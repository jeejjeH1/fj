// Optional Sorsa Score badge on profile pages. Off until the user turns it on and adds their own Sorsa API key
// (pages/sorsa.html). It reads the handle of the profile that is open and asks the background (official API) for
// the score; the key never reaches X. Hovering the badge opens a card with the 7 / 30-day change (fetched once).
(() => {
  const { XAL } = window;
  const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'tos', 'privacy', 'login', 'signup',
    'logout', 'jobs', 'communities', 'lists', 'bookmarks', 'premium', 'following', 'followers', 'account', 'intent', 'share', 'hashtag']);
  const pending = new Map();
  let cfg = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const st = document.createElement('style');
  st.textContent = `
    .xal-sorsa { position: relative; display: inline-flex; align-items: center; gap: 8px; margin: 6px 0 8px; padding: 4px 13px 4px 6px; border-radius: 99px; cursor: pointer;
      color: #fff; font: 800 13px XalVaz, sans-serif; direction: ltr; user-select: none; border: 1px solid rgba(162,75,255,.55);
      background: linear-gradient(135deg, rgba(255,46,126,.2), rgba(162,75,255,.22) 55%, rgba(42,212,255,.18)); box-shadow: 0 0 18px rgba(162,75,255,.2);
      transition: transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .3s; animation: xal-sorsa-in .5s cubic-bezier(.22,1,.36,1) both; }
    .xal-sorsa:hover, .xal-sorsa.open { transform: translateY(-1px) scale(1.04); box-shadow: 0 6px 26px rgba(162,75,255,.4); }
    .xal-sorsa .ring { width: 24px; height: 24px; border-radius: 50%; flex: none; background: conic-gradient(#ff2e7e, #a24bff, #2ad4ff, #ff2e7e);
      -webkit-mask: radial-gradient(farthest-side, transparent 55%, #000 58%); mask: radial-gradient(farthest-side, transparent 55%, #000 58%); }
    .xal-sorsa[data-state="loading"] .ring { animation: xal-spin 1s linear infinite; }
    .xal-sorsa[data-state="loading"] .num { width: 52px; height: 12px; border-radius: 6px; color: transparent;
      background: linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.28), rgba(255,255,255,.08)); background-size: 200% 100%; animation: xal-shine 1.2s linear infinite; }
    .xal-sorsa[data-state="err"] { border-color: rgba(255,173,31,.55); background: rgba(255,173,31,.1); box-shadow: none; color: #ffd28a; }
    .xal-sorsa[data-state="err"] .ring, .xal-sorsa[data-state="none"] .ring { background: rgba(255,255,255,.25); }
    .xal-sorsa .lbl { font-weight: 600; opacity: .7; font-size: 11.5px; }
    .xal-pop { position: absolute; top: calc(100% + 10px); left: 0; z-index: 50; width: 250px; padding: 14px 16px; border-radius: 18px; cursor: default;
      background: rgba(15,13,24,.97); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 20px 60px rgba(0,0,0,.65); color: #cfc9ea; font: 600 12.5px XalVaz, sans-serif;
      opacity: 0; transform: translateY(-6px) scale(.97); transform-origin: top left; pointer-events: none; transition: opacity .25s, transform .35s cubic-bezier(.34,1.56,.64,1); }
    .xal-sorsa.open .xal-pop { opacity: 1; transform: none; pointer-events: auto; }
    .xal-pop .big { font: 900 30px/1.1 XalVaz, sans-serif; background: linear-gradient(120deg, #ff2e7e, #a24bff 55%, #2ad4ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .xal-pop .cap { opacity: .65; font-size: 11.5px; margin-bottom: 10px; }
    .xal-pop .rw { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-top: 1px solid rgba(255,255,255,.08); direction: rtl; }
    .xal-pop .rw b { direction: ltr; font-weight: 800; }
    .xal-pop .up { color: #2fe39a; } .xal-pop .dn { color: #ff6b7a; } .xal-pop .fl { color: #9a94b8; }
    .xal-pop .ft { margin-top: 8px; font-size: 11px; opacity: .5; direction: rtl; }
    @keyframes xal-spin { to { transform: rotate(360deg); } }
    @keyframes xal-shine { to { background-position: -200% 0; } }
    @keyframes xal-sorsa-in { from { opacity: 0; transform: translateY(6px) scale(.9); } }
    @media (prefers-reduced-motion: reduce) { .xal-sorsa, .xal-sorsa * { animation: none !important; transition: none !important; } }`;
  (document.head || document.documentElement).appendChild(st);

  function profileHandle() {
    const m = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(?:with_replies|highlights|media|articles|superfollows))?\/?$/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  }
  const fmt = (n) => Number(n).toLocaleString('en', { maximumFractionDigits: 1 });
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);

  function skeleton(badge) {
    badge.innerHTML = '<i class="ring"></i><span class="num">0000</span>';
    badge.dataset.state = 'loading';
  }

  function countUp(el, to) {
    el.textContent = fmt(to);   // final value first: a hidden tab never runs animation frames
    if (reduced || !isFinite(to) || document.visibilityState !== 'visible') return;
    const t0 = performance.now(), D = 800;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function popHtml(res) {
    return `<div class="big">${fmt(res.score)}</div><div class="cap">Sorsa Score</div>
      <div class="rw" data-r="d7"><span>${fa(7)} روز اخیر</span><b class="fl">…</b></div>
      <div class="rw" data-r="d30"><span>${fa(30)} روز اخیر</span><b class="fl">…</b></div>
      <div class="ft">قدرت‌گرفته از Sorsa</div>`;
  }

  function paintChange(row, n) {
    const b = row.querySelector('b');
    if (n === null || n === undefined) { b.className = 'fl'; b.textContent = '—'; return; }
    b.className = n > 0 ? 'up' : n < 0 ? 'dn' : 'fl';
    b.textContent = `${n > 0 ? '▲ +' : n < 0 ? '▼ ' : ''}${fmt(n)}`;
  }

  function paint(badge, res, h) {
    if (res?.ok && res.score !== null && res.score !== undefined) {
      badge.dataset.state = 'ok';
      badge.innerHTML = `<i class="ring"></i><span class="num"></span><span class="lbl">Sorsa</span><div class="xal-pop">${popHtml(res)}</div>`;
      countUp(badge.querySelector('.num'), Number(res.score));
      let loaded = false, closeT;
      const open = async () => {
        clearTimeout(closeT); badge.classList.add('open');
        if (loaded) return; loaded = true;
        const ch = await XAL.bg({ type: 'sorsaChanges', handle: h }).catch((e) => ({ ok: false, error: e.message }));
        badge.querySelectorAll('.rw').forEach((row) => paintChange(row, ch?.ok ? ch[row.dataset.r] : null));
      };
      badge.addEventListener('mouseenter', open);
      badge.addEventListener('mouseleave', () => { closeT = setTimeout(() => badge.classList.remove('open'), 180); });
      badge.addEventListener('click', (e) => { if (e.target.closest('.xal-pop')) return; badge.classList.contains('open') ? badge.classList.remove('open') : open(); });
    } else if (res?.ok) {
      badge.dataset.state = 'none';
      badge.innerHTML = '<i class="ring"></i><span class="num">Sorsa —</span>';
      badge.title = 'امتیازی برای این حساب پیدا نشد';
    } else {
      badge.dataset.state = 'err';
      badge.innerHTML = '<i class="ring"></i><span class="num">Sorsa ⚠</span>';
      badge.title = res?.error || 'خطا';
    }
  }

  async function run() {
    const h = profileHandle();
    const key = h?.toLowerCase();
    document.querySelectorAll('.xal-sorsa').forEach((el) => { if (el.dataset.h !== key) el.remove(); });
    if (!h) return;
    if (!cfg) cfg = (await chrome.storage.local.get('sorsa')).sorsa || {};
    if (!cfg.enabled || !cfg.key) return;
    const name = document.querySelector('[data-testid="UserName"]');
    // X keeps the previous profile's DOM for a moment after navigating; only act when this header is the open profile
    if (!name || !name.textContent.toLowerCase().includes(`@${key}`)) return;
    if (document.querySelector(`.xal-sorsa[data-h="${key}"]`) && !pending.has(key) && document.querySelector(`.xal-sorsa[data-h="${key}"]`).dataset.state !== 'loading') return;
    let badge = document.querySelector(`.xal-sorsa[data-h="${key}"]`);
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'xal-sorsa';
      badge.dataset.h = key;
      skeleton(badge);
      name.insertAdjacentElement('afterend', badge);
    }
    if (!pending.has(key)) {
      const p = XAL.bg({ type: 'sorsaScore', handle: h }).catch((e) => ({ ok: false, error: e.message })).finally(() => pending.delete(key));
      pending.set(key, p);
      const res = await p;
      document.querySelectorAll(`.xal-sorsa[data-h="${key}"]`).forEach((el) => paint(el, res, h));
    }
  }

  let timer;
  XAL.onScan(() => { clearTimeout(timer); timer = setTimeout(run, 700); });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local' || !c.sorsa) return;
    cfg = null;
    document.querySelectorAll('.xal-sorsa').forEach((el) => el.remove());
    run();
  });
})();
