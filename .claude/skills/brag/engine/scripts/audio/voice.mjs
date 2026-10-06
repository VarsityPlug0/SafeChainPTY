/**
 * Voiceover providers. Every provider returns per-line WAV files (48 kHz stereo,
 * loudness-normalised to -16 LUFS) plus their measured durations.
 *
 *   file        user-supplied recording(s)
 *   local       offline Flite TTS built into ffmpeg (robotic; labelled DEMO AUDIO)
 *   elevenlabs  ElevenLabs API (needs ELEVENLABS_API_KEY)
 */
import fs from 'node:fs';
import path from 'node:path';
import {AudioError, duration, ff, hasFlite, silences, toWav} from './ffmpeg.mjs';
import {localVoiceFor} from './presets.mjs';

const VOICE_LUFS = -16;

const tempoFilter = (speed) => {
  if (!speed || Math.abs(speed - 1) < 0.01) return [];
  if (speed < 0.8 || speed > 1.25) throw new AudioError(`voiceover.speed ${speed} is outside 0.8–1.25 (speech would sound unnatural)`);
  return [`atempo=${speed}`];
};

/** Trim leading/trailing silence so measured durations are the real speech length. */
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse';

const finish = (raw, out, speed) => {
  toWav(raw, out, {lufsTarget: VOICE_LUFS, extraFilters: [TRIM, 'highpass=f=70', ...tempoFilter(speed)]});
  return {file: out, duration: duration(out)};
};

// ---------- local (Flite) ----------
export const localTts = (lines, {voice, speed, workDir}) => {
  if (!hasFlite()) {
    throw new AudioError('Local voiceover needs ffmpeg built with libflite (not available here). Provide a recorded voice file (voiceover.provider "file") or use ElevenLabs (set ELEVENLABS_API_KEY).');
  }
  return lines.map((line, i) => {
    const txt = path.join(workDir, `voice-${i}.txt`);
    fs.writeFileSync(txt, line.say ?? line.text);
    const raw = path.join(workDir, `voice-${i}.raw.wav`);
    ff(['-f', 'lavfi', '-i', `flite=textfile=${txt}:voice=${voice}`, raw]);
    const res = finish(raw, path.join(workDir, `voice-${i}.wav`), speed);
    fs.rmSync(raw, {force: true});
    fs.rmSync(txt, {force: true});
    return res;
  });
};

// ---------- ElevenLabs ----------
const API = () => (process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '');

export const elevenLabsKeyError = () =>
  new AudioError(
    'ElevenLabs voiceover requested but ELEVENLABS_API_KEY is not set. Set it in the environment ' +
    '(export ELEVENLABS_API_KEY=...; never put it in the spec or source), or provide a recorded voice file ' +
    '(voiceover.provider "file", voiceover.audioFile "voiceover.mp3"), or use voiceover.provider "local" for a DEMO voice.',
  );

const looksLikeVoiceId = (v) => /^[A-Za-z0-9]{18,24}$/.test(v || '');

async function resolveVoiceId(request, presetDescription, key) {
  if (looksLikeVoiceId(request)) return {id: request, name: request};
  const res = await fetch(`${API()}/v1/voices`, {headers: {'xi-api-key': key}});
  if (!res.ok) throw new AudioError(`ElevenLabs: could not list voices (HTTP ${res.status}). ${res.status === 401 ? 'Check ELEVENLABS_API_KEY.' : ''}`);
  const voices = (await res.json()).voices ?? [];
  if (!voices.length) throw new AudioError('ElevenLabs: this account has no voices available.');
  const want = (request || presetDescription || '').toLowerCase();
  const byName = voices.find((v) => want && v.name && want.includes(v.name.toLowerCase()));
  if (byName) return {id: byName.voice_id, name: byName.name};
  const words = want.split(/[^a-z]+/).filter((w) => w.length > 2);
  const score = (v) => {
    const hay = [v.name, v.description, ...Object.values(v.labels ?? {})].join(' ').toLowerCase();
    return words.reduce((s, w) => s + (hay.includes(w) ? (w === 'male' && hay.includes('female') ? 0 : 1) : 0), 0);
  };
  const best = [...voices].sort((a, b) => score(b) - score(a))[0];
  return {id: best.voice_id, name: best.name};
}

export async function elevenLabsTts(lines, {voice, presetDescription, speed, stability = 0.5, style = 0.3, model, workDir}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw elevenLabsKeyError();
  const chosen = await resolveVoiceId(voice, presetDescription, key);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const res = await fetch(`${API()}/v1/text-to-speech/${chosen.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg'},
      body: JSON.stringify({
        text: lines[i].say ?? lines[i].text,
        model_id: model || 'eleven_multilingual_v2',
        previous_text: i > 0 ? lines[i - 1].say ?? lines[i - 1].text : undefined,
        next_text: i < lines.length - 1 ? lines[i + 1].say ?? lines[i + 1].text : undefined,
        voice_settings: {stability, similarity_boost: 0.75, style, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed || 1))},
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AudioError(`ElevenLabs TTS failed for line ${i + 1} (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const raw = path.join(workDir, `voice-${i}.raw.mp3`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    // ElevenLabs already applies `speed`; don't time-stretch again.
    out.push(finish(raw, path.join(workDir, `voice-${i}.wav`), 1));
    fs.rmSync(raw, {force: true});
  }
  return {segments: out, voice: chosen};
}

// ---------- user files ----------
/** One file per line. */
export const fileLines = (lines, {workDir, speed}) =>
  lines.map((line, i) => finish(line.audioFile, path.join(workDir, `voice-${i}.wav`), speed));

/**
 * A single recording for the whole ad. If it splits cleanly at pauses into as
 * many phrases as there are script lines, each phrase is cut out so scenes can
 * be timed to it; otherwise it plays as one continuous take.
 */
export function fileSingle(file, lineCount, {workDir, speed}) {
  const whole = finish(file, path.join(workDir, 'voice-full.wav'), speed);
  if (lineCount > 1) {
    const gaps = silences(whole.file, -38, 0.22).filter((s) => s.start > 0.05 && s.end < whole.duration - 0.05);
    if (gaps.length >= lineCount - 1) {
      // the (lineCount-1) longest pauses are the phrase boundaries
      const cuts = [...gaps].sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, lineCount - 1).sort((a, b) => a.start - b.start);
      const bounds = [0, ...cuts.map((c) => (c.start + c.end) / 2), whole.duration];
      const segments = [];
      for (let i = 0; i < lineCount; i++) {
        const out = path.join(workDir, `voice-${i}.wav`);
        ff(['-i', whole.file, '-ss', bounds[i].toFixed(3), '-to', bounds[i + 1].toFixed(3), '-af', TRIM, out]);
        segments.push({file: out, duration: duration(out)});
      }
      return {segments, mode: 'phrases'};
    }
  }
  return {segments: [whole], mode: 'continuous'};
}

export {localVoiceFor};
