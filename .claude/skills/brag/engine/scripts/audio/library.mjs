/**
 * Locally generated audio library: sound effects + demo music beds, synthesised
 * with ffmpeg so they are deterministic and free of licensing issues.
 * Files are created on demand in engine/audio-library/ (git-ignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ff, levels} from './ffmpeg.mjs';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LIBRARY = path.join(ENGINE, 'audio-library');
const VERSION = '1';

const SR = 48000;
const src = (expr, d) => ['-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=${SR}:d=${d}`];
const N = '(random(0)*2-1)'; // deterministic white noise

/** Sound-effect recipes: [inputs, filter_complex or simple filters, duration]. */
const SFX = {
  whoosh: {d: 0.75, desc: 'airy whoosh (transitions, reveals)', make: (o) => ff([
    ...src(`${N}*pow(sin(PI*t/0.75),3)*0.9`, 0.75),
    ...src(`(random(1)*2-1)*pow(sin(PI*min(1,t/0.6)),4)*0.8`, 0.75),
    '-filter_complex', '[0]lowpass=f=900,highpass=f=120[a];[1]highpass=f=2200,lowpass=f=7000[b];[a][b]amix=inputs=2:normalize=0,aecho=0.6:0.3:40:0.25', o])},
  transition: {d: 1.0, desc: 'longer, darker whoosh', make: (o) => ff([...src(`${N}*pow(sin(PI*t/1.0),2)*0.9`, 1.0), '-af', 'lowpass=f=1400,highpass=f=90,aecho=0.7:0.4:60:0.3', o])},
  swipe: {d: 0.35, desc: 'quick swipe (before/after, slides)', make: (o) => ff([...src(`${N}*pow(t/0.35,2)*(1-pow(t/0.35,10))`, 0.35), '-af', 'highpass=f=1500,lowpass=f=9000', o])},
  impact: {d: 1.2, desc: 'punchy low impact (hooks, sale)', make: (o) => ff([...src(`sin(2*PI*(45+90*exp(-t*18))*t)*exp(-t*5)*0.9+${N}*exp(-t*30)*0.5`, 1.2), '-af', 'lowpass=f=5000,aecho=0.5:0.3:30:0.2', o])},
  'cinematic-hit': {d: 2.6, desc: 'deep cinematic boom (luxury reveals)', make: (o) => ff([...src(`sin(2*PI*(36+55*exp(-t*12))*t)*exp(-t*2.2)*0.9+${N}*exp(-t*14)*0.3`, 2.6), '-af', 'lowpass=f=2500,aecho=0.8:0.7:120|260:0.35|0.2', o])},
  pop: {d: 0.25, desc: 'soft pop', make: (o) => ff([...src('sin(2*PI*(380+900*exp(-t*30))*t)*exp(-t*16)*0.9', 0.25), o])},
  'price-pop': {d: 0.35, desc: 'bright pop for price reveals', make: (o) => ff([...src('0.7*sin(2*PI*(500+1200*exp(-t*28))*t)*exp(-t*14)+0.3*sin(2*PI*1800*t)*exp(-t*30)', 0.35), o])},
  click: {d: 0.15, desc: 'UI click (CTA)', make: (o) => ff([...src(`${N}*exp(-t*220)*0.8+sin(2*PI*2400*t)*exp(-t*120)*0.5`, 0.15), o])},
  cash: {d: 0.9, desc: 'cash-register bells (price, sale)', make: (o) => ff([...src('(sin(2*PI*2093*t)+0.7*sin(2*PI*2637*t)+0.5*sin(2*PI*3136*t))*exp(-t*6)*0.3+if(gt(t,0.12),(sin(2*PI*2637*(t-0.12))+0.6*sin(2*PI*3520*(t-0.12)))*exp(-(t-0.12)*5)*0.3,0)', 0.9), o])},
  shine: {d: 1.0, desc: 'sparkle shimmer (logo, luxury)', make: (o) => ff([...src([1568, 2093, 2637, 3136].map((f, k) => `if(gt(t,${k * 0.08}),sin(2*PI*${f}*(t-${k * 0.08}))*exp(-(t-${k * 0.08})*7)*0.25,0)`).join('+'), 1.0), '-af', 'aecho=0.6:0.5:90:0.3', o])},
  rise: {d: 1.4, desc: 'tension riser into the end card', make: (o) => ff([...src(`${N}*pow(t/1.4,2.5)*0.6+sin(2*PI*(200+700*pow(t/1.4,2))*t)*pow(t/1.4,2)*0.3`, 1.4), '-af', 'highpass=f=200', o])},
};

