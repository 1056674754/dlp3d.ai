#!/bin/bash
# Download Sherpa-ONNX KWS model and JNI libraries for Android wake word detection.
#
# Usage:
#   ./scripts/setup-kws.sh
#
# This downloads:
#   - sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01 model (~12.5MB)
#   - libsherpa-onnx-jni.so + dependencies for arm64-v8a (~34MB)
#
# Prerequisites: curl, tar
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$ANDROID_ROOT/android/app/src/main"
ASSETS_DIR="$APP_DIR/assets/models/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01"
JNI_DIR="$APP_DIR/jniLibs/arm64-v8a"

SHERPA_VERSION="1.12.38"
MODEL_BASE_URL="https://www.modelscope.cn/api/v1/models/pkufool/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01/repo?Revision=master&FilePath="

log()  { echo -e "\033[1;36m▶ $1\033[0m"; }
ok()   { echo -e "\033[1;32m✓ $1\033[0m"; }

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# ── 1. Download KWS model from ModelScope ──
log "Downloading KWS model files..."

mkdir -p "$ASSETS_DIR"

for file in encoder-epoch-12-avg-2-chunk-16-left-64.onnx \
            decoder-epoch-12-avg-2-chunk-16-left-64.onnx \
            joiner-epoch-12-avg-2-chunk-16-left-64.onnx \
            tokens.txt; do
  if [ -f "$ASSETS_DIR/$file" ]; then
    echo "  $file (already exists, skipping)"
  else
    echo "  $file ..."
    curl -sL "${MODEL_BASE_URL}${file}" -o "$ASSETS_DIR/$file"
  fi
done

# Create keywords.txt if not present
if [ ! -f "$ASSETS_DIR/keywords.txt" ]; then
  cat > "$ASSETS_DIR/keywords.txt" << 'KEYWORDS'
h ēi n ǐ h ǎo @嘿你好
n ǐ h ǎo @你好
KEYWORDS
  echo "  keywords.txt (created)"
fi

ok "KWS model files ready at $ASSETS_DIR"

# ── 2. Download JNI libraries from GitHub releases ──
log "Downloading Sherpa-ONNX JNI libraries (arm64-v8a)..."

mkdir -p "$JNI_DIR"

JNI_ARCHIVE="$TMPDIR/sherpa-onnx-android.tar.bz2"
curl -sL "https://github.com/k2-fsa/sherpa-onnx/releases/download/v${SHERPA_VERSION}/sherpa-onnx-v${SHERPA_VERSION}-android.tar.bz2" \
  -o "$JNI_ARCHIVE"

tar xjf "$JNI_ARCHIVE" -C "$TMPDIR"

for so in libsherpa-onnx-jni.so libsherpa-onnx-c-api.so libsherpa-onnx-cxx-api.so libonnxruntime.so; do
  if [ -f "$TMPDIR/jniLibs/arm64-v8a/$so" ]; then
    cp "$TMPDIR/jniLibs/arm64-v8a/$so" "$JNI_DIR/"
    echo "  $so"
  else
    echo "  WARNING: $so not found in archive"
  fi
done

ok "JNI libraries ready at $JNI_DIR"
echo ""
ok "Setup complete! Run './gradlew assembleDebug' to build."
