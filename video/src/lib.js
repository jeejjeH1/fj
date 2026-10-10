// Deterministic motion toolkit: every visual is a pure function of time t (seconds).
export const W = 1920, H = 1080;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, x) => a + (b - a) * x;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const E = {
  lin: x => x,
  inCubic: x => x * x * x,
  outCubic: x => 1 - (1 - x) ** 3,
  inOutCubic: x => (x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outQuart: x => 1 - (1 - x) ** 4,
  outExpo: x => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inExpo: x => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
  outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1),
};
export const ease = (t, a, b, e = E.outCubic) => e(seg(t, a, b));

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296);
}
export const hash = (n) => { const r = rng(n * 9301 + 49297); r(); return r(); };
// smooth 1D value noise
export const noise1 = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 1000), hash(i + 1 + seed * 1000), u) * 2 - 1;
};

// ---------- DOM helpers
export function el(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

// set visual state: o opacity, x/y px, s scale, r deg, b blur px, rx/ry deg
export function set(e, { o = 1, x = 0, y = 0, s = 1, sx, sy, r = 0, b = 0, rx = 0, ry = 0, z = 0 } = {}) {
  e.style.opacity = o;
  e.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  const sc = sx != null || sy != null ? `scale(${sx ?? s},${sy ?? s})` : `scale(${s})`;
  e.style.transform = `translate3d(${x}px,${y}px,${z}px) ${rx ? `rotateX(${rx}deg)` : ''} ${ry ? `rotateY(${ry}deg)` : ''} rotate(${r}deg) ${sc}`;
  e.style.filter = b > 0.05 ? `blur(${b}px)` : 'none';
}

// standard reveal: rise + unblur
export function rise(e, t, t0, d = .55, dist = 40, blur = 12) {
  const p = ease(t, t0, t0 + d, E.outCubic);
  set(e, { o: p, y: (1 - p) * dist, b: (1 - p) * blur });
  return p;
}
export function pop(e, t, t0, d = .45, from = .4) {
  const p = seg(t, t0, t0 + d);
  set(e, { o: clamp(p * 3), s: lerp(from, 1, E.outBack(p, 2.2)) });
  return p;
}

export function splitWords(e) {
  const walk = (node, cls) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const w of ch.textContent.split(/(\s+)/)) {
          if (!w) continue;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const sp = document.createElement('span'); sp.className = 'w ' + cls; sp.textContent = w; frag.appendChild(sp);
        }
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') {
        const g = [...ch.classList].filter(c => c.startsWith('grad'));
        g.forEach(c => ch.classList.remove(c));
        walk(ch, [cls, ...g].join(' ').trim());
      }
    }
  };
  walk(e, '');
  return $$(e, '.w');
}
export function revealWords(spans, t, t0, stagger = .07, d = .5, dist = 50) {
  spans.forEach((s, i) => {
    const p = ease(t, t0 + i * stagger, t0 + i * stagger + d, E.outCubic);
    set(s, { o: p, y: (1 - p) * dist, b: (1 - p) * 14, r: (1 - p) * 4 });
  });
}

// ---------- event log (drives the sound design)
export const EVENTS = [];
export const ev = (type, t, extra = {}) => { EVENTS.push({ type, t: +t.toFixed(4), ...extra }); };

// ---------- typing
const PAUSE = { ',': .1, '.': .16, ':': .1, '—': .14, '?': .16, '!': .16, '\n': .18 };
export function typer(target, text, t0, cps = 24, { seed = 7, sound = true, highlight = null, caret = true, vol = 1, caretEnd = null, placeholder = '' } = {}) {
  const r = rng(seed), times = [];
  let tt = t0;
  for (const ch of text) {
    times.push(tt);
    if (sound && ch !== '\n') ev(ch === ' ' ? 'space' : 'key', tt, { v: vol });
    tt += (1 / cps) * (.55 + r() * .9) + (PAUSE[ch] || 0) * (cps > 40 ? .3 : 1);
  }
  const caretEl = `<span class="caret"></span>`;
  return {
    end: tt, times,
    update(t) {
      let n = 0;
      while (n < times.length && times[n] <= t) n++;
      const vis = text.slice(0, n);
      const body = highlight ? highlight(vis) : esc(vis);
      const blinkOn = n < text.length && t >= t0 ? true : Math.floor((t - t0) * 2.4) % 2 === 0;
      const showCaret = caret && t >= t0 - .6 && blinkOn && t < (caretEnd ?? tt + 1.6);
      target.innerHTML = (n === 0 && placeholder ? `<span style="opacity:.35">${placeholder}</span>` : body) + (showCaret ? caretEl : '');
      return n / text.length;
    },
  };
}
export const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

