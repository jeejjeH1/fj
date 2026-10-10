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
  -movflags +faststart -shortest out/master.mp4
# X/Twitter delivery: cap bitrate so the file stays under 512 MB
ffmpeg -y -loglevel error -i out/master.mp4 -c:v libx264 -preset slow -crf 19 -maxrate 22M -bufsize 44M \
  -profile:v high -level 4.2 -pix_fmt yuv420p -g 120 -c:a copy -movflags +faststart out/internet_court_x.mp4
echo "-> out/internet_court_x.mp4"
