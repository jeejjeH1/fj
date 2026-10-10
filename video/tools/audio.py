"""Procedural soundtrack + SFX, synced to out/events.json (exported by the renderer).

usage: python3 tools/audio.py  ->  out/audio.wav
"""
import json, numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
data = json.load(open("out/events.json"))
DUR = data["duration"] + 2.5
N = int(DUR * SR)
scenes = {s["name"]: s for s in data["scenes"]}
EV = data["events"]
rs = np.random.default_rng(7)

music = np.zeros((2, N)); sfx = np.zeros((2, N)); verb = np.zeros((2, N))

def t_(d): return np.arange(int(d * SR)) / SR
def add(buf, x, t, pan=0.0, g=1.0):
    i = int(t * SR)
    if i >= N or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[: N - i] * g
    buf[0, i:i + len(x)] += x * np.sqrt(.5 - pan / 2) * 1.414
    buf[1, i:i + len(x)] += x * np.sqrt(.5 + pan / 2) * 1.414
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, hi], "bandpass", fs=SR, output="sos"), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, "lowpass", fs=SR, output="sos"), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, "highpass", fs=SR, output="sos"), x)
def noise(d): return rs.standard_normal(int(d * SR))
def env(d, a, dec): t = t_(d); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / dec)
def saw(f, d, ph=0): t = t_(d); return 2 * ((f * t + ph) % 1) - 1
def nf(n): return 440 * 2 ** ((n - 69) / 12)

# ───────────────────────── SFX ─────────────────────────
def key(v=1, space=False):
    d = .09
    click = bp(noise(d), 2500, 7000) * env(d, .0005, .004)
    body = bp(noise(d), 250 if space else 400, 900 if space else 1600) * env(d, .001, .022 if space else .014)
    tone = np.sin(2 * np.pi * rs.uniform(180, 260) * t_(d)) * env(d, .001, .02)
    x = click * .55 + body * (1.4 if space else 1.0) + tone * .25
    rel = np.zeros(int(.16 * SR)); r = bp(noise(.03), 2000, 6000) * env(.03, .0005, .003) * .35
    o = int(rs.uniform(.045, .075) * SR); rel[o:o + len(r)] = r
    rel[:len(x)] += x
    return rel * v * rs.uniform(.7, 1.0)

def mouse():
    d = .2; x = np.zeros(int(d * SR))
    a = hp(noise(.02), 2500) * env(.02, .0002, .0018) + np.sin(2 * np.pi * 2300 * t_(.02)) * env(.02, .0002, .006) * .6
    x[:len(a)] += a * 1.1
    o = int(.085 * SR); x[o:o + len(a)] += a * .55
    return x

def whoosh(d=.55, up=True):
    n = noise(d); seg = 24; out = np.zeros_like(n); L = len(n) // seg
    for k in range(seg):
        p = k / seg; fc = 300 * (12 ** (p if up else 1 - p))
        out[k * L:(k + 1) * L] = bp(n[k * L:(k + 1) * L + 2000][: L + 2000], fc * .7, min(fc * 1.6, 20000))[:L]
    e = np.sin(np.pi * np.linspace(0, 1, len(n))) ** 1.6
    return out * e * .9

def impact(v=1.0):
    d = 2.2; t = t_(d)
    f = 34 + 90 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crack = lp(noise(d), 3500) * env(d, .0005, .09)
    tail = lp(noise(d), 900) * env(d, .002, .45) * .35
    return (sub * 1.3 + crack * .8 + tail) * v

def riser(d):
    t = t_(d); p = t / d
    n = noise(d); out = np.zeros_like(n); seg = 40; L = len(n) // seg
    for k in range(seg):
        fc = 400 * (16 ** (k / seg))
        out[k * L:(k + 1) * L] = bp(n[k * L:(k + 1) * L + 2000][: L + 2000], fc * .8, min(fc * 1.4, 20000))[:L]
    sweep = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (p * 3)) / SR) * .25
    return (out * .8 + sweep) * p ** 2.2

