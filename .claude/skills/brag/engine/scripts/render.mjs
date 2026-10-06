#!/usr/bin/env node
/**
 * /brag renderer: spec JSON -> verified MP4 + storyboard + QA frames.
 *
 *   node scripts/render.mjs <spec.json> [more specs...] [--out <dir>] [--concurrency N]
 *
 * Exit code 0 = every video rendered and passed checks; 1 = something failed (see report).
 */
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeAudio, planAudio} from './audio/plan.mjs';
import {auditAudio, exportStems} from './audio/qa.mjs';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENE_TYPES = ['hook', 'statement', 'productReveal', 'productZoom', 'features', 'beforeAfter', 'price', 'sale', 'logo', 'cta', 'final'];
const STYLES = ['luxury', 'streetwear', 'clean', 'viral', 'sale'];
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;

// ---------- args ----------
const argv = process.argv.slice(2);
const specs = [];
let outBase = process.env.BRAG_OUTPUT_DIR || path.join(process.cwd(), 'brag-output');
let concurrency = os.cpus().length;
let reportFile = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outBase = path.resolve(argv[++i]);
  else if (argv[i] === '--report') reportFile = path.resolve(argv[++i]);
  else if (argv[i] === '--concurrency') concurrency = Number(argv[++i]);
  else specs.push(path.resolve(argv[i]));
}
if (!specs.length) {
  console.error('Usage: node scripts/render.mjs <spec.json> [more...] [--out <dir>] [--report <reports.json>] [--concurrency N]');
  process.exit(2);
}

// ---------- helpers ----------
const slug = (s) => String(s || 'ad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ad';
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const ffprobe = (file) =>
  JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString());

const findBrowser = () => {
  if (process.env.BRAG_BROWSER) return process.env.BRAG_BROWSER;
  const base = '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      const p = path.join(base, d, 'chrome-linux', 'headless_shell');
      if (d.startsWith('chromium_headless_shell') && fs.existsSync(p)) return p;
    }
  }
  return undefined; // Remotion downloads its own chrome-headless-shell on first use
};

const loadBrandPreset = (brand) => {
  const dir = path.join(ENGINE, 'presets', 'brands');
  const key = slug(brand?.preset || brand?.name || '');
  if (key === 'template') return null;
  const file = path.join(dir, `${key}.json`);
  if (key && fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const k of Object.keys(data)) if (k.startsWith('_')) delete data[k]; // comments
    return {key, data};
  }
  return null;
};

