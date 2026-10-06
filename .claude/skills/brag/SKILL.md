---
name: brag
description: Make a real motion-graphics video ad (rendered MP4, vertical 1080x1920 by default) for a product — concept, storyboard, copy, kinetic typography, product reveals, transitions, price badge and CTA. Use when the user runs /brag or asks for a video ad, reel, TikTok/Instagram/Story ad, promo video or several ad concepts for a product.
argument-hint: <what ad to make, e.g. "a 15 second Instagram ad for my sneaker cleaning kit, price R299">
---

# /brag — motion-graphics ad generator

Turn the user's request into a finished, verified MP4. You do the creative work (concept, storyboard, copy) and write an **ad spec**; the bundled Remotion engine renders it and runs QA.

Request: $ARGUMENTS

Paths below are relative to this skill's folder: `.claude/skills/brag/` in the project root.

## 0. One-time setup (only if needed)

Check whether `engine/node_modules/remotion` exists. If it doesn't, run `bash .claude/skills/brag/engine/scripts/setup.sh` (installs pinned npm packages and copies the bundled fonts; takes about a minute). This needs Node 18+ and `ffmpeg`/`ffprobe` on PATH. On a machine without `/opt/pw-browsers`, Remotion downloads its own headless Chrome the first time it renders.

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

`total = sum(scene durations) − (number of scenes − 1) × transition` (default transition 0.45s, so 15s ≈ 16.8s of scenes for 5 scenes).

Recommended structures:

- **15s product ad:** `hook` 2.6 → `productReveal` 3.0 → `productZoom` 2.6 → `price` 2.8 (if a price is known) → `final` 4.6
- **Luxury:** `logo` 2.4 → `statement` 2.6 → `productReveal` 3.2 → `features` 3.4 (if facts were given) → `final` 4.2, with `"transition": {"duration": 0.6}`
- **Viral/TikTok:** short scenes (2–2.6s), `"transition": {"duration": 0.35}`, `hook` in the first 2s, finish with `cta` or `final`
- **Sale/event:** `sale` → `productReveal` → `price` → `final`
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
5. writes `ad.mp4`, `poster.jpg`, `storyboard.md`, `spec.json`, `report.json` and `qa/` frames plus `qa/contact-sheet.jpg`.

Exit code 0 means every video passed.

## 6. QA and fix loop

1. If the report says **FAIL**, fix the cause: shorten text that doesn't fit, fix missing asset paths, adjust durations. Then render again.
2. Always **look at** `qa/contact-sheet.jpg` (and `poster.jpg`) with the Read tool. Check that:
   - no text is clipped or awkwardly wrapped;
   - the product is visible;
   - the CTA is readable in the final frame;
   - nothing overlaps badly;
   - each scene matches the storyboard.
3. Repeat at most twice. Report anything still imperfect honestly.

## 7. Report back

Tell the user:
- the video path(s), resolution, duration and file size;
- the concept and storyboard (scene, time, on-screen copy);
- whether a DEMO placeholder was used and what to provide for the real version (transparent PNG product photos work best; also logo, website/handle, before/after photos);
- that there is no music unless they supplied a licensed audio file (`"audio": "path.mp3"`).

If a SendUserFile tool is available, send `ad.mp4` (and the contact sheet) to the user.

## Extending

- **New brand:** copy `engine/presets/brands/_template.json` to `engine/presets/brands/<brand-name>.json`.
- **New look:** add a style in `engine/src/theme.ts`.
- **New scene type:** compose components in `engine/src/scenes.tsx`, and add the type to `SCENE_TYPES` in `engine/src/spec.ts` and `engine/scripts/render.mjs`.

Preview interactively with `npm run studio` in `engine/`.
