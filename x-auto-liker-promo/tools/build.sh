#!/usr/bin/env bash
# Renders the 10s promo: frames -> video, procedural audio, then mux an X-ready MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
FPS="${FPS:-60}"
mkdir -p out
node tools/render.mjs --out out/video.mp4 --fps "$FPS"
python3 tools/audio.py
ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio.wav \
  -c:v copy -movflags +faststart \
  -c:a aac -b:a 256k -ar 48000 -shortest x_auto_liker_promo.mp4
echo "done -> x_auto_liker_promo.mp4"