// ---------- cursor
export const CURSOR = [];
// keyframe: arrive at (x,y) by time t. opts: click, show, hide, md (move duration)
export function cur(t, x, y, opts = {}) {
  CURSOR.push({ t, x, y, ...opts });
  if (opts.click) ev('click', t + .02);
  if (opts.hover) ev('hover', t);
}
export function cursorAt(t) {
  const k = CURSOR;
  if (!k.length) return null;
  let i = -1;
  for (let j = 0; j < k.length; j++) if (k[j].t <= t) i = j;
  const a = k[Math.max(i, 0)], b = k[i + 1];
  let x = a.x, y = a.y;
  if (i >= 0 && b && !b.show) {
    const md = b.md ?? Math.min(.55, b.t - a.t);
    const p = E.inOutCubic(seg(t, b.t - md, b.t));
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const arc = Math.sin(Math.PI * p) * Math.min(d * .12, 60);
    x = lerp(a.x, b.x, p) + (-dy / d) * arc;
    y = lerp(a.y, b.y, p) + (dx / d) * arc;
  } else if (i < 0) { x = k[0].x; y = k[0].y; }
  // visibility
  let vis = 0, lastToggle = -99, state = 0;
  for (const f of k) {
    if (f.t > t) break;
    if (f.show) { state = 1; lastToggle = f.t; }
    if (f.hide) { state = 0; lastToggle = f.t; }
  }
  const fp = seg(t, lastToggle, lastToggle + .22);
  vis = state ? fp : 1 - fp;
  // click squash
  let press = 0, ripple = null;
  for (const f of k) {
    if (!f.click) continue;
    const dt = t - f.t;
    if (dt >= -.06 && dt < .2) press = Math.max(press, dt < 0 ? seg(dt, -.06, 0) : 1 - seg(dt, .04, .2));
    if (dt >= 0 && dt < .5) ripple = { x: f.x, y: f.y, p: dt / .5 };
  }
  return { x, y, vis, press, ripple };
}

// ---------- global FX timelines
export const FLASHES = [], SHAKES = [], GLITCHES = [];
export const flash = (t, a = .8, d = .5, color = '255,255,255') => FLASHES.push({ t, a, d, color });
export const shake = (t, a = 14, d = .45) => SHAKES.push({ t, a, d });
export const glitch = (t, d = .4, sound = true) => { GLITCHES.push({ t, d }); if (sound) ev('glitch', t, { d }); };
export function impact(t, big = 1) {
  flash(t, .35 * big, .4);
  shake(t, 5 * big, .4);
  ev('impact', t, { v: big });
}
export function fxAt(t) {
  let fl = 0, color = '255,255,255';
  for (const f of FLASHES) if (t >= f.t && t < f.t + f.d) { const v = f.a * (1 - (t - f.t) / f.d) ** 2; if (v > fl) { fl = v; color = f.color; } }
  let sx = 0, sy = 0;
  for (const s of SHAKES) if (t >= s.t && t < s.t + s.d) {
    const k = s.a * (1 - (t - s.t) / s.d) ** 2;
    sx += noise1((t - s.t) * 38, 1) * k; sy += noise1((t - s.t) * 38, 2) * k;
  }
  let g = 0;
  for (const q of GLITCHES) if (t >= q.t && t < q.t + q.d) g = Math.max(g, 1);
  return { fl, color, sx, sy, g };
}

// Python-ish syntax highlight for the code window
export function hlPy(src) {
  const s = esc(src);
  return s
    .replace(/(&quot;|"[^"<]*("|$))/g, m => `<span class="s">${m}</span>`)
    .replace(/\b(class|def|return|self|from|import|if|else)\b(?![^<]*<\/span>)/g, '<span class="k">$1</span>')
    .replace(/(@[\w.]+)/g, '<span class="d">$1</span>')
    .replace(/\b(gl)\b(?![^<]*<\/span>)/g, '<span class="g">$1</span>')
    .replace(/(\.)([a-z_]+)(?=\()/g, '$1<span class="f">$2</span>');
}
