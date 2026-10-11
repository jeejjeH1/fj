// Optional Sorsa Score badge on profile pages. Off until the user turns it on and adds their own Sorsa API key
// (pages/sorsa.html). It reads the handle of the profile that is open and asks the background (official API) for
// the score; the key never reaches X.
(() => {
  const { XAL } = window;
  const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'tos', 'privacy', 'login', 'signup',
    'logout', 'jobs', 'communities', 'lists', 'bookmarks', 'premium', 'following', 'followers', 'account', 'intent', 'share', 'hashtag']);
  const pending = new Map();
  let cfg = null;

  function profileHandle() {
    const m = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(?:with_replies|highlights|media|articles|superfollows))?\/?$/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  }

  function paint(badge, res) {
    if (res?.ok && res.score !== null && res.score !== undefined) {
      badge.dataset.state = 'ok';
      badge.textContent = `Sorsa ${Number(res.score).toLocaleString('en', { maximumFractionDigits: 1 })}`;
      badge.title = 'Sorsa Score';
    } else if (res?.ok) {
      badge.dataset.state = 'none';
      badge.textContent = 'Sorsa —';
      badge.title = 'امتیازی برای این حساب پیدا نشد';
    } else {
      badge.dataset.state = 'err';
      badge.textContent = 'Sorsa ⚠';
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
    let badge = document.querySelector(`.xal-sorsa[data-h="${key}"]`);
    if (badge && badge.dataset.state && badge.dataset.state !== 'loading') return;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'xal-sorsa';
      badge.dataset.h = key;
      badge.dataset.state = 'loading';
      badge.textContent = 'Sorsa …';
      name.insertAdjacentElement('afterend', badge);
    }
    if (!pending.has(key)) {
      const p = XAL.bg({ type: 'sorsaScore', handle: h }).catch((e) => ({ ok: false, error: e.message })).finally(() => pending.delete(key));
      pending.set(key, p);
      const res = await p;
      document.querySelectorAll(`.xal-sorsa[data-h="${key}"]`).forEach((el) => paint(el, res));
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
