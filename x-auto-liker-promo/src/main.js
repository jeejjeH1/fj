// 10s promo for X Auto Liker. Every frame is a pure function of t (seconds): window.renderFrame(t).
const DURATION = 10;
const $ = (id) => document.getElementById(id);

/* ── easing / timing helpers ───────────────────── */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const outCubic = (p) => 1 - (1 - p) ** 3;
const outQuint = (p) => 1 - (1 - p) ** 5;
const inOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const inCubic = (p) => p * p * p;
const outBack = (p, s = 1.70158) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ── timeline ───────────────────── */
const T = {
  s1Out: [1.75, 2.1],
  s2In: [1.85, 2.35], s2Out: [4.05, 4.4],
  s3In: [4.2, 4.65], s3Out: [6.3, 6.65],
  s4In: [6.45, 6.9], s4Out: [8.5, 8.85],
  finIn: 8.7,
};
const LINE_T0 = 2.4, LINE_DT = 0.048, NLINES = 30;
const LIKES = Array.from({ length: 6 }, (_, k) => 7.0 + k * 0.27);

const events = [];
const ev = (t, type, extra = {}) => events.push({ t: +t.toFixed(3), type, ...extra });
ev(0.12, 'riser', { d: 0.4 }); ev(0.5, 'impact');
['X', 'Auto', 'Liker'].forEach((_, i) => ev(0.8 + i * 0.09, 'tick', { v: 0.6 }));
ev(T.s2In[0] - 0.05, 'whoosh'); ev(T.s3In[0] - 0.05, 'whoosh'); ev(T.s4In[0] - 0.05, 'whoosh'); ev(T.finIn - 0.1, 'whoosh');
for (let i = 0; i < NLINES; i++) ev(LINE_T0 + i * LINE_DT, 'tick', { v: 0.35 });
ev(LINE_T0 + NLINES * LINE_DT + 0.05, 'pop');
ev(4.75, 'slide', { d: 0.55 }); ev(5.05, 'slide', { d: 0.6 }); ev(5.65, 'blip');
LIKES.forEach((t, k) => ev(t, 'like', { k }));
ev(8.78, 'impact'); ev(8.8, 'chime');

/* ── word animation ───────────────────── */
function setWords(el, text, cls = '') {
  el.innerHTML = text.split(' ').map((w) => `<span class="w ${cls}">${w}</span>`).join(' ');
  return [...el.querySelectorAll('.w')];
}
function animWords(words, t, start, stagger = 0.06, dur = 0.55, dist = 60) {
  words.forEach((w, i) => {
    const p = outCubic(seg(t, start + i * stagger, start + i * stagger + dur));
    w.style.opacity = p;
    w.style.transform = `translateY(${(1 - p) * dist}px) scale(${0.92 + 0.08 * p})`;
    w.style.filter = p < 1 ? `blur(${(1 - p) * 14}px)` : 'none';
  });
}
function sceneVis(el, t, inR, outR, { dirIn = 1 } = {}) {
  const pi = inR ? outCubic(seg(t, inR[0], inR[1])) : 1;
  const po = outR ? inCubic(seg(t, outR[0], outR[1])) : 0;
  const o = Math.min(pi, 1 - po);
  el.style.display = o <= 0.001 ? 'none' : 'block';
  el.style.opacity = o;
  const sc = lerp(0.94, 1, pi) * lerp(1, 1.08, po);
  el.style.transform = `translateX(${(1 - pi) * 120 * dirIn}px) scale(${sc})`;
  el.style.filter = o < 1 ? `blur(${(1 - o) * 18}px)` : 'none';
}

/* ── build static content ───────────────────── */
const titleWords = setWords($('title'), 'X Auto Liker', 'grad-text');
const tagWords = setWords($('tagline'), 'لایک خودکار، نوبت به نوبت');
const s2h = setWords($('s2h'), 'لینک‌ها رو بچسبون');
const s2s = setWords($('s2s'), 'کل پیام رو کپی کن؛ تا ۳۰ لینک، خودش پیداشون می‌کنه');
const s3h = setWords($('s3h'), 'زمانش دست خودته');
const s3s = setWords($('s3s'), 'چند ثانیه صبر قبل از لایک، و فاصله‌ی بین لایک‌ها');
const s4h = setWords($('s4h'), 'خودش نوبت به نوبت لایک می‌کنه');

