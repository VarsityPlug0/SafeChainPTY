// End-to-end tests: real renders through the CLI (small 540×960 frames for speed),
// then checks on the MP4 (ffprobe + level measurements), report.json, timeline and storyboard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {before, describe, test} from 'node:test';
import {SAMPLE_PRODUCT, audioStream, byTitle, makeMusicFile, makeSfxFile, makeVoiceFile, meanDb, render, scenes, spec, tmp, voiceScript, writeSpecs} from './helpers.mjs';

const local = (extra = {}) => ({provider: 'flite', script: voiceScript, ...extra});
let run;          // one CLI invocation renders all the "normal" cases (bundle once)
let inputs;

before(() => {
  const dir = tmp('render');
  inputs = {
    voiceFile: makeVoiceFile(dir, voiceScript.map((l) => l.say ?? l.text)),
    music: makeMusicFile(dir, 4),
    ding: makeSfxFile(dir),
  };
  const specs = {
    'visual-only': spec({style: 'streetwear'}),
    'voice-only': spec({style: 'luxury', audio: {voiceover: local({voice: 'deep male'}), sfx: 'none'}}),
    'voice-music': spec({style: 'clean', audio: {voiceover: local(), music: {}, sfx: 'none'}}),
    'voice-music-sfx': spec({style: 'streetwear', audio: {voiceover: local(), music: {}, sfx: 'auto'}}),
    'user-voice-file': spec({style: 'streetwear', audio: {voiceover: {provider: 'file', audioFile: inputs.voiceFile, script: voiceScript}, music: {}, sfx: 'none'}}),
    'user-music': spec({style: 'viral', audio: {voiceover: local(), music: {audioFile: inputs.music, volume: 0.2, duckVolume: 0.07}, sfx: 'auto'}}),
    'multi-sfx': spec({style: 'sale', audio: {
      sfxLibrary: {ding: inputs.ding},
      sfx: [{type: 'impact', scene: 0, offset: 0.1}, {type: 'whoosh', scene: 1}, {type: 'ding', scene: 2, offset: 0.3}, {type: 'cash', scene: 2, offset: 0.5}, {type: 'click', scene: 3, offset: 0.85}, {type: 'riser', time: 5.6, audioFile: inputs.ding, volume: 0.4}],
      music: {}}}),
    // voice at volume 0: the mix then contains only music, so ducking can be measured directly
    'ducking-probe': spec({style: 'streetwear', audio: {voiceover: {provider: 'flite', volume: 0, script: [voiceScript[0], {scene: 1, text: 'Meet the test kit, made for your favourite pairs.'}]}, music: {volume: 0.2, duckVolume: 0.05}, sfx: 'none'}}),
    'audio-shorter': spec({style: 'clean', audio: {voiceover: {provider: 'flite', script: [{scene: 0, text: 'Hi.'}]}, music: {}, sfx: 'none'}}),
    'audio-longer': spec({style: 'streetwear', audio: {voiceover: {provider: 'flite', script: [
      {scene: 0, text: 'Your favourite sneakers took you everywhere this year, and now they need some care.'},
      {scene: 3, text: 'Shop now.'}]}, music: {}, sfx: 'auto'}}),
    'showcase': spec({style: 'luxury', scenes: [
      {type: 'hook', duration: 2.2, text: 'The *range*'},
      {type: 'showcase', duration: 4.2, title: 'Line-up', items: [
        {image: SAMPLE_PRODUCT, label: 'Kit One', price: 'R299'}, {image: SAMPLE_PRODUCT, label: 'Kit Two', sublabel: 'Travel size'}, {image: SAMPLE_PRODUCT, label: 'Kit Three'}]},
      {type: 'final', duration: 2.8}], audio: {voiceover: local({script: [{scene: 0, text: 'The range.'}, {scene: 1, text: 'Three kits.'}, {scene: 2, text: 'Shop now.'}]}), music: {}, sfx: 'auto'}}),
  };
  run = render(writeSpecs(dir, specs));
});