// ---------- validate + resolve one spec ----------
function prepare(specPath, runId) {
  const errors = [];
  const warnings = [];
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (e) {
    return {errors: [`Cannot read spec ${specPath}: ${e.message}`], warnings};
  }
  const specDir = path.dirname(specPath);
  const preset = loadBrandPreset(spec.brand);
  if (preset) {
    const {logo, ...rest} = preset.data;
    // The preset's full palette applies with the brand's own default style. With any other
    // style the brand keeps its accent colours and the style supplies backgrounds/energy.
    // Colours given explicitly in the spec always win.
    const style = spec.style ?? rest.defaultStyle;
    const presetColors = rest.colors || {};
    const brandColors = style === rest.defaultStyle
      ? presetColors
      : Object.fromEntries(Object.entries(presetColors).filter(([k]) => k === 'accent'));
    spec.brand = {...rest, ...spec.brand, colors: {...brandColors, ...(spec.brand?.colors || {})}};
    if (!spec.brand.logo && logo) spec.brand.logo = path.isAbsolute(logo) ? logo : path.join(ENGINE, 'presets', 'brands', logo);
    if (!spec.style && preset.data.defaultStyle) spec.style = preset.data.defaultStyle;
    delete spec.brand.defaultStyle;
  }
  spec.style ??= 'clean';
  if (!STYLES.includes(spec.style)) errors.push(`style must be one of ${STYLES.join(', ')}`);
  if (!spec.brand?.name) errors.push('brand.name is required');
  if (!spec.product?.name) errors.push('product.name is required');
  if (!spec.cta?.text) errors.push('cta.text is required');
  if (!Array.isArray(spec.scenes) || !spec.scenes.length) errors.push('scenes must be a non-empty array');

  // assets: copy into public/assets/<runId>/ and rewrite to staticFile paths
  const assetDir = path.join(ENGINE, 'public', 'assets', runId);
  const assetMap = new Map();
  const asset = (p, kind, where) => {
    if (!p) return p;
    const abs = path.isAbsolute(p) ? p : path.resolve(specDir, p);
    if (!fs.existsSync(abs)) { errors.push(`Missing ${kind} for ${where}: ${abs}`); return p; }
    if (kind === 'image' && !IMAGE_EXT.test(abs)) { errors.push(`Unsupported image type for ${where}: ${abs}`); return p; }
    if (kind === 'audio' && !AUDIO_EXT.test(abs)) { errors.push(`Unsupported audio type for ${where}: ${abs}`); return p; }
    if (!assetMap.has(abs)) {
      fs.mkdirSync(assetDir, {recursive: true});
      const name = `${assetMap.size}-${path.basename(abs).replace(/[^\w.-]/g, '_')}`;
      fs.copyFileSync(abs, path.join(assetDir, name));
      assetMap.set(abs, `assets/${runId}/${name}`);
    }
    return assetMap.get(abs);
  };
  spec.product.images = (spec.product?.images || []).map((p, i) => asset(p, 'image', `product.images[${i}]`));
  if (spec.brand?.logo) spec.brand.logo = asset(spec.brand.logo, 'image', 'brand.logo');

  const fps = spec.format?.fps ?? 30;
  (spec.scenes || []).forEach((s, i) => {
    const where = `scenes[${i}] (${s.type})`;
    if (!SCENE_TYPES.includes(s.type)) errors.push(`${where}: unknown type. Use one of ${SCENE_TYPES.join(', ')}`);
    if (!(s.duration >= 0.8 && s.duration <= 10)) errors.push(`${where}: duration must be 0.8–10 seconds`);
    if (['hook', 'statement', 'sale'].includes(s.type) && !s.text) errors.push(`${where}: text is required`);
    if (s.type === 'features' && !(Array.isArray(s.items) && s.items.length)) errors.push(`${where}: items are required`);
    if (s.type === 'price' && !spec.product?.price) errors.push(`${where}: product.price is required for a price scene`);
    if (s.type === 'beforeAfter') {
      s.before = asset(s.before, 'image', `${where}.before`);
      s.after = asset(s.after, 'image', `${where}.after`);
      if (!s.before || !s.after) warnings.push(`${where}: no before/after photos supplied — DEMO placeholders will be shown`);
    }
    if ((s.type === 'productReveal' || s.type === 'productZoom') && s.image != null && s.image >= spec.product.images.length) {
      warnings.push(`${where}: image index ${s.image} not available; using last image/placeholder`);
    }
  });
  const last = spec.scenes?.[spec.scenes.length - 1];
  if (last && !['final', 'cta'].includes(last.type)) errors.push('The last scene must be "final" or "cta" so the call to action is on screen at the end.');
  if (last && ['final', 'cta'].includes(last.type) && last.duration < 2) errors.push('The final/cta scene must last at least 2 seconds so the CTA is readable.');

  const trans = spec.transition?.type === 'none' ? 0 : spec.transition?.duration ?? 0.45;
  const frames = (spec.scenes || []).reduce((a, s) => a + Math.round(s.duration * fps), 0) - Math.round(trans * fps) * Math.max(0, (spec.scenes || []).length - 1);
  const seconds = frames / fps;
  if (seconds < 5 || seconds > 60) errors.push(`Total duration ${seconds.toFixed(2)}s is outside 5–60s`);
  else if (seconds < 10 || seconds > 20) warnings.push(`Total duration ${seconds.toFixed(2)}s is outside the recommended 10–20s`);
  if (!spec.product.images.length) {
    spec.demo = true;
    warnings.push('No product image supplied — rendering a DEMO placeholder product');
  }
  return {spec, errors, warnings, assetDir, specDir, expected: {frames, seconds, fps, width: spec.format?.width ?? 1080, height: spec.format?.height ?? 1920}};
}

// ---------- audio (optional) ----------
const transitionFrames = (spec, fps) => Math.round((spec.transition?.type === 'none' ? 0 : spec.transition?.duration ?? 0.45) * fps);

