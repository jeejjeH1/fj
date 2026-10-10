import { initWorld } from './world.js';
import { EVENTS, CURSOR, cursorAt, fxAt, set, seg, lerp, E, rng, clamp } from './lib.js';
import { SCENES, DURATION } from './scenes.js';

const $ = id => document.getElementById(id);
const logos = await fetch('./logos.json').then(r => r.json());
await document.fonts.ready;
await Promise.all([...document.images].map(i => i.complete || new Promise(r => (i.onload = i.onerror = r))));
const world = await initWorld($('gl'), logos);

CURSOR.sort((a, b) => a.t - b.t);

window.DURATION = DURATION;
window.getEvents = () => ({ duration: DURATION, scenes: SCENES.map(s => ({ name: s.name, t0: s.T0, dur: s.dur })), events: [...EVENTS].sort((a, b) => a.t - b.t) });

window.renderFrame = (t) => {
  let worldSt = { mix: 0 }, active = null;
  for (const s of SCENES) {
    const lt = t - s.T0;
    if (lt < 0 || lt >= s.dur) { s.root.style.display = 'none'; continue; }
    s.root.style.display = 'block';
    active = s;
    if (s.env) {
      const pin = E.outCubic(seg(lt, 0, .35)), pout = E.inCubic(seg(lt, s.dur - .32, s.dur));
      set(s.root, { o: pin * (1 - pout), s: lerp(1.05, 1, pin) * lerp(1, .95, pout), b: (1 - pin) * 10 + pout * 12 });
    }
    s.update(lt);
  }
  // world state: blend background mix between scenes
  if (active) {
    const i = SCENES.indexOf(active), prev = SCENES[i - 1];
    const lt = t - active.T0, k = E.inOutCubic(seg(lt, 0, 1.2));
    const mix = prev ? lerp(prev.mix, active.mix, k) : active.mix;
    worldSt = { mix, ...(active.logos ? active.logos(lt) : {}), ...(active.world ? active.world(lt) : {}) };
  }
  const fx = fxAt(t);
    world.render(t, worldSt);

  // global FX
  $('stage').style.transform = `translate(${fx.sx}px,${fx.sy}px)`;
  $('gl').style.transform = `translate(${fx.sx * .6}px,${fx.sy * .6}px) scale(1.01)`;
    $('fx-flash').style.opacity = fx.fl * .5; $('fx-flash').style.background = '#fdecf2';
  $('fx-fade').style.opacity = clamp((worldSt.fade || 0) + (1 - seg(t, 0, .25)));

  // cursor
  const c = cursorAt(t);
  const cu = $('cursor'), rp = $('ripple');
  if (c && c.vis > 0) {
    cu.style.display = 'block';
    cu.style.opacity = c.vis;
    cu.style.transform = `translate(${c.x - 6 + fx.sx}px,${c.y - 4 + fx.sy}px) scale(${1.15 - c.press * .2})`;
  } else cu.style.display = 'none';
  if (c && c.ripple) {
    rp.style.display = 'block';
    rp.style.left = c.ripple.x + 'px'; rp.style.top = c.ripple.y + 'px';
    rp.style.opacity = (1 - c.ripple.p) * .9;
    rp.style.transform = `scale(${.2 + E.outCubic(c.ripple.p) * .9})`;
  } else rp.style.display = 'none';
};

window.renderFrame(0);
window.ready = true;
