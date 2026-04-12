#!/usr/bin/env bash
# Downloads the Vosk Chinese small model and places it in the Android assets directory.
# Run once from the RN android project root:  bash scripts/setup-vosk-model.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASSETS_DIR="${SCRIPT_DIR}/../assets/model-small-cn-0.22"
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip"
TMP_ZIP="/tmp/vosk-model-small-cn-0.22.zip"

if [ -f "${ASSETS_DIR}/am/final.mdl" ]; then
  echo "Vosk model already exists at ${ASSETS_DIR}, skipping download."
  exit 0
fi

echo "Downloading Vosk Chinese small model (~42MB)..."
curl -fSL -o "${TMP_ZIP}" "${MODEL_URL}"

echo "Extracting to ${ASSETS_DIR}..."
mkdir -p "${ASSETS_DIR}"
unzip -q -o "${TMP_ZIP}" -d /tmp/vosk-extract
cp -r /tmp/vosk-extract/vosk-model-small-cn-0.22/* "${ASSETS_DIR}/"
rm -rf /tmp/vosk-extract "${TMP_ZIP}"

# Clean up the old incorrect app-assets location if it exists. react-native-vosk
# scans the project-level assets/ directory for model* folders when Vosk_models
# is not configured.
LEGACY_DIR="${SCRIPT_DIR}/../android/app/src/main/assets/models/vosk-model-small-cn-0.22"
if [ -d "${LEGACY_DIR}" ]; then
  rm -rf "${LEGACY_DIR}"
fi

echo "Done. Model placed at ${ASSETS_DIR}"
ls -lh "${ASSETS_DIR}"