async function prepareAudio(job, index) {
  if (!normalizeAudio(job.spec)) return; // visual-only: nothing changes
  const fps = job.expected.fps;
  const tf = transitionFrames(job.spec, fps);
  const plan = await planAudio(job.spec, {
    fps,
    transition: tf / fps,
    abs: (p) => (path.isAbsolute(p) ? p : path.resolve(job.specDir, p)),
    workDir: path.join(job.assetDir, `audio-${index}`),
    publicPrefix: `assets/${runId}/audio-${index}`,
  });
  job.errors.push(...(plan.errors ?? []));
  job.warnings.push(...(plan.warnings ?? []));
  if (!plan.enabled || plan.errors?.length) return;
  job.audioPlan = plan;
  job.spec.audioResolved = plan.resolved;
  // scenes may have been re-timed to the narration
  const frames = job.spec.scenes.reduce((a, sc) => a + Math.round(sc.duration * fps), 0) - tf * Math.max(0, job.spec.scenes.length - 1);
  job.expected.frames = frames;
  job.expected.seconds = frames / fps;
  if (job.expected.seconds > 60) job.errors.push(`Total duration ${job.expected.seconds.toFixed(2)}s exceeds 60s`);
  else if (job.expected.seconds < 10 || job.expected.seconds > 20) job.warnings.push(`Final duration ${job.expected.seconds.toFixed(2)}s is outside the recommended 10–20s`);
}

// ---------- storyboard ----------
function storyboard(spec, fps, audioPlan = null) {
  const t = transitionFrames(spec, fps) / fps; // what Remotion actually uses
  let start = 0;
  const rows = spec.scenes.map((s, i) => {
    const from = start;
    const to = from + s.duration;
    start = to - t;
    const text = [s.text, s.subtext, s.headline, s.title, s.caption, s.label, s.tagline, ...(s.items || [])].filter(Boolean).join(' / ') || '—';
    return `| ${i + 1} | ${from.toFixed(2)}–${to.toFixed(2)}s | ${s.type} | ${text.replace(/\|/g, '/')} | ${s.notes || ''} |`;
  });
  return [
    `# Storyboard — ${spec.title || spec.product.name}`,
    '',
    spec.concept ? `**Concept:** ${spec.concept}\n` : '',
    `**Brand:** ${spec.brand.name} · **Product:** ${spec.product.name}${spec.product.price ? ` · **Price:** ${spec.product.price}` : ''} · **Style:** ${spec.style} · **CTA:** ${spec.cta.text}${spec.cta.detail ? ` (${spec.cta.detail})` : ''}`,
    spec.demo ? '\n> DEMO: no product photo supplied; a placeholder product is shown.\n' : '',
    '| # | Time | Scene | On-screen copy | Direction |',
    '|---|------|-------|----------------|-----------|',
    ...rows,
    '',
    `Transitions: ${spec.transition?.type ?? 'auto (from style)'}, ${t.toFixed(3)}s each. Format: ${spec.format?.width ?? 1080}×${spec.format?.height ?? 1920} @ ${fps}fps.`,
    '',
    '## Scene by scene',
    audioPlan?.resolved?.label ? `\n> ${audioPlan.resolved.label}: placeholder audio for testing, not final production audio.\n` : '',
    audioPlan ? `Audio: voice ${audioPlan.voiceInfo ? `${audioPlan.voiceInfo.provider} (${audioPlan.voiceInfo.voice})` : '—'} · music ${audioPlan.music ? `${audioPlan.music.source}, volume ${audioPlan.music.volume}${audioPlan.music.duck ? `, ducked to ${audioPlan.music.duckVolume} under voice` : ''}` : '—'} · ${audioPlan.sfx.length} sound effect(s) · sync: ${audioPlan.timeline.sync.mode}` : 'Audio: none (visual-only ad).',
    '',
    ...sceneBlocks(spec, t, audioPlan),
  ].join('\n');
}

function sceneBlocks(spec, t, audioPlan) {
  let start = 0;
  return spec.scenes.flatMap((s, i) => {
    const from = start;
    const to = from + s.duration;
    start = to - t;
    const text = [s.text, s.subtext, s.headline, s.title, s.caption, s.label, s.tagline, ...(s.items || [])].filter(Boolean).join(' / ');
    const note = audioPlan?.notes?.[i] ?? {voice: '—', music: '—', sfx: '—'};
    return [
      `**${from.toFixed(2)}–${to.toFixed(2)}s · ${i + 1}. ${s.type}**`,
      `- VISUAL: ${s.type}${text ? ` — "${text}"` : ''}${s.notes ? ` (${s.notes})` : ''}`,
      `- VOICE: ${note.voice}`,
      `- MUSIC: ${note.music}`,
      `- SFX: ${note.sfx}`,
      '',
    ];
  });
}

// ---------- main ----------
const browserExecutable = findBrowser();
const runId = `${Date.now()}`;
const prepared = specs.map((p) => ({path: p, ...prepare(p, runId)}));
// audio is generated before bundling (the bundle snapshots public/)
for (const [i, job] of prepared.entries()) {
  if (job.errors.length) continue;
  try {
    await prepareAudio(job, i);
  } catch (err) {
    job.errors.push(`Audio preparation failed: ${err.message}`);
  }
}
const reports = [];
let serveUrl = null;

