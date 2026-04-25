#!/usr/bin/env bash
set -euo pipefail

FFMPEG_VERSION="b6.1.1"
FFMPEG_BASE="https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_VERSION}"

OS=$(uname -s)
ARCH=$(uname -m)

case "${OS}-${ARCH}" in
  Darwin-arm64)  TRIPLE="aarch64-apple-darwin";      ASSET="ffmpeg-darwin-arm64" ;;
  Darwin-x86_64) TRIPLE="x86_64-apple-darwin";       ASSET="ffmpeg-darwin-x64"   ;;
  Linux-aarch64) TRIPLE="aarch64-unknown-linux-gnu";  ASSET="ffmpeg-linux-arm64"  ;;
  Linux-x86_64)  TRIPLE="x86_64-unknown-linux-gnu";   ASSET="ffmpeg-linux-x64"    ;;
  *)
    echo "Unsupported platform: ${OS}-${ARCH}"
    exit 1
    ;;
esac

SIDECAR="src-tauri/binaries/ffmpeg-${TRIPLE}"

if [ -f "$SIDECAR" ]; then
  echo "ffmpeg sidecar already exists: $SIDECAR"
  exit 0
fi

mkdir -p src-tauri/binaries
echo "Downloading ffmpeg sidecar (${ASSET})..."
curl -L -o "$SIDECAR" "${FFMPEG_BASE}/${ASSET}"
chmod +x "$SIDECAR"
echo "Done: $SIDECAR"
