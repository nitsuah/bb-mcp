#!/usr/bin/env bash
# Render bb-mcp promo spot end to end in Docker.
#
#   promo/build.sh bb-mcp-21s                     # frames → audio → mp4, poster, web cut
#   promo/build.sh bb-mcp-21s --stills 1.5,5,9,15 # a few frames only, for review
#   promo/build.sh bb-mcp-21s --audio             # re-synth audio + remux
#   promo/build.sh bb-mcp-21s --publish           # also copy the web cut + poster to pages/assets/
#
# Each spot is promo/<spot>/{spot.json, compose.html, synth.py, share-copy.txt}.
# compose.html exposes window.render(t) (a pure function of time). Output goes
# to promo/out/<spot>/ (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd -W 2>/dev/null || pwd)"   # Windows path under Git Bash

SPOT=""; MODE="full"; TIMES=""; PUBLISH=0
while [ $# -gt 0 ]; do
  case "$1" in
    --stills) [ $# -ge 2 ] || { echo "--stills needs a time list, e.g. 1.5,5"; exit 1; }
      MODE="stills"; TIMES="$2"; shift 2 ;;
    --audio) MODE="audio"; shift ;;
    --publish) PUBLISH=1; shift ;;
    -*) echo "unknown option $1"; exit 1 ;;
    *) SPOT="$1"; shift ;;
  esac
done
[[ "$SPOT" =~ ^[a-z0-9][a-z0-9-]*$ ]] && [ -f "promo/$SPOT/spot.json" ] || { echo "usage: promo/build.sh <spot> [--stills t,t|--audio] [--publish]"; exit 1; }

docker info >/dev/null 2>&1 || { echo "Docker Desktop isn't running."; exit 1; }
docker build -q -f promo/Dockerfile -t bb-mcp-promo . >/dev/null
mkdir -p "promo/out/$SPOT"
# Mount only the promo directory, preserving the output mount.
# The render.cjs is copied into the image at /repo/render.cjs
run() { MSYS_NO_PATHCONV=1 docker run --rm -v "$REPO/promo:/repo/promo:ro" -v "$REPO/promo/out:/out" bb-mcp-promo "$@"; }

W="/out/$SPOT"; D="/repo/promo/$SPOT"
if [ "$MODE" = stills ]; then
  run node /repo/render.cjs "$SPOT" "$TIMES"
  echo "stills → promo/out/$SPOT/stills/"; exit 0
fi
[ "$MODE" = full ] && run node /repo/render.cjs "$SPOT"

# The inner script is single-quoted and gets its paths as arguments, so the
# outer shell never re-parses them.
run sh -c '
set -e
W="$1"; D="$2"; SPOT="$3"
[ -d "$W/frames" ] || { echo "no frames yet; run without --audio first"; exit 1; }
python3 "$D/synth.py" "$D/spot.json" "$W/audio-raw.wav"
ffmpeg -hide_banner -loglevel error -y -i "$W/audio-raw.wav" -af loudnorm=I=-14:TP=-1.5:LRA=11:linear=true -ar 44100 "$W/audio.wav"
FPS=$(node -p "require(process.argv[1]).fps || 30" "$D/spot.json")
P=$(node -p "const s=require(process.argv[1]); String(Math.round(s.poster*(s.fps||30))).padStart(4,\"0\")" "$D/spot.json")
# The poster frame doubles as frame 0 so every thumbnail shows it; replaced,
# not added, so duration and audio sync stay the same.
[ -f "$W/frames/f0000.orig.png" ] || cp "$W/frames/f0000.png" "$W/frames/f0000.orig.png"
cp "$W/frames/f$P.png" "$W/frames/f0000.png"
ffmpeg -hide_banner -loglevel error -y -framerate "$FPS" -i "$W/frames/f%04d.png" -i "$W/audio.wav" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -shortest "$W/$SPOT.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$W/frames/f$P.png" -q:v 2 "$W/$SPOT.jpg"
ffmpeg -hide_banner -loglevel error -y -i "$W/$SPOT.mp4" -c:v libx264 -preset slow -crf 27 \
  -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$W/$SPOT-web.mp4"
cp "$D/share-copy.txt" "$W/share-copy.txt"
' sh "$W" "$D" "$SPOT"
echo "done → promo/out/$SPOT/$SPOT.mp4"

if [ "$PUBLISH" = 1 ]; then
  cp "promo/out/$SPOT/$SPOT-web.mp4" "docs/brag/$SPOT.mp4"
  cp "promo/out/$SPOT/$SPOT.jpg" "docs/brag/$SPOT.jpg"
  echo "published → docs/brag/$SPOT.mp4, $SPOT.jpg"
fi