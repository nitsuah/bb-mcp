#!/usr/bin/env bash
# Generates promo/<spot>/vo/<id>.wav for each line in promo/<spot>/spot.json "narration"
# with Hyperframes' local Kokoro TTS, in Docker. The wavs are committed, so
# build.sh stays offline; re-run this only when the narration changes.
# Reuses vigil's image (vigil/promo/tts/Dockerfile: Node + kokoro-onnx); build it
# once from ~/code/vigil with `docker build -t vigil-promo-tts promo/tts`.
#   promo/tts/narrate.sh bb-mcp-21s-vert
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO="$(pwd -W 2>/dev/null || pwd)"
SPOT="$1"
docker image inspect vigil-promo-tts >/dev/null 2>&1 || { echo "build vigil-promo-tts first (see header)"; exit 1; }
MSYS_NO_PATHCONV=1 docker run --rm -v "$REPO/promo/$SPOT:/spot" -v vigil-promo-hf:/root/.cache vigil-promo-tts node -e '
const { execFileSync } = require("child_process");
const n = require("/spot/spot.json").narration;
require("fs").mkdirSync("/spot/vo", { recursive: true });
for (const l of n.lines) {
  const out = execFileSync("hyperframes", ["tts", l.text, "--voice", n.voice, "--speed", String(n.speed ?? 1), "--output", `/spot/vo/${l.id}.wav`, "--json"], { encoding: "utf8" });
  console.log(l.id, out.trim().split("\n").pop());
}'
