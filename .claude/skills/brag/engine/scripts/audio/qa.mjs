/**
 * Audio QA on the rendered MP4 + export of inspectable stems.
 * All measurements come from the final file (ffprobe/ffmpeg), not from the plan.
 */
import fs from 'node:fs';
import path from 'node:path';
import {ff, levels, probe, silences} from './ffmpeg.mjs';

const r2 = (x) => Math.round(x * 100) / 100;

export function auditAudio(video, plan, {fps, videoDuration}) {
  const errors = [];
  const warnings = [];
  const metrics = {};
  const p = probe(video);
  const a = p.streams.find((s) => s.codec_type === 'audio');
  if (!a) {
    errors.push('Audio was requested but the MP4 has no audio stream');
    return {errors, warnings, metrics};
  }
  const aDur = Number(a.duration ?? p.format.duration);
  Object.assign(metrics, {codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels, bitRate: Number(a.bit_rate) || null, audioDuration: r2(aDur), videoDuration: r2(videoDuration)});
  if (!['aac', 'mp3'].includes(a.codec_name)) errors.push(`Unexpected audio codec ${a.codec_name}`);
  if (Number(a.sample_rate) < 44100) errors.push(`Audio sample rate ${a.sample_rate} Hz is too low`);
  if (a.channels < 1) errors.push('Audio has no channels');
  if (Math.abs(aDur - videoDuration) > 0.1) errors.push(`Audio lasts ${aDur.toFixed(3)}s but the video ${videoDuration.toFixed(3)}s`);
  if (aDur > videoDuration + 1 / fps + 0.06) errors.push('Audio continues after the final frame');

  // whole-mix level / clipping
  const whole = levels(video);
  metrics.peakDb = whole.max;
  metrics.meanDb = whole.mean;
  if (whole.max >= -0.05) errors.push(`Final mix clips (peak ${whole.max} dBFS)`);
  else if (whole.max > -0.8) warnings.push(`Final mix peaks at ${whole.max} dBFS (very hot)`);
  if (whole.mean < -45) errors.push(`Final mix is nearly silent (mean ${whole.mean} dB)`);

  // voice windows vs music-only windows
  const voice = plan.voicePlaced ?? [];
  if (voice.length) {
    const vLevels = voice.map((v) => ({text: v.text, ...levels(video, v.start, v.duration)}));
    metrics.voiceWindows = vLevels.map((l) => ({text: l.text.slice(0, 40), meanDb: l.mean, peakDb: l.max}));
    for (const l of vLevels) if (l.mean < -38) errors.push(`Voice line "${l.text.slice(0, 40)}" is barely audible in the mix (${l.mean} dB)`);
    if (plan.music) {
      // music-only gaps (≥0.5s, away from fades)
      const gaps = [];
      let cursor = plan.music.fadeIn + 0.2;
      for (const v of voice) { if (v.start - 0.1 - cursor >= 0.5) gaps.push([cursor, v.start - 0.1]); cursor = Math.max(cursor, v.start + v.duration + 0.4); }
      if (plan.total - plan.music.fadeOut - cursor >= 0.5) gaps.push([cursor, plan.total - plan.music.fadeOut]);
      const mLevels = gaps.map(([s, e]) => levels(video, s, e - s));
      const vMean = Math.max(...vLevels.map((l) => l.mean));
      const vMed = vLevels.map((l) => l.mean).sort((x, y) => x - y)[Math.floor(vLevels.length / 2)];
      if (mLevels.length) {
        const mMean = Math.max(...mLevels.map((l) => l.mean));
        metrics.musicOnlyMeanDb = mMean;
        metrics.voiceOverMusicDb = r2(vMed - mMean);
        if (vMed - mMean < 3) errors.push(`Voice is not clearly louder than the music (voice ${vMed} dB vs music-only ${mMean} dB). Lower music.volume.`);
      }
      // measured from the actual source files + the gains used in the mix (works even with no music-only gaps)
      const db = (g) => 20 * Math.log10(Math.max(1e-4, g));
      // RMS level (volumedetect) — unlike LUFS it is valid for short lines (< 400 ms)
      const voiceRms = voice.map((v) => levels(v.file).mean).sort((x, y) => x - y);
      const voiceLufs = voiceRms[Math.floor(voiceRms.length / 2)] + db(plan.resolved.voice[0]?.volume ?? 1);
      const musicUnderVoice = levels(plan.music.file).mean + db(plan.music.duck ? plan.music.duckVolume : plan.music.volume);
      metrics.voiceRmsDb = r2(voiceLufs);
      metrics.voiceOverDuckedMusicDb = r2(voiceLufs - musicUnderVoice);
      if (voiceLufs - musicUnderVoice < 6) errors.push(`Music under the voice is only ${(voiceLufs - musicUnderVoice).toFixed(1)} dB below it — lower music.duckVolume/volume.`);
      else if (voiceLufs - musicUnderVoice < 12) warnings.push(`Music under the voice is ${(voiceLufs - musicUnderVoice).toFixed(1)} dB below it; ≥12 dB is clearer.`);
      void vMean;
    }
  }

  // unexpected silences
  const sil = silences(video, -50, plan.music ? 0.8 : 2.5).filter((s) => s.start > 0.4 && s.start < videoDuration - 0.6);
  metrics.silences = sil.map((s) => [r2(s.start), r2(Math.min(s.end, videoDuration))]);
  for (const s of sil) warnings.push(`Silent gap ${s.start.toFixed(2)}–${Math.min(s.end, videoDuration).toFixed(2)}s`);

  // CTA moment should not be silent
  const cta = levels(video, Math.max(0, videoDuration - 1.8), 1.3);
  metrics.ctaMeanDb = cta.mean;
  if (cta.mean < -48) errors.push(`No audible audio under the final CTA (${cta.mean} dB)`);

  // SFX must sit inside the video
  for (const s of plan.sfx ?? []) if (s.start + s.duration > videoDuration + 0.02) errors.push(`SFX ${s.type} runs past the end of the video`);
  return {errors, warnings, metrics};
}

