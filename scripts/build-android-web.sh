#!/bin/bash
# Build script: exports Next.js static site → copies to Android assets
# Usage: ./scripts/build-android-web.sh

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Phase 3: Building web app for APK assets"
echo "========================================="

# 1. Build the Next.js static export
echo "Building Next.js static export..."
cd "$PROJECT_ROOT"
# Avoid blocking first paint on Google Fonts / Inspector in offline WebView (APK).
export NEXT_PUBLIC_OFFLINE_WEBVIEW=1
npm run build

# 2. Verify output exists
if [ ! -d "$PROJECT_ROOT/out" ]; then
  echo "ERROR: Build output directory 'out/' not found. Did 'next build' with output:'export' succeed?"
  exit 1
fi

# 3. Copy output to Android assets directory (RN native project lives under android/android/)
WEB_DIR="$PROJECT_ROOT/android/android/app/src/main/assets/web"
rm -rf "$WEB_DIR"
mkdir -p "$WEB_DIR"

echo "Copying static export to Android assets..."
cp -r "$PROJECT_ROOT/out/"* "$WEB_DIR/"

# Android WebView 在 file:///android_asset 下访问 `/_next` / `_next` 目录不稳定；
# 将其改名为普通目录并重写导出文件内的引用，避免子资源 404。
if [ -d "$WEB_DIR/_next" ]; then
  mv "$WEB_DIR/_next" "$WEB_DIR/next-static"
  python3 - <<'PY' "$WEB_DIR"
from pathlib import Path
import sys

root = Path(sys.argv[1])
suffixes = {'.html', '.txt', '.js', '.css', '.map'}
replacements = [
    ('./_next/', './next-static/'),
    ('/_next/', '/next-static/'),
    ('"_next/', '"next-static/'),
    ("'_next/", "'next-static/"),
]

for path in root.rglob('*'):
    if not path.is_file() or path.suffix not in suffixes:
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = text
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated)
PY
fi

# 4. Optional: CI / 胖包演示 — 校验 public/ 下是否已放入全部 3D 资源（瘦包默认跳过）
if [ "${DLP_CHECK_PACKAGED_3D_ASSETS:-0}" = "1" ]; then
  REQ_CHARS=(
    "Ani-default_481.glb" "KQ-default_420.glb" "HT-default_214.glb"
    "FNN-default_296.glb" "KL-default_214.glb" "NXD-default_321.glb"
  )
  MISSING=0
  for f in "${REQ_CHARS[@]}"; do
    if [ ! -f "$PROJECT_ROOT/public/characters/$f" ]; then
      echo "WARNING: missing packaged character model: public/characters/$f"
      MISSING=1
    fi
  done
  REQ_GROUND=(
    "hdr-seabed.glb" "hdr-black.glb" "hdr-street.glb" "hdr-vast.glb"
    "hdr-cyber_black.glb" "hdr-green.glb"
  )
  for f in "${REQ_GROUND[@]}"; do
    if [ ! -f "$PROJECT_ROOT/public/models/ground/$f" ]; then
      echo "WARNING: missing ground model: public/models/ground/$f"
      MISSING=1
    fi
  done
  REQ_HDR=(
    "hdr-seabed.jpg" "hdr-black.jpg" "hdr-street.jpg" "hdr-vast.jpg" "hdr-cyber_black.png"
  )
  for f in "${REQ_HDR[@]}"; do
    if [ ! -f "$PROJECT_ROOT/public/img/hdr/$f" ]; then
      echo "WARNING: missing HDR texture: public/img/hdr/$f"
      MISSING=1
    fi
  done
  if [ "$MISSING" -ne 0 ]; then
    echo "Some packaged assets are missing under public/ — copy from your art pipeline or server build."
    echo "See android/docs/PACKAGED_WEB_ASSETS.md"
  fi
fi

# 5. Report sizes
echo ""
echo "Output size: $(du -sh "$WEB_DIR" | cut -f1)"
echo "File count: $(find "$WEB_DIR" -type f | wc -l | tr -d ' ')"
echo "========================================="
echo "Static export complete!"
echo "Files copied to android/android/app/src/main/assets/web/"
