// Fast tests of the audio planner (no video rendering). Uses the local Flite voice
// and a mock ElevenLabs server, so no credentials are needed.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {normalizeAudio, planAudio} from '../scripts/audio/plan.mjs';
import {AUDIO_PRESETS} from '../scripts/audio/presets.mjs';
import {makeMusicFile, makeVoiceFile, spec, tmp, voiceScript} from './helpers.mjs';
import {neuralAvailable, neuralVoiceFor} from '../scripts/audio/voice.mjs';

const ctx = (dir) => ({fps: 30, transition: 14 / 30, abs: (p) => path.resolve(dir, p), workDir: path.join(dir, 'audio'), publicPrefix: 'assets/test/audio'});
const total = (s) => s.scenes.reduce((a, x) => a + x.duration, 0) - (14 / 30) * (s.scenes.length - 1);

test('no audio section / enabled:false => visual-only (planner is a no-op)', async () => {
  for (const audio of [undefined, null, {enabled: false}]) {
    const s = spec({audio});
    const before = JSON.stringify(s);
    assert.equal(normalizeAudio(s), null);
    assert.deepEqual(await planAudio(s, ctx(tmp('none'))), {enabled: false});
    assert.equal(JSON.stringify(s), before, 'spec must not change');
  }
});

test('legacy "audio": "file" is still accepted (music bed, full volume, no ducking)', () => {
  const n = normalizeAudio(spec({audio: 'song.mp3'}));
  assert.equal(n.legacy, true);
  assert.equal(n.music.audioFile, 'song.mp3');
  assert.equal(n.music.duckUnderVoice, false);
});

test('voice shorter than the scenes: planned visual timing is kept', async () => {
  const s = spec({audio: {voiceover: {provider: 'flite', script: [{scene: 0, text: 'Hi.'}]}, music: {}, sfx: 'none'}});
  const planned = total(s);
  const plan = await planAudio(s, ctx(tmp('short')));
  assert.deepEqual(plan.errors, []);
  assert.ok(Math.abs(plan.total - planned) < 0.05, `${plan.total} vs ${planned}`);
  assert.equal(plan.voicePlaced.length, 1);
  assert.ok(plan.voicePlaced[0].start + plan.voicePlaced[0].duration < plan.total);
});

test('voice longer than expected: scenes are extended (speech is not stretched) and it is reported', async () => {
  const long = 'Meet the BEVANSSONS Sneaker Cleaning Kit, made for the pairs you wear every single day of the week.';
  const s = spec({scenes: [{type: 'hook', duration: 1.8, text: 'Hi'}, {type: 'final', duration: 3.2}],
    audio: {voiceover: {provider: 'flite', script: [{scene: 0, text: long}]}, sfx: 'none'}});
  const plan = await planAudio(s, ctx(tmp('long')));
  assert.deepEqual(plan.errors, []);
  const v = plan.voicePlaced[0];
  assert.ok(v.duration > 3, 'line is long');
  assert.ok(s.scenes[0].duration >= v.duration, 'hook scene grew to fit the line');
  assert.ok(plan.warnings.some((w) => /re-timed|longer than the requested/.test(w)));
  // the line finishes before the next scene's transition starts
  assert.ok(v.start + v.duration <= s.scenes[0].duration - 14 / 30 + 1e-6);
});

test('sync "fixed" refuses to cut speech off', async () => {
  const s = spec({scenes: [{type: 'hook', duration: 1.8, text: 'Hi'}, {type: 'final', duration: 3.2}], audio: {sync: 'fixed',
    voiceover: {provider: 'flite', script: [{scene: 0, text: 'This sentence is far too long to fit inside a scene that lasts under two seconds.'}]}}});
  const plan = await planAudio(s, ctx(tmp('fixed')));
  assert.ok(plan.errors.some((e) => /needs .*s but the scene is/.test(e)));
});

test('missing audio files are reported before rendering', async () => {
  for (const audio of [
    {voiceover: {provider: 'file', audioFile: 'nope.mp3'}},
    {music: {audioFile: 'missing-music.mp3'}},
    {sfx: [{type: 'whoosh', time: 1, audioFile: 'missing.wav'}]},
  ]) {
    const plan = await planAudio(spec({audio}), ctx(tmp('missing')));
    assert.ok(plan.errors.some((e) => /Missing audio file/.test(e)), JSON.stringify(plan.errors));
  }
});

test('unsupported audio types and unknown SFX names are rejected', async () => {
  const dir = tmp('types');
  fs.writeFileSync(path.join(dir, 'voice.txt'), 'x');
  let plan = await planAudio(spec({audio: {voiceover: {provider: 'file', audioFile: 'voice.txt'}}}), ctx(dir));
  assert.ok(plan.errors.some((e) => /Unsupported audio type/.test(e)));
  plan = await planAudio(spec({audio: {sfx: [{type: 'laser-cannon', time: 1}]}}), ctx(dir));
  assert.ok(plan.errors.some((e) => /Unknown sound effect "laser-cannon"/.test(e)));
});

