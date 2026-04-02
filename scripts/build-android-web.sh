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
npm run build

# 2. Verify output exists
if [ ! -d "$PROJECT_ROOT/out" ]; then
  echo "ERROR: Build output directory 'out/' not found. Did 'next build' with output:'export' succeed?"
  exit 1
fi

# 3. Copy output to Android assets directory
WEB_DIR="$PROJECT_ROOT/android/app/src/main/assets/web"
rm -rf "$WEB_DIR"
mkdir -p "$WEB_DIR"

echo "Copying static export to Android assets..."
cp -r "$PROJECT_ROOT/out/"* "$WEB_DIR/"

# 4. Report sizes
echo ""
echo "Output size: $(du -sh "$WEB_DIR" | cut -f1)"
echo "File count: $(find "$WEB_DIR" -type f | wc -l | tr -d ' ')"
echo "========================================="
echo "Static export complete!"
echo "Files copied to android/app/src/main/assets/web/"