def glitch(d=.4):
    x = np.zeros(int(d * SR)); i = 0
    while i < len(x):
        L = int(rs.uniform(.01, .05) * SR)
        kind = rs.integers(3)
        tt = np.arange(L) / SR
        if kind == 0: s = np.sign(np.sin(2 * np.pi * rs.uniform(80, 900) * tt))
        elif kind == 1: s = np.round(rs.standard_normal(L) * 3) / 3
        else: s = np.zeros(L)
        s = s[: len(x) - i]; x[i:i + len(s)] = s * rs.uniform(.3, .8); i += L
    return lp(x, 6000) * .5

def blip(f, d=.08, dec=.03, kind="sine"):
    t = t_(d); w = np.sin(2 * np.pi * f * t)
    if kind == "bell": w = w + .4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 30)
    return w * env(d, .001, dec)

def check():
    x = np.zeros(int(.22 * SR)); a = blip(1318, .1, .03); b = blip(1975, .14, .05)
    x[:len(a)] += a; o = int(.055 * SR); x[o:o + len(b)] += b
    return x * .45

def success():
    x = np.zeros(int(.9 * SR))
    for k, n in enumerate([72, 76, 79, 84]):
        b = blip(nf(n), .7, .22, "bell"); o = int(k * .06 * SR); x[o:o + len(b)] += b
    return x * .35

def stamp():
    d = .5; t = t_(d)
    thud = np.sin(2 * np.pi * (60 + 80 * np.exp(-t * 30)) * t) * np.exp(-t * 9)
    crack = bp(noise(d), 600, 4000) * env(d, .0005, .03)
    return thud * 1.2 + crack * .9

def pop(n=0):
    d = .14; t = t_(d); f0 = 520 * 1.1 ** n
    return np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.2 * np.exp(-t * 60))) / SR) * env(d, .001, .035) * .55

def deny():
    d = .26; t = t_(d)
    x = (np.sign(np.sin(2 * np.pi * 140 * t)) + np.sign(np.sin(2 * np.pi * 147 * t))) * .5
    return lp(x, 1800) * env(d, .002, .1) * .35

def beam():
    d = .45; t = t_(d); f = 2400 * np.exp(-t * 6) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, .002, .12) * .22

def sign(d=.7):
    n = bp(noise(d), 2500, 7000); m = np.abs(np.sin(2 * np.pi * 7 * t_(d))) ** 2
    return n * m * np.sin(np.pi * np.linspace(0, 1, len(n))) * .35

def scan(d=1.4):
    t = t_(d); f = 400 + 1400 * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (.5 + .5 * np.sin(2 * np.pi * 18 * t)) * np.sin(np.pi * t / d) * .12

def unlock():
    x = np.zeros(int(1.0 * SR)); a = hp(noise(.02), 2000) * env(.02, .0002, .003)
    x[:len(a)] += a; o = int(.09 * SR); x[o:o + len(a)] += a * .8
    b = blip(1568, .8, .25, "bell"); o = int(.15 * SR); x[o:o + len(b)] += b * .5
    return x

for e in EV:
    t, ty, v = e["t"], e["type"], e.get("v", 1)
    pan = float(rs.uniform(-.25, .25))
    if ty == "key": add(sfx, key(v), t, pan, .8)
    elif ty == "space": add(sfx, key(v, True), t, pan, .8)
    elif ty == "click": add(sfx, mouse(), t, .15, .6)
    elif ty == "hover": add(sfx, blip(2600, .03, .008), t, .1, .12)
    elif ty == "whoosh": w = whoosh(); add(sfx, w, t - .25, 0, .32 * v); add(verb, w, t - .25, 0, .1 * v)
    elif ty == "impact": x = impact(v); add(sfx, x, t, 0, .55); add(verb, x, t, 0, .25)
    elif ty == "riser": add(sfx, riser(e["d"]), t, 0, .3)
    elif ty == "glitch": add(sfx, glitch(e.get("d", .4)), t, 0, .55)
    elif ty == "tick": add(sfx, blip(3200, .03, .006), t, pan, .22 * v)
    elif ty == "check": x = check(); add(sfx, x, t, pan, .8); add(verb, x, t, 0, .15)
    elif ty == "success": x = success(); add(sfx, x, t, 0, .8); add(verb, x, t, 0, .3)
    elif ty == "stamp": add(sfx, stamp(), t, 0, .7 * v); add(verb, stamp(), t, 0, .2)
    elif ty == "pop": add(sfx, pop(e.get("n", 0)), t, pan, .7)
    elif ty == "deny": add(sfx, deny(), t, 0, .8)
    elif ty == "beam": x = beam(); add(sfx, x, t, 0, .7); add(verb, x, t, 0, .3)
    elif ty == "line": add(sfx, blip(990, .05, .015), t, pan, .25)
    elif ty == "sign": add(sfx, sign(e.get("d", .7)), t, .2, .8)
    elif ty == "scan": add(sfx, scan(e.get("d", 1.4)), t, 0, .8)
    elif ty == "unlock": x = unlock(); add(sfx, x, t, 0, .8); add(verb, x, t, 0, .3)