const ok = (name) => {
  const r = byTitle(run.reports, name);
  assert.ok(r, `${name} rendered`);
  assert.ok(r.ok, `${name} failed: ${r.errors.join(' | ')}`);
  assert.equal(r.file.width, 540);
  assert.equal(r.file.height, 960);
  return r;
};
const timeline = (r) => JSON.parse(fs.readFileSync(path.join(r.outDir, 'audio', 'audio-timeline.json'), 'utf8'));

describe('renders', () => {
  test('1. visual-only ad: no audio stream, no audio files, report unchanged', () => {
    const r = ok('visual-only');
    assert.equal(audioStream(r.video), null);
    assert.equal(r.audio, null);
    assert.equal(fs.existsSync(path.join(r.outDir, 'audio')), false);
    for (const f of ['ad.mp4', 'poster.jpg', 'storyboard.md', 'report.json', 'spec.json', 'qa/contact-sheet.jpg']) assert.ok(fs.existsSync(path.join(r.outDir, f)), f);
    assert.match(fs.readFileSync(path.join(r.outDir, 'storyboard.md'), 'utf8'), /Audio: none \(visual-only ad\)/);
  });

  test('2. voice only: AAC stereo track matching the video, no music', () => {
    const r = ok('voice-only');
    const a = audioStream(r.video);
    assert.equal(a.codec_name, 'aac');
    assert.equal(Number(a.sample_rate), 48000);
    assert.equal(a.channels, 2);
    assert.ok(Math.abs(Number(a.duration) - r.file.duration) <= 0.1);
    assert.equal(r.audio.music, null);
    assert.equal(r.audio.voice.lines, 4);
    assert.match(r.audio.label, /DEMO AUDIO/);
  });

  test('3. voice + music: music ducked under voice, voice louder than music', () => {
    const r = ok('voice-music');
    assert.equal(r.audio.music.ducking, true);
    assert.ok(r.audio.metrics.voiceOverDuckedMusicDb >= 12, `voice over ducked music ${r.audio.metrics.voiceOverDuckedMusicDb} dB`);
    if (r.audio.metrics.voiceOverMusicDb != null) assert.ok(r.audio.metrics.voiceOverMusicDb >= 3);
    for (const f of ['voiceover.mp3', 'music.mp3', 'audio-timeline.json']) assert.ok(fs.existsSync(path.join(r.outDir, 'audio', f)), f);
  });

  test('4. voice + music + sfx: at least 3 effects synced to scene events, copied to audio/sfx', () => {
    const r = ok('voice-music-sfx');
    const t = timeline(r);
    assert.ok(t.sfx.length >= 3, `${t.sfx.length} sfx`);
    const types = t.sfx.map((s) => s.type);
    assert.ok(types.includes('impact') && types.includes('price-pop'));
    const price = t.sync.scenes.find((s) => s.type === 'price');
    const pop = t.sfx.find((s) => s.type === 'price-pop');
    assert.ok(pop.start > price.start && pop.start < price.start + 0.6, 'price-pop lands as the badge pops');
    assert.ok(fs.readdirSync(path.join(r.outDir, 'audio', 'sfx')).length >= 3);
    const story = fs.readFileSync(path.join(r.outDir, 'storyboard.md'), 'utf8');
    for (const k of ['- VISUAL:', '- VOICE: "Dirty sneakers?"', '- MUSIC:', '- SFX: impact']) assert.ok(story.includes(k), k);
  });

  test('5. user-provided voice file: split at pauses, each phrase starts as its scene lands', () => {
    const r = ok('user-voice-file');
    const t = timeline(r);
    assert.equal(t.voiceover.provider, 'file');
    assert.equal(t.voiceover.mode, 'phrases');
    assert.equal(t.voiceover.segments.length, 4);
    t.voiceover.segments.forEach((seg) => {
      const sc = t.sync.scenes[seg.scene];
      assert.ok(seg.start >= sc.start && seg.start <= sc.start + 0.5);
    });
    assert.doesNotMatch(r.audio.label ?? '', /DEMO AUDIO/, 'the user\'s own voice is not labelled DEMO AUDIO');
  });

  test('6. user-provided music shorter than the ad loops to the end (no silent tail)', () => {
    const r = ok('user-music');
    assert.match(r.audio.music.source, /my-music\.mp3/);
    assert.deepEqual(r.audio.metrics.silences, []);
    assert.ok(r.audio.metrics.ctaMeanDb > -40, 'audible under the CTA');
  });

  test('7. multiple sfx: named, aliased and user-supplied effects at the requested times', () => {
    const r = ok('multi-sfx');
    const t = timeline(r);
    assert.equal(t.sfx.length, 6);
    assert.deepEqual(t.sfx.map((s) => s.type), ['impact', 'whoosh', 'ding', 'cash', 'riser', 'click']); // sorted by time
    t.sfx.forEach((s) => assert.ok(s.end <= t.duration + 1e-6));
    // each effect is actually audible in the final mix right where it was placed
    for (const s of t.sfx) assert.ok(meanDb(r.video, s.start, 0.15) > -45, `${s.type} audible`);
  });

  test('8. ducking: measured music level drops under the (silent) voice and recovers after', () => {
    const r = byTitle(run.reports, 'ducking-probe');
    // the probe's voice is muted on purpose, so QA must flag exactly that — and nothing else
    assert.ok(r.video && r.errors.length > 0 && r.errors.every((e) => /barely audible|Music under the voice|not clearly louder/.test(e)), r.errors.join(' | '));
    const t = timeline(r);
    const ranges = t.music.duckRanges;
    // longest ducked range vs longest un-ducked gap (inset by attack/release so we measure steady state)
    const ducks = ranges.map(([a, b]) => [a + 0.2, b - 0.2]).filter(([a, b]) => b - a > 0.3);
    const edges = [[t.music.fadeIn + 0.1, ranges[0][0]], ...ranges.slice(1).map((rg, i) => [ranges[i][1], rg[0]]), [ranges.at(-1)[1], t.duration - t.music.fadeOut]];
    const gaps = edges.map(([a, b]) => [a + 0.35, b - 0.15]).filter(([a, b]) => b - a > 0.25);
    const longest = (xs) => xs.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
    assert.ok(ducks.length && gaps.length, `need a ducked range and an open gap: ${JSON.stringify(ranges)}`);
    const [da, db] = longest(ducks);
    const [ga, gb] = longest(gaps);
    const ducked = meanDb(r.video, da, db - da);
    const open = meanDb(r.video, ga, gb - ga);
    assert.ok(open - ducked >= 8, `music ${open} dB in the gap ${ga.toFixed(2)}–${gb.toFixed(2)}s vs ${ducked} dB while "speaking" ${da.toFixed(2)}–${db.toFixed(2)}s (expect ≈12 dB: 0.2 → 0.05)`);
  });

  test('9. audio shorter than the video: planned duration kept, music fills, nothing silent', () => {
    const r = ok('audio-shorter');
    const t = timeline(r);
    assert.ok(Math.abs(t.duration - t.sync.targetDuration) < 0.05);
    assert.deepEqual(r.audio.metrics.silences, []);
  });

  test('10. audio longer than expected: scenes re-timed to the speech, nothing cut off, reported', () => {
    const r = ok('audio-longer');
    const t = timeline(r);
    assert.ok(t.duration > t.sync.targetDuration + 0.5, `${t.duration} vs ${t.sync.targetDuration}`);
    const line = t.voiceover.segments[0];
    assert.ok(line.end <= t.sync.scenes[1].start + 0.01, 'first line ends before the next scene takes over');
    assert.ok(r.warnings.some((w) => /re-timed/.test(w)));
    assert.ok(Math.abs(r.file.duration - t.duration) < 0.05, 'video length follows the narration');
  });
});

