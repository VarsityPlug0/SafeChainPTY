// Small, synchronous ffmpeg/ffprobe helpers used by the audio pipeline and QA.
import {execFileSync, spawnSync} from 'node:child_process';

export class AudioError extends Error {}

export const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) throw new AudioError(`ffmpeg failed: ${(r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ')}`);
  return r.stderr || '';
};

/** Run an analysis filter (output discarded) and return ffmpeg's log. */
export const analyze = (inputArgs, filter) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...inputArgs, '-af', filter, '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  if (r.status !== 0) throw new AudioError(`ffmpeg analysis failed: ${(r.stderr || '').split('\n').slice(-3).join(' | ')}`);
  return r.stderr;
};

export const probe = (file) =>
  JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString());

export const duration = (file) => {
  const p = probe(file);
  const a = p.streams.find((s) => s.codec_type === 'audio');
  if (!a) throw new AudioError(`No audio stream in ${file}`);
  return Number(a.duration ?? p.format.duration);
};

/** {mean, max} in dBFS for a file or a time window of it. */
export const levels = (file, start = null, dur = null) => {
  const input = [...(start != null ? ['-ss', String(start)] : []), ...(dur != null ? ['-t', String(dur)] : []), '-i', file];
  const log = analyze(input, 'volumedetect');
  const mean = Number(/mean_volume: (-?[\d.]+|-inf) dB/.exec(log)?.[1] ?? -Infinity);
  const max = Number(/max_volume: (-?[\d.]+|-inf) dB/.exec(log)?.[1] ?? -Infinity);
  return {mean: Number.isFinite(mean) ? mean : -120, max: Number.isFinite(max) ? max : -120};
};

/** Integrated loudness (LUFS) via EBU R128. */
export const lufs = (file) => {
  const log = analyze(['-i', file], 'ebur128=framelog=quiet');
  const m = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(log);
  return m ? Number(m[1]) : -70;
};

/** Silent intervals [{start, end}] below `noise` dB lasting at least `min` seconds. */
export const silences = (file, noise = -45, min = 0.25) => {
  const log = analyze(['-i', file], `silencedetect=noise=${noise}dB:d=${min}`);
  const out = [];
  let start = null;
  for (const line of log.split('\n')) {
    const s = /silence_start: (-?[\d.]+)/.exec(line);
    const e = /silence_end: (-?[\d.]+)/.exec(line);
    if (s) start = Math.max(0, Number(s[1]));
    if (e && start != null) { out.push({start, end: Number(e[1])}); start = null; }
  }
  if (start != null) out.push({start, end: Infinity});
  return out;
};

/** Convert any audio file to 48 kHz stereo WAV, optionally loudness-normalised. */
export const toWav = (input, output, {lufsTarget = null, extraFilters = []} = {}) => {
  const filters = [...extraFilters];
  if (lufsTarget != null) filters.push(`loudnorm=I=${lufsTarget}:TP=-1.5:LRA=11`);
  filters.push('aresample=48000', 'aformat=sample_fmts=s16:channel_layouts=stereo');
  ff(['-i', input, '-af', filters.join(','), '-ar', '48000', '-ac', '2', output]);
  return output;
};

export const hasFlite = () => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-filters'], {encoding: 'utf8'});
  return /\bflite\b/.test(r.stdout || '');
};
