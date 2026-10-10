"""Procedural music + SFX for the promo, synced to out/events.json (written by tools/render.mjs).

usage: python3 tools/audio.py  ->  out/audio.wav
"""
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
data = json.load(open("out/events.json"))
DUR = data["duration"] + 0.6
N = int(DUR * SR)
rs = np.random.default_rng(3)
music = np.zeros((2, N)); sfx = np.zeros((2, N))


def t_(d): return np.arange(int(d * SR)) / SR
def noise(d): return rs.standard_normal(int(d * SR))
def env(d, a, dec): t = t_(d); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / dec)
def nf(n): return 440 * 2 ** ((n - 69) / 12)
def bp(x, lo, hi): return signal.sosfilt(signal.butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def lp(x, f): return signal.sosfilt(signal.butter(2, f, "lowpass", fs=SR, output="sos"), x)
def hp(x, f): return signal.sosfilt(signal.butter(2, f, "highpass", fs=SR, output="sos"), x)


def add(buf, x, t, pan=0.0, g=1.0):
    i = int(t * SR)
    if i >= N: return
    x = x[: N - i] * g
    buf[0, i:i + len(x)] += x * np.sqrt(.5 - pan / 2) * 1.414
    buf[1, i:i + len(x)] += x * np.sqrt(.5 + pan / 2) * 1.414


# ── music: 128 BPM, F minor-ish  (Fm - Db - Ab - Eb) ──
BPM = 128; B = 60 / BPM
CHORDS = [[53, 56, 60, 65], [49, 53, 56, 61], [56, 60, 63, 68], [51, 55, 58, 63]]
BASS = [41, 37, 44, 39]


def kick():
    d = .45; t = t_(d)
    f = 45 + 120 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 1.1 + hp(noise(d), 2000) * env(d, .0005, .004) * .3


def hat(open_=False):
    d = .2 if open_ else .05
    return hp(noise(d), 7000) * env(d, .0005, .06 if open_ else .012) * .35


def clap():
    d = .3; x = bp(noise(d), 900, 4000)
    e = sum(env(d, .0005, .01) * (np.arange(len(x)) >= int(o * SR)) for o in (0, .012, .024)) + env(d, .0005, .08) * .6
    return x * e * .45


def pad(notes, d):
    t = t_(d); x = np.zeros(len(t))
    for n in notes:
        for det in (-0.08, 0.08):
            f = nf(n + det)
            x += 2 * ((f * t) % 1) - 1
    x = lp(x / (len(notes) * 2), 1800)
    a = np.minimum(1, t / .25) * np.minimum(1, (d - t) / .3)
    return x * a * .22


def bass(n, d):
    t = t_(d); f = nf(n)
    x = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t)
    return x * np.minimum(1, t / .01) * np.exp(-t * 2.5) * .45


def pluck(n, d=.35):
    t = t_(d); f = nf(n)
    x = (2 * ((f * t) % 1) - 1) * .5 + np.sin(2 * np.pi * f * 2 * t) * .3
    return lp(x, 3000) * env(d, .002, .12) * .25


