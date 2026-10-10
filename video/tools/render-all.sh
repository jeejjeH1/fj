#!/usr/bin/env bash
# Render the full video in N parallel chunks, then concatenate.  usage: tools/render-all.sh [fps] [workers]
set -euo pipefail
cd "$(dirname "$0")/.."
FPS=${1:-60}; N=${2:-3}
DUR=$(node -e "
const fs=require('fs');const s=fs.readFileSync('src/scenes.js','utf8');
const d=[...s.matchAll(/^scene\('[^']+', ([\d.]+),/gm)].reduce((a,m)=>a+ +m[1],0);console.log(d)")
echo "duration $DUR s @ $FPS fps, $N workers"
rm -f out/part_*.mp4 out/parts.txt
for ((k=0;k<N;k++)); do
  A=$(python3 -c "print(round($DUR*$k/$N*$FPS)/$FPS)"); B=$(python3 -c "print(round($DUR*($k+1)/$N*$FPS)/$FPS)")
  node tools/render.mjs --fps "$FPS" --from "$A" --to "$B" --out "out/part_$k.mp4" > "out/part_$k.log" 2>&1 &
  echo "file 'part_$k.mp4'" >> out/parts.txt
done
wait
ffmpeg -y -loglevel error -f concat -safe 0 -i out/parts.txt -c copy out/video_silent.mp4
echo done