/** Semantic aliases so specs/scenes can ask for meaning rather than a file. */
export const SFX_ALIASES = {
  hit: 'impact', boom: 'cinematic-hit', 'luxury-hit': 'cinematic-hit', 'cta': 'click', 'cta-click': 'click',
  ding: 'cash', sparkle: 'shine', riser: 'rise', slide: 'swipe', wipe: 'swipe', 'transition-whoosh': 'transition',
};
export const SFX_NAMES = Object.keys(SFX);
export const sfxDescriptions = () => Object.fromEntries(Object.entries(SFX).map(([k, v]) => [k, v.desc]));

/** Demo music beds (one per style): kick/snare/hats/bass/pad from expressions, 4-bar seamless loop. */
const MUSIC = {
  luxury:     {bpm: 72,  third: 1.2,  kick: 0.45, snare: 0,    hat: 0,    bass: 0.16, pad: 0.07, lp: 2400, desc: 'slow cinematic pad'},
  streetwear: {bpm: 92,  third: 1.2,  kick: 0.9,  snare: 0.28, hat: 0.1,  bass: 0.2,  pad: 0.03, lp: 6000, desc: 'punchy boom-bap beat'},
  clean:      {bpm: 104, third: 1.25, kick: 0.4,  snare: 0,    hat: 0.06, bass: 0.1,  pad: 0.05, lp: 5000, desc: 'light, airy groove'},
  viral:      {bpm: 124, third: 1.25, kick: 0.85, snare: 0.18, hat: 0.12, bass: 0.18, pad: 0.04, lp: 8000, desc: 'energetic four-on-the-floor'},
  sale:       {bpm: 132, third: 1.25, kick: 0.9,  snare: 0.3,  hat: 0.14, bass: 0.2,  pad: 0.04, lp: 8000, desc: 'high-energy sale beat'},
};
export const musicDescription = (style) => MUSIC[style]?.desc ?? MUSIC.clean.desc;

const musicExpr = (m) => {
  const b = (60 / m.bpm).toFixed(5);
  const bar = `(4*${b})`;
  const k = `mod(floor(t/${bar}),4)`;
  const root = `if(eq(${k},0),55,if(eq(${k},1),43.654,if(eq(${k},2),48.999,41.203)))`;
  const parts = [
    m.kick && `${m.kick}*sin(2*PI*(48+70*exp(-mod(t,${b})*30))*mod(t,${b}))*exp(-mod(t,${b})*8)`,
    m.snare && `${m.snare}*(random(1)*2-1)*exp(-mod(t+${b},2*${b})*22)`,
    m.hat && `${m.hat}*(random(2)*2-1)*exp(-mod(t+${b}/2,${b})*80)`,
    m.bass && `${m.bass}*sin(2*PI*${root}*t)*(0.55+0.45*exp(-mod(t,${b}/2)*5))`,
    m.pad && `${m.pad}*(sin(2*PI*${root}*4*t)+sin(2*PI*${root}*4*${m.third}*t)+sin(2*PI*${root}*6*t))*(0.7+0.3*sin(2*PI*t/${bar}))`,
  ].filter(Boolean);
  return {expr: parts.join('+'), seconds: 16 * Number(b)};
};

const ensureFile = (file, make) => {
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const raw = file.replace(/\.wav$/, '.raw.wav');
  make(raw);
  // peak-normalise to -3 dBFS, 48 kHz stereo
  const {max} = levels(raw);
  ff(['-i', raw, '-af', `volume=${(-3 - max).toFixed(2)}dB,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo`, file]);
  fs.rmSync(raw, {force: true});
  return file;
};

export const sfxFile = (name) => {
  const key = SFX[name] ? name : SFX_ALIASES[name];
  if (!key) return null;
  return ensureFile(path.join(LIBRARY, `v${VERSION}`, 'sfx', `${key}.wav`), SFX[key].make);
};

export const demoMusicFile = (style) => {
  const m = MUSIC[style] ?? MUSIC.clean;
  const file = path.join(LIBRARY, `v${VERSION}`, 'music', `demo-${MUSIC[style] ? style : 'clean'}.wav`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const {expr, seconds} = musicExpr(m);
  const raw = file.replace(/\.wav$/, '.raw.wav');
  ff(['-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=${SR}:d=${seconds.toFixed(4)}`, '-af', `lowpass=f=${m.lp},highpass=f=30`, raw]);
  ff(['-i', raw, '-af', 'loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo', file]);
  fs.rmSync(raw, {force: true});
  return file;
};

/** Build the whole library (used by setup.sh and tests). */
export const buildLibrary = () => {
  const out = SFX_NAMES.map(sfxFile);
  for (const s of Object.keys(MUSIC)) out.push(demoMusicFile(s));
  return out;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const files = buildLibrary();
  console.log(`audio library ready (${files.length} files) in ${LIBRARY}`);
}