test('missing ElevenLabs key gives a clear, actionable error', async () => {
  const saved = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  try {
    const plan = await planAudio(spec({audio: {voiceover: {provider: 'elevenlabs', voice: 'energetic male', script: voiceScript}}}), ctx(tmp('nokey')));
    assert.equal(plan.errors.length, 1);
    assert.match(plan.errors[0], /ELEVENLABS_API_KEY is not set/);
    assert.match(plan.errors[0], /provider "file"/);
  } finally {
    if (saved) process.env.ELEVENLABS_API_KEY = saved;
  }
});

test('ElevenLabs integration (mock server): voice lookup, auth header, per-line requests', async () => {
  const dir = tmp('el');
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      requests.push({method: req.method, url: req.url, key: req.headers['xi-api-key'], body: body ? JSON.parse(body) : null});
      if (req.url === '/v1/voices') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({voices: [
          {voice_id: 'FemaleVoiceId0000001', name: 'Bella', labels: {gender: 'female', description: 'soft'}},
          {voice_id: 'MaleVoiceId000000001', name: 'Adam', labels: {gender: 'male', description: 'deep energetic'}},
        ]}));
        return;
      }
      const text = JSON.parse(body).text;
      const txt = path.join(dir, `req-${requests.length}.txt`);
      fs.writeFileSync(txt, text);
      const mp3 = path.join(dir, `req-${requests.length}.mp3`);
      spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `flite=textfile=${txt}:voice=rms`, '-c:a', 'libmp3lame', mp3]);
      res.setHeader('content-type', 'audio/mpeg');
      res.end(fs.readFileSync(mp3));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const saved = {k: process.env.ELEVENLABS_API_KEY, b: process.env.ELEVENLABS_API_BASE};
  process.env.ELEVENLABS_API_KEY = 'test-key-123';
  process.env.ELEVENLABS_API_BASE = `http://127.0.0.1:${server.address().port}`;
  try {
    const s = spec({audio: {voiceover: {provider: 'elevenlabs', voice: 'energetic male', speed: 1.05, script: voiceScript}, sfx: 'none'}});
    const plan = await planAudio(s, ctx(dir));
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.voiceInfo.provider, 'elevenlabs');
    assert.match(plan.voiceInfo.voice, /Adam/);
    const tts = requests.filter((r) => r.method === 'POST');
    assert.equal(tts.length, voiceScript.length, 'one request per line');
    assert.ok(requests.every((r) => r.key === 'test-key-123'));
    assert.ok(tts.every((r) => r.url.startsWith('/v1/text-to-speech/MaleVoiceId000000001')));
    assert.equal(tts[2].body.text, 'Only two hundred and ninety-nine rand.', 'uses the spoken form');
    assert.equal(tts[0].body.voice_settings.speed, 1.05);
    assert.equal(tts[1].body.previous_text, 'Dirty sneakers?');
    assert.equal(plan.voicePlaced.length, 4);
  } finally {
    server.close();
    process.env.ELEVENLABS_API_KEY = saved.k ?? '';
    if (!saved.k) delete process.env.ELEVENLABS_API_KEY;
    if (saved.b) process.env.ELEVENLABS_API_BASE = saved.b; else delete process.env.ELEVENLABS_API_BASE;
  }
});

test('a single user recording is split at its pauses and each phrase timed to its scene', async () => {
  const dir = tmp('userfile');
  const file = makeVoiceFile(dir, voiceScript.map((l) => l.say ?? l.text));
  const s = spec({audio: {voiceover: {provider: 'file', audioFile: file, script: voiceScript}, sfx: 'none'}});
  const plan = await planAudio(s, ctx(dir));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.voiceInfo.mode, 'phrases');
  assert.equal(plan.voicePlaced.length, 4);
  plan.voicePlaced.forEach((v, i) => {
    const start = plan.timeline.sync.scenes[i].start;
    assert.ok(v.start >= start && v.start < start + 0.5, `line ${i} starts as scene ${i} lands`);
  });
});

test('ducking ranges cover every voice line; music loops when shorter than the ad', async () => {
  const dir = tmp('duck');
  const s = spec({audio: {voiceover: {provider: 'flite', script: voiceScript}, music: {audioFile: makeMusicFile(dir, 3)}}});
  const plan = await planAudio(s, ctx(dir));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.music.loop, true);
  assert.ok(plan.music.duration < plan.total);
  for (const v of plan.voicePlaced) {
    assert.ok(plan.timeline.music.duckRanges.some(([a, b]) => a <= v.start && b >= v.start + v.duration), 'voice inside a duck range');
  }
  assert.ok(plan.resolved.music.duckVolume < plan.resolved.music.volume);
});

