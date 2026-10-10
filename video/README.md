# Internet Court — motion graphics (X / Twitter, 16:9)

A ~2:09, 1920×1080 @ 60 fps motion-graphics video for the thread
**“Your AI agent can stay inside its budget and still do the wrong thing.”**
(MetaMask × GenLayer · Internet Court case study).

Everything is generated from code — no stock footage:

| Layer | How |
|---|---|
| 3D logos | `tools/vectorize.py` traces both PNG logos into polygon layers → Three.js `ExtrudeGeometry` (fox = layered low-poly facets; GenLayer and Internet Court = glossy black with soft-pink sides) with soft contact shadows on a plain background |
| Motion / UI | `src/scenes.js` — 18 scenes (kinetic type, typing, UI mockups, jury simulation, appeals counter, verdicts…), every frame a pure function of time |
| Cursor | Keyframed mouse pointer with click squash + ripple; drives hover states |
| Sound | `tools/audio.py` — procedural 120 BPM track (D minor) + SFX: minimal soft keystroke ticks, mouse clicks, whooshes, impacts, risers, glitches, UI blips. All synced to `out/events.json`, exported by the timeline itself |
| Render | `tools/render.mjs` — headless Chromium (Playwright), deterministic frame stepping, piped to ffmpeg/x264 |

## Final video

`video/internet_court_x.mp4` — 1920×1080, 60 fps, H.264 + AAC 256k, 2:09, ~30 MB, −14 LUFS. Light minimal theme (white · soft pink · black). Ready to upload to X.

## Build

```bash
cd video
npm install
pip install opencv-python-headless scipy numpy
tools/build.sh            # -> out/internet_court_x.mp4   (FPS=30 WORKERS=4 tools/build.sh for a faster pass)
node tools/render.mjs --stills 12,50,124   # quick frame previews in out/
```
