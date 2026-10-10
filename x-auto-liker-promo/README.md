# X Auto Liker — 10s promo

A 10-second motion-graphics intro for the `x-auto-liker` extension: 1920×1080, 60 fps, H.264 + AAC, about −14 LUFS. The file is ready to upload to X.

All of it is generated from code; there is no stock footage.

| Layer | How |
|---|---|
| Motion | `src/main.js` has 5 scenes: logo reveal, pasting links (counter 0→30), timing sliders, auto-like run, and the final lockup with confetti. Every frame is a pure function of `t`. |
| Sound | `tools/audio.py` makes a procedural 128 BPM track plus SFX (ticks, whooshes, impacts, a rising bell on every like). It is synced to `out/events.json`, which the timeline exports. |
| Render | `tools/render.mjs` steps headless Chromium frame by frame and pipes the frames to ffmpeg. |

Final file: `x_auto_liker_promo.mp4`

## Build

```bash
cd x-auto-liker-promo
npm install
pip install numpy scipy
tools/build.sh                              # -> x_auto_liker_promo.mp4
node tools/render.mjs --stills 1.5,5.8,9.6  # quick frame previews in out/
```