for (const job of prepared) {
  const report = {spec: job.path, ok: false, errors: [...job.errors], warnings: [...job.warnings], qa: [], audio: null};
  reports.push(report);
  if (job.errors.length) continue;
  const {spec, expected} = job;
  const outDir = path.join(outBase, `${stamp()}-${slug(spec.title || `${spec.brand.name}-${spec.product.name}`)}-${spec.style}`);
  fs.mkdirSync(path.join(outDir, 'qa'), {recursive: true});
  const video = path.join(outDir, 'ad.mp4');
  report.outDir = outDir;
  report.video = video;
  try {
    if (!serveUrl) {
      process.stdout.write('Bundling engine… ');
      serveUrl = await bundle({entryPoint: path.join(ENGINE, 'src', 'index.ts'), publicDir: path.join(ENGINE, 'public')});
      console.log('done');
    }
    const qaEvents = new Map();
    const onBrowserLog = (log) => {
      const m = /^BRAG_QA (.*)$/.exec(log.text);
      if (m) {
        const key = m[1];
        if (!qaEvents.has(key)) qaEvents.set(key, JSON.parse(key));
      } else if (log.type === 'error') {
        report.warnings.push(`browser: ${log.text}`);
      }
    };
    const composition = await selectComposition({serveUrl, id: 'BragAd', inputProps: spec, browserExecutable, onBrowserLog, logLevel: 'error'});
    console.log(`Rendering ${path.basename(job.path)} → ${composition.width}×${composition.height}, ${composition.durationInFrames} frames @ ${composition.fps}fps`);
    let last = -10;
    await renderMedia({
      composition, serveUrl, codec: 'h264', outputLocation: video, inputProps: spec, browserExecutable, onBrowserLog, logLevel: 'error',
      crf: 18, pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 92, concurrency,
      onProgress: ({progress}) => {
        const pct = Math.floor(progress * 100);
        if (pct >= last + 10) { last = pct; process.stdout.write(`${pct}% `); }
      },
    });
    console.log('');

    // ---- verify the file ----
    const probe = ffprobe(video);
    const v = probe.streams.find((s) => s.codec_type === 'video');
    const duration = Number(probe.format.duration);
    const tol = 1.5 / expected.fps;
    report.file = {bytes: fs.statSync(video).size, codec: v?.codec_name, width: v?.width, height: v?.height, duration, fps: v?.r_frame_rate, pixFmt: v?.pix_fmt};
    if (!v || v.codec_name !== 'h264') report.errors.push('Output is not an H.264 video');
    if (v?.width !== expected.width || v?.height !== expected.height) report.errors.push(`Resolution ${v?.width}×${v?.height}, expected ${expected.width}×${expected.height}`);
    if (Math.abs(duration - expected.seconds) > tol) report.errors.push(`Duration ${duration.toFixed(3)}s, expected ${expected.seconds.toFixed(3)}s`);
    if (report.file.bytes < 50_000) report.errors.push('Video file is suspiciously small');

    // ---- QA events from components ----
    report.qa = [...qaEvents.values()];
    for (const e of report.qa) {
      if (e.type === 'text-overflow') report.errors.push(`Text does not fit (${e.label}): "${e.text}"${e.actual ? ` (${e.actual}px > ${e.max}px)` : ''} — shorten it`);
      if (e.type === 'text-layout-mismatch') report.errors.push(`Text rendered at an unexpected width (${e.label}): "${e.text}" ${e.actual}px vs ${e.expected}px — check fonts/spacing`);
      if (e.type === 'out-of-frame') report.errors.push(`Element outside the frame: ${e.label}`);
      if (e.type === 'outside-safe-area') report.warnings.push(`Element outside the social-app safe area: ${e.label}`);
    }
    if (!report.qa.some((e) => e.type === 'cta-visible')) report.errors.push('The CTA never became fully visible');

    // ---- QA frames: middle of each scene + final frame, and a contact sheet ----
    const t = transitionFrames(spec, expected.fps) / expected.fps;
    let start = 0;
    const times = spec.scenes.map((s) => { const mid = start + s.duration * 0.62; start += s.duration - t; return mid; });
    times.forEach((sec, i) => {
      const name = `${String(i + 1).padStart(2, '0')}-${spec.scenes[i].type}.jpg`;
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', sec.toFixed(3), '-i', video, '-frames:v', '1', '-q:v', '3', path.join(outDir, 'qa', name)]);
    });
    // very last frame: decode the final half-second and keep the last image written
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.5', '-i', video, '-update', '1', '-q:v', '3', path.join(outDir, 'qa', '99-final-frame.jpg')]);
    times.push(duration);
    for (const f of fs.readdirSync(path.join(outDir, 'qa'))) if (fs.statSync(path.join(outDir, 'qa', f)).size < 2000) report.errors.push(`QA frame ${f} is empty`);
    if (!fs.existsSync(path.join(outDir, 'qa', '99-final-frame.jpg'))) throw new Error('Could not extract the final frame');
    fs.copyFileSync(path.join(outDir, 'qa', '99-final-frame.jpg'), path.join(outDir, 'poster.jpg'));
    const cols = Math.min(times.length, 4);
    const rows = Math.ceil(times.length / cols);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(outDir, 'qa', '[0-9][0-9]-*.jpg'),
      '-vf', `scale=270:480,tile=${cols}x${rows}:padding=8:margin=8:color=0x222222`, '-frames:v', '1', path.join(outDir, 'qa', 'contact-sheet.jpg')]);

    // ---- write spec + storyboard ----
    fs.writeFileSync(path.join(outDir, 'spec.resolved.json'), JSON.stringify(spec, null, 2));
    fs.copyFileSync(job.path, path.join(outDir, 'spec.json'));
    // ---- audio QA + stems ----
    if (job.audioPlan) {
      const audit = auditAudio(video, job.audioPlan, {fps: expected.fps, videoDuration: duration});
      report.errors.push(...audit.errors);
      report.warnings.push(...audit.warnings);
      exportStems(job.audioPlan, path.join(outDir, 'audio'));
      const ap = job.audioPlan;
      report.audio = {
        label: ap.resolved.label,
        voice: ap.voiceInfo && {...ap.voiceInfo, lines: ap.voicePlaced.length},
        music: ap.music && {source: ap.music.source, volume: ap.music.volume, duckVolume: ap.music.duckVolume, ducking: ap.music.duck},
        sfx: ap.sfx.map((x) => `${x.type}@${x.start}s`),
        sync: ap.timeline.sync,
        metrics: audit.metrics,
        files: fs.readdirSync(path.join(outDir, 'audio')),
      };
    } else if (probe.streams.some((s) => s.codec_type === 'audio')) {
      report.warnings.push('Visual-only ad unexpectedly contains an audio stream');
    }
    fs.writeFileSync(path.join(outDir, 'storyboard.md'), storyboard(spec, expected.fps, job.audioPlan));
    report.ok = report.errors.length === 0;
  } catch (err) {
    report.errors.push(`Render failed: ${err.message}`);
  }
  if (report.outDir) fs.writeFileSync(path.join(report.outDir, 'report.json'), JSON.stringify(report, null, 2));
}

