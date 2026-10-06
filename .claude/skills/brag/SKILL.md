---
name: brag
description: Make a real motion-graphics video ad (rendered MP4, vertical 1080x1920 by default) for a product — concept, storyboard, copy, kinetic typography, product reveals, transitions, price badge and CTA, with optional audio (voiceover via ElevenLabs/local/own file, background music with ducking, sound effects, all synced). Use when the user runs /brag or asks for a video ad, reel, TikTok/Instagram/Story ad, promo video or several ad concepts for a product.
argument-hint: <what ad to make, e.g. "a 15 second Instagram ad for my sneaker cleaning kit, price R299">
---

# /brag — motion-graphics ad generator

Turn the user's request into a finished, verified MP4. You do the creative work (concept, storyboard, copy) and write an **ad spec**; the bundled Remotion engine renders it and runs QA.

Request: $ARGUMENTS

Paths below are relative to this skill's folder: `.claude/skills/brag/` in the project root.

## 0. One-time setup (only if needed)

Check whether `engine/node_modules/remotion` exists. If it doesn't, run `bash .claude/skills/brag/engine/scripts/setup.sh` (installs pinned npm packages, copies the bundled fonts and generates the local SFX/demo-music library; takes about a minute). This needs Node 18+ and `ffmpeg`/`ffprobe` on PATH. On a machine without `/opt/pw-browsers`, Remotion downloads its own headless Chrome the first time it renders.

## 1. Build the brief

Extract the following from the request and the conversation. Don't ask questions unless the **product name** is missing; use these defaults otherwise.

| Field | Source / default |
|---|---|
| Product name | **required**, exactly as the user wrote it |
| Price | only if given, kept **exactly** as written (e.g. `R299`) |
| Brand | as given. If it matches a preset in `engine/presets/brands/` (e.g. `BEVANSSONS`), set `brand.name` to it and the preset is merged automatically. Otherwise use the name given, or `"Your Brand"` if none. |
| Product images | file paths the user gave or attached, or images they point to in the project. Never pick random project images. None → placeholder (it is labelled DEMO). For a test run, if the user asks for "the sample product", use `engine/examples/sample-product.png` (test artwork). |
| Before/after photos | only if the user supplies both |
| Style | `luxury`, `streetwear`, `clean`, `viral` or `sale`, inferred from the request ("Black Friday"/"sale" → `sale`, "TikTok"/"viral" → `viral`, "luxury"/"premium" → `luxury`, sneakers/street → `streetwear`, else `clean`) or the brand's `defaultStyle` |
| Duration | requested length, else 15s. Keep between 10–20s unless asked otherwise. |
| Format | 1080×1920 @30fps (9:16). Use 1080×1080 for "square/feed" or 1920×1080 for "YouTube/landscape" via `format`. |
| CTA | the user's CTA, else `Shop Now`. `cta.detail` / `brand.website` / `brand.handle` only if real ones were given. |
| Concepts | "3 concepts/variations" → write 3 different specs (different style, hook and scene order) and render them in one command |

## 2. Truthfulness rules (non-negotiable)

- Do **not** invent specifications, ingredients, contents, materials, sizes, results, statistics, reviews, testimonials, ratings, awards, discounts, "% off", "free shipping", guarantees, deadlines or scarcity ("only 3 left").
- `features` items and `beforeAfter` scenes require facts or photos the user supplied. If there are none, omit those scenes.
- Event framing ("Black Friday") is fine, but state a discount only if the user gave one.
- Copy may be persuasive but not factual-sounding unless it's true: "Dirty kicks?" is fine; "Removes 99% of stains" is not, unless the user said so.
- If no product photo was supplied, the placeholder is shown and the report must say the ad is a DEMO until real photos are added.

## 3. Concept, storyboard and copy

Write a one-sentence `concept`, then choose scenes. Durations are in seconds, and each transition overlaps the neighbouring scenes:

`total = sum(scene durations) − (number of scenes − 1) × transition`. The default transition is 0.45s, which renders as 14 frames = 0.467s at 30fps. So for 15s with 5 scenes, the scene durations must sum to about **16.87s**; with 4 scenes, about 16.4s. Always do this arithmetic. The renderer's duration warning tells you if you're off.

Recommended structures:

- **15s product ad:** `hook` 2.8 → `productReveal` 3.3 → `productZoom` 3.0 → `price` 3.1 (if a price is known) → `final` 4.67 (= 15.0s)
- **Luxury:** `logo` 2.4 → `statement` 2.6 → `productReveal` 3.2 → `features` 3.4 (if facts were given) → `final` 4.2, with `"transition": {"duration": 0.6}`
- **Viral/TikTok:** short scenes (2–2.6s), `"transition": {"duration": 0.35}`, `hook` in the first 2s, finish with `cta` or `final`
- **Sale/event:** `sale` → `productReveal` → `price` → `final`
- **Collection / range (several products):** `logo` → `statement` → `showcase` 7.2 (4 items) → `final` 4.2. Label and price each item only with what the user or store actually lists; if a photo doesn't show the named model, label it at brand level or leave it out.
- **Before/after (user photos):** `hook` → `beforeAfter` 3.2 → `productReveal` → `final`