# ───────────────────────── MUSIC (120 BPM, D minor) ─────────────────────────
BEAT = .5; BAR = 2.0
s = lambda n: scenes[n]["t0"]
DROP = s("reveal") + 1.0          # first impact lands on the downbeat
BREAK0, BREAK1 = s("caveat"), s("sla")
FIN = s("finale"); END_HIT = FIN + 3.5
grid0 = DROP % BAR

def kick():
    d = .5; t = t_(d); f = 45 + 120 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    c = hp(noise(.004), 3000) * .25; x[:len(c)] += c
    return x
def clap():
    x = np.zeros(int(.3 * SR))
    for k in range(3):
        b = bp(noise(.25), 900, 3500) * env(.25, .0005, .012 if k < 2 else .09); o = int(k * .011 * SR); x[o:o + len(b)] += b[: len(x) - o]
    return x * .5
def hat(open_=False):
    d = .3 if open_ else .06
    return hp(noise(d), 7500) * env(d, .0005, .09 if open_ else .014) * .35

CH = [[50, 53, 57, 62], [46, 50, 53, 58], [53, 57, 60, 65], [48, 52, 55, 60]]  # Dm Bb F C
BASS = [38, 34, 41, 36]
KICK, CLAP, HAT, OHAT = kick(), clap(), hat(), hat(True)

def pad_chord(notes, d, bright=1.0):
    t = t_(d); L = np.zeros(len(t)); R = np.zeros(len(t))
    for n in notes:
        for det, side in [(-.09, 0), (.08, 1), (0, 2)]:
            w = saw(nf(n + det), d, rs.random())
            if side in (0, 2): L += w
            if side in (1, 2): R += w
    a = np.minimum(1, t / .5) * np.minimum(1, (d - t) / .4)
    return lp(L, 900 * bright) * a * .05, lp(R, 900 * bright) * a * .05

def section(t):
    if t < DROP - .01: return "intro"
    if BREAK0 <= t < BREAK1: return "break"
    if t >= END_HIT: return "outro"
    if t >= FIN: return "pre"
    return "groove"

