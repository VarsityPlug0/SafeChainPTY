// Test helpers: build specs, synthesise "user" audio files locally, run the real CLI.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SAMPLE_PRODUCT = path.join(ENGINE, 'examples', 'sample-product.png');
export const SMALL = {width: 540, height: 960, fps: 30};

export const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `brag-${name}-`));

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(r.stderr);
};

/** A "user-recorded" voiceover: Flite lines joined with pauses, saved as MP3. */
export function makeVoiceFile(dir, lines, pause = 0.6, voice = 'slt') {
  const pauseWav = path.join(dir, 'pause.wav');
  ff(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', String(pause), pauseWav]);
  const parts = [];
  lines.forEach((text, i) => {
    const txt = path.join(dir, `l${i}.txt`);
    fs.writeFileSync(txt, text);
    const wav = path.join(dir, `l${i}.wav`);
    ff(['-f', 'lavfi', '-i', `flite=textfile=${txt}:voice=${voice}`, '-ar', '48000', '-ac', '1', wav]);
    if (i) parts.push(pauseWav);
    parts.push(wav);
  });
  const out = path.join(dir, 'my-voiceover.mp3');
  ff([...parts.flatMap((p) => ['-i', p]), '-filter_complex', `${parts.map((_, i) => `[${i}]`).join('')}concat=n=${parts.length}:v=0:a=1[out]`,
    '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
  return out;
}

/** A short "user" music track (4 s arpeggio) — shorter than any ad, so it must loop. */
export function makeMusicFile(dir, seconds = 4) {
  const out = path.join(dir, 'my-music.mp3');
  ff(['-f', 'lavfi', '-i', `aevalsrc=exprs='0.3*sin(2*PI*(220*pow(1.5,mod(floor(t*4),3)))*t)*exp(-mod(t,0.25)*6)':s=48000:d=${seconds}`, '-c:a', 'libmp3lame', '-b:a', '128k', out]);
  return out;
}

export function makeSfxFile(dir, name = 'my-ding.wav') {
  const out = path.join(dir, name);
  ff(['-f', 'lavfi', '-i', "aevalsrc=exprs='0.8*sin(2*PI*1320*t)*exp(-t*8)':s=48000:d=0.6", out]);
  return out;
}

export const scenes = (n = 4) => [
  {type: 'hook', duration: 2.2, text: 'Dirty *kicks?*'},
  {type: 'productReveal', duration: 2.4, headline: 'The *kit*'},
  {type: 'price', duration: 2.2, label: 'Only'},
  {type: 'final', duration: 2.8},
].slice(0, n);

export function spec(overrides = {}) {
  return {
    title: 'test', style: 'streetwear', format: SMALL,
    brand: {name: 'Test Brand'}, product: {name: 'Test Kit', price: 'R299', images: [SAMPLE_PRODUCT]},
    cta: {text: 'Shop Now'}, scenes: scenes(), ...overrides,
  };
}

export const voiceScript = [
  {scene: 0, text: 'Dirty sneakers?'},
  {scene: 1, text: 'Meet the test kit.'},
  {scene: 2, text: 'Only R299.', say: 'Only two hundred and ninety-nine rand.'},
  {scene: 3, text: 'Shop now.'},
];

export function writeSpecs(dir, specs) {
  return Object.entries(specs).map(([name, s]) => {
    const p = path.join(dir, `${name}.json`);
    fs.writeFileSync(p, JSON.stringify({...s, title: name}, null, 2));
    return p;
  });
}

/** Run the real render CLI. Returns {code, reports, stdout}. */
export function render(specPaths, {out, env = {}} = {}) {
  const outDir = out ?? tmp('out');
  const reportFile = path.join(outDir, 'reports.json');
  const r = spawnSync('node', [path.join(ENGINE, 'scripts', 'render.mjs'), ...specPaths, '--out', outDir, '--report', reportFile], {
    encoding: 'utf8', env: {...process.env, ...env}, maxBuffer: 64 * 1024 * 1024,
  });
  const reports = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : [];
  return {code: r.status, reports, stdout: r.stdout + r.stderr, outDir};
}

export const byTitle = (reports, name) => reports.find((r) => r.spec.endsWith(`${name}.json`));

export const audioStream = (video) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', video], {encoding: 'utf8'});
  return JSON.parse(r.stdout).streams.find((s) => s.codec_type === 'audio') ?? null;
};

/** mean dB of a window of a media file */
export const meanDb = (file, start, dur) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(start), '-t', String(dur), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = /mean_volume: (-?[\d.]+|-inf) dB/.exec(r.stderr);
  return m && m[1] !== '-inf' ? Number(m[1]) : -120;
};