const rnd = mulberry32(42);
const linesEl = $('lines');
const lineEls = Array.from({ length: NLINES }, (_, i) => {
  const id = '210' + Array.from({ length: 16 }, () => Math.floor(rnd() * 10)).join('');
  const d = document.createElement('div');
  d.className = 'line';
  d.innerHTML = i % 4 === 2
    ? `x.com/user_${(rnd() * 900 + 100) | 0}/status/<span>${id}</span>`
    : `x.com/intent/like?tweet_id=<span>${id}</span>`;
  linesEl.appendChild(d);
  return d;
});

const AV = ['#ff2e7e', '#a24bff', '#2ad4ff', '#2fe39a', '#ffb02e', '#ff79b0', '#7c8bff', '#2ad4ff'];
const tweetsEl = $('tweets');
const tweets = AV.map((c, i) => {
  const d = document.createElement('div');
  d.className = 'tw';
  const base = 12 + ((rnd() * 80) | 0);
  d.innerHTML = `<div class="av" style="background:radial-gradient(circle at 30% 30%, #fff8, ${c})"></div><div class="nm"></div><div class="hd"></div>
    <div class="l1"></div><div class="l2" style="width:${300 + rnd() * 300}px"></div>
    <div class="act"><i></i><i></i><i></i></div>
    <div class="lk"><span class="n">${base}</span><svg><use href="#heart"/></svg></div>`;
  tweetsEl.appendChild(d);
  return { el: d, base, heart: d.querySelector('.lk svg'), num: d.querySelector('.lk .n'), lk: d.querySelector('.lk') };
});

/* ── particles (deterministic) ───────────────────── */
const COLORS = ['#ff2e7e', '#ff79b0', '#a24bff', '#2ad4ff', '#ffffff'];
const bursts = [];
function addBurst(t0, x, y, n, seed, { hearts = false, ring = true, power = 1 } = {}) {
  const r = mulberry32(seed);
  const parts = Array.from({ length: n }, (_, i) => {
    const a = r() * Math.PI * 2, v = (260 + r() * 620) * power;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180 * power, life: 0.8 + r() * 0.7, size: hearts && i % 3 === 0 ? 16 + r() * 16 : 3 + r() * 5,
      heart: hearts && i % 3 === 0, color: COLORS[(r() * COLORS.length) | 0], spin: (r() - 0.5) * 6 };
  });
  bursts.push({ t0, x, y, parts, ring });
}
addBurst(0.5, 960, 430, 90, 1, { hearts: true, power: 1.5 });
LIKES.forEach((t, k) => {
  addBurst(t, 1701, 667, 34, 10 + k, { hearts: true, power: 0.75 });
  addBurst(t + 0.02, 540, 400, 22, 30 + k, { hearts: true, ring: false, power: 0.6 });
});
addBurst(8.78, 960, 430, 110, 99, { hearts: true, power: 1.7 });
const confetti = (() => {
  const r = mulberry32(7);
  return Array.from({ length: 220 }, () => ({ x: r() * 1920, y: -40 - r() * 500, vx: (r() - 0.5) * 160, vy: 320 + r() * 380,
    w: 12 + r() * 14, rot: r() * 6, vr: (r() - 0.5) * 9, wob: r() * 6, color: COLORS[(r() * COLORS.length) | 0] }));
})();