describe('showcase', () => {
  test('15. multi-product showcase: every item labelled, a swipe on each item change', () => {
    const r = ok('showcase');
    const board = fs.readFileSync(path.join(r.outDir, 'storyboard.md'), 'utf8');
    for (const label of ['Kit One R299', 'Kit Two', 'Kit Three']) assert.ok(board.includes(label), label);
    const swipes = timeline(r).sfx.filter((e) => /showcase item/.test(e.reason));
    assert.deepEqual(swipes.map((e) => e.reason), ['showcase item 2', 'showcase item 3']);
    assert.ok(swipes[0].start < swipes[1].start);
  });

  test('16. showcase with one item or a missing image → FAIL before rendering', () => {
    const dir = tmp('showcase-bad');
    const res = render(writeSpecs(dir, {'bad-showcase': spec({scenes: [
      {type: 'showcase', duration: 3, items: [{image: SAMPLE_PRODUCT, label: 'Only one'}]},
      {type: 'showcase', duration: 3, items: [{image: 'missing.jpg', label: 'A'}, {label: 'B'}]}]})}));
    assert.equal(res.code, 1);
    const msg = res.reports[0].errors.join(' | ');
    assert.match(msg, /items must list 2–8 products/);
    assert.match(msg, /missing\.jpg/);
    assert.match(msg, /items\[1\]/);
  });
});

