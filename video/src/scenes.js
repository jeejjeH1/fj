// Storyboard. Every scene is built once, then updated as a pure function of its local time `lt`.
import {
  W, H, clamp, lerp, seg, E, ease, rng, noise1, el, $, $$, set, rise, pop, splitWords, revealWords,
  ev, typer, cur, cursorAt, flash, shake, glitch, impact, hlPy, esc,
} from './lib.js';

export const SCENES = [];
const stage = () => document.getElementById('stage');
const A = (p, cls, html, css = '') => { const e = el('div', 'abs ' + (cls || ''), html, p); e.style.cssText += css; return e; };
const hide = e => set(e, { o: 0 });
const MM = '../assets/metamask.png', GL = '../assets/genlayer.png';

function scene(name, dur, build, opts = {}) {
  const T0 = SCENES.reduce((a, s) => a + s.dur, 0);
  const root = el('div', 'scene', null, stage());
  const s = { name, T0, dur, root, mix: opts.mix ?? 0, env: opts.env ?? true };
  const r = build(root, T0, dur) || {};
  s.update = r.update || (() => {});
  s.logos = r.logos || null;
  s.world = r.world || null;
  SCENES.push(s);
  if (T0 > 0 && opts.whoosh !== false) ev('whoosh', T0 - .14);
}

// rect hover test (screen px)
const inside = (c, x, y, w, h) => c && c.vis > .5 && c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h;

const ICON = {
  key: `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>`,
  bot: `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/></svg>`,
  lock: `<svg width="120" height="140" viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path class="shackle" d="M7 12V8a5 5 0 0 1 10 0v4"/><rect x="4" y="12" width="16" height="13" rx="3"/><path d="M12 17v3"/></svg>`,
  chart: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 20h18M6 16l4-5 3 3 5-7"/><circle cx="18" cy="7" r="1.6"/></svg>`,
  doc: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13l2 2 4-4"/></svg>`,
  shield: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  scale: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/></svg>`,
};

// shared 3D logo helpers
const flyIn = (lt, t0, t1, from, to, spin = 1) => {
  const p = seg(lt, t0, t1), e = E.inCubic(p);
  const settle = lt > t1 ? Math.exp(-(lt - t1) * 7) * Math.sin((lt - t1) * 26) : 0;
  return {
    x: lerp(from.x, to.x, E.outCubic(p)), y: lerp(from.y, to.y, E.outCubic(p)),
    z: lerp(-38, 0, e) + settle * .9,
    ry: (1 - E.outCubic(p)) * Math.PI * 4 * spin, rx: (1 - E.outCubic(p)) * .8,
    size: to.size, o: clamp(p * 4),
  };
};

/* ───────────────────────── 1. HOOK ───────────────────────── */
scene('hook', 6, (R, T0) => {
  const meter = A(R, '', `
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="label g"><i></i>Agent budget · weekly</div><div class="mono green" style="font:700 22px JBM;letter-spacing:.14em">● WITHIN BUDGET</div></div>
    <div style="margin-top:18px;height:14px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden"><div class="fill" style="height:100%;width:0;background:linear-gradient(90deg,#1fc977,#7cf5c0);box-shadow:0 0 20px #2be38b"></div></div>
    <div class="amt mono" style="margin-top:14px;font:400 22px JBM;color:#9a9cad">$0.00 / $50.00</div>`, 'left:310px;top:250px;width:1300px');
  const box = A(R, 'panel or-edge', '', 'left:310px;top:405px;width:1300px;height:300px;padding:58px 66px');
  const l1 = el('div', '', '', box); l1.style.cssText = 'font:700 60px/1.25 Inter;letter-spacing:-.025em;color:#fff;white-space:nowrap';
  const l2 = el('div', '', '', box); l2.style.cssText = 'font:800 66px/1.25 Inter;letter-spacing:-.025em;color:var(--red);margin-top:14px;white-space:nowrap';
  const send = A(box, '', `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#160800" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    'right:34px;bottom:34px;width:70px;height:70px;border-radius:20px;background:linear-gradient(180deg,#ff8a3a,#ff5f10);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 40px rgba(255,107,26,.4)');
  const tag = A(R, 'chip mono', '<span style="color:var(--red)">▲</span>&nbsp;INTENT ≠ ACTION', 'left:1280px;top:735px;border-color:rgba(255,59,78,.6);background:rgba(60,8,14,.85);color:#ffd5da;font-size:22px');

  const tyA = typer(l1, 'Your AI agent can stay inside its budget', T0 + 1.15, 23, { seed: 3, caretEnd: T0 + 3.25 });
  const tyB = typer(l2, 'and still do the wrong thing.', T0 + 3.3, 15, { seed: 5 });
  const tg = tyB.end + .12;
  glitch(tg, .5); flash(tg, .35, .45, '255,40,70'); shake(tg, 10, .4);
  cur(T0 + .15, 1720, 1030, { show: true }); cur(T0 + .95, 1250, 520, { click: true }); cur(T0 + 1.7, 1380, 640, { hide: true });

  return {
    update(lt) {
      const t = T0 + lt;
      rise(meter, lt, .15, .6, 30);
      const f = ease(lt, .5, 2.6, E.inOutCubic);
      $(meter, '.fill').style.width = (f * 38) + '%';
      $(meter, '.amt').textContent = `$${(f * 19).toFixed(2)} / $50.00`;
      const bp = ease(lt, 0, .55, E.outBack);
      set(box, { o: clamp(lt / .3), s: lerp(.9, 1, bp), y: (1 - bp) * 30 });
      tyA.update(t);
      if (t < tyB.times[0] - .6 && lt < 1.15) l1.innerHTML = '<span class="caret"></span><span style="opacity:.32">Ask your agent anything…</span>';
      tyB.update(t);
      const g = t >= tg && t < tg + .5;
      l2.style.transform = g ? `translateX(${noise1(t * 60) * 14}px) skewX(${noise1(t * 40, 3) * 8}deg)` : 'none';
      pop(tag, t - tg, .1, .45, .5);
      set(send, { o: 1, s: 1 - .12 * clamp(1 - Math.abs(lt - 1.0) * 8) });
    },
  };
}, { mix: 0 });