// copied/generated assets live in public/ only for the duration of this run
fs.rmSync(path.join(ENGINE, 'public', 'assets', runId), {recursive: true, force: true});

// ---------- summary ----------
console.log('\n=== /brag report ===');
for (const r of reports) {
  console.log(`\n${r.ok ? 'PASS' : 'FAIL'}  ${r.spec}`);
  if (r.video) console.log(`  video:      ${r.video}`);
  if (r.file) console.log(`  file:       ${r.file.width}×${r.file.height}, ${r.file.duration.toFixed(2)}s, ${r.file.codec}, ${(r.file.bytes / 1e6).toFixed(2)} MB`);
  if (r.audio) console.log(`  audio:      ${r.audio.metrics.codec} ${r.audio.metrics.sampleRate} Hz ${r.audio.metrics.channels}ch, ${r.audio.metrics.audioDuration}s · voice ${r.audio.voice ? `${r.audio.voice.provider} (${r.audio.voice.lines} lines)` : '—'} · music ${r.audio.music ? (r.audio.music.ducking ? 'ducked' : 'on') : '—'} · ${r.audio.sfx.length} sfx${r.audio.label ? ` · ${r.audio.label}` : ''}\n  timeline:   ${path.join(r.outDir, 'audio', 'audio-timeline.json')}`);
  if (r.outDir) console.log(`  storyboard: ${path.join(r.outDir, 'storyboard.md')}\n  qa sheet:   ${path.join(r.outDir, 'qa', 'contact-sheet.jpg')}`);
  for (const e of r.errors) console.log(`  ERROR   ${e}`);
  for (const w of r.warnings) console.log(`  warning ${w}`);
}
if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(reports, null, 2));
process.exit(reports.every((r) => r.ok) ? 0 : 1);
