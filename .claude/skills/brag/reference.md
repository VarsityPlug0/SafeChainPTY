# /brag reference

## Ad spec (JSON)

```jsonc
{
  "title": "string — used for the output folder name",
  "concept": "one sentence (goes into storyboard.md)",
  "style": "luxury | streetwear | clean | viral | sale",
  "format": {"width": 1080, "height": 1920, "fps": 30},      // optional; defaults shown
  "brand": {
    "name": "BEVANSSONS",            // matches presets/brands/<slug>.json → merged in
    "logo": "path/to/logo.png",      // optional; otherwise an animated wordmark
    "website": "…", "handle": "@…",  // optional, only if real
    "colors": {"bg": "#…", "bg2": "#…", "accent": "#…", "accent2": "#…", "text": "#…"},  // optional overrides
    "displayFont": "anton | archivo | inter | playfair", "bodyFont": "inter"            // optional
  },
  "product": {"name": "required", "price": "as given, e.g. R299", "images": ["path.png", "…"]},
  "cta": {"text": "Shop Now", "detail": "optional line under the button, e.g. a real URL"},
  "transition": {"type": "auto | slide | wipe | zoom | fade | none", "duration": 0.45},
  "audio": { /* optional — see "Audio" below; omit for a silent, visual-only ad */ },
  "scenes": [ /* see below */ ]
}
```

- Paths are absolute or relative to the spec file. Missing files fail validation before rendering.
- Brand presets: with the brand's `defaultStyle` the full preset palette applies. With another style, only the brand's `accent` carries over and the style provides the rest. `colors` set in the spec always win.
- Text markup: `*word*` highlights a word (accent colour; a marker box in streetwear/sale/viral).

### Scene types

Every scene has `"duration"` in seconds (0.8–10).

| type | fields | what it does |
|---|---|---|
| `hook` | `text`*, `subtext` | Slammed kinetic headline with blur-in, impact shake (energetic styles), accent bar wipe, subtext rises, slow camera push |
| `statement` | `text`*, `subtext` | Large word-by-word masked rise, used for brand lines and transitions in the story |
| `productReveal` | `headline`, `image` (index) | Product revealed through an expanding circular mask, scale/rotate settle, glow and light sweep, then a headline |
| `productZoom` | `text`, `image` | Controlled camera push-in on the product with parallax: a giant outlined word behind, accent rings in front |
| `features` | `title`, `items`* (≤4, user-supplied facts only) | Rows slide in with self-drawing check marks |
| `beforeAfter` | `before`, `after` (user photos), `labels`, `caption` | Divider sweeps across to reveal "after"; labelled DEMO panels if photos are missing |
| `price` | `label` (e.g. "Only"), `caption` | Product plus a spring-popped rotating starburst with the exact price |
| `sale` | `text`*, `subtext` | Crossing marquee tapes plus a slammed event headline |
| `logo` | `tagline` | Logo wipe-in, or a tracking-in wordmark with drawn underline |
| `cta` | `headline` | Headline plus the CTA button (spring, pulse, glow ring, nudging arrow) |
| `final` | `headline` | End card: brand, floating product, price badge, headline, CTA (hold ≥ 2s) |

\* required. The last scene must be `final` or `cta`.

## Styles

| style | look | type | transitions | pace |
|---|---|---|---|---|
| luxury | black/champagne gold, light rays | Playfair Display 900 | fade / wipe | slow, 0.6s transitions recommended |
| streetwear | near-black + acid lime, perspective grid | Anton, uppercase | whip slides | fast |
| clean | light grey/white + blue | Inter 800 | wipes | medium |
| viral | purple→pink + yellow/cyan | Archivo Black, uppercase | punch-zoom | very fast |
| sale | black/red + yellow, moving stripes | Anton, uppercase | punch-zoom | fast |

## Components (engine/src/components)

All take their colours and fonts from the active style (`useAd()`), sizes scale with the video width, and text is auto-fitted (never clipped silently).