/* ───────────────────────── 2. JUDGMENT ───────────────────────── */
scene('judgment', 4.5, (R, T0) => {
  const a = A(R, 'h1 center-x', `Spending limits <span class="mute">can't catch that.</span>`, 'top:300px');
  const wa = splitWords(a);
  const b = A(R, 'h0 center-x', '', 'top:470px');
  const word = 'Judgment can.';
  b.innerHTML = [...word].map(c => `<span class="w grad" style="display:inline-block">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  const letters = $$(b, '.w');
  const bar = A(R, '', '', 'left:560px;top:690px;width:800px;height:6px;border-radius:3px;background:linear-gradient(90deg,#ff8a2a,#ff4fa3,#8b7cff);box-shadow:0 0 30px #ff4fa3;transform-origin:0 50%');
  wa.forEach((_, i) => ev('tick', T0 + .1 + i * .11));
  impact(T0 + 1.85, .9);
  return {
    update(lt) {
      revealWords(wa, lt, .1, .11, .45, -60);
      const up = ease(lt, 1.6, 2.1, E.outCubic);
      a.style.transform = `translateY(${-70 * up}px) scale(${1 - .18 * up})`;
      a.style.opacity = lt < .1 ? 0 : 1 - .55 * up;
      letters.forEach((l, i) => {
        const p = seg(lt, 1.72 + i * .018, 1.72 + i * .018 + .32);
        set(l, { o: clamp(p * 2), s: lerp(2.6, 1, E.outExpo(p)), b: (1 - p) * 18, y: (1 - E.outExpo(p)) * -40 });
      });
      const bp = ease(lt, 2.3, 2.9, E.outExpo);
      bar.style.transform = `scaleX(${bp})`; bar.style.opacity = bp > 0 ? 1 : 0;
    },
  };
});

/* ───────────────────────── 3. LOGO REVEAL ───────────────────────── */
scene('reveal', 7, (R, T0) => {
  const lab = A(R, 'label center-x', '', 'top:96px;justify-content:center;display:flex');
  const labIn = el('span', '', '', lab);
  const x = A(R, 'center-x', '×', 'top:300px;font:200 150px/1 Inter;color:#d7d8e6');
  const l1 = A(R, 'mono center-x', '', 'top:668px;font:400 30px/1 JBM;color:#a4a6b8');
  const big = A(R, 'h1 center-x', 'INTERNET COURT', 'top:722px;font-size:150px;letter-spacing:.02em');
  const chips = A(R, 'center-x', `<span class="chip"><span class="or">●</span> AI agents</span>&nbsp;&nbsp;<span class="chip"><span class="vi">●</span> Payments</span>&nbsp;&nbsp;<span class="chip"><span style="color:#ff4fa3">●</span> Onchain judgment</span>`, 'top:908px');
  const cs = $$(chips, '.chip');
  const tyL = typer(labIn, 'CASE STUDY', T0 + 1.35, 18, { seed: 11, caret: false });
  const ty1 = typer(l1, "@MetaMask published a case study on how @GenLayer's", T0 + 1.7, 40, { seed: 12, caret: false, vol: .8 });
  impact(T0 + 1.0, 1.25);
  ev('riser', T0 - 2.0, { d: 2.0 });
  impact(T0 + 3.4, .6);
  cs.forEach((_, i) => ev('pop', T0 + 4.1 + i * .15));
  return {
    update(lt) {
      const t = T0 + lt;
      pop(x, lt, 1.05, .5, .2);
      tyL.update(t); set(lab, { o: lt > 1.3 ? 1 : 0 });
      ty1.update(t);
      const p = seg(lt, 3.3, 3.9);
      big.style.letterSpacing = lerp(.5, .02, E.outExpo(p)) + 'em';
      set(big, { o: clamp(p * 2), b: (1 - E.outExpo(p)) * 16, s: lerp(1.25, 1, E.outExpo(p)) });
      big.classList.toggle('grad', true);
      cs.forEach((c, i) => pop(c, lt, 4.1 + i * .15, .45, .6));
    },
    logos(lt) {
      const out = E.inCubic(seg(lt, 6.25, 6.95));
      const idle = Math.max(0, lt - 1.1);
      const f = flyIn(lt, .05, 1.0, { x: -500, y: 300 }, { x: 540, y: 395, size: 430 }, 1);
      const g = flyIn(lt, .05, 1.0, { x: 2420, y: 300 }, { x: 1380, y: 395, size: 430 }, -1);
      f.ry += Math.sin(idle * .9) * .45 + out * Math.PI * 2; g.ry += Math.sin(idle * .9 + 1.5) * .45 - out * Math.PI * 2;
      f.y += Math.sin(idle * 1.3) * 8; g.y += Math.cos(idle * 1.3) * 8;
      f.size *= 1 - out; g.size *= 1 - out;
      return { fox: f, gen: g };
    },
  };
}, { mix: .5 });

/* ───────────────────────── 4. DELEGATION ───────────────────────── */
scene('delegation', 9, (R, T0) => {
  const lab = A(R, 'label', '<i></i>01 · The problem', 'left:140px;top:200px');
  const title = A(R, 'h2', 'Your agent gets a<br><span class="grad-or">scoped delegation.</span>', 'left:140px;top:250px;width:820px');
  const body = A(R, 'body', 'Which token. Which recipient. What budget.<br>Which merchant. Until when.', 'left:140px;top:440px;width:820px');
  const enf = A(R, 'h3', 'MetaMask enforces it <span class="or">in code.</span>', 'left:140px;top:610px');
  const blk = A(R, 'body', 'Anything outside the scope is <b class="red">blocked<br>before it settles.</b>', 'left:140px;top:700px;width:820px');

  const card = A(R, 'panel or-edge', '', 'left:1010px;top:150px;width:780px;height:780px');
  A(card, '', `<img src="${MM}" style="width:56px;height:56px;border-radius:14px;vertical-align:middle"> <span style="font:800 34px Inter;vertical-align:middle;margin-left:12px">Smart Account</span>`, 'left:36px;top:30px');
  A(card, 'chip mono', 'DELEGATION', 'right:36px;top:36px;font-size:18px;color:var(--or2);border-color:rgba(255,107,26,.4)');
  const rows = [['TOKEN', 'USDC'], ['RECIPIENT', '0x7A3c…F91e'], ['BUDGET', '$50 / week'], ['MERCHANT', 'news-hub.api'], ['UNTIL', 'Oct 31, 2026']];
  const R0 = 130, RH = 104;
  const rowEls = rows.map(([k], i) => {
    const r = A(card, '', `<div class="mono" style="width:210px;font:700 20px JBM;letter-spacing:.16em;color:#8d8fa2">${k}</div><div class="val" style="flex:1;font:600 34px Inter;white-space:nowrap"></div><div class="check">✓</div>`,
      `left:36px;right:36px;top:${R0 + i * RH}px;height:${RH}px;border-top:1px solid var(--line);display:flex;align-items:center`);
    return r;
  });
  const btn = A(card, 'btn', '<span class="a">Sign delegation&nbsp;→</span>', 'left:36px;right:36px;top:672px;height:82px');
  const btnOk = A(card, 'btn', '🔒&nbsp;Delegation active', 'left:36px;right:36px;top:672px;height:82px;background:linear-gradient(180deg,#3df0a0,#18c172);color:#03140b;box-shadow:0 16px 50px rgba(43,227,139,.35)');
  const pill = A(R, 'chip mono', 'PAY $240 → unknown-shop.xyz', 'left:1080px;top:470px;font-size:28px;padding:20px 30px;border-color:rgba(255,59,78,.7);background:rgba(60,8,14,.92);color:#ffd5da;z-index:3');
  const stamp = A(R, 'stamp', 'BLOCKED<div style="font:700 20px JBM;letter-spacing:.2em;margin-top:10px;text-align:center">OUTSIDE SCOPE</div>', 'left:1190px;top:420px;z-index:4');

  const typers = [];
  cur(T0 + .3, 1750, 1060, { show: true });
  rows.forEach(([, v], i) => {
    const tc = T0 + .95 + i * .56;
    cur(tc, 1300 + (i % 2) * 40, 150 + R0 + i * RH + 52, { click: true });
    typers.push(typer($(rowEls[i], '.val'), v, tc + .06, 42, { seed: 20 + i, caretEnd: tc + .46 }));
    ev('check', tc + .42);
  });
  const tb = T0 + 4.0;
  cur(tb, 1400, 150 + 672 + 41, { click: true }); ev('success', tb + .05);
  cur(T0 + 4.6, 1560, 1000, { hide: true });
  const th = T0 + 5.35;
  ev('stamp', th); shake(th, 16, .45); flash(th, .25, .35, '255,40,70');
  return {
    update(lt) {
      const t = T0 + lt;
      rise(lab, lt, .05); rise(title, lt, .12); rise(body, lt, .5); rise(enf, lt, 4.2); rise(blk, lt, 5.7);
      const cp = ease(lt, .05, .7, E.outCubic);
      set(card, { o: cp, x: (1 - cp) * 120, ry: (1 - cp) * -18 });
      rowEls.forEach((r, i) => { typers[i].update(t); pop($(r, '.check'), t - (T0 + .95 + i * .56), .42, .35, .2); });
      const press = 1 - .05 * clamp(1 - Math.abs(t - tb) * 10);
      set(btn, { o: t < tb + .1 ? 1 : 1 - seg(t, tb + .1, tb + .3), s: press });
      set(btnOk, { o: seg(t, tb + .08, tb + .28), s: press });
      // blocked payment
      const pin = seg(lt, 4.7, 5.35);
      const bounce = seg(lt, 5.35, 6.2);
      set(pill, { o: lt < 4.7 ? 0 : 1 - bounce, x: lerp(900, 0, E.inCubic(pin)) + E.outCubic(bounce) * 260, r: E.outCubic(bounce) * 8 });
      const sp = seg(lt, 5.35, 5.6);
      set(stamp, { o: clamp(sp * 3), s: lerp(2.4, 1, E.outBack(sp, 1.4)), r: -8 });
      card.style.borderColor = lt > 5.35 && lt < 7 ? `rgba(255,59,78,${.8 * (1 - seg(lt, 5.35, 7))})` : '';
      card.style.transform += lt > 5.35 && lt < 5.8 ? ` translateX(${noise1(lt * 50) * 10 * (1 - seg(lt, 5.35, 5.8))}px)` : '';
    },
  };
}, { mix: .1 });

/* ───────────────────────── 5. THE GAP ───────────────────────── */
scene('gap', 7.5, (R, T0) => {
  const lab = A(R, 'label center-x', '<i></i>02 · The gap', 'top:110px;display:flex;justify-content:center');
  const pnl = A(R, 'panel', '', 'left:360px;top:165px;width:1200px;height:300px;padding:40px 48px');
  A(pnl, '', `<div class="mono" style="font:700 40px JBM">PAY $12.00 → news-hub.api</div><div style="margin-top:12px;font:500 28px Inter;color:#9a9cad">item: <span style="color:#fff">“Crypto Signals Pro”</span></div>`, 'left:48px;top:40px');
  const pass = A(pnl, 'chip mono', '✓ ALL CHECKS PASSED', 'right:48px;top:46px;font-size:22px;background:rgba(43,227,139,.14);border-color:rgba(43,227,139,.6);color:var(--green)');
  const names = ['TOKEN', 'RECIPIENT', 'BUDGET', 'MERCHANT', 'TIME'];
  const cks = names.map((n, i) => A(pnl, 'chip mono', `<span class="green">✓</span> ${n}`, `left:${48 + i * 222}px;top:196px;font-size:20px;width:204px;justify-content:center`));
  const cmpL = A(R, 'panel', `<div class="label g"><i></i>You asked for</div><div class="h3" style="margin-top:18px;font-size:56px">Sports news</div>`, 'left:360px;top:505px;width:540px;height:180px;padding:34px 40px');
  const neq = A(R, 'center-x', '≠', 'top:530px;font:900 120px/1 Inter;color:var(--red);text-shadow:0 0 40px rgba(255,59,78,.7)');
  const cmpR = A(R, 'panel', `<div class="label r"><i></i>Agent bought</div><div class="h3 red" style="margin-top:18px;font-size:56px">Crypto signals</div>`, 'left:1020px;top:505px;width:540px;height:180px;padding:34px 40px;border-color:rgba(255,59,78,.55)');
  const l1 = A(R, 'h2 center-x', "A deterministic rule can't understand what you meant.", 'top:740px;font-size:62px');
  const w1 = splitWords(l1);
  const l2 = A(R, 'body center-x', `This gap doesn't close with one more rule. <b class="grad" style="font-weight:800">It takes judgment.</b>`, 'top:850px;font-size:40px');
  names.forEach((_, i) => ev('check', T0 + .55 + i * .18));
  ev('success', T0 + 1.55);
  glitch(T0 + 2.75, .45); shake(T0 + 2.75, 12, .4);
  return {
    update(lt) {
      rise(lab, lt, .05);
      const pp = ease(lt, 0, .5, E.outBack); set(pnl, { o: clamp(lt / .25), s: lerp(.92, 1, pp) });
      cks.forEach((c, i) => pop(c, lt, .5 + i * .18, .4, .5));
      pop(pass, lt, 1.5, .5, .4);
      const red = seg(lt, 2.75, 3.1);
      pnl.style.borderColor = red > 0 ? `rgba(255,59,78,${.7 * red})` : '';
      rise(cmpL, lt, 2.2, .5, 40); rise(cmpR, lt, 2.4, .5, 40); pop(neq, lt, 2.7, .4, .2);
      revealWords(w1, lt, 3.5, .06, .5, 40);
      rise(l2, lt, 5.0, .6, 30);
    },
  };
}, { mix: .3 });

/* ───────────────────────── 6. GENLAYER / GENVM ───────────────────────── */
scene('genvm', 7, (R, T0) => {
  const lab = A(R, 'label v', '<i></i>03 · Enter GenLayer', 'left:120px;top:112px');
  const win = A(R, 'panel vi-edge', `<div class="win-bar"><b style="background:#ff5f57"></b><b style="background:#febc2e"></b><b style="background:#28c840"></b><span style="margin-left:14px">internet_court.py</span></div><div class="code"></div>`, 'left:120px;top:165px;width:1000px;height:770px;overflow:hidden');
  const code = `class InternetCourt(gl.Contract):

    @gl.public.write
    def review(self, intent, evidence_url):
        def judge():
            web = gl.nondet.web.render(evidence_url)
            return gl.nondet.exec_prompt(
                f"Intent: {intent}  Evidence: {web}"
                "continue|constrain|revoke|escalate?")

        self.verdict = gl.eq_principle \\
            .prompt_non_comparative(judge,
                criteria="matches the user's intent")`;
  const ty = typer($(win, '.code'), code, T0 + .4, 92, { seed: 33, highlight: hlPy, vol: .55 });
  const head = A(R, 'h3 center-x grad-vi', 'Intelligent Contracts', 'left:1160px;right:40px;top:640px;font-size:60px');
  const sub = A(R, 'body center-x', 'written in Python · executed in the GenVM', 'left:1160px;right:40px;top:720px;font-size:28px');
  const chipDefs = [['Live web data', 'web.render'], ['Natural language', 'exec_prompt'], ['Unstructured evidence', 'Evidence'], ['→ Onchain outcome', 'self.verdict']];
  const chips = chipDefs.map(([txt], i) => A(R, 'chip', `<span class="vi">◆</span> ${txt}`, `left:${i % 2 ? 1500 : 1180}px;top:${800 + Math.floor(i / 2) * 76}px;font-size:24px`));
  const ct = chipDefs.map(([, k]) => ty.times[code.indexOf(k) + k.length - 1] ?? T0 + 3);
  ct.forEach(t => ev('pop', t + .05));
  return {
    update(lt) {
      const t = T0 + lt;
      rise(lab, lt, .05);
      const wp = ease(lt, 0, .6, E.outCubic); set(win, { o: wp, x: (1 - wp) * -80, ry: (1 - wp) * 14 });
      ty.update(t);
      rise(head, lt, .7); rise(sub, lt, .9);
      chips.forEach((c, i) => pop(c, t - ct[i], .05, .4, .5));
    },
    logos(lt) {
      const p = ease(lt, .1, .9, E.outCubic), out = E.inCubic(seg(lt, 6.4, 6.95));
      return { gen: { x: 1475, y: 360, z: lerp(-20, 0, p), size: 420 * (1 - out), ry: lt * 1.1 + (1 - p) * 6, rx: Math.sin(lt * .8) * .12, o: clamp(p * 3), glow: .3 } };
    },
  };
}, { mix: .85 });

/* ───────────────────────── 7. EQUIVALENCE PRINCIPLE ───────────────────────── */
scene('equivalence', 5.5, (R, T0) => {
  const lab = A(R, 'label v center-x', '<i></i>The Equivalence Principle', 'top:112px;display:flex;justify-content:center');
  const title = A(R, 'h2 center-x', 'Consensus on <span class="grad-vi">meaning</span>, not on exact text.', 'top:160px;font-size:66px');
  const outs = ['Off-scope purchase. Revoke the delegation.', 'Not sports news → revoke.', 'Intent violated. Recommend: revoke.', 'Bought crypto signals. Revoke it.', 'Revoke — breaks the user’s intent.'];
  const CW = 330, GAP = 22, L0 = (W - (5 * CW + 4 * GAP)) / 2;
  const cards = outs.map((o, i) => A(R, 'panel vi-edge', `<div style="display:flex;justify-content:space-between" class="mono"><span style="font:700 18px JBM;letter-spacing:.14em;color:#b8adff">VALIDATOR ${i + 1}</span><span style="font:700 16px JBM;color:#6f7186">LLM·${'ABCDE'[i]}</span></div><div class="q" style="margin-top:20px;font:500 28px/1.32 Inter;color:#e9e9f4;height:120px"></div><div class="ok chip mono" style="position:absolute;left:24px;bottom:22px;font-size:18px;background:rgba(43,227,139,.14);border-color:rgba(43,227,139,.5);color:var(--green)">≈ REVOKE</div>`,
    `left:${L0 + i * (CW + GAP)}px;top:330px;width:${CW}px;height:290px;padding:26px 24px`));
  const tys = cards.map((c, i) => typer($(c, '.q'), outs[i], T0 + .55 + i * .1, 30 + i * 3, { seed: 40 + i, sound: i % 2 === 0, vol: .5, caretEnd: T0 + 3.2 }));
  const svg = el('div', 'abs', `<svg width="1920" height="1080" style="position:absolute;left:0;top:0"><defs><linearGradient id="eqg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8b7cff"/><stop offset="1" stop-color="#2be38b"/></linearGradient></defs>${outs.map((_, i) => {
    const x = L0 + i * (CW + GAP) + CW / 2; return `<path d="M${x} 625 C ${x} 720, 960 690, 960 790" stroke="url(#eqg)" stroke-width="3" fill="none" stroke-dasharray="400" stroke-dashoffset="400" style="filter:drop-shadow(0 0 6px #8b7cff)"/>`;
  }).join('')}</svg>`, R);
  svg.style.cssText = 'left:0;top:0';
  const paths = $$(svg, 'path');
  const pill = A(R, 'chip', '<span class="check" style="width:46px;height:46px">✓</span>&nbsp;CONSENSUS&nbsp;·&nbsp;<span class="green">REVOKE</span>', 'left:0;right:0;margin:auto;width:520px;justify-content:center;top:795px;font:800 34px Inter;padding:20px 30px;border-color:rgba(43,227,139,.55);background:rgba(10,40,26,.85)');
  cards.forEach((_, i) => ev('check', T0 + 2.9 + i * .08));
  impact(T0 + 3.75, .55);
  return {
    update(lt) {
      const t = T0 + lt;
      rise(lab, lt, .05); rise(title, lt, .12);
      cards.forEach((c, i) => { rise(c, lt, .2 + i * .07, .5, 50); tys[i].update(t); pop($(c, '.ok'), lt, 2.9 + i * .08, .35, .4); });
      paths.forEach((p, i) => { p.setAttribute('stroke-dashoffset', 400 * (1 - ease(lt, 3.15 + i * .05, 3.7, E.inOutCubic))); });
      pop(pill, lt, 3.75, .5, .4);
    },
  };
}, { mix: .9 });

/* ───────────────────────── 8. THE JURY ───────────────────────── */
scene('jury', 9, (R, T0) => {
  const CX = 960, CY = 575, RP = 285, RR = 430;
  const lab = A(R, 'label v', '<i></i>04 · The jury', 'left:120px;top:112px');
  const title = A(R, 'h2', 'How does the<br><span class="grad-vi">jury</span> work?', 'left:120px;top:160px;font-size:64px');
  const pool = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2 - Math.PI / 2;
    return A(R, '', '', `left:${CX + Math.cos(a) * RR - 6}px;top:${CY + Math.sin(a) * RR * .82 - 6}px;width:12px;height:12px;border-radius:50%;background:#8b7cff`);
  });
  const picks = [7, 20, 33, 46, 59];
  const pos = i => { const a = -Math.PI / 2 + i * (Math.PI * 2 / 5); return [CX + Math.cos(a) * RP, CY + Math.sin(a) * RP]; };
  const svg = el('div', 'abs', `<svg width="1920" height="1080">${[0, 1, 2, 3, 4].map(() => '<line stroke="#ffa04d" stroke-width="3" stroke-linecap="round" style="filter:drop-shadow(0 0 8px #ff6b1a)"/>').join('')}${[0, 1, 2, 3, 4].map(() => '<circle r="9" fill="#fff" style="filter:drop-shadow(0 0 10px #ffa04d)"/>').join('')}</svg>`, R);
  svg.style.cssText = 'left:0;top:0';
  const lines = $$(svg, 'line'), packets = $$(svg, 'circle');
  const nodes = [0, 1, 2, 3, 4].map(i => { const [x, y] = pos(i); return A(R, 'node', `<div class="n">V${i + 1}</div><div class="m">LLM·${'ABCDE'[i]}</div>`, `left:${x}px;top:${y}px`); });
  const crown = A(R, 'chip mono', '★ LEADER', 'font-size:17px;padding:8px 14px;background:rgba(255,107,26,.2);border-color:var(--or);color:#ffd1b0;margin-left:-62px');
  const votes = [0, 1, 2, 3, 4].map(() => A(R, 'vote', ''));
  const status = ['5 validators · picked at random · each runs its own LLM', 'The leader proposes · the other four vote independently', 'No majority → the leader rotates · the round repeats', 'Majority reached ✓'];
  const st = status.map((s, i) => A(R, 'mono center-x', s, `top:965px;font:700 30px JBM;color:${i === 2 ? 'var(--red)' : i === 3 ? 'var(--green)' : '#d8d9e6'}`));
  const R1 = { lead: 0, at: 2.8, votes: [1, 0, 0, 1] }, R2 = { lead: 1, at: 5.0, votes: [1, 1, 0, 1] };
  for (const r of [R1, R2]) {
    ev('beam', T0 + r.at + .2);
    r.votes.forEach((v, k) => ev(v ? 'check' : 'deny', T0 + r.at + .9 + k * .2));
  }
  for (let k = 0; k < 10; k++) ev('tick', T0 + 1.15 + k * .07);
  ev('pop', T0 + 1.95);
  ev('deny', T0 + 4.55); flash(T0 + 4.55, .18, .3, '255,40,70');
  impact(T0 + 6.85, .7);
  const others = l => [0, 1, 2, 3, 4].filter(i => i !== l);
  return {
    update(lt) {
      rise(lab, lt, .05); rise(title, lt, .12);
      // pool & random pick
      pool.forEach((d, i) => {
        const a = ease(lt, .2 + i * .008, .5 + i * .008);
        const pi = picks.indexOf(i);
        let o = a * .35, s = 1;
        if (lt > 1.15 && lt < 1.9) { const k = Math.floor((lt - 1.15) / .07); if (hash2(k, i) > .9) { o = 1; s = 1.6; } }
        if (pi >= 0 && lt >= 1.9) { o = 1; s = 1.8; const f = ease(lt, 2.0, 2.5, E.inOutCubic); const [tx, ty] = pos(pi); const ox = parseFloat(d.style.left) + 6, oy = parseFloat(d.style.top) + 6; set(d, { o: 1 - seg(lt, 2.35, 2.55), x: (tx - ox) * f, y: (ty - oy) * f, s: lerp(1.8, 4, f) }); return; }
        if (lt > 2.4) o *= 1 - seg(lt, 2.4, 2.9) * .6;
        set(d, { o, s });
      });
      nodes.forEach((n, i) => pop(n, lt, 2.4 + i * .04, .4, .3));
      // rounds
      const r = lt < R2.at ? R1 : R2;
      const [lx, ly] = pos(r.lead);
      const cp = lt < R2.at ? pop(crown, lt, R1.at, .4, .3) : 1;
      if (lt >= R2.at) { // crown moves to next leader
        const m = ease(lt, R2.at, R2.at + .4, E.inOutCubic);
        const [ax, ay] = pos(R1.lead);
        crown.style.left = lerp(ax, lx, m) + 'px'; crown.style.top = lerp(ay, ly, m) - 108 + 'px';
        set(crown, { o: 1 });
      } else { crown.style.left = lx + 'px'; crown.style.top = ly - 108 + 'px'; }
      nodes.forEach((n, i) => {
        const lead = i === r.lead && lt >= r.at;
        n.style.borderColor = lead ? '#ff6b1a' : 'rgba(139,124,255,.55)';
        n.style.boxShadow = lead ? '0 0 60px rgba(255,107,26,.55)' : '0 0 40px rgba(139,124,255,.25)';
      });
      const ot = others(r.lead);
      lines.forEach((l, k) => {
        if (k >= 4 || lt < r.at + .2) { l.style.opacity = 0; packets[k].style.opacity = 0; return; }
        const [bx, by] = pos(ot[k]);
        const p = ease(lt, r.at + .2 + k * .04, r.at + .6 + k * .04, E.inOutCubic);
        const fade = 1 - seg(lt, r.at + 1.9, r.at + 2.2);
        l.setAttribute('x1', lx); l.setAttribute('y1', ly); l.setAttribute('x2', lerp(lx, bx, p)); l.setAttribute('y2', lerp(ly, by, p));
        l.style.opacity = .85 * fade;
        const q = seg(lt, r.at + .35 + k * .04, r.at + .8 + k * .04);
        packets[k].setAttribute('cx', lerp(lx, bx, q)); packets[k].setAttribute('cy', lerp(ly, by, q));
        packets[k].style.opacity = q > 0 && q < 1 ? 1 : 0;
      });
      votes.forEach((v, k) => {
        if (k >= 4) { hide(v); return; }
        const i = ot[k], [x, y] = pos(i), a = Math.atan2(y - CY, x - CX);
        v.style.left = x + Math.cos(a) * 92 + 'px'; v.style.top = y + Math.sin(a) * 92 + 'px';
        const ok = r.votes[k];
        v.textContent = ok ? '✓' : '✕';
        v.style.background = ok ? 'var(--green)' : 'var(--red)'; v.style.color = ok ? '#03140b' : '#fff';
        v.style.boxShadow = `0 0 30px ${ok ? 'rgba(43,227,139,.6)' : 'rgba(255,59,78,.6)'}`;
        const p = pop(v, lt, r.at + .9 + k * .2, .35, .2);
        if (r === R1 && lt > R2.at - .3) set(v, { o: 1 - seg(lt, R2.at - .3, R2.at), s: 1 });
      });
      const si = lt < R1.at ? 0 : lt < 4.5 ? 1 : lt < R2.at + .2 ? 2 : lt < 6.8 ? 1 : 3;
      st.forEach((s, i) => { const on = i === si; const since = [0.3, R1.at, 4.5, 6.8][i]; const tt = i === 1 && si === 1 && lt > R2.at ? R2.at + .2 : since; set(s, on ? { o: ease(lt, tt, tt + .3), y: (1 - ease(lt, tt, tt + .3)) * 16 } : { o: 0 }); });
      if (si === 3) { const p = ease(lt, 6.8, 7.2, E.outBack); st[3].style.transform = `scale(${lerp(.6, 1.15, p)})`; }
    },
    logos(lt) {
      const p = ease(lt, .1, .9, E.outCubic), out = E.inCubic(seg(lt, 8.45, 8.95));
      const pulse = Math.exp(-Math.max(0, lt - 6.85) * 4) * (lt > 6.85 ? 1 : 0);
      return { gen: { x: CX, y: CY, z: 0, size: (190 + pulse * 70) * (1 - out) * p, ry: lt * 1.4, o: p, glow: .5 + pulse } };
    },
    world(lt) { return { pulse: lt > 6.85 ? Math.exp(-(lt - 6.85) * 2) : 0 }; },
  };
}, { mix: 1 });
function hash2(a, b) { const r = rng(a * 7919 + b * 104729 + 1); r(); return r(); }

