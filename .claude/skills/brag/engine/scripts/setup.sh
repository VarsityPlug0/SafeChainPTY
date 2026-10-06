#!/usr/bin/env bash
# One-time setup for the /brag engine: installs pinned dependencies, copies the
# bundled (SIL OFL) fonts into public/fonts, and generates the local audio library.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d node_modules/remotion ]; then
  npm ci --no-audit --no-fund
fi
mkdir -p public/fonts
F=node_modules/@fontsource
cp "$F/anton/files/anton-latin-400-normal.woff2" public/fonts/
cp "$F/archivo-black/files/archivo-black-latin-400-normal.woff2" public/fonts/
for w in 400 600 800; do cp "$F/inter/files/inter-latin-$w-normal.woff2" public/fonts/; done
for w in 700 900; do cp "$F/playfair-display/files/playfair-display-latin-$w-normal.woff2" public/fonts/; cp "$F/playfair-display/files/playfair-display-latin-$w-italic.woff2" public/fonts/; done
# locally generated SFX + demo music (deterministic ffmpeg synthesis)
node scripts/audio/library.mjs
# natural offline voice (Kokoro, ~120 MB); optional — skip with BRAG_SKIP_NEURAL_VOICE=1
if [ -z "${BRAG_SKIP_NEURAL_VOICE:-}" ]; then bash scripts/setup-voice.sh || echo "neural voice not installed — local voice will use the robotic Flite DEMO voice"; fi
echo "brag engine ready"