START = 0.5  # the drop lands on the logo impact
bars = int((DUR - START) / (4 * B)) + 1
# intro pad before the drop
add(music, pad(CHORDS[0], START + .1) * .7, 0, g=.8)
for bar in range(bars):
    t0 = START + bar * 4 * B
    ch = CHORDS[bar % 4]
    add(music, pad(ch, 4 * B + .2), t0, g=1)
    for beat in range(4):
        tb = t0 + beat * B
        add(music, kick(), tb, g=.9)
        add(music, bass(BASS[bar % 4], B * .9), tb + B / 2, g=1)
        add(music, hat(beat % 2 == 1), tb + B / 2, pan=.25)
        add(music, hat(), tb + B / 4, pan=-.2, g=.6); add(music, hat(), tb + 3 * B / 4, pan=-.2, g=.6)
        if beat in (1, 3): add(music, clap(), tb, g=.9)
    for s in range(8):  # arp
        add(music, pluck(ch[s % 4] + 12 * (s // 4)), t0 + s * B / 2, pan=(-.4 if s % 2 else .4), g=.8)

# fade music under finale tail
fade = np.ones(N); i0 = int((data["duration"] - .4) * SR); fade[i0:] = np.linspace(1, 0, N - i0) ** 1.5
music *= fade


# ── SFX ──
def tick(v):
    d = .03; return (hp(noise(d), 5000) * env(d, .0003, .002) * .5 + np.sin(2 * np.pi * 5200 * t_(d)) * env(d, .0003, .003) * .3) * v


def whoosh(d=.5):
    n = noise(d); seg = 20; L = len(n) // seg; out = np.zeros_like(n)
    for k in range(seg):
        fc = 300 * 14 ** (k / seg)
        out[k * L:(k + 1) * L] = bp(n[k * L:(k + 1) * L + 2000][: L + 2000], fc * .7, min(fc * 1.6, 20000))[:L]
    return out * np.sin(np.pi * np.linspace(0, 1, len(n))) ** 1.6 * .7


def impact():
    d = 1.8; t = t_(d); f = 32 + 100 * np.exp(-t * 10)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.5) * 1.2 + lp(noise(d), 3000) * env(d, .0005, .08) * .6 + lp(noise(d), 800) * env(d, .002, .4) * .3


def riser(d):
    t = t_(d); p = t / d
    return hp(noise(d), 1500) * p ** 2 * .35 + np.sin(2 * np.pi * np.cumsum(200 * 2 ** (p * 3)) / SR) * p ** 2 * .15


def pop(f=900):
    d = .18; t = t_(d); fr = f * (1 + 1.5 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(d, .001, .04) * .6


def like(k):
    # bubbly pop + bell note climbing the scale on each like
    notes = [72, 75, 77, 79, 82, 84]
    d = .9; t = t_(d); f = nf(notes[k % len(notes)])
    bell = (np.sin(2 * np.pi * f * t) + .4 * np.sin(2 * np.pi * f * 2.01 * t) + .15 * np.sin(2 * np.pi * f * 3.98 * t)) * env(d, .002, .22)
    out = bell * .35
    p = pop(700 + k * 80); out[:len(p)] += p
    c = hp(noise(.08), 3000) * env(.08, .0005, .015) * .3; out[:len(c)] += c
    return out


def slide(d):
    t = t_(d); p = t / d
    return np.sin(2 * np.pi * np.cumsum(500 + 700 * p) / SR) * np.sin(np.pi * p) * .08 + bp(noise(d), 2000, 5000) * np.sin(np.pi * p) * .05


def chime():
    d = 2.2; x = np.zeros(int(d * SR))
    for i, n in enumerate([77, 81, 84, 89]):
        tt = t_(d - i * .06); f = nf(n)
        s = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(2 * np.pi * f * 2 * tt)) * env(d - i * .06, .003, .6)
        x[int(i * .06 * SR):int(i * .06 * SR) + len(s)] += s
    return x * .22


for e in data["events"]:
    t, ty = e["t"], e["type"]
    if ty == "tick": add(sfx, tick(e.get("v", .5)), t, pan=rs.uniform(-.3, .3))
    elif ty == "whoosh": add(sfx, whoosh(), t - .25)
    elif ty == "impact": add(sfx, impact(), t)
    elif ty == "riser": add(sfx, riser(e["d"]), t)
    elif ty == "pop": add(sfx, pop(1200), t, g=.8)
    elif ty == "blip": add(sfx, pop(1500), t, g=.5)
    elif ty == "slide": add(sfx, slide(e["d"]), t)
    elif ty == "like": add(sfx, like(e["k"]), t, pan=.35)
    elif ty == "chime": add(sfx, chime(), t)

mix = music * .55 + sfx * .9
# gentle bus compression-ish soft clip + normalize peak-normalize
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix = mix / np.max(np.abs(mix)) * 0.56  # ≈ -14 LUFS
fade_in = np.minimum(1, np.arange(N) / (0.02 * SR))
mix *= fade_in
wavfile.write("out/audio.wav", SR, (mix.T * 32767).astype(np.int16))
print("wrote out/audio.wav", DUR, "s")