Copy rules:
- Headlines are 2–6 words. Wrap **one** word in `*asterisks*` to highlight it in the accent colour.
- The hook must work with the sound off and land in under 2s.
- Every word on screen must be readable in about 1.5s, so don't stack long sentences.
- The last scene must be `final` (brand + product + price + CTA) or `cta`, lasting at least 2s, so the CTA is on screen at the end.

## 4. Write the spec

Write each spec to `brag-output/specs/<slug>.json` in the project root. Image paths may be absolute or relative to the spec file. The full schema, all scene types and the components are in [reference.md](reference.md). Minimal example:

```json
{
  "title": "Sneaker Cleaning Kit — Instagram 15s",
  "concept": "Question hook, product reveal, push-in, price pop, end card.",
  "style": "streetwear",
  "brand": {"name": "BEVANSSONS"},
  "product": {"name": "Sneaker Cleaning Kit", "price": "R299", "images": ["/abs/path/kit.png"]},
  "cta": {"text": "Shop Now"},
  "scenes": [
    {"type": "hook", "duration": 2.8, "text": "Dirty *kicks?*", "subtext": "Meet the BEVANSSONS Sneaker Cleaning Kit"},
    {"type": "productReveal", "duration": 3.2, "headline": "The *kit*"},
    {"type": "productZoom", "duration": 3.0, "text": "Built for your *pairs*"},
    {"type": "price", "duration": 3.0, "label": "Only"},
    {"type": "final", "duration": 4.8}
  ]
}
```

## 4b. Audio (only when the user asks for sound)

No mention of voice, voiceover, narration, music, sound or SFX → **omit `audio`**. The ad renders silent, exactly as before.

**Pick the voice provider:**
- The user gave a recording → `"provider": "file"`, plus `audioFile` (one take for the whole ad; it is split at pauses to match your script lines).
- The user asked for ElevenLabs/AI voice → `"provider": "elevenlabs"`. This needs `ELEVENLABS_API_KEY` in the environment; never write keys into files. Check with `test -n "$ELEVENLABS_API_KEY"`. If it's missing, **stop and tell the user**: they can set the key, give a recording, or accept the local DEMO voice. Don't silently switch providers.
- Otherwise → `"provider": "local"`. This is the natural-sounding offline neural voice (Kokoro, Apache-2.0, usable commercially), installed by setup. If it isn't installed, `local` falls back to the robotic Flite voice. The report then shows a warning and the label **DEMO AUDIO**; tell the user to run `bash .claude/skills/brag/engine/scripts/setup-voice.sh`.

**`voice`:** pass the user's description ("energetic male", "deep calm", "female", "british"), an ElevenLabs voice ID/name, or a Kokoro voice ID (e.g. `am_puck`, `af_heart`, `bm_george`). If omitted, the style preset picks one.

**Brand names** are often mispronounced. Brand presets can set `pronunciation` (BEVANSSONS → "Bevans Sons"), which applies to every spoken line automatically. Confirm the real pronunciation with the user.

