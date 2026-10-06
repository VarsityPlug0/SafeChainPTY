/**
 * Audio planner: turns spec.audio into
 *   - adjusted scene durations (visuals follow the narration; speech is never stretched to fit)
 *   - a frame-accurate `audioResolved` object for the Remotion composition (voice, music, sfx)
 *   - a human-readable timeline (audio-timeline.json) and per-scene storyboard notes
 */
import fs from 'node:fs';
import path from 'node:path';
import {AUDIO_PRESETS, localVoiceFor} from './presets.mjs';
import {AudioError, duration, toWav} from './ffmpeg.mjs';
import {demoMusicFile, musicDescription, sfxFile, SFX_ALIASES, SFX_NAMES} from './library.mjs';
import {elevenLabsTts, fileLines, fileSingle, localTts, neuralAvailable, neuralSetupError, neuralTts, neuralVoiceFor} from './voice.mjs';

const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
const VOICE_EXT = /\.(mp3|wav|m4a)$/i;
const MUSIC_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;

/** Shortest a scene may become when re-timed to narration (its animation must still read). */
export const SCENE_MIN = {
  hook: 1.6, statement: 1.6, productReveal: 2.0, productZoom: 1.6, features: 2.4, beforeAfter: 2.4,
  price: 1.8, sale: 1.8, logo: 1.6, cta: 2.2, final: 2.6,
};
const GAP = 0.15;                       // pause between two lines in the same scene
const lead = (i, t) => (i === 0 ? 0.2 : Math.min(0.35, t * 0.7));   // voice starts as the scene lands
const tail = (i, n, t) => (i === n - 1 ? 0.9 : t + 0.2);            // finish before the next transition

const r3 = (x) => Math.round(x * 1000) / 1000;
const sum = (a) => a.reduce((x, y) => x + y, 0);

/** Normalise spec.audio. Returns null when the ad has no audio (visual-only path, unchanged). */
export function normalizeAudio(spec) {
  const a = spec.audio;
  if (!a) return null;
  if (typeof a === 'string') {
    // legacy: "audio": "file.mp3" = one music/voice bed at full volume with short fades
    return {enabled: true, legacy: true, music: {audioFile: a, volume: 1, duckUnderVoice: false, fadeIn: 1 / 3, fadeOut: 2 / 3, loop: false}, sfx: 'none'};
  }
  if (typeof a !== 'object' || a.enabled === false) return null;
  return a;
}

/** Split free narration text into one line per scene (sentences in order). */
const linesFromText = (text, sceneCount) => {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const lines = sentences.slice(0, sceneCount).map((s, i) => ({scene: i, text: s}));
  if (sentences.length > sceneCount && lines.length) lines[lines.length - 1].text += ` ${sentences.slice(sceneCount).join(' ')}`;
  return lines;
};

const emotionSettings = (emotion) => {
  const e = (emotion || '').toLowerCase();
  if (/energetic|excited|hype|upbeat|fast/.test(e)) return {stability: 0.35, style: 0.6};
  if (/calm|deep|luxury|warm|soft|cinematic/.test(e)) return {stability: 0.7, style: 0.15};
  return {};
};

/**
 * @param spec   the (already validated) ad spec — scenes are mutated to the re-timed durations
 * @param ctx    {fps, transition, abs(path)=>absolute path, workDir (inside public/), publicPrefix}
 */