| Component | Purpose |
|---|---|
| `Background` | Gradient, two parallax light layers, style pattern (grid/stripes/rays/orbs), animated film grain, vignette |
| `KineticText` | Word-by-word typography: `rise` (masked), `slam`, `pop`, `fade`. Auto-size/wrap; `*highlight*` support; DOM width QA |
| `Hook` | Opening scroll-stopper built from KineticText |
| `ProductImage` / `PlaceholderProduct` | User photo (contain-fit, shadow, idle float; `product.imageFrame: "card"` gives photos with a background a rounded, gold-edged frame) or a branded 3D placeholder package tagged DEMO |
| `ProductReveal` | Circular mask reveal + settle + light sweep |
| `ProductZoom` | Camera push-in with parallax layers |
| `PriceBadge` | Rotating starburst, spring pop, exact price |
| `FeatureList` | Staggered rows with drawn check marks |
| `SaleBanner` | Marquee tapes + slam headline |
| `CTAButton` | Button with spring entrance, pulse, glow ring, arrow; safe-area QA |
| `LogoReveal` | Logo wipe or tracking-in wordmark |
| `BeforeAfter` | Sweeping split comparison |
| `FinalFrame` | End card composition |
| `Transitions` | `presentationFor(theme, i)`: slide / wipe / fade / custom `zoomPunch`, via @remotion/transitions |
| `SafeArea`, `useInFrame` | Keeps content clear of social-app UI (top ~11.5%, bottom ~20%); reports elements outside the frame |

## QA performed by `scripts/render.mjs`

- **Before rendering:** schema checks, known scene types, durations, required fields, asset existence and types, last scene is `final`/`cta` (≥ 2s), total duration (hard limit 5–60s, warning outside 10–20s).
- **During rendering:** components log `BRAG_QA` events:
  - `text-overflow` (fit impossible, or rendered line wider than its box);
  - `text-layout-mismatch` (rendered width ≠ font measurement, e.g. missing spaces or font fallback);
  - `out-of-frame` / `outside-safe-area`;
  - `cta-visible`.
- **After rendering:**
  - ffprobe checks the codec (H.264), resolution, and duration (±1.5 frames) and that the file isn't suspiciously small;
  - a frame from the middle of each scene and the very last frame are extracted, along with a contact sheet.

## Audio

Optional. With no `audio` section, `null`, or `"enabled": false`, the ad renders exactly as a silent, visual-only ad. The legacy form `"audio": "song.mp3"` still works: one music bed at full volume with short fades.

```jsonc
"audio": {
  "enabled": true,
  "preset": "streetwear",              // audio preset; default = style
  "sync": "voice",                      // "voice" (default): scenes follow the narration | "fixed": error if a line doesn't fit
  "voiceover": {
    "provider": "local | neural | flite | elevenlabs | file",   // default: file if audioFile, elevenlabs if ELEVENLABS_API_KEY, else local
                                        // local = neural (Kokoro, natural) if installed, else flite (robotic, DEMO AUDIO)
    "voice": "energetic male",          // description, ElevenLabs id/name, Kokoro id (am_puck, af_heart, bm_george…) or Flite voice
    "script": [{"scene": 0, "text": "Dirty sneakers?"}, {"scene": 3, "text": "Only R299.", "say": "Only two hundred and ninety-nine rand."}],
    "text": "…",                        // alternative to script: sentences are spread over the scenes in order
    "audioFile": "voiceover.mp3",       // provider "file": one take (split at pauses), or per line: script[i].audioFile
    "speed": 1.0, "volume": 1.0, "emotion": "energetic", "model": "eleven_multilingual_v2"
  },
  "music": {"audioFile": "music.mp3 | demo", "volume": 0.18, "duckVolume": 0.05, "duckUnderVoice": true, "loop": true, "fadeIn": 0.6, "fadeOut": 1.2, "startAt": 0},
  "sfx": "auto",                        // "auto" | "none" | [{"type": "whoosh", "time": 2.1} | {"type": "cash", "scene": 3, "offset": 0.4, "volume": 0.5, "audioFile": "my.wav"}]
  "sfxLibrary": {"whoosh": "my-sfx/whoosh.wav"},   // replace/add named effects
  "maxSfx": 5
}
```

**Pipeline** (`scripts/audio/`, runs inside `render.mjs` before bundling):

1. **Voice.** Each script line becomes its own clip:
   - `local`: the best offline voice available, i.e. `neural` if installed, else `flite`.
   - `neural`: Kokoro-82M neural TTS (Apache-2.0, natural-sounding, offline; `scripts/setup-voice.sh` installs it into `engine/.voice/`). Descriptions map to Kokoro's best-rated voices: energetic → am_puck, deep → am_fenrir, male → am_michael, female → af_heart, British → bm_george / bf_emma.
   - `flite`: Flite TTS built into ffmpeg; robotic, labelled DEMO AUDIO.
   - A brand `pronunciation` (e.g. from the brand preset) replaces the brand name in every spoken line that has no explicit `say`.
   - `elevenlabs`: one request per line, with previous/next text for natural prosody.
   - `file`: the take is split at pauses, one phrase per line; if that's impossible it plays as one continuous take.

   Clips are trimmed of silence, converted to 48 kHz stereo and loudness-normalised to -16 LUFS, then measured.