describe('failures are reported, never silent', () => {
  test('11. missing audio file → FAIL before rendering, with the path', () => {
    const dir = tmp('fail');
    const res = render(writeSpecs(dir, {'missing-audio': spec({audio: {voiceover: {provider: 'file', audioFile: 'does-not-exist.mp3'}, music: {audioFile: 'also-missing.wav'}}})}));
    assert.equal(res.code, 1);
    const r = res.reports[0];
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /Missing audio file for voiceover\.audioFile: .*does-not-exist\.mp3/.test(e)));
    assert.equal(r.video, undefined, 'nothing rendered');
  });

  test('12. missing ElevenLabs key → FAIL with setup instructions and alternatives', () => {
    const dir = tmp('nokey');
    const res = render(writeSpecs(dir, {'no-key': spec({audio: {voiceover: {provider: 'elevenlabs', voice: 'energetic male', script: voiceScript}}})}), {env: {ELEVENLABS_API_KEY: ''}});
    assert.equal(res.code, 1);
    const msg = res.reports[0].errors.join(' ');
    assert.match(msg, /ELEVENLABS_API_KEY is not set/);
    assert.match(msg, /provider "file"/);
    assert.match(msg, /provider "local"/);
  });
});

describe('concepts', () => {
  test('13. three concepts in one command, each with its own audio style', () => {
    const dir = tmp('concepts');
    const specs = {
      'concept-luxury': spec({style: 'luxury', scenes: [{type: 'logo', duration: 2.2}, ...scenes(4).slice(1)], audio: {voiceover: local({voice: 'deep'}), music: {}}}),
      'concept-viral': spec({style: 'viral', audio: {voiceover: local({voice: 'energetic'}), music: {}}}),
      'concept-sale': spec({style: 'sale', scenes: [{type: 'sale', duration: 2.2, text: 'Black *Friday*'}, ...scenes(4).slice(1)], audio: {voiceover: local(), music: {}}}),
    };
    const res = render(writeSpecs(dir, specs));
    assert.equal(res.code, 0, res.stdout.slice(-1500));
    assert.equal(res.reports.length, 3);
    const outDirs = new Set(res.reports.map((r) => r.outDir));
    assert.equal(outDirs.size, 3);
    const voices = res.reports.map((r) => r.audio.voice.voice);
    assert.ok(voices.includes('flite:rms') && voices.includes('flite:kal16'));
    for (const r of res.reports) {
      assert.ok(r.ok, r.errors.join(' | '));
      assert.ok(audioStream(r.video));
      assert.ok(fs.existsSync(path.join(r.outDir, 'audio', 'audio-timeline.json')));
    }
  });
});

test('14. every visual style rendered with audio (luxury, clean, streetwear, viral, sale)', () => {
  const styles = new Set(run.reports.filter((r) => r.ok && r.audio).map((r) => JSON.parse(fs.readFileSync(path.join(r.outDir, 'spec.resolved.json'), 'utf8')).style));
  for (const s of ['luxury', 'clean', 'streetwear', 'viral', 'sale']) assert.ok(styles.has(s), s);
});