/** Write audio/ stems: voiceover.mp3, music.mp3 (as mixed: looped, trimmed, faded, ducked), sfx/*, audio-timeline.json. */
export function exportStems(plan, dir) {
  fs.mkdirSync(path.join(dir, 'sfx'), {recursive: true});
  const T = plan.total.toFixed(3);
  const mp3 = ['-c:a', 'libmp3lame', '-b:a', '192k'];
  if (plan.voicePlaced?.length) {
    const inputs = plan.voicePlaced.flatMap((v) => ['-i', v.file]);
    const graph = plan.voicePlaced.map((v, i) => `[${i}]adelay=${Math.round(v.start * 1000)}:all=1[v${i}]`).join(';')
      + `;${plan.voicePlaced.map((_, i) => `[v${i}]`).join('')}amix=inputs=${plan.voicePlaced.length}:normalize=0,apad,atrim=0:${T}[out]`;
    ff([...inputs, '-filter_complex', graph, '-map', '[out]', ...mp3, path.join(dir, 'voiceover.mp3')]);
  }
  if (plan.music) {
    const m = plan.music;
    const ducks = m.duck ? (plan.timeline.music.duckRanges || []).map(([a, b]) => `between(t,${a},${b})`).join('+') : '';
    const gain = ducks ? `(${m.volume}-(${m.volume}-${m.duckVolume})*min(1,${ducks}))` : `${m.volume}`;
    const vol = `${gain}*min(1,t/${m.fadeIn})*min(1,max(0,(${T}-t)/${m.fadeOut}))`;
    ff([...(m.loop ? ['-stream_loop', '-1'] : []), '-ss', String(m.startAt), '-i', m.file, '-af', `volume=eval=frame:volume='${vol}',apad,atrim=0:${T}`, ...mp3, path.join(dir, 'music.mp3')]);
  }
  const seen = new Set();
  for (const s of plan.sfx ?? []) {
    const name = path.basename(s.file);
    if (seen.has(name)) continue;
    seen.add(name);
    fs.copyFileSync(s.file, path.join(dir, 'sfx', name));
  }
  if (!seen.size) fs.rmSync(path.join(dir, 'sfx'), {recursive: true, force: true});
  fs.writeFileSync(path.join(dir, 'audio-timeline.json'), JSON.stringify(plan.timeline, null, 2));
}