/* ───────────────────────── 9. FINALITY & APPEALS ───────────────────────── */
scene('finality', 8, (R, T0) => {
  const lab = A(R, 'label v', '<i></i>05 · Finality & appeals', 'left:120px;top:150px');
  const timer = A(R, 'mono', '30:00', 'left:112px;top:190px;font:800 176px/1 JBM;letter-spacing:-.04em');
  const tl = A(R, 'mono', 'FINALITY WINDOW', 'left:124px;top:376px;font:700 20px JBM;letter-spacing:.22em;color:#8d8fa2');
  const b1 = A(R, 'body', 'Anyone can appeal by <b style="color:#fff">staking more gas.</b><br>Each appeal roughly doubles the jury: <b class="vi">2n + 1</b>.', 'left:120px;top:440px;width:860px;font-size:32px');
  const btn = A(R, 'btn', '<span>⚖&nbsp; APPEAL&nbsp;·&nbsp;stake ↑ gas</span>', 'left:120px;top:610px;width:480px;height:92px');
  const cj = A(R, '', `<div class="label v"><i></i>Condorcet Jury Theorem</div><div class="body" style="margin-top:18px;font-size:32px;width:820px">A group of independent voters is <b style="color:#fff">more accurate than any one of them.</b></div>`, 'left:120px;top:780px');
  const cv = el('canvas', 'abs', null, R); cv.width = 840; cv.height = 840; cv.style.cssText = 'left:1000px;top:120px';
  const ctx = cv.getContext('2d');
  const cnt = A(R, 'center-x mono', '', 'left:1000px;width:840px;top:470px;font:800 120px/1 JBM;letter-spacing:-.03em;text-shadow:0 8px 40px #000,0 0 30px #000');
  const cntL = A(R, 'center-x mono', 'VALIDATORS', 'left:1000px;width:840px;top:612px;font:700 22px JBM;letter-spacing:.24em;color:#b8adff;text-shadow:0 0 20px #000');
  const max = A(R, 'chip mono', '◆ ALL 1,534 MAINNET VALIDATORS', 'left:1170px;top:960px;font-size:22px;border-color:rgba(139,124,255,.6);background:rgba(30,24,70,.85);color:#e0dbff');
  const steps = [5, 11, 23, 47, 95, 191, 383, 767, 1534];
  const clicks = [1.55, 2.1, 2.58, 3.0, 3.38, 3.72, 4.02, 4.3];
  cur(T0 + .9, 900, 1040, { show: true });
  clicks.forEach((c, i) => { cur(T0 + c, 360 + (i % 3) * 14, 656 + (i % 2) * 6, { click: true, md: i ? .2 : .55 }); ev('pop', T0 + c + .04, { n: i }); });
  cur(T0 + 4.9, 760, 1000, { hide: true });
  impact(T0 + 4.55, .6);
  const nAt = lt => { let n = 5; clicks.forEach((c, i) => { const p = E.outCubic(seg(lt, c, c + .3)); n = p > 0 ? lerp(steps[i], steps[i + 1], p) : n; }); return n; };
  return {
    update(lt) {
      rise(lab, lt, .05); rise(timer, lt, .1, .5); rise(tl, lt, .2); rise(b1, lt, .45); rise(btn, lt, .7); rise(cj, lt, 5.0);
      const sec = Math.max(0, 1800 - Math.floor(Math.max(0, lt - .5) * 63));
      timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      const press = clicks.some(c => lt > c - .05 && lt < c + .1) ? .95 : 1;
      set(btn, { o: btn.style.opacity, s: press, y: 0 });
      const n = nAt(lt);
      cnt.textContent = Math.round(n).toLocaleString('en-US');
      set(cnt, { o: ease(lt, .5, 1), s: 1 + .08 * clicks.reduce((a, c) => a + Math.max(0, 1 - Math.abs(lt - c - .05) * 8), 0) });
      set(cntL, { o: ease(lt, .5, 1) });
      pop(max, lt, 4.55, .5, .5);
      // dot cloud
      ctx.clearRect(0, 0, 840, 840);
      const ap = ease(lt, .3, .9);
      ctx.strokeStyle = `rgba(139,124,255,${.25 * ap})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(420, 420, 400, 0, Math.PI * 2); ctx.stroke();
      const cnum = Math.ceil(n), rad = clamp(26 / Math.sqrt(n / 5), 4.2, 26);
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let k = 0; k < cnum; k++) {
        const fr = k < Math.floor(n) ? 1 : n - Math.floor(n);
        const rr = 375 * Math.sqrt((k + .5) / n), a = k * ga + lt * .15;
        const x = 420 + Math.cos(a) * rr, y = 420 + Math.sin(a) * rr;
        const hue = k % 9 === 0 ? '255,140,60' : '150,135,255';
        ctx.fillStyle = `rgba(${hue},${.9 * fr * ap})`;
        ctx.beginPath(); ctx.arc(x, y, rad * fr, 0, Math.PI * 2); ctx.fill();
      }
    },
  };
}, { mix: .8 });

/* ───────────────────────── 10. WHY METAMASK ───────────────────────── */
scene('whymm', 7.5, (R, T0) => {
  const lab = A(R, 'label', '<i></i>06 · Why MetaMask', 'left:960px;top:150px');
  const title = A(R, 'h2', 'You stay the owner.<br><span class="grad-or">The agent gets narrow authority.</span>', 'left:960px;top:196px;width:900px;font-size:60px');
  const owner = A(R, 'panel or-edge', `<div style="display:flex;gap:18px;align-items:center;color:var(--or2)">${ICON.key}<div><div class="mono" style="font:700 20px JBM;letter-spacing:.16em">OWNER KEY</div><div style="font:600 26px Inter;color:#fff;margin-top:6px">never handed over</div></div></div>`, 'left:960px;top:380px;width:410px;height:130px;padding:30px');
  const agent = A(R, 'panel', `<div style="display:flex;gap:18px;align-items:center;color:var(--vi2)">${ICON.bot}<div><div class="mono" style="font:700 20px JBM;letter-spacing:.16em">AI AGENT</div><div style="font:600 26px Inter;color:#fff;margin-top:6px">scoped permission</div></div></div>`, 'left:1400px;top:380px;width:410px;height:130px;padding:30px');
  const sign = A(R, 'panel', `<div class="mono" style="font:700 20px JBM;letter-spacing:.16em;color:#8d8fa2">ERC-7710 / ERC-7715 DELEGATION</div><svg width="420" height="80" style="position:absolute;left:30px;top:66px"><path class="sig" d="M5 55 C 30 10, 50 10, 45 50 S 80 70, 95 30 S 120 5, 125 45 S 160 70, 175 35 C 185 15, 200 20, 205 50 S 250 60, 270 30 C 290 5, 300 60, 330 40 S 380 30, 410 38" stroke="#ffa04d" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="900" stroke-dashoffset="900" style="filter:drop-shadow(0 0 8px #ff6b1a)"/></svg>`, 'left:960px;top:540px;width:850px;height:170px;padding:30px');
  const sbtn = A(sign, 'btn', 'Sign once', 'right:30px;top:46px;width:230px;height:78px');
  const sok = A(sign, 'chip mono', '✓ SIGNED ONCE', 'right:30px;top:58px;font-size:22px;background:rgba(43,227,139,.14);border-color:rgba(43,227,139,.6);color:var(--green)');
  const x402 = A(R, 'panel vi-edge', `<div class="mono" style="font:700 20px JBM;letter-spacing:.16em;color:#b8adff">x402 FACILITATOR · MACHINE-TO-MACHINE PAYMENTS</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:26px;font:700 24px JBM">
      <span class="chip mono" style="font-size:20px">AGENT</span><span class="v1 green">verify ✓</span><span class="v2 green">settle ✓</span><span class="chip mono" style="font-size:20px">MERCHANT</span></div>`, 'left:960px;top:740px;width:850px;height:180px;padding:30px');
  const pk = A(x402, '', '', 'left:150px;top:112px;width:16px;height:16px;border-radius:50%;background:#b8adff;box-shadow:0 0 18px #8b7cff');
  const ts = T0 + 2.9;
  cur(T0 + 2.0, 1880, 1060, { show: true }); cur(ts, 1690, 625, { click: true }); cur(T0 + 3.6, 1760, 900, { hide: true });
  ev('sign', ts + .1, { d: .7 }); ev('success', ts + .85);
  [4.6, 5.6, 6.6].forEach(t => { ev('tick', T0 + t + .3); ev('tick', T0 + t + .6); });
  return {
    update(lt) {
      rise(lab, lt, .05); rise(title, lt, .15);
      rise(owner, lt, .9); rise(agent, lt, 1.1); rise(sign, lt, 1.5); rise(x402, lt, 4.1);
      $(sign, '.sig').setAttribute('stroke-dashoffset', 900 * (1 - ease(lt, 3.0, 3.75, E.inOutCubic)));
      set(sbtn, { o: 1 - seg(lt, 3.05, 3.25), s: Math.abs(lt - 2.9) < .1 ? .94 : 1 });
      pop(sok, lt, 3.3, .4, .5);
      const cyc = ((lt - 4.6) % 1) / 1, on = lt > 4.6;
      set(pk, { o: on ? clamp(Math.sin(cyc * Math.PI) * 3) : 0, x: lerp(0, 520, E.inOutCubic(cyc)) });
      $(x402, '.v1').style.opacity = on && cyc > .3 ? 1 : .25; $(x402, '.v2').style.opacity = on && cyc > .6 ? 1 : .25;
    },
    logos(lt) {
      const f = flyIn(lt, 0, .8, { x: -300, y: 500 }, { x: 480, y: 540, size: 560 }, 1);
      const out = E.inCubic(seg(lt, 6.9, 7.45));
      f.ry += Math.sin(Math.max(0, lt - .8) * .8) * .5; f.rx = (f.rx || 0) + Math.sin(lt * .6) * .1;
      f.y += Math.sin(lt * 1.2) * 10; f.size *= 1 - out; f.glow = .55;
      return { fox: f };
    },
  };
}, { mix: 0 });

/* ───────────────────────── 11. TWO-LAYER LOOP ───────────────────────── */
scene('layers', 8, (R, T0) => {
  const lab = A(R, 'label center-x', '<i></i>07 · The control loop', 'top:92px;display:flex;justify-content:center');
  const title = A(R, 'h2 center-x', 'Two layers. <span class="grad">One control loop.</span>', 'top:136px;font-size:64px');
  const persp = A(R, '', '', 'left:0;top:0;width:1920px;height:1080px;perspective:1800px;perspective-origin:50% 20%');
  const mk = (top, cls, img, k, txt, chip, chipCss) => A(persp, 'panel ' + cls, `
    <div style="display:flex;align-items:center;gap:28px;height:100%">
      <div style="width:92px;height:92px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden">${img}</div>
      <div style="flex:1"><div class="mono" style="font:700 20px JBM;letter-spacing:.18em;color:${cls === 'or-edge' ? 'var(--or2)' : 'var(--vi2)'}">${k}</div><div style="font:700 36px Inter;margin-top:10px">${txt}</div></div>
      <div class="chip mono res" style="${chipCss}">${chip}</div></div>`, `left:300px;top:${top}px;width:1320px;height:170px;padding:0 40px;transform-origin:50% 100%`);
  const L1 = mk(270, 'or-edge', `<img src="${MM}" style="width:92px">`, 'LAYER 1 · METAMASK', 'Clearly outside the delegation', '✕ BLOCKED', 'font-size:24px;background:rgba(60,8,14,.9);border-color:var(--red);color:#ffb3bb');
  const L2 = mk(480, 'vi-edge', `<img src="${GL}" style="width:70px;filter:invert(1)">`, 'LAYER 2 · GENLAYER', 'Inside the delegation, but questionable', '⚖ REVIEWED · signed evidence', 'font-size:22px;background:rgba(30,24,70,.9);border-color:var(--vi);color:#e0dbff');
  const vl = A(R, 'label center-x', 'The verdict is one of four', 'top:720px;display:flex;justify-content:center');
  const V = [['CONTINUE', '#2be38b'], ['CONSTRAIN', '#ffc53d'], ['REVOKE', '#ff3b4e'], ['ESCALATE', '#8b7cff']];
  const VW = 330, VG = 26, VX = (W - (4 * VW + 3 * VG)) / 2, VY = 775;
  const vs = V.map(([n, c], i) => A(R, 'chip mono', n, `left:${VX + i * (VW + VG)}px;top:${VY}px;width:${VW}px;height:96px;justify-content:center;font:800 30px JBM;letter-spacing:.08em;color:${c};border:2px solid ${c}55;background:rgba(14,14,20,.9)`));
  ev('stamp', T0 + 1.45, { v: .6 }); ev('beam', T0 + 2.9);
  V.forEach((_, i) => ev('pop', T0 + 3.5 + i * .12));
  cur(T0 + 4.1, 1800, 1060, { show: true });
  [0, 1, 2, 3].forEach(i => cur(T0 + 4.65 + i * .42, VX + i * (VW + VG) + VW / 2 + 20, VY + 60, { hover: true, md: .35 }));
  cur(T0 + 6.55, VX + 2 * (VW + VG) + VW / 2, VY + 52, { click: true, md: .45 });
  cur(T0 + 7.2, 1300, 1000, { hide: true });
  impact(T0 + 6.6, .45);
  const dots = [0, 1, 2].map(() => A(persp, '', '', 'width:22px;height:22px;border-radius:50%;margin:-11px 0 0 -11px'));
  return {
    update(lt) {
      const t = T0 + lt;
      rise(lab, lt, .05); rise(title, lt, .12);
      [L1, L2].forEach((L, i) => {
        const p = ease(lt, .35 + i * 1.5, 1.0 + i * 1.5, E.outCubic);
        set(L, { o: p, y: (1 - p) * 120, rx: lerp(70, 20, p) });
        pop($(L, '.res'), lt, 1.45 + i * 1.45, .45, .4);
      });
      // packets: red one bounces off layer 1, amber passes into layer 2
      const d0 = dots[0], p0 = seg(lt, .9, 1.45), b0 = seg(lt, 1.45, 2.0);
      d0.style.background = '#ff3b4e'; d0.style.boxShadow = '0 0 20px #ff3b4e';
      set(d0, { o: p0 > 0 && b0 < 1 ? 1 : 0, x: 760 - b0 * 120, y: lerp(210, 345, E.inCubic(p0)) - Math.sin(b0 * Math.PI) * 120 + b0 * 40 });
      const d1 = dots[1], p1 = seg(lt, 2.2, 2.9);
      d1.style.background = '#ffc53d'; d1.style.boxShadow = '0 0 20px #ffc53d';
      set(d1, { o: p1 > 0 && lt < 3.4 ? 1 : 0, x: 1100, y: lerp(210, 560, E.inOutCubic(p1)) });
      hide(dots[2]);
      rise(vl, lt, 3.3);
      const c = cursorAt(t);
      vs.forEach((v, i) => {
        const hov = inside(c, VX + i * (VW + VG), VY, VW, 96);
        const pp = seg(lt, 3.5 + i * .12, 3.95 + i * .12);
        const chosen = i === 2 && lt > 6.57;
        set(v, { o: clamp(pp * 3), s: lerp(.5, 1, E.outBack(pp, 2)) * (hov ? 1.07 : 1) * (chosen ? 1.08 : 1), y: hov ? -6 : 0 });
        v.style.background = chosen ? '#ff3b4e' : hov ? 'rgba(40,40,56,.95)' : 'rgba(14,14,20,.9)';
        v.style.color = chosen ? '#fff' : V[i][1];
        v.style.boxShadow = chosen ? '0 0 60px rgba(255,59,78,.7)' : hov ? `0 0 40px ${V[i][1]}55` : 'none';
      });
    },
  };
}, { mix: .5 });

/* ───────────────────────── 12. REAL EXAMPLE ───────────────────────── */
scene('example', 9.5, (R, T0) => {
  const lab = A(R, 'label', '<i></i>08 · A real example', 'left:120px;top:96px');
  const title = A(R, 'h3', 'Scope: <span class="grad-or">sports-news services only.</span>', 'left:120px;top:140px;font-size:50px');
  const term = A(R, 'panel', `<div class="win-bar"><b style="background:#ff5f57"></b><b style="background:#febc2e"></b><b style="background:#28c840"></b><span style="margin-left:14px">agent.log</span></div><div class="term"></div>`, 'left:120px;top:230px;width:1050px;height:690px');
  const tb = $(term, '.term');
  const L = [];
  const cmd = (t, s, cps = 44) => { const d = el('div', '', '', tb); L.push({ d, ty: typer(d, s, T0 + t, cps, { seed: L.length + 60, highlight: x => `<span class="p">$</span>${esc(x.slice(1))}`, vol: .7 }) }); return L.at(-1).ty.end - T0; };
  const out = (t, html, sfx = 'line') => { const d = el('div', '', html, tb); L.push({ d, at: t }); if (sfx) ev(sfx, T0 + t); };
  let e = cmd(.3, '$ agent.pay("news-hub.api", "Sports Daily API", 4.00)');
  out(e + .2, '<span class="ok">  ✓ settled · within delegation</span>');
  e = cmd(e + .55, '$ agent.pay("news-hub.api", "Crypto Signals Pro", 12.00)');
  out(e + .2, '<span class="ok">  ✓ settled · still within budget</span>');
  out(e + .65, '<span style="color:var(--amber)">  ⚠ not sports news → flagged to Internet Court</span>', 'deny');
  const tFlag = e + .65;
  out(5.65, '<span class="bad">  ⛔ verdict: REVOKE · delegation revoked onchain</span>', null);
  e = cmd(6.15, '$ agent.pay("news-hub.api", "Crypto Signals Pro", 12.00)');
  const tRej = e + .25;
  out(tRej - 0, '<span class="bad">  ✕ REJECTED before funds move</span>', 'deny');
  shake(T0 + tRej, 10, .35);
  glitch(T0 + tFlag, .25, false);
  // court card
  const court = A(R, 'panel vi-edge', `<div style="display:flex;align-items:center;gap:16px"><img src="${GL}" style="width:46px;filter:invert(1)"><span class="mono" style="font:800 24px JBM;letter-spacing:.14em">INTERNET COURT</span></div>
    <div class="rev mono" style="margin-top:34px;font:500 22px JBM;color:#b8adff">reviewing signed evidence<span class="dots"></span></div>
    <div class="jur" style="display:flex;gap:16px;margin-top:22px">${'<i style="width:26px;height:26px;border-radius:50%;background:#2a2547;border:2px solid #8b7cff;display:inline-block"></i>'.repeat(5)}</div>
    <div class="ver" style="margin-top:34px"><div class="mono" style="font:700 20px JBM;letter-spacing:.2em;color:#8d8fa2">VERDICT · FINALIZED</div><div style="font:900 96px/1 'Inter Display';color:var(--red);letter-spacing:-.02em;margin-top:12px;text-shadow:0 0 40px rgba(255,59,78,.5)">REVOKE</div></div>
    <div class="safe" style="position:absolute;left:36px;right:36px;bottom:34px;display:grid;gap:14px">
      <div class="chip" style="font-size:24px;justify-content:space-between"><span>Account</span><span class="green">✓ still yours</span></div>
      <div class="chip" style="font-size:24px;justify-content:space-between"><span>Remaining balance</span><span class="green">✓ $34.00 safe</span></div></div>`, 'left:1220px;top:230px;width:580px;height:690px;padding:36px');
  const tC = tFlag + .35, tV = 5.45;
  ev('beam', T0 + tC + .3);
  impact(T0 + tV, .7); ev('stamp', T0 + tV, { v: .7 });
  ev('success', T0 + tRej + .45);
  return {
    update(lt) {
      const t = T0 + lt;
      rise(lab, lt, .05); rise(title, lt, .12);
      const wp = ease(lt, 0, .5); set(term, { o: wp, y: (1 - wp) * 40 });
      L.forEach(l => { if (l.ty) l.ty.update(t); else l.d.style.opacity = lt >= l.at ? 1 : 0; if (l.ty) l.d.style.display = t >= l.ty.times[0] - .6 ? 'block' : 'none'; else l.d.style.display = lt >= l.at ? 'block' : 'none'; });
      // only the newest typer keeps its caret
      const cp = ease(lt, tC, tC + .5); set(court, { o: cp, x: (1 - cp) * 80 });
      $(court, '.dots').textContent = '.'.repeat(1 + Math.floor(lt * 4) % 3);
      $(court, '.rev').style.opacity = lt < tV ? 1 : .35;
      $$(court, '.jur i').forEach((d, i) => { const on = lt > tC + .5 + i * .18; d.style.background = on ? (lt > tV ? '#ff3b4e' : '#8b7cff') : '#2a2547'; d.style.boxShadow = on ? `0 0 16px ${lt > tV ? '#ff3b4e' : '#8b7cff'}` : 'none'; });
      const vp = seg(lt, tV, tV + .35); set($(court, '.ver'), { o: clamp(vp * 3), s: lerp(1.8, 1, E.outBack(vp, 1.2)) });
      rise($(court, '.safe'), lt, tRej + .4, .5, 30);
    },
  };
}, { mix: .2 });
// pre-register court-dots sound
/* ───────────────────────── 13. CAVEAT ───────────────────────── */
scene('caveat', 5, (R, T0) => {
  const lab = A(R, 'label center-x', '<i style="background:var(--amber);box-shadow:0 0 14px var(--amber)"></i>One honest caveat', 'top:240px;display:flex;justify-content:center');
  const b = A(R, 'body center-x', 'A verdict doesn’t reverse a payment that already settled —<br>unless it also ran through a separate escrow or refund mechanism.', 'top:300px;font-size:36px');
  const wb = splitWords(b);
  const l1 = A(R, 'h1 center-x', 'Internet Court stops the <span class="grad">next</span> mistake.', 'top:530px;font-size:104px');
  const l2 = A(R, 'h1 center-x', 'Not the last one.', 'top:660px;font-size:104px;color:#4d4f60');
  ev('tick', T0 + 1.9); ev('tick', T0 + 2.9);
  return {
    update(lt) {
      rise(lab, lt, .1); revealWords(wb, lt, .3, .028, .45, 24);
      rise(l1, lt, 1.85, .6, 50, 20); rise(l2, lt, 2.85, .6, 50, 20);
    },
  };
}, { mix: 0 });

/* ───────────────────────── 14. SLA ESCROW ───────────────────────── */
scene('sla', 7.5, (R, T0) => {
  const lab = A(R, 'label', '<i style="background:var(--amber);box-shadow:0 0 14px var(--amber)"></i>In progress · SLA escrow', 'left:120px;top:110px');
  const title = A(R, 'h2', 'An agent pays for <span class="grad-vi">AI inference.</span>', 'left:120px;top:152px;font-size:64px');
  const terms = A(R, 'panel', `<div class="mono" style="font:700 20px JBM;letter-spacing:.18em;color:#8d8fa2">SLA TERMS</div>
    <div style="margin-top:26px;font:600 34px Inter;display:flex;justify-content:space-between"><span>Successful responses</span><span class="mono" style="color:#fff">≥ 99.5%</span></div>
    <div style="margin-top:20px;font:600 34px Inter;display:flex;justify-content:space-between"><span>p95 latency</span><span class="mono" style="color:#fff">&lt; 800 ms</span></div>`, 'left:120px;top:280px;width:700px;height:240px;padding:34px 38px');
  const logs = A(R, 'panel', `<div class="mono" style="font:700 20px JBM;letter-spacing:.18em;color:#8d8fa2">SIGNED LOGS</div><div class="ls" style="position:absolute;left:38px;right:30px;top:80px;bottom:20px;overflow:hidden;font:400 21px/1.75 JBM;color:#9fa1b5"></div>`, 'left:120px;top:550px;width:700px;height:380px;padding:30px 38px');
  const ls = $(logs, '.ls'), lr = rng(77);
  const LOG = Array.from({ length: 80 }, (_, i) => { const ok = lr() > .03, ms = Math.floor(280 + lr() ** 2 * 700); return `req#${48213 + i}  <span style="color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? 200 : 503}</span>  ${String(ms).padStart(3, ' ')}ms  <span style="color:#6f7186">sig 0x${Math.floor(lr() * 0xffff).toString(16).padStart(4, '0')}…</span>`; });
  const vault = A(R, 'panel vi-edge', `<div class="lk" style="color:#d6d0ff;margin-top:20px">${ICON.lock}</div><div class="mono" style="margin-top:22px;font:700 20px JBM;letter-spacing:.22em;color:#b8adff">IN ESCROW</div><div style="font:800 52px Inter;margin-top:8px">$500.00</div>`, 'left:880px;top:280px;width:440px;height:450px;padding:30px;text-align:center');
  const _unused = (top, name, val, pct, thr) => A(R, '', `<div style="display:flex;justify-content:space-between;font:600 26px Inter"><span>${name}</span><span class="mono v" style="color:#fff">${val}</span></div>
     <div style="position:relative;margin-top:16px;height:16px;border-radius:9px;background:rgba(255,255,255,.08)"><div class="f" style="height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#8b7cff,#2be38b);box-shadow:0 0 18px #2be38b"></div><div style="position:absolute;left:${thr}%;top:-8px;width:3px;height:32px;background:#fff;opacity:.7"></div></div>
     <div class="ok mono green" style="margin-top:12px;font:700 20px JBM;letter-spacing:.14em">✓ PASS</div>`, `left:1380px;top:${top}px;width:420px`).dataset && null;
  const m1 = A(R, '', '', ''), m2 = A(R, '', '', '');
  [[m1, 300, 'Success rate', '99.71%', 'thr', 70], [m2, 500, 'p95 latency', '742 ms', 'thr', 92.75]].forEach(([m, top, n, v, , thr]) => {
    m.style.cssText = `position:absolute;left:1380px;top:${top}px;width:420px`;
    m.innerHTML = `<div class="label v" style="font-size:18px"><i></i>Jury checks</div><div style="display:flex;justify-content:space-between;font:600 28px Inter;margin-top:18px"><span>${n}</span><span class="mono v" style="color:#fff">${v}</span></div>
     <div style="position:relative;margin-top:16px;height:16px;border-radius:9px;background:rgba(255,255,255,.08)"><div class="f" style="height:100%;width:0;border-radius:9px;background:linear-gradient(90deg,#8b7cff,#2be38b);box-shadow:0 0 18px #2be38b"></div><div style="position:absolute;left:${thr}%;top:-8px;width:3px;height:32px;background:#fff;opacity:.8"></div></div>
     <div class="ok mono green" style="margin-top:14px;font:700 20px JBM;letter-spacing:.14em">✓ WITHIN SLA</div>`;
  });
  const o1 = A(R, 'chip', '<span class="check" style="width:40px;height:40px;font-size:22px">✓</span> SLA met → <b style="margin-left:6px">full payment</b>', 'left:880px;top:780px;font-size:30px;padding:18px 26px;border-color:rgba(43,227,139,.6);background:rgba(10,40,26,.85)');
  const o2 = A(R, 'chip', '<span style="color:var(--amber)">◐</span> SLA missed → proportional deduction', 'left:880px;top:870px;font-size:26px;padding:16px 26px;color:#8d8fa2');
  ev('scan', T0 + 2.6, { d: 1.4 }); ev('check', T0 + 3.6); ev('check', T0 + 4.2);
  ev('unlock', T0 + 4.75); impact(T0 + 4.8, .5); ev('success', T0 + 4.85);
  return {
    update(lt) {
      rise(lab, lt, .05); rise(title, lt, .12); rise(terms, lt, .4); rise(logs, lt, .7); rise(vault, lt, 1.0);
      const sc = Math.max(0, lt - .8) * 9.5, i0 = Math.floor(sc);
      ls.innerHTML = LOG.slice(i0, i0 + 9).join('<br>');
      ls.style.transform = `translateY(${-(sc - i0) * 36.75}px)`;
      [m1, m2].forEach((m, i) => {
        rise(m, lt, 2.3 + i * .25);
        const p = ease(lt, 2.6 + i * .4, 3.5 + i * .5, E.outCubic);
        $(m, '.f').style.width = (i === 0 ? 74 : 85) * p + '%';
        $(m, '.ok').style.opacity = lt > 3.6 + i * .6 ? 1 : 0;
      });
      const u = ease(lt, 4.75, 5.1, E.outBack);
      $(vault, '.shackle').style.transform = `translateY(${-u * 3}px)`;
      vault.style.borderColor = lt > 4.75 ? 'rgba(43,227,139,.7)' : '';
      vault.style.boxShadow = lt > 4.75 ? `0 0 ${80 * (1 - seg(lt, 4.75, 6.5)) + 20}px rgba(43,227,139,.35)` : '';
      pop(o1, lt, 4.85, .45, .5); rise(o2, lt, 5.2, .5, 20); o2.style.opacity = Math.min(+o2.style.opacity, .7);
    },
  };
}, { mix: .7 });

/* ───────────────────────── 15. NUMBERS ───────────────────────── */
scene('numbers', 6, (R, T0) => {
  const lab = A(R, 'label v center-x', "<i></i>The network today · per GenLayer's public dashboard", 'top:190px;display:flex;justify-content:center');
  const D = [[326000, '~', '', 'daily transactions'], [25800, '~', '', 'daily decisions'], [1000000, '', '+', 'cumulative trustless decisions']];
  const cols = D.map(([, pre, post, cap], i) => A(R, 'center-x', `<div class="num grad" style="font:900 112px/1.1 'Inter Display';letter-spacing:-.04em;font-variant-numeric:tabular-nums;white-space:nowrap"></div><div class="body" style="margin-top:20px;font-size:32px">${cap}</div>`, `left:${60 + i * 600}px;width:600px;top:330px;right:auto`));
  const foot = A(R, 'mono center-x', 'Whole network — not just the MetaMask integration.', 'top:610px;font:400 26px JBM;color:#8d8fa2');
  const svg = el('div', 'abs', `<svg width="1920" height="300"><defs><linearGradient id="spk" x1="0" x2="1"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#ff4fa3"/><stop offset="1" stop-color="#8b7cff"/></linearGradient><linearGradient id="spf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8b7cff" stop-opacity=".3"/><stop offset="1" stop-color="#8b7cff" stop-opacity="0"/></linearGradient></defs><path class="ar" fill="url(#spf)"/><path class="ln" fill="none" stroke="url(#spk)" stroke-width="5" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px #ff4fa3)"/></svg>`, R);
  svg.style.cssText = 'left:0;top:720px';
  const pr = rng(9), pts = Array.from({ length: 40 }, (_, i) => [120 + i * 43.6, 250 - (i / 39) ** 1.6 * 190 - pr() * 26]);
  const dPath = n => pts.slice(0, n).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  for (let k = 0; k < 28; k++) ev('tick', T0 + .45 + k * .065, { v: .5 });
  D.forEach((_, i) => ev('pop', T0 + 2.3 + i * .15));
  return {
    update(lt) {
      rise(lab, lt, .05);
      cols.forEach((c, i) => {
        rise(c, lt, .25 + i * .1, .5, 40);
        const p = ease(lt, .4 + i * .1, 2.3 + i * .15, E.outQuart);
        const [v, pre, post] = D[i];
        $(c, '.num').textContent = pre + Math.round(v * p).toLocaleString('en-US') + (p >= 1 ? post : '');
        const bump = Math.max(0, 1 - Math.abs(lt - 2.3 - i * .15) * 6);
        $(c, '.num').style.transform = `scale(${1 + bump * .08})`;
      });
      rise(foot, lt, 2.9, .5, 20);
      const n = Math.max(2, Math.floor(ease(lt, .3, 3.0, E.inOutCubic) * 40));
      $(svg, '.ln').setAttribute('d', dPath(n));
      $(svg, '.ar').setAttribute('d', dPath(n) + ` L${pts[n - 1][0]} 300 L120 300 Z`);
    },
  };
}, { mix: .6 });

/* ───────────────────────── 16. ROADMAP + ERC ───────────────────────── */
scene('roadmap', 8, (R, T0) => {
  const lab = A(R, 'label v', "<i></i>What's next", 'left:120px;top:96px');
  const lineBg = A(R, '', '', 'left:220px;top:298px;width:1480px;height:4px;background:rgba(255,255,255,.1);border-radius:2px');
  const line = A(R, '', '', 'left:220px;top:298px;width:1480px;height:4px;background:linear-gradient(90deg,#ff8a2a,#ff4fa3,#8b7cff);border-radius:2px;transform-origin:0 50%;box-shadow:0 0 20px #ff4fa3');
  const M = [[220, 'TODAY', 'Building in public'], [960, 'H2 2026', 'Clarke testnet phase'], [1700, 'Q4 2026', 'Mainnet target']];
  const ms = M.map(([x, k, v], i) => A(R, 'center-x', `<div style="width:30px;height:30px;margin:0 auto;border-radius:50%;background:${i === 2 ? '#8b7cff' : '#fff'};box-shadow:0 0 30px ${i === 2 ? '#8b7cff' : '#ff8a2a'};border:5px solid #0b0b12"></div><div class="mono" style="margin-top:24px;font:800 28px JBM;letter-spacing:.08em;color:${i ? '#fff' : '#8d8fa2'}">${k}</div><div class="body" style="font-size:26px;margin-top:6px">${v}</div>`, `left:${x - 200}px;width:400px;right:auto;top:284px`));
  const erc = A(R, '', `<div class="h3 grad" style="font-size:56px">Composable Adjudication ERC</div><div class="body" style="margin-top:16px;width:760px">Builders implement <b style="color:#fff">one interface</b> and pick their adjudicator.</div>
    <div class="panel code" style="position:relative;margin-top:30px;font-size:24px;width:760px;padding:24px 30px"><span class="k">interface</span> <span class="f">IAdjudicator</span> {
  <span class="k">function</span> <span class="f">adjudicate</span>(<span class="d">bytes</span> evidence)
    <span class="k">returns</span> (<span class="d">Verdict</span>);
}</div>`, 'left:120px;top:530px');
  const ddl = A(R, 'label', 'Adjudicator', 'left:1060px;top:560px');
  const opts = [['GenLayer', `<img src="${GL}" style="width:34px;filter:invert(1)">`], ['Kleros', '<span style="font-size:30px">⚖</span>'], ['UMA', '<span style="font-size:30px">◎</span>'], ['A group of agents', '<span style="font-size:30px">⬡</span>']];
  const sel = A(R, 'panel', `<div class="cv" style="display:flex;align-items:center;gap:16px;font:700 32px Inter"></div><span style="position:absolute;right:28px;top:26px;font:700 28px Inter;color:#8d8fa2">▾</span>`, 'left:1060px;top:600px;width:700px;height:86px;padding:20px 28px;border-radius:18px');
  const list = A(R, 'panel', opts.map(([n, ic], i) => `<div class="it" style="display:flex;align-items:center;gap:16px;height:76px;padding:0 24px;border-radius:12px;font:600 30px Inter">${ic}<span>${n}</span><span class="tick" style="margin-left:auto;color:var(--green);opacity:0">✓</span></div>`).join(''), 'left:1060px;top:700px;width:700px;padding:10px;border-radius:18px;transform-origin:50% 0');
  const its = $$(list, '.it');
  const tOpen = T0 + 3.0, tPick = T0 + 5.5;
  cur(T0 + 2.3, 1860, 1050, { show: true }); cur(tOpen, 1500, 645, { click: true });
  [3, 2, 1, 0].forEach((k, i) => cur(T0 + 3.55 + i * .42, 1400 + i * 18, 710 + 10 + k * 76 + 38, { hover: true, md: .35 }));
  cur(tPick, 1420, 758, { click: true, md: .3 }); cur(T0 + 6.2, 1700, 1000, { hide: true });
  impact(tPick + .03, .45);
  ev('pop', T0 + .5); ev('pop', T0 + 1.0); ev('pop', T0 + 1.45);
  return {
    update(lt) {
      const t = T0 + lt, c = cursorAt(t);
      rise(lab, lt, .05);
      set(lineBg, { o: ease(lt, .1, .4) });
      line.style.transform = `scaleX(${ease(lt, .2, 1.5, E.inOutCubic)})`;
      ms.forEach((m, i) => pop(m, lt, .45 + i * .5, .45, .3));
      rise(erc, lt, 1.6, .6); rise(ddl, lt, 2.0); rise(sel, lt, 2.1);
      const open = t > tOpen && t < tPick + .1;
      const op = open ? ease(t, tOpen, tOpen + .3, E.outCubic) : t >= tPick + .1 ? 1 - ease(t, tPick + .1, tPick + .3) : 0;
      set(list, { o: op, sy: lerp(.6, 1, op), sx: 1 });
      its.forEach((it, i) => {
        const hov = inside(c, 1070, 710 + i * 76, 680, 76);
        it.style.background = hov ? 'rgba(139,124,255,.22)' : 'transparent';
        $(it, '.tick').style.opacity = i === 0 && t > tPick ? 1 : 0;
      });
      const picked = t > tPick;
      $(sel, '.cv').innerHTML = picked ? `${opts[0][1]}<span>GenLayer</span><span class="green" style="margin-left:8px">✓</span>` : '<span style="color:#6f7186">Choose an adjudicator…</span>';
      sel.style.borderColor = picked ? 'rgba(139,124,255,.8)' : '';
      sel.style.boxShadow = picked ? '0 0 60px rgba(139,124,255,.35)' : '';
    },
  };
}, { mix: .8 });

/* ───────────────────────── 17. BEYOND PAYMENTS ───────────────────────── */
scene('beyond', 5.5, (R, T0) => {
  const lab = A(R, 'label center-x', '<i></i>Beyond payments', 'top:150px;display:flex;justify-content:center');
  const C = [[ICON.chart, 'Prediction-market', 'resolution', '#ff8a2a'], [ICON.doc, 'Performance-based', 'contracts', '#ff4fa3'], [ICON.shield, 'Insurance', 'claims', '#8b7cff']];
  const persp = A(R, '', '', 'left:0;top:0;width:1920px;height:1080px;perspective:1400px');
  const cards = C.map(([ic, a, b, col], i) => A(persp, 'panel', `<div style="color:${col};filter:drop-shadow(0 0 14px ${col})">${ic}</div><div class="h3" style="margin-top:34px;font-size:44px">${a}<br><span style="color:${col}">${b}</span></div>`, `left:${180 + i * 540}px;top:230px;width:480px;height:340px;padding:44px;border-color:${col}55`));
  const f1 = A(R, 'body center-x', 'Still early — no public transaction hashes are out yet.', 'top:660px;font-size:36px');
  const f2 = A(R, 'h2 center-x', 'But the direction is <span class="grad">clear.</span>', 'top:730px;font-size:76px');
  C.forEach((_, i) => ev('whoosh', T0 + .3 + i * .22, { v: .45 }));
  ev('tick', T0 + 2.8);
  return {
    update(lt) {
      rise(lab, lt, .05);
      cards.forEach((c, i) => { const p = ease(lt, .3 + i * .22, 1.0 + i * .22, E.outCubic); set(c, { o: p, ry: (1 - p) * -80, y: (1 - p) * 60 }); });
      rise(f1, lt, 2.1); rise(f2, lt, 2.8, .6, 40, 16);
    },
  };
}, { mix: .5 });

/* ───────────────────────── 18. FINALE ───────────────────────── */
scene('finale', 8.5, (R, T0) => {
  const l1 = A(R, 'center-x', '', 'top:650px;font:800 80px/1 Inter;letter-spacing:-.03em;color:#e8e8f2');
  const l2 = A(R, 'h1 center-x', '', 'top:760px;font-size:124px');
  l2.innerHTML = [...'GenLayer enforces intent.'].map(ch => `<span class="w grad">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  const ls = $$(l2, '.w');
  const end = A(R, 'center-x', `<span class="chip"><img src="${MM}" style="width:30px;border-radius:7px"> @MetaMask&nbsp;×&nbsp;<img src="${GL}" style="width:26px;filter:invert(1)"> @GenLayer · Internet Court</span>&nbsp;&nbsp;<span class="chip" style="border-color:rgba(255,107,26,.5)">Read the thread 🧵</span>`, 'top:950px');
  const ty = typer(l1, 'Code enforces limits.', T0 + 1.45, 15, { seed: 90, caretEnd: T0 + 3.35 });
  impact(T0 + 1.0, 1.1);
  impact(T0 + 3.5, 1.5);
  ev('riser', T0 + 2.0, { d: 1.5 });
  ev('end', T0 + 3.5);
  return {
    update(lt) {
      ty.update(T0 + lt);
      ls.forEach((s, i) => { const p = seg(lt, 3.42 + i * .012, 3.42 + i * .012 + .3); set(s, { o: clamp(p * 2), s: lerp(2.4, 1, E.outExpo(p)), b: (1 - p) * 14, y: (1 - E.outExpo(p)) * -30 }); });
      rise(end, lt, 4.6, .6, 30);
      l1.style.opacity = 1 - seg(lt, 7.6, 8.3);
    },
    logos(lt) {
      const f = flyIn(lt, .1, 1.0, { x: -500, y: 200 }, { x: 600, y: 360, size: 430 }, 1);
      const g = flyIn(lt, .1, 1.0, { x: 2420, y: 200 }, { x: 1320, y: 360, size: 430 }, -1);
      const idle = Math.max(0, lt - 1.0), hit = lt > 3.5 ? Math.exp(-(lt - 3.5) * 5) : 0;
      f.ry += Math.sin(idle * .9) * .5 + hit * 1.2; g.ry += Math.sin(idle * .9 + 1.4) * .5 - hit * 1.2;
      f.y += Math.sin(idle * 1.2) * 10; g.y += Math.cos(idle * 1.2) * 10;
      f.size *= 1 + hit * .15; g.size *= 1 + hit * .15; f.glow = g.glow = .5 + hit;
      return { fox: f, gen: g };
    },
    world(lt) { return { pulse: lt > 3.5 ? Math.exp(-(lt - 3.5) * 1.5) : 0, fade: seg(lt, 7.6, 8.5) }; },
  };
}, { mix: .5 });

export const DURATION = SCENES.reduce((a, s) => a + s.dur, 0);