export async function planAudio(spec, ctx) {
  const audio = normalizeAudio(spec);
  if (!audio) return {enabled: false};
  const {fps, transition: t, abs, workDir, publicPrefix} = ctx;
  const errors = [];
  const warnings = [];
  const styleKey = audio.preset ?? spec.style;
  const preset = AUDIO_PRESETS[styleKey] ?? AUDIO_PRESETS.clean;
  const n = spec.scenes.length;
  fs.mkdirSync(workDir, {recursive: true});
  const fileOk = (p, re, where) => {
    const f = abs(p);
    if (!fs.existsSync(f)) { errors.push(`Missing audio file for ${where}: ${f}`); return null; }
    if (!re.test(f)) { errors.push(`Unsupported audio type for ${where}: ${f} (use ${re.source.replace(/[\\()$/i]/g, '').replace(/\|/g, ', ')})`); return null; }
    return f;
  };

  // ---------------- voiceover ----------------
  const vo = audio.voiceover && audio.voiceover.enabled !== false ? audio.voiceover : null;
  let segments = [];               // {scene, text, file, duration}
  let voiceInfo = null;
  let continuous = false;
  if (vo) {
    let lines = [];
    if (Array.isArray(vo.script) && vo.script.length) {
      for (const [k, l] of vo.script.entries()) {
        if (!Number.isInteger(l.scene) || l.scene < 0 || l.scene >= n) errors.push(`voiceover.script[${k}].scene must be a scene index 0–${n - 1}`);
        if (!l.text && !l.audioFile) errors.push(`voiceover.script[${k}] needs text`);
        lines.push({scene: l.scene, text: l.text ?? '', say: l.say, audioFile: l.audioFile ? fileOk(l.audioFile, VOICE_EXT, `voiceover.script[${k}].audioFile`) : null});
      }
      lines.sort((a, b) => a.scene - b.scene);
    } else if (vo.text) {
      lines = linesFromText(vo.text, n);
    }
    // brand pronunciation (e.g. from the brand preset) applies to lines without an explicit "say"
    const said = spec.brand?.pronunciation;
    if (said && spec.brand?.name) {
      const re = new RegExp(spec.brand.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      lines = lines.map((l) => (l.say || !re.test(l.text) ? l : {...l, say: l.text.replace(re, said)}));
    }
    const userFile = vo.audioFile ? fileOk(vo.audioFile, VOICE_EXT, 'voiceover.audioFile') : null;
    const requested = vo.provider ?? (vo.audioFile || (lines.length && lines.every((l) => l.audioFile)) ? 'file' : process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'local');
    if (!['file', 'local', 'neural', 'flite', 'elevenlabs'].includes(requested)) errors.push(`voiceover.provider must be "elevenlabs", "local", "neural", "flite" or "file"`);
    // "local" = the best offline voice available: natural neural voice if installed, else robotic Flite (DEMO)
    let provider = requested;
    if (requested === 'local') {
      provider = neuralAvailable() ? 'neural' : 'flite';
      if (provider === 'flite') warnings.push('Natural local voice not installed (run engine/scripts/setup-voice.sh) — using the robotic Flite DEMO voice.');
    }
    if (provider === 'neural' && !neuralAvailable()) errors.push(neuralSetupError().message);
    if (provider !== 'file' && !lines.length) errors.push('voiceover needs a script (voiceover.script lines with scene + text) or voiceover.text');
    if (provider === 'file' && !userFile && !(lines.length && lines.every((l) => l.audioFile))) errors.push('voiceover.provider "file" needs voiceover.audioFile (or an audioFile on every script line)');
    if (!vo.provider && requested === 'local') warnings.push(`No voice provider set and ELEVENLABS_API_KEY is not available: using the local ${provider === 'neural' ? 'neural voice (Kokoro)' : 'DEMO voice (Flite)'}.`);
    if (errors.length) return {enabled: true, errors, warnings};

    const speed = vo.speed ?? preset.voice.speed;
    try {
      if (provider === 'neural') {
        const voice = neuralVoiceFor(vo.voice, preset.voice.neural);
        segments = neuralTts(lines, {voice, speed, workDir}).map((s, i) => ({...s, scene: lines[i].scene, text: lines[i].text}));
        voiceInfo = {provider: requested === 'local' ? 'local' : 'neural', engine: 'kokoro', voice: `kokoro:${voice}`, demo: false};
      } else if (provider === 'flite') {
        const voice = localVoiceFor(vo.voice, preset.voice.local);
        segments = localTts(lines, {voice, speed, workDir}).map((s, i) => ({...s, scene: lines[i].scene, text: lines[i].text}));
        voiceInfo = {provider: requested === 'local' ? 'local' : 'flite', engine: 'flite', voice: `flite:${voice}`, demo: true};
      } else if (provider === 'elevenlabs') {
        const emo = emotionSettings(vo.emotion);
        const res = await elevenLabsTts(lines, {
          voice: vo.voice, presetDescription: preset.voice.elevenlabs, speed, model: vo.model, workDir,
          stability: emo.stability ?? preset.voice.stability, style: emo.style ?? preset.voice.style,
        });
        segments = res.segments.map((s, i) => ({...s, scene: lines[i].scene, text: lines[i].text}));
        voiceInfo = {provider, voice: `${res.voice.name} (${res.voice.id})`, demo: false};
      } else if (userFile) {
        const res = fileSingle(userFile, Math.max(1, lines.length), {workDir, speed: vo.speed ?? 1});
        if (res.mode === 'phrases') {
          segments = res.segments.map((s, i) => ({...s, scene: lines[i].scene, text: lines[i].text}));
        } else {
          continuous = true;
          segments = [{...res.segments[0], scene: lines[0]?.scene ?? 0, text: lines.map((l) => l.text).join(' ') || '(recorded voiceover)'}];
          if (lines.length > 1) warnings.push(`Could not split the voice file into ${lines.length} phrases at pauses — it plays as one continuous take and scenes are scaled to fit it.`);
        }
        voiceInfo = {provider, voice: path.basename(userFile), demo: false, mode: res.mode};
      } else {
        segments = fileLines(lines, {workDir, speed: vo.speed ?? 1}).map((s, i) => ({...s, scene: lines[i].scene, text: lines[i].text}));
        voiceInfo = {provider, voice: 'user files', demo: false, mode: 'per-line'};
      }
    } catch (e) {
      if (e instanceof AudioError) return {enabled: true, errors: [e.message], warnings};
      throw e;
    }
  }

  // ---------------- scene timing (visuals follow the voice) ----------------
  const planned = spec.scenes.map((s) => s.duration);
  const target = sum(planned) - t * (n - 1);
  const sync = audio.sync ?? 'voice';
  let final = [...planned];
  const need = planned.map(() => 0);
  if (segments.length && !continuous) {
    for (let i = 0; i < n; i++) {
      const segs = segments.filter((s) => s.scene === i);
      if (segs.length) need[i] = lead(i, t) + sum(segs.map((s) => s.duration)) + GAP * (segs.length - 1) + tail(i, n, t);
    }
    if (sync === 'fixed') {
      need.forEach((d, i) => { if (d > planned[i] + 1e-6) errors.push(`Voice line for scene ${i + 1} (${spec.scenes[i].type}) needs ${d.toFixed(2)}s but the scene is ${planned[i]}s (sync "fixed"). Shorten the line or use sync "voice".`); });
    } else {
      final = planned.map((p, i) => (need[i] ? Math.max(SCENE_MIN[spec.scenes[i].type] ?? 1.6, need[i]) : p));
      let total = sum(final) - t * (n - 1);
      if (total < target) {
        // voice is shorter than planned: give scenes back their planned length (no rushed visuals)
        let slack = target - total;
        const room = final.map((f, i) => Math.max(0, planned[i] - f));
        const roomSum = sum(room);
        if (roomSum > 0) final = final.map((f, i) => f + (room[i] / roomSum) * Math.min(slack, roomSum));
        total = sum(final) - t * (n - 1);
        if (total < target - 1e-6) final[n - 1] += target - total;
      } else if (total > target) {
        // voice is longer: tighten scenes that have slack (never below their voice need / minimum)
        let excess = total - target;
        const floor = final.map((f, i) => Math.max(SCENE_MIN[spec.scenes[i].type] ?? 1.6, need[i]));
        const room = final.map((f, i) => Math.max(0, f - floor[i]));
        const roomSum = sum(room);
        if (roomSum > 0) final = final.map((f, i) => f - (room[i] / roomSum) * Math.min(excess, roomSum));
      }
    }
  } else if (continuous) {
    const needTotal = lead(0, t) + segments[0].duration + 0.9;
    if (needTotal > target) {
      if (sync === 'fixed') errors.push(`The voice file lasts ${segments[0].duration.toFixed(2)}s but the ad is ${target.toFixed(2)}s (sync "fixed").`);
      else { const k = (needTotal + t * (n - 1)) / sum(planned); final = planned.map((p) => p * k); }
    }
  }
  final = final.map((d) => Math.round(d * fps) / fps);
  const starts = [];
  final.forEach((d, i) => starts.push(i === 0 ? 0 : starts[i - 1] + final[i - 1] - t));
  const total = r3(starts[n - 1] + final[n - 1]);
  if (Math.abs(total - target) > 0.05) {
    const msg = `Scenes re-timed to the narration: ${target.toFixed(2)}s planned → ${total.toFixed(2)}s.`;
    warnings.push(total > target * 1.15 ? `${msg} The narration is longer than the requested duration — shorten the script to hit ${target.toFixed(1)}s.` : msg);
  }
  if (total > 60) errors.push(`Narration makes the ad ${total.toFixed(1)}s long (max 60s). Shorten the script.`);
  spec.scenes.forEach((s, i) => { s.duration = final[i]; });

  // place voice
  const voicePlaced = [];
  if (continuous) {
    voicePlaced.push({...segments[0], start: lead(0, t)});
  } else {
    for (let i = 0; i < n; i++) {
      let cursor = starts[i] + lead(i, t);
      for (const s of segments.filter((x) => x.scene === i)) {
        voicePlaced.push({...s, start: cursor});
        cursor += s.duration + GAP;
      }
    }
  }
  for (const v of voicePlaced) {
    if (v.start + v.duration > total - 0.05) errors.push(`Voice line "${v.text.slice(0, 40)}" would be cut off at the end of the video.`);
  }

  // ---------------- music ----------------
  let music = null;
  if (audio.music && audio.music.enabled !== false) {
    const m = audio.music;
    const userMusic = m.audioFile && m.audioFile !== 'demo' ? fileOk(m.audioFile, MUSIC_EXT, 'music.audioFile') : null;
    if (m.audioFile && m.audioFile !== 'demo' && !userMusic) return {enabled: true, errors, warnings};
    const srcFile = userMusic ?? demoMusicFile(styleKey);
    const out = path.join(workDir, 'music.wav');
    toWav(srcFile, out, {lufsTarget: audio.legacy ? null : -16});
    const mdur = duration(out);
    const startAt = m.startAt ?? 0;
    const loop = m.loop ?? !audio.legacy;
    const hasVoice = voicePlaced.length > 0;
    music = {
      file: out, source: userMusic ? path.basename(userMusic) : `DEMO MUSIC (${styleKey}: ${musicDescription(styleKey)}, generated locally)`,
      demo: !userMusic, duration: mdur, startAt, loop,
      volume: m.volume ?? preset.music.volume, duckVolume: m.duckVolume ?? preset.music.duckVolume,
      duck: (m.duckUnderVoice ?? true) && hasVoice, fadeIn: m.fadeIn ?? 0.6, fadeOut: m.fadeOut ?? 1.2,
    };
    if (music.duckVolume > music.volume) warnings.push('music.duckVolume is higher than music.volume — ducking will raise the music.');
    if (!loop && mdur - startAt < total - 0.3) warnings.push(`Music (${(mdur - startAt).toFixed(1)}s) is shorter than the video (${total.toFixed(1)}s) and loop is off — the end will be silent.`);
  }
  // merge voice into duck ranges
  const duckRanges = [];
  for (const v of voicePlaced) {
    const a = Math.max(0, v.start - 0.05);
    const b = Math.min(total, v.start + v.duration + 0.05);
    const last = duckRanges[duckRanges.length - 1];
    if (last && a - last[1] < 0.4) last[1] = b; else duckRanges.push([a, b]);
  }

  // ---------------- sound effects ----------------
  const lib = audio.sfxLibrary ?? {};
  const sfxFor = (type, where) => {
    if (lib[type]) return fileOk(lib[type], AUDIO_EXT, `sfxLibrary.${type}`);
    const f = sfxFile(type);
    if (!f) errors.push(`Unknown sound effect "${type}" in ${where}. Built-in: ${SFX_NAMES.join(', ')} (aliases: ${Object.keys(SFX_ALIASES).join(', ')}), or give an audioFile / sfxLibrary entry.`);
    return f;
  };
  const mode = audio.sfx === undefined ? 'auto' : audio.sfx;
  let cues = [];
  if (Array.isArray(mode)) {
    mode.forEach((c, k) => {
      const where = `sfx[${k}]`;
      const start = c.time ?? (Number.isInteger(c.scene) ? starts[c.scene] + (c.offset ?? 0) : null);
      if (start == null) { errors.push(`${where} needs "time" (seconds) or "scene" (+ optional "offset")`); return; }
      const file = c.audioFile ? fileOk(c.audioFile, AUDIO_EXT, where) : sfxFor(c.type, where);
      if (file) cues.push({type: c.type ?? path.basename(file), file, start, volume: c.volume ?? 0.6, maxDuration: c.duration, reason: 'requested'});
    });
  } else if (mode === 'auto') {
    const candidates = [];
    spec.scenes.forEach((s, i) => {
      for (const [name, offset, priority, volume] of preset.sceneSfx[s.type] ?? []) {
        candidates.push({type: name, start: starts[i] + offset, priority, volume, reason: `${s.type} (scene ${i + 1})`});
      }
      if (i > 0 && preset.transitionSfx) {
        const [name, priority, volume] = preset.transitionSfx;
        candidates.push({type: name, start: starts[i] + t * 0.15, priority, volume, reason: `transition into scene ${i + 1}`});
      }
    });
    const budget = audio.maxSfx ?? Math.round(preset.maxSfx * Math.min(1.5, Math.max(0.7, total / 15)));
    const chosen = [];
    for (const c of [...candidates].sort((a, b) => a.priority - b.priority || a.start - b.start)) {
      if (chosen.length >= budget) break;
      if (chosen.some((x) => Math.abs(x.start - c.start) < 0.35)) continue;
      chosen.push(c);
    }
    // effects that land under speech are softened (≈-4 dB) so they never mask the voice
    const underVoice = (x) => voicePlaced.some((v) => x >= v.start - 0.05 && x <= v.start + v.duration);
    cues = chosen.map((c) => ({...c, volume: underVoice(c.start) ? r3(c.volume * 0.6) : c.volume, file: sfxFor(c.type, 'auto')}));
  } else if (mode !== 'none') {
    errors.push('audio.sfx must be "auto", "none" or a list of cues');
  }
  const sfx = [];
  for (const c of cues.sort((a, b) => a.start - b.start)) {
    if (!c.file) continue;
    const fdur = duration(c.file);
    let start = Math.max(0, c.start);
    if (start > total - 0.1) { warnings.push(`Sound effect "${c.type}" at ${c.start.toFixed(2)}s is after the end of the video — dropped.`); continue; }
    let dur = Math.min(fdur, c.maxDuration ?? fdur);
    if (start + dur > total) { dur = total - start; if (c.reason === 'requested') warnings.push(`Sound effect "${c.type}" trimmed to end with the video.`); }
    sfx.push({...c, start: r3(start), duration: r3(dur)});
  }
  if (errors.length) return {enabled: true, errors, warnings};

  // ---------------- copy into public/ and build the composition object ----------------
  const pub = (file, name) => {
    const dest = path.join(workDir, name);
    if (path.resolve(file) !== path.resolve(dest)) { fs.mkdirSync(path.dirname(dest), {recursive: true}); fs.copyFileSync(file, dest); }
    return `${publicPrefix}/${name}`;
  };
  const f = (s) => Math.round(s * fps);
  const totalFrames = f(total);
  const resolved = {
    label: [voiceInfo?.demo && 'DEMO AUDIO (local Flite voice)', music?.demo && 'DEMO MUSIC'].filter(Boolean).join(' · ') || null,
    voice: voicePlaced.map((v) => ({
      src: pub(v.file, path.basename(v.file)), from: f(v.start),
      durationInFrames: Math.min(Math.ceil(v.duration * fps) + 2, totalFrames - f(v.start)), volume: vo?.volume ?? 1, text: v.text,
    })),
    music: music && {
      src: pub(music.file, 'music.wav'), volume: music.volume, duckVolume: music.duckVolume, duck: music.duck, loop: music.loop,
      fadeInFrames: Math.max(1, f(music.fadeIn)), fadeOutFrames: Math.max(1, f(music.fadeOut)),
      attackFrames: Math.max(1, f(0.12)), releaseFrames: Math.max(1, f(0.3)),
      duckRanges: duckRanges.map(([a, b]) => [f(a), f(b)]), trimBeforeFrames: f(music.startAt),
    },
    sfx: sfx.map((s, k) => ({src: pub(s.file, `sfx/${k}-${path.basename(s.file)}`), from: f(s.start), durationInFrames: Math.max(1, Math.ceil(s.duration * fps)), volume: s.volume, type: s.type})),
  };

  const timeline = {
    version: 1,
    duration: total,
    fps,
    label: resolved.label,
    sync: {mode: continuous ? 'continuous-take' : sync, targetDuration: r3(target), finalDuration: total,
      scenes: spec.scenes.map((s, i) => ({index: i, type: s.type, start: r3(starts[i]), end: r3(starts[i] + final[i]), planned: planned[i], final: r3(final[i])}))},
    voiceover: voiceInfo && {...voiceInfo, segments: voicePlaced.map((v) => ({scene: v.scene, start: r3(v.start), end: r3(v.start + v.duration), text: v.text}))},
    music: music && {source: music.source, demo: music.demo, start: 0, end: total, volume: music.volume, duckVolume: music.duckVolume,
      ducking: music.duck, duckRanges: duckRanges.map(([a, b]) => [r3(a), r3(b)]), fadeIn: music.fadeIn, fadeOut: music.fadeOut, loop: music.loop, fileDuration: r3(music.duration)},
    sfx: sfx.map((s) => ({type: s.type, start: s.start, end: r3(s.start + s.duration), volume: s.volume, reason: s.reason})),
  };

  // per-scene notes for the storyboard
  const notes = spec.scenes.map((s, i) => {
    const a = starts[i];
    const b = starts[i] + final[i];
    // each event belongs to exactly one scene: from this scene's start until the next one starts
    const ownEnd = i < n - 1 ? starts[i + 1] : b + 1;
    const inScene = (x) => x >= a - 0.01 && x < ownEnd - 0.01; // tolerance for ms rounding at boundaries
    const voice = voicePlaced.filter((v) => inScene(v.start)).map((v) => `"${v.text}" (${v.start.toFixed(2)}–${(v.start + v.duration).toFixed(2)}s)`);
    let mus = '—';
    if (music) {
      const ducked = duckRanges.some(([x, y]) => x < b && y > a);
      mus = i === 0 ? `${music.source} fades in${ducked ? ', ducked under voice' : ''}` : i === n - 1 ? `${ducked ? 'ducked under voice, then ' : ''}lifts and fades out` : ducked ? 'ducked under voice' : 'full bed';
    }
    return {voice: voice.join(' · ') || '—', music: mus, sfx: sfx.filter((x) => inScene(x.start)).map((x) => `${x.type} @${x.start.toFixed(2)}s`).join(', ') || '—'};
  });

  return {enabled: true, errors, warnings, resolved, timeline, notes, total, voicePlaced, music, sfx, voiceInfo, workDir};
}
