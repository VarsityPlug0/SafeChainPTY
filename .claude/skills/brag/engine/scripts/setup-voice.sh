#!/usr/bin/env bash
# Optional: natural-sounding offline voice for /brag (Kokoro-82M neural TTS, Apache-2.0).
# Creates engine/.voice/ (git-ignored): a Python venv with kokoro-onnx + the model files (~120 MB).
# Without it, the "local" voice falls back to the robotic Flite DEMO voice.
set -euo pipefail
cd "$(dirname "$0")/.."
V=.voice
if [ -f "$V/models/kokoro-v1.0.int8.onnx" ] && [ -f "$V/models/voices-v1.0.bin" ] && "$V/venv/bin/python" -c "import kokoro_onnx" 2>/dev/null; then
  echo "neural voice already installed"; exit 0
fi
command -v python3 >/dev/null || { echo "python3 not found — skipping neural voice"; exit 1; }
python3 -m venv "$V/venv"
"$V/venv/bin/pip" install -q "kokoro-onnx==0.6.1" soundfile
mkdir -p "$V/models"
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  [ -s "$V/models/$f" ] || curl -fsSL -o "$V/models/$f" "$BASE/$f"
done
"$V/venv/bin/python" scripts/audio/kokoro_tts.py --check
echo "neural voice ready"