test('auto SFX: 3–7 meaningful effects for a 15 s ad, spaced, inside the video, for every style', async () => {
  for (const style of Object.keys(AUDIO_PRESETS)) {
    const s = spec({style, scenes: [
      {type: 'hook', duration: 2.6, text: 'Hi'}, {type: 'productReveal', duration: 3.2}, {type: 'productZoom', duration: 2.8},
      {type: 'price', duration: 3.0, label: 'Only'}, {type: 'final', duration: 5.2},
    ], audio: {music: {}}});
    const plan = await planAudio(s, ctx(tmp(`sfx-${style}`)));
    assert.deepEqual(plan.errors, [], style);
    assert.ok(plan.sfx.length >= 3 && plan.sfx.length <= 7, `${style}: ${plan.sfx.length} sfx`);
    const times = plan.sfx.map((x) => x.start);
    times.slice(1).forEach((t, i) => assert.ok(t - times[i] >= 0.35, `${style}: spacing`));
    plan.sfx.forEach((x) => assert.ok(x.start >= 0 && x.start + x.duration <= plan.total + 1e-6, `${style}: ${x.type} inside video`));
  }
});

test('requested SFX past the end are trimmed or dropped, never overrun the video', async () => {
  const s = spec({audio: {sfx: [{type: 'cinematic-hit', time: 7.5}, {type: 'whoosh', time: 99}]}});
  const plan = await planAudio(s, ctx(tmp('trim')));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.sfx.length, 1);
  assert.ok(plan.sfx[0].start + plan.sfx[0].duration <= plan.total + 1e-6);
  assert.ok(plan.warnings.some((w) => /trimmed/.test(w)) && plan.warnings.some((w) => /dropped/.test(w)));
});

test('voice descriptions map to natural Kokoro voices', () => {
  assert.equal(neuralVoiceFor('energetic male', 'am_michael'), 'am_puck');
  assert.equal(neuralVoiceFor('deep calm', 'am_michael'), 'am_fenrir');
  assert.equal(neuralVoiceFor('female', 'am_michael'), 'af_heart');
  assert.equal(neuralVoiceFor('british woman', 'am_michael'), 'bf_emma');
  assert.equal(neuralVoiceFor('use bm_lewis please', 'am_michael'), 'bm_lewis');
  assert.equal(neuralVoiceFor(undefined, 'af_heart'), 'af_heart');
});

test('"local" uses the natural neural voice when installed, otherwise robotic Flite with a warning', {skip: !neuralAvailable() && 'neural voice not installed'}, async () => {
  const s = spec({audio: {voiceover: {provider: 'local', voice: 'energetic male', script: voiceScript.slice(0, 2)}, sfx: 'none'}});
  const plan = await planAudio(s, ctx(tmp('neural')));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.voiceInfo.engine, 'kokoro');
  assert.equal(plan.voiceInfo.voice, 'kokoro:am_puck');
  assert.equal(plan.voiceInfo.demo, false);
  assert.equal(plan.resolved.label, null, 'natural voice is not labelled DEMO');
  assert.ok(plan.voicePlaced.every((v) => v.duration > 0.4));
  process.env.BRAG_DISABLE_NEURAL_VOICE = '1';
  try {
    const s2 = spec({audio: {voiceover: {provider: 'local', script: voiceScript.slice(0, 1)}, sfx: 'none'}});
    const p2 = await planAudio(s2, ctx(tmp('fallback')));
    assert.equal(p2.voiceInfo.engine, 'flite');
    assert.match(p2.resolved.label, /DEMO AUDIO/);
    assert.ok(p2.warnings.some((w) => /setup-voice\.sh/.test(w)));
    const p3 = await planAudio(spec({audio: {voiceover: {provider: 'neural', script: voiceScript}}}), ctx(tmp('nn')));
    assert.match(p3.errors[0], /not installed/);
  } finally {
    delete process.env.BRAG_DISABLE_NEURAL_VOICE;
  }
});

test('brand pronunciation is used for spoken lines (on-screen text unchanged)', async () => {
  const s = spec({brand: {name: 'BEVANSSONS', pronunciation: 'Bevans Sons'}, audio: {voiceover: {provider: 'flite', script: [{scene: 0, text: 'Shop now at BEVANSSONS.'}, {scene: 1, text: 'BEVANSSONS!', say: 'Custom.'}]}, sfx: 'none'}});
  const plan = await planAudio(s, ctx(tmp('pron')));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.voicePlaced[0].text, 'Shop now at BEVANSSONS.', 'display text unchanged');
});