2. **Sync.** Scene `i` must last `lead + speech + tail`:
   - lead = 0.2 s (first scene) or ≈0.33 s (lands during the transition);
   - tail = transition + 0.2 s, or 0.9 s for the last scene.

   Scenes grow when narration is longer and return toward their planned length when it's shorter, never below a per-type minimum for the visuals. Speech is never time-stretched. Re-timing is reported as a warning.
3. **Music.** Loudness-normalised, looped (`loop`), trimmed to the video, faded in and out. While a line plays it ducks to `duckVolume`, with a 0.12 s attack and 0.3 s release.
4. **SFX.**
   - `auto`: the style preset maps scene events to effects with priorities. The budget is ≈3–7 per 15 s, at least 0.35 s apart, and effects that land under speech are softened by ≈4 dB.
   - Explicit cues: placed at their `time` or at `scene` + `offset`.

   Anything past the end is trimmed or dropped, with a warning.
5. **Mix.** `<AdAudio>` in the Remotion composition places each voice clip and effect in a `<Sequence>`, and plays the music with a frame-accurate volume curve (`loopVolumeCurveBehavior: "extend"`). Remotion renders the final AAC track; there is no separate merge step.

**Audio presets** (`scripts/audio/presets.mjs`):

| | voice (neural · flite / ElevenLabs) | music bed | max SFX | typical effects |
|---|---|---|---|---|
| luxury | am_fenrir · rms / deep calm male, 0.95× | slow cinematic pad, 0.16 → 0.045 | 3 | cinematic-hit on reveal, shine on logo/end |
| streetwear | am_puck · kal16 / energetic young male | boom-bap beat, 0.2 → 0.05 | 5 | impact hook, whoosh reveal, price-pop, swipe, CTA click |
| viral | am_puck · kal16 / fast energetic, 1.08× | four-on-the-floor, 0.2 → 0.05 | 7 | impact, whoosh, swipe, price-pop + cash, riser, click, transition whooshes |
| clean | af_heart · slt / clear friendly female | light groove, 0.15 → 0.045 | 4 | soft whoosh, pop, click |
| sale | am_michael · kal16 / energetic announcer, 1.05× | high-energy beat, 0.2 → 0.055 | 6 | impact, cash + price-pop, riser, impact on CTA |

**Sound library** (`scripts/audio/library.mjs`, generated by ffmpeg into `engine/audio-library/`): whoosh, transition, swipe, impact, cinematic-hit, pop, price-pop, click, cash, shine, rise. Aliases: hit, boom, cta, ding, sparkle, riser, slide, wipe. There is also one generated demo music loop per style. Everything is synthesised locally, so there are no licensing issues; it's labelled DEMO MUSIC.

**Output:**

```
brag-output/<render>/
  ad.mp4  poster.jpg  storyboard.md  report.json  spec.json  spec.resolved.json  qa/
  audio/
    voiceover.mp3        all voice lines at their final positions
    music.mp3            the bed as mixed (looped, trimmed, faded, ducked)
    sfx/                 the effect files used
    audio-timeline.json  scenes (planned → final), voice segments, music + duck ranges, SFX — all in seconds
```

**Audio QA** (`scripts/audio/qa.mjs`, on the final MP4, added to `report.json` → `audio.metrics`):

| | |
|---|---|
| **Errors** | no audio stream · codec not AAC/MP3 · sample rate < 44.1 kHz · audio vs video length off by more than 0.1 s · audio past the final frame · peak ≥ 0 dBFS · near-silent mix · a voice line below -38 dB in the mix · voice not ≥ 3 dB above music-only passages · ducked music not ≥ 6 dB below the voice · silent CTA · SFX past the end |
| **Warnings** | silent gaps (> 0.8 s with music, > 2.5 s voice-only) · hot peaks · scene re-timing · DEMO voice fallback |

## Licences

Remotion is free for individuals and companies with up to 3 employees; larger companies need a Remotion company licence (remotion.dev/license). The bundled fonts (Anton, Archivo Black, Inter, Playfair Display) are SIL Open Font License. The SFX and demo music are generated locally by `scripts/audio/library.mjs`. User-supplied music and voice must be licensed for the intended use. ElevenLabs usage is subject to the user's ElevenLabs plan and terms.
