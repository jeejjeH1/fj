#!/usr/bin/env bash
# Full pipeline: vectorize logos -> render frames -> synthesize audio -> mux final MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
FPS=${FPS:-60}; WORKERS=${WORKERS:-3}
python3 tools/vectorize.py
tools/render-all.sh "$FPS" "$WORKERS"
python3 tools/audio.py
ffmpeg -y -loglevel error -i out/video_silent.mp4 -i out/audio.wav \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:v copy -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart -shortest out/internet_court_x.mp4
echo "-> out/internet_court_x.mp4"
