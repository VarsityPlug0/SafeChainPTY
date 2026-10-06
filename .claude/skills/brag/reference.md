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
  "audio": "optional path to licensed music/voice-over (mp3/wav/m4a)",
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
| `ProductImage` / `PlaceholderProduct` | User photo (contain-fit, shadow, idle float) or a branded 3D placeholder package tagged DEMO |
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

## Licences

Remotion is free for individuals and companies with up to 3 employees; larger companies need a Remotion company licence (remotion.dev/license). The bundled fonts (Anton, Archivo Black, Inter, Playfair Display) are SIL Open Font License.