bar_t = grid0 - BAR * int(grid0 / BAR + 1)
bi = 0
while bar_t < DUR:
    sec = section(bar_t + .01)
    ci = int(round((bar_t - grid0) / BAR)) % 4
    if bar_t >= -1:
        # pad
        if sec != "outro":
            br = .6 if sec in ("intro", "break") else 1.3
            Lp, Rp = pad_chord(CH[ci], BAR + .3, br)
            for c, x in ((0, Lp), (1, Rp)):
                i = int(max(bar_t, 0) * SR); x = x[: N - i]; music[c, i:i + len(x)] += x; verb[c, i:i + len(x)] += x * .4
        for b in range(4):
            bt = bar_t + b * BEAT
            if bt < 0 or bt >= DUR: continue
            if sec == "intro":
                if bt >= s("judgment") and b % 2 == 0: add(music, KICK, bt, 0, .45)
                sub = np.sin(2 * np.pi * nf(BASS[0]) * t_(.4)) * env(.4, .01, .15)
                add(music, sub, bt, 0, .25)
            elif sec in ("groove", "pre"):
                add(music, KICK, bt, 0, .8)
                if b in (1, 3): add(music, CLAP, bt, .05, .55); add(verb, CLAP, bt, 0, .2)
                for h in range(4 if sec == "groove" else 2):
                    ht = bt + h * BEAT / 4
                    add(music, OHAT if h == 2 else HAT, ht, .3 * (-1) ** h, (.5 if h == 2 else .35) * (1 if h % 2 == 0 else .6))
                # offbeat bass
                bn = BASS[ci] + (12 if b == 3 else 0)
                bs = lp(saw(nf(bn), BEAT / 2 * .95), 600) * env(BEAT / 2 * .95, .003, .12)
                add(music, bs, bt + BEAT / 2, 0, .55)
                # 16th arp from the genvm scene onwards
                if bt >= s("genvm") and sec == "groove":
                    for k in range(4):
                        n = CH[ci][(b * 4 + k) % 4] + 12
                        a = lp(np.sign(np.sin(2 * np.pi * nf(n) * t_(.12))), 2600) * env(.12, .002, .045)
                        add(music, a, bt + k * BEAT / 4, .35 * (-1) ** k, .05); add(verb, a, bt + k * BEAT / 4, 0, .04)
            elif sec == "break" and b == 0:
                add(music, np.sin(2 * np.pi * nf(BASS[ci]) * t_(1.6)) * env(1.6, .02, .6), bt, 0, .3)
    bar_t += BAR

# outro: big held chord after the final hit
d = DUR - END_HIT
Lp, Rp = pad_chord([38, 50, 57, 62, 65, 69], d, 1.6)
fade = np.exp(-t_(d) / 2.2)
for c, x in ((0, Lp), (1, Rp)):
    i = int(END_HIT * SR); x = (x * fade * 2.2)[: N - i]; music[c, i:i + len(x)] += x; verb[c, i:i + len(x)] += x * .6

# ───────────────────────── MIX ─────────────────────────
ir_t = t_(2.4)
IR = np.stack([lp(noise(2.4), 5000) * np.exp(-ir_t / .55), lp(noise(2.4), 5000) * np.exp(-ir_t / .55)]) * .05
wet = np.stack([signal.fftconvolve(verb[c], IR[c])[:N] for c in range(2)])

# sidechain duck music on kicks/impacts a little for punch
duck = np.ones(N)
for e in EV:
    if e["type"] == "impact":
        i = int(e["t"] * SR); L = int(.8 * SR); duck[i:i + L] = np.minimum(duck[i:i + L], 1 - .6 * np.exp(-np.arange(min(L, N - i)) / SR / .25))
typ = np.zeros(N)
for e in EV:
    if e["type"] in ("key", "space", "click"):
        i = int(e["t"] * SR); typ[i:i + int(.25 * SR)] = 1
typ = signal.sosfiltfilt(signal.butter(1, 4, fs=SR, output="sos"), typ)
duck *= 1 - .35 * np.clip(typ, 0, 1)
mix = music * .45 * duck + sfx * 1.0 + wet * 1.0
mix = hp(mix, 25)
# fade-in/out
mix[:, : int(.05 * SR)] *= np.linspace(0, 1, int(.05 * SR))
tail = int(1.0 * SR); mix[:, -tail:] *= np.linspace(1, 0, tail)
pk = np.max(np.abs(mix)); mix = mix / pk * 1.6
mix = np.tanh(mix) * .89   # soft limiter
mix = mix[:, : int(data["duration"] * SR)]
wavfile.write("out/audio.wav", SR, (mix.T * 32767).astype(np.int16))
print("audio", mix.shape[1] / SR, "s, events", len(EV))

if __import__("os").environ.get("STEMS"):
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    for name, a, b in [("hook typing", 1.2, 3.0), ("delegation typing", s("delegation") + 1, s("delegation") + 3.4),
                       ("genvm code", s("genvm") + .5, s("genvm") + 4.5), ("finale typing", FIN + 1.5, FIN + 3.2)]:
        i, j = int(a * SR), int(b * SR)
        print(f"{name:20s} music {db(music[:, i:j] * .45 * duck[i:j]):6.1f} dB   sfx {db(sfx[:, i:j]):6.1f} dB   peak-sfx {20*np.log10(np.abs(sfx[:, i:j]).max()):6.1f}")
