// Starts a list sync when the extension opens your Following / Followers page with #xal-sync.
// Shows a small progress panel, saves what was read, then brings the extension's page to the front.
(() => {
  const { XAL } = window;
  const m = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/(following|followers)\/?$/);
  if (!m || location.hash !== '#xal-sync') return;
  const type = m[2];
  const handle = m[1];

  const REASONS = {
    end: ['تمام شد ✓', ''],
    stopped: ['متوقف شد', 'آنچه تا اینجا خوانده شد ذخیره شده است.'],
    rate_limit: ['X محدودیت گذاشت', 'آنچه خوانده شد ذخیره شد. چند ساعت دیگر دوباره ادامه دهید.'],
    rate_limit_soon: ['نزدیک به محدودیت X', 'برای امنیت حساب همین‌جا ایستادیم و آنچه خوانده شد ذخیره شد.'],
    auth: ['دسترسی رد شد', 'مطمئن شوید وارد X هستید و صفحه را رفرش کنید.'],
    network: ['خطای شبکه', 'اینترنت را بررسی کنید.'],
    error: ['خطا از سمت X', 'آنچه خوانده شد ذخیره شد.'],
    no_request: ['درخواست لیست پیدا نشد', 'صفحه را رفرش کنید و دوباره از اکستنشن بزنید.'],
  };

  const label = type === 'following' ? 'دنبال‌شوندگان' : 'دنبال‌کنندگان';
  const { body, close } = XAL.modal({ title: `🔄 همگام‌سازی ${label}`, onClose: () => window.postMessage({ __xal: 'syncStop' }, location.origin) });
  body.innerHTML = `
    <p class="muted" style="margin-bottom:10px">فهرست از خود X خوانده می‌شود، چند حساب در هر مرحله و با مکث بین مراحل. چیزی تغییر نمی‌کند (فقط خواندن).</p>
    <div style="text-align:center;margin:14px 0 6px"><div style="font-size:42px;font-weight:900" id="c">۰</div><div class="muted">حساب خوانده شد</div></div>
    <div class="bar"><i id="b" style="width:10%"></i></div>
    <div class="row" style="margin-top:14px;justify-content:center"><button class="btn danger" id="stop">توقف</button></div>
    <div id="msg" class="muted" style="margin-top:12px;text-align:center"></div>`;
  let pulse = 10;
  const t = setInterval(() => { pulse = (pulse + 6) % 100; const b = body.querySelector('#b'); if (b) b.style.width = `${pulse}%`; }, 400);
  body.querySelector('#stop').addEventListener('click', () => window.postMessage({ __xal: 'syncStop' }, location.origin));

  window.addEventListener('message', async function onMsg(e) {
    if (e.source !== window || e.data?.__xal !== 'sync' || e.data.type !== type) return;
    const d = e.data;
    if (d.state === 'progress') { const c = body.querySelector('#c'); if (c) c.textContent = XAL.fa(d.count); return; }
    if (d.state !== 'done') return;
    window.removeEventListener('message', onMsg);
    clearInterval(t);

    const [title, detail] = REASONS[d.reason] || REASONS.error;
    if (d.users.length) {
      const { followData = {} } = await chrome.storage.local.get('followData');
      const old = followData[type];
      followData[type] = {
        at: Date.now(), handle, partial: d.reason !== 'end', users: d.users,
        // for "who unfollowed me": who was in the list the last time
        prev: type === 'followers' && old?.users ? old.users.map((u) => u.handle) : old?.prev || [],
        prevAt: type === 'followers' && old?.at ? old.at : old?.prevAt || 0,
      };
      await chrome.storage.local.set({ followData, me: handle });
    }
    body.innerHTML = `<div style="text-align:center;padding:10px 0">
      <div style="font-size:34px;font-weight:900">${XAL.fa(d.users.length)}</div>
      <div style="font-weight:700;margin:4px 0">${title}</div><div class="muted">${detail}</div>
      <div class="row" style="margin-top:16px;justify-content:center">${d.users.length ? '<button class="btn" id="open">نمایش نتایج</button>' : ''}<button class="btn ghost" id="x">بستن</button></div></div>`;
    body.querySelector('#x').addEventListener('click', close);
    const openIt = () => { XAL.openPage(`pages/following.html?tab=${type}`); close(); };
    body.querySelector('#open')?.addEventListener('click', openIt);
    if (d.users.length && d.reason === 'end') setTimeout(openIt, 800);
  });

  history.replaceState(null, '', location.pathname); // drop the #xal-sync marker so a refresh does not sync again
  window.postMessage({ __xal: 'syncStart', type }, location.origin);
})();