const fx = $('fx');
const ctx = fx.getContext('2d');
function heartPath(x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
  ctx.fill(new Path2D('M12 21.2s-7.6-4.6-9.9-9.3C.6 8.7 2.4 4.8 6.1 4.4c2.1-.2 3.9.9 5.9 3 2-2.1 3.8-3.2 5.9-3 3.7.4 5.5 4.3 4 7.5-2.3 4.7-9.9 9.3-9.9 9.3z'));
  ctx.restore();
}
function drawFx(t) {
  ctx.clearRect(0, 0, 1920, 1080);
  const K = 2.6, G = 900;
  for (const b of bursts) {
    const tau = t - b.t0;
    if (tau < 0 || tau > 1.6) continue;
    if (b.ring && tau < 0.7) {
      const p = tau / 0.7;
      ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ff2e7e'; ctx.lineWidth = 10 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 40 + 520 * outCubic(p), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = (1 - p) * 0.5; ctx.strokeStyle = '#2ad4ff'; ctx.lineWidth = 4 * (1 - p);
      ctx.beginPath(); ctx.arc(b.x, b.y, 20 + 380 * outCubic(clamp(p * 1.2)), 0, Math.PI * 2); ctx.stroke();
    }
    for (const q of b.parts) {
      if (tau > q.life) continue;
      const e = (1 - Math.exp(-K * tau)) / K;
      const x = b.x + q.vx * e, y = b.y + q.vy * e + 0.5 * G * tau * tau * 0.6;
      ctx.globalAlpha = (1 - tau / q.life) ** 1.2;
      ctx.fillStyle = q.color;
      if (q.heart) { ctx.fillStyle = q.color === '#ffffff' ? '#ff79b0' : q.color; heartPath(x, y, q.size, q.spin * tau * 0.3); }
      else { ctx.beginPath(); ctx.arc(x, y, q.size * (1 - tau / q.life * 0.5), 0, Math.PI * 2); ctx.fill(); }
    }
  }
  const tc = t - 8.72;
  if (tc > 0) {
    for (const c of confetti) {
      const x = c.x + c.vx * tc + Math.sin(tc * 4 + c.wob) * 30, y = c.y + c.vy * tc + 60 * tc * tc;
      if (y > 1120) continue;
      ctx.globalAlpha = clamp(tc * 4) * 0.95; ctx.fillStyle = c.color;
      ctx.save(); ctx.translate(x, y); ctx.rotate(c.rot + c.vr * tc); ctx.scale(1, Math.cos(tc * 7 + c.wob));
      ctx.fillRect(-c.w / 2, -c.w / 4, c.w, c.w / 2); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── per-scene renderers ───────────────────── */
function renderBg(t) {
  const b = (id, x, y) => { $(id).style.transform = `translate(${x}px, ${y}px)`; };
  b('b1', 1500 + Math.sin(t * 0.5) * 220, 150 + Math.cos(t * 0.4) * 140);
  b('b2', 350 + Math.cos(t * 0.35) * 200, 950 + Math.sin(t * 0.45) * 120);
  b('b3', 960 + Math.sin(t * 0.3 + 1) * 380, 560 + Math.cos(t * 0.5) * 160);
  // like beats pulse the pink blob
  const pulse = LIKES.reduce((a, L) => a + Math.max(0, 1 - Math.abs(t - L - 0.05) * 6), 0);
  $('b1').style.opacity = 0.5 + 0.25 * pulse;
  $('flash').style.opacity = 0.22 * Math.max(0, 1 - Math.abs(t - 0.52) * 8) + 0.25 * Math.max(0, 1 - Math.abs(t - 8.8) * 7);
}

function renderLogo(t) {
  // intro (0–2) and finale (8.7–10) share the logo lockup
  const fin = t >= 8.6;
  const t0 = fin ? T.finIn : 0.1;
  const s1 = $('s1');
  if (!fin) sceneVis(s1, t, null, T.s1Out);
  else { s1.style.display = 'block'; s1.style.opacity = 1; s1.style.filter = 'none'; s1.style.transform = `scale(${lerp(1, 1.03, seg(t, 9, 10))})`; }
  if (!fin && t > T.s1Out[1]) return;

  const pt = outBack(seg(t, t0, t0 + 0.55), 1.9);
  const rot = (1 - outCubic(seg(t, t0, t0 + 0.7))) * -40;
  const logo = $('logo');
  const lift = fin ? 0 : 0;
  logo.style.transform = `translateY(${lift}px) scale(${Math.max(0, pt)}) rotate(${rot}deg)`;
  const hp = outBack(seg(t, t0 + 0.22, t0 + 0.65), 2.6);
  const beatT = fin ? 9.55 : 1.35;
  const beat = 1 + 0.14 * Math.max(0, Math.sin(clamp((t - beatT) / 0.25) * Math.PI)) + 0.09 * Math.max(0, Math.sin(clamp((t - beatT - 0.28) / 0.22) * Math.PI));
  logo.querySelector('svg').style.transform = `scale(${Math.max(0, hp) * beat})`;
  logo.querySelector('.tile').style.transform = `rotate(${t * 40}deg)`;

  animWords(titleWords, t, t0 + (fin ? 0.25 : 0.6), 0.09, fin ? 0.45 : 0.6, 80);
  animWords(tagWords, t, t0 + (fin ? 0.45 : 0.95), 0.07, 0.45, 40);
  const lt = $('lockTag');
  lt.style.display = fin ? 'block' : 'none';
  if (fin) { const p = outBack(seg(t, 9.25, 9.7)); lt.style.opacity = clamp(p); lt.style.transform = `translateY(${(1 - p) * 40}px)`; }
}

function renderLinks(t) {
  const s = $('s2');
  sceneVis(s, t, T.s2In, T.s2Out, { dirIn: -1 });
  if (s.style.display === 'none') return;
  const tag = outCubic(seg(t, 2.0, 2.4));
  $('s2tag').style.opacity = tag; $('s2tag').style.transform = `translateY(${(1 - tag) * 20}px)`;
  animWords(s2h, t, 2.08, 0.08);
  animWords(s2s, t, 2.4, 0.035, 0.45, 30);

  let shown = 0, n = 0;
  lineEls.forEach((el, i) => {
    const p = outCubic(seg(t, LINE_T0 + i * LINE_DT, LINE_T0 + i * LINE_DT + 0.22));
    el.style.opacity = p; el.style.transform = `translateX(${(1 - p) * -50}px)`;
    shown += p; if (p > 0.5) n++;
  });
  const VISIBLE = 9;
  linesEl.style.transform = `translateY(${-Math.max(0, shown - VISIBLE) * 52}px)`;
  $('cnt').textContent = fa(n);
  const last = LINE_T0 + (n - 1) * LINE_DT + 0.11;
  const bump = n ? 1 + 0.3 * Math.exp(-Math.max(0, t - last) * 14) : 1;
  const done = n === NLINES ? 1 + 0.5 * Math.max(0, Math.sin(clamp((t - (LINE_T0 + NLINES * LINE_DT + 0.05)) / 0.35) * Math.PI)) : 1;
  $('cnt').style.transform = `scale(${bump * done})`;
  $('cnt').style.color = n === NLINES ? '#ff79b0' : '';
  $('cbar').style.width = `${(n / NLINES) * 100}%`;
}

function setRange(id, min, max, lo, hi) {
  const r = $(id);
  const pct = (v) => ((v - min) / (max - min)) * 100;
  r.querySelector('.fill').style.cssText = `left:${pct(lo)}%; right:${100 - pct(hi)}%; background:var(--c); box-shadow:0 0 22px var(--c)`;
  r.querySelector('.lo').style.cssText = `left:${pct(lo)}%; border-color:var(--c)`;
  r.querySelector('.hi').style.cssText = `left:${pct(hi)}%; border-color:var(--c)`;
}

function renderTiming(t) {
  const s = $('s3');
  sceneVis(s, t, T.s3In, T.s3Out, { dirIn: -1 });
  if (s.style.display === 'none') return;
  const tag = outCubic(seg(t, 4.3, 4.7));
  $('s3tag').style.opacity = tag; $('s3tag').style.transform = `translateY(${(1 - tag) * 20}px)`;
  animWords(s3h, t, 4.38, 0.09);
  animWords(s3s, t, 4.7, 0.035, 0.45, 30);

  const a = inOutCubic(seg(t, 4.75, 5.3)), b = inOutCubic(seg(t, 4.85, 5.45));
  const preLo = Math.round(lerp(0, 2, a)), preHi = Math.round(lerp(0, 5, b));
  setRange('r1', 0, 30, lerp(0, 2, a), lerp(0, 5, b));
  const c = inOutCubic(seg(t, 5.05, 5.6)), d = inOutCubic(seg(t, 5.15, 5.75));
  setRange('r2', 1, 60, lerp(1, 8, c), lerp(1, 15, d));
  const dLo = Math.round(lerp(1, 8, c)), dHi = Math.round(lerp(1, 15, d));
  $('o1').textContent = `${fa(preLo)} تا ${fa(preHi)} ثانیه`;
  $('o2').textContent = `${fa(dLo)} تا ${fa(dHi)} ثانیه`;
  // thumbs squash while being dragged
  [['r1', 4.75, 5.45], ['r2', 5.05, 5.75]].forEach(([id, s0, s1]) => {
    const act = Math.sin(seg(t, s0, s1) * Math.PI);
    $(id).querySelectorAll('.thumb').forEach((th) => { th.style.transform = `scale(${1 + 0.3 * act})`; th.style.boxShadow = `0 0 0 ${act * 14}px rgba(255,255,255,.12), 0 6px 16px rgba(0,0,0,.5)`; });
  });

  const g = outBack(seg(t, 5.55, 6.0));
  [['sgO', 3], ['sgR', 1 + 3.5 * b], ['sgL', 0], ['sgW', 1 + 11.5 * d]].forEach(([id, grow], i) => {
    const el = $(id);
    if (id === 'sgL') el.style.flex = '0 0 76px'; else el.style.flexGrow = grow;
    const p = outBack(seg(t, 4.85 + i * 0.07, 5.3 + i * 0.07));
    el.style.transform = `scaleY(${clamp(p, 0, 1.2)})`; el.style.opacity = clamp(p);
  });
  const run = seg(t, 5.6, 6.6);
  const rn = $('runner');
  rn.style.opacity = clamp(g) * (run > 0 ? 1 : 0);
  rn.style.left = `${inOutCubic(run) * 694}px`;
}

function renderRun(t) {
  const s = $('s4');
  sceneVis(s, t, T.s4In, T.s4Out);
  if (s.style.display === 'none') return;
  animWords(s4h, t, 6.55, 0.07, 0.5, 40);

  const k = LIKES.filter((L) => t >= L).length;
  const count = k * 5;
  const prevL = k ? LIKES[k - 1] : 6.7;
  const nextL = LIKES[k] ?? prevL + 0.27;
  const smooth = LIKES.reduce((a, L) => a + outCubic(seg(t, L, L + 0.25)), 0) * 5;
  $('ringT').setAttribute('stroke-dashoffset', 1000 * (1 - smooth / 30));
  $('ringP').setAttribute('stroke-dashoffset', k < LIKES.length ? 1000 * seg(t, prevL, nextL) : 0);
  $('ringP').setAttribute('stroke', k < LIKES.length ? '#a24bff' : '#2fe39a');
  $('coreNum').innerHTML = `${fa(count)}<small> / ۳۰</small>`;
  const pop = k ? 1 + 0.45 * Math.exp(-(t - prevL) * 9) * Math.sin(clamp((t - prevL) / 0.35) * Math.PI) : 1;
  $('coreHeart').style.transform = `scale(${pop})`;
  $('coreHeart').style.filter = `drop-shadow(0 0 ${20 + 30 * (pop - 1)}px rgba(255,46,126,.8))`;
  $('stL').textContent = fa(count);
  $('stL').style.transform = `scale(${1 + 0.4 * (pop - 1)})`;

  // tweet stack scrolls up after each like
  const sp = LIKES.reduce((a, L) => a + inOutCubic(seg(t, L + 0.07, L + 0.24)), 0);
  const enter = outCubic(seg(t, 6.55, 7.0));
  tweets.forEach((tw, i) => {
    const dI = i - sp;
    const y = 460 + dI * 300 + (1 - enter) * 300;
    const o = clamp(1 - Math.abs(dI) * 0.62) * enter;
    tw.el.style.transform = `translateY(${y}px) scale(${1 - Math.min(1, Math.abs(dI)) * 0.08})`;
    tw.el.style.opacity = o;
    const liked = i < LIKES.length && t >= LIKES[i];
    const lp = liked ? t - LIKES[i] : 0;
    const hs = liked ? 1 + 0.8 * Math.exp(-lp * 8) * Math.sin(clamp(lp / 0.3) * Math.PI) : 1;
    tw.heart.style.fill = liked ? 'url(#g-heart)' : 'none';
    tw.heart.style.stroke = liked ? 'none' : 'rgba(255,255,255,.55)';
    tw.heart.style.strokeWidth = '2';
    tw.heart.style.transform = `scale(${hs})`;
    tw.heart.style.filter = liked ? 'drop-shadow(0 0 14px rgba(255,46,126,.9))' : 'none';
    tw.num.textContent = tw.base + (liked ? 1 : 0);
    tw.lk.style.color = liked ? '#ff79b0' : '';
    tw.el.style.borderColor = Math.abs(dI) < 0.5 ? `rgba(255,46,126,${0.6 * (1 - Math.abs(dI) * 2)})` : '';
    tw.el.style.boxShadow = Math.abs(dI) < 0.5 ? `0 0 ${60 * (1 - Math.abs(dI) * 2)}px rgba(255,46,126,.25), 0 30px 80px rgba(0,0,0,.45)` : '';
  });
}

window.renderFrame = (t) => {
  renderBg(t);
  renderLogo(t);
  renderLinks(t);
  renderTiming(t);
  renderRun(t);
  drawFx(t);
};
window.DURATION = DURATION;
window.getEvents = () => ({ duration: DURATION, events: events.sort((a, b) => a.t - b.t) });
Promise.all(['400', '500', '700', '900'].map((w) => document.fonts.load(`${w} 40px Vaz`, 'سلام')).concat(
  ['700', '900'].map((w) => document.fonts.load(`${w} 40px VazL`, 'X Auto Liker'))))
  .then(() => document.fonts.ready).then(() => { window.renderFrame(0); window.ready = true; });