**Script** (when the user didn't give exact narration), one line per scene:
- Use only verified facts: product name, brand, the user's price and CTA, or the user's own words. The truthfulness rules in section 2 apply to everything spoken.
- About 2.5 words per second. A 15s ad is roughly 25–35 words over 4–5 lines. The hook line is 1–4 words.
- Add `say` for anything a TTS voice would mispronounce: `{"text": "Only R299.", "say": "Only two hundred and ninety-nine rand."}`.
- Lines may differ from the on-screen text (e.g. screen "Dirty *kicks?*", voice "Dirty sneakers?").

**Music:**
- The user's file → `"music": {"audioFile": "path.mp3"}` (loops, trims, fades and ducks automatically).
- Otherwise `"music": {}` uses the generated **DEMO MUSIC** bed for the style.
- Volume and ducking default from the preset (`volume` ≈0.15–0.2, `duckVolume` ≈0.045–0.055, i.e. music ≈18 dB under the voice). Override only on request.

**SFX:**
- `"auto"` (default) places 3–7 effects on events from the style preset: hook impact, reveal whoosh, price-pop, CTA click, …
- `"none"`, or explicit cues, e.g. `[{"type": "whoosh", "scene": 1}, {"type": "cash", "scene": 3, "offset": 0.4}]`.
- Built-in names: whoosh, transition, swipe, impact, cinematic-hit, pop, price-pop, click, cash, shine, rise. User files go via `"audioFile"` or `"sfxLibrary": {"name": "path.wav"}`.

**Sync:** the engine measures every voice line and re-times scenes so each line starts as its scene lands and ends before the next transition. Speech is never stretched. Keep scene durations as planned; the engine adjusts them.

```json
"audio": {
  "voiceover": {"provider": "local", "voice": "energetic male", "script": [
    {"scene": 0, "text": "Dirty sneakers?"},
    {"scene": 1, "text": "Meet the BEVANSSONS Sneaker Cleaning Kit."},
    {"scene": 3, "text": "Only R299.", "say": "Only two hundred and ninety-nine rand."},
    {"scene": 4, "text": "Shop now at BEVANSSONS."}
  ]},
  "music": {"audioFile": "music/upbeat.mp3"},
  "sfx": "auto"
}
```

Audio presets follow `style` (override with `"preset"`):

| style | voice | music | SFX |
|---|---|---|---|
| luxury | deep, slow | slow cinematic pad | ≤3, subtle |
| streetwear | energetic | punchy beat | impact, whoosh |
| viral | fast | energetic | up to 7, strong hook |
| clean | clear, female | light | subtle |
| sale | energetic | high-energy | cash/impacts, CTA hit |

Full audio schema: [reference.md](reference.md#audio).

## 5. Render

From the project root (allow up to 10 minutes; roughly 1–2 minutes per 15s video):

```bash
node .claude/skills/brag/engine/scripts/render.mjs brag-output/specs/<slug>.json [more specs…] --out brag-output
```

For each spec the renderer:
1. validates the spec and assets;
2. renders an H.264 MP4;
3. checks resolution, duration and codec with ffprobe;
4. collects QA from the components (text overflow or width mismatch, elements outside the frame or safe area, CTA visibility);
5. writes `ad.mp4`, `poster.jpg`, `storyboard.md` (TIME/VISUAL/VOICE/MUSIC/SFX per scene), `spec.json`, `report.json` and `qa/` frames plus `qa/contact-sheet.jpg`;
6. with audio, also generates or measures the voice lines, re-times the scenes, has Remotion mix voice, music and SFX into the MP4, then runs audio QA:
   - audio stream, codec, sample rate and channels;
   - audio length matches the video;
   - no clipping;
   - voice louder than the music;
   - no silent gaps;
   - audible CTA;
   - SFX inside the video.

   It writes `audio/` with `voiceover.mp3`, `music.mp3`, `sfx/` and `audio-timeline.json`.

Exit code 0 means every video passed.

## 6. QA and fix loop

1. If the report says **FAIL**, fix the cause: shorten text that doesn't fit, fix missing asset paths, adjust durations, shorten narration, or lower music volume. Then render again.
2. Always **look at** `qa/contact-sheet.jpg` (and `poster.jpg`) with the Read tool. Check that:
   - no text is clipped or awkwardly wrapped;
   - the product is visible;
   - the CTA is readable in the final frame;
   - nothing overlaps badly;
   - each scene matches the storyboard.
3. With audio, read `audio/audio-timeline.json` and the storyboard. Check that:
   - each voice line belongs to the right scene;
   - effects land on visual events;
   - the final duration is close to the request. Re-timed scenes and narration longer than requested appear as warnings; shorten the script if needed.
4. Repeat at most twice. Report anything still imperfect honestly.

## 7. Report back

Tell the user:
- the video path(s), resolution, duration and file size;
- the concept and storyboard (scene, time, on-screen copy);
- whether a DEMO placeholder was used and what to provide for the real version (transparent PNG product photos work best; also logo, website/handle, before/after photos);
- the audio: voice provider and voice, music source, the SFX list and audio QA metrics from `report.json` (`report.audio`). Say plainly when anything is **DEMO AUDIO / DEMO MUSIC** (placeholder) and what to supply for production: an ElevenLabs key or a recorded voiceover, and a licensed music track;
- for silent ads, offer the audio version.

If a SendUserFile tool is available, send `ad.mp4` (and the contact sheet) to the user.

## Audio troubleshooting

- **"ELEVENLABS_API_KEY is not set"** → the user sets it (`export ELEVENLABS_API_KEY=…`, or the environment's secrets settings), gives a recording, or accepts `"provider": "local"`.
- **Voice sounds robotic** → the natural voice isn't installed, so it fell back to Flite. Run `bash .claude/skills/brag/engine/scripts/setup-voice.sh` (python3, ~120 MB), or use ElevenLabs or a recording.
- **"Local voiceover needs ffmpeg built with libflite"** → only relevant for the Flite fallback.
- **"Could not split the voice file into N phrases"** → the take plays continuously. Ask for clearer pauses between lines, or one file per line (`script[i].audioFile`).
- **"Voice is not clearly louder than the music"** → lower `music.volume` / `music.duckVolume`.
- **"Scenes re-timed … narration is longer than the requested duration"** → shorten the script.

## Extending

- **New brand:** copy `engine/presets/brands/_template.json` to `engine/presets/brands/<brand-name>.json`.
- **New look:** add a style in `engine/src/theme.ts`.
- **New scene type:** compose components in `engine/src/scenes.tsx`, and add the type to `SCENE_TYPES` in `engine/src/spec.ts` and `engine/scripts/render.mjs`.
- **New sound effect:** add a recipe in `engine/scripts/audio/library.mjs` (or use `sfxLibrary`). Scene-to-effect timing lives in `engine/scripts/audio/presets.mjs`.
- **Tests:** `cd .claude/skills/brag/engine && npm test` (27 tests, about 5 minutes, no API keys needed).

Preview interactively with `npm run studio` in `engine/`.
