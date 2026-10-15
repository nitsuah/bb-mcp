#!/usr/bin/env bash
# Tile a spot's stills (promo/build.sh <spot> --stills ...) into one contact sheet:
#   promo/sheet.sh bb-mcp-21s-vert        -> promo/out/<spot>/sheet.png
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd -W 2>/dev/null || pwd)"
SPOT="$1"
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint sh -v "$REPO/promo/out:/out" bb-mcp-promo -c \
  "cd /out/$SPOT/stills && ls t*.png | wc -l > /tmp/n && ffmpeg -hide_banner -loglevel error -y -pattern_type glob -i 't*.png' -vf \"scale=360:-1,tile=5x2:padding=8:color=black\" -frames:v 1 ../sheet.png"
echo "sheet -> promo/out/$SPOT/sheet.png"
