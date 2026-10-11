// Follow-back checker: on your own "Following" page, scans the list, finds who doesn't follow you
// back, filters them and hands a list to the unfollow queue (manual or capped auto).
(() => {
  const { XAL } = window;

  // The page's own address names whose following list this is, so the username is only a cross-check.
  const pathHandle = () => location.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/following\/?$/)?.[1] || null;
  const onFollowing = () => {
    const h = pathHandle();
    const me = XAL.me();
    return !!h && (!me || me.toLowerCase() === h.toLowerCase());
  };

  function readCell(cell) {
    const links = [...cell.querySelectorAll('a[href^="/"]')];
    const handle = links[0]?.getAttribute('href')?.slice(1).split('/')[0];
    if (!handle) return null;
    const nameLink = links.find((a) => a.textContent.trim() && !a.textContent.trim().startsWith('@'));
    const name = nameLink ? XAL.richText(nameLink) : handle;
    const img = cell.querySelector('img[src*="pbs.twimg.com"], img[src*="abs.twimg.com"]');
    const bioEl = [...cell.querySelectorAll('div[dir="auto"]')].reverse().find((d) => !d.closest('a') && !d.closest('button') && !d.closest('[data-testid="userFollowIndicator"]'));
    const bio = bioEl ? XAL.richText(bioEl) : '';
    return {
      handle,
      name,
      bio: bio === name ? '' : bio,
      avatar: img?.src || '',
      followsYou: !!cell.querySelector('[data-testid="userFollowIndicator"]'),
      verified: !!cell.querySelector('[data-testid="icon-verified"], svg[aria-label*="erified"]'),
      locked: !!cell.querySelector('[data-testid="icon-lock"], svg[aria-label*="rotected"]'),
      noAvatar: !img || /default_profile/.test(img.src),
    };
  }

  async function scan(onProgress, job) {
    const users = new Map();
    let idle = 0;
    scrollTo(0, 0);
    await XAL.sleep(800);
    while (!job.stop && idle < 6 && users.size < 8000) {
      let added = 0;
      document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="UserCell"]').forEach((cell) => {
        const u = readCell(cell);
        if (u && !users.has(u.handle.toLowerCase())) { users.set(u.handle.toLowerCase(), u); added++; }
      });
      idle = added ? 0 : idle + 1;
      onProgress(users.size);
      scrollBy(0, innerHeight * 0.9);
      await XAL.sleep(idle ? 1400 : 900);
    }
    return [...users.values()];
  }

  XAL.fab('follow', '🔍 فالوبک‌نده‌ها', onFollowing, async () => {
    const { followScan } = await chrome.storage.local.get('followScan');
    const me = XAL.me() || pathHandle();
    const m = XAL.modal({ title: '🔍 کسانی که فالوبک نداده‌اند', wide: true, onClose: () => { job.stop = true; } });
    const job = { stop: false };
    if (followScan?.handle?.toLowerCase() === me.toLowerCase() && followScan.users?.length) showResults(m, followScan, startScan);
    else startScan();

    function startScan() {
      job.stop = false;
      m.body.innerHTML = `
        <p class="muted">لیست Following شما از بالا تا پایین خوانده می‌شود. برای چند صد نفر حدود یک دقیقه طول می‌کشد. فقط خواندن است؛ هیچ کلیکی انجام نمی‌شود.</p>
        <div style="text-align:center;margin:26px 0 10px"><div style="font-size:44px;font-weight:900" id="c">۰</div><div class="muted">نفر خوانده شد</div></div>
        <div class="bar"><i id="b" style="width:8%"></i></div>
        <div class="row" style="margin-top:16px;justify-content:center"><button class="btn ghost" id="stop">کافیه، نتایج را نشان بده</button></div>`;
      let pulse = 8;
      const t = setInterval(() => { pulse = (pulse + 7) % 100; const b = m.body.querySelector('#b'); if (b) b.style.width = `${pulse}%`; }, 400);
      m.body.querySelector('#stop').addEventListener('click', () => { job.stop = true; job.partial = true; });
      scan((n) => { const c = m.body.querySelector('#c'); if (c) c.textContent = XAL.fa(n); }, job).then(async (users) => {
        clearInterval(t);
        if (job.stop && !job.partial) return;
        const data = { handle: me, at: Date.now(), users };
        await chrome.storage.local.set({ followScan: data });
        job.stop = false;
        showResults(m, data, startScan);
      });
    }
  });

  async function showResults(m, data, rescan) {
    const { followWhitelist = [] } = await chrome.storage.local.get('followWhitelist');
    const white = new Set(followWhitelist);
    const users = data.users;
    const f = { rel: 'no', verified: false, notVerified: false, noAvatar: false, noBio: false, locked: false, hideWhite: true, q: '' };
    const selected = new Set();
    let limit = 200;

    const notBack = users.filter((u) => !u.followsYou).length;
    m.body.innerHTML = `
      <div class="row" style="gap:10px;margin-bottom:14px">
        ${[['همه‌ی فالوئینگ', users.length, '#f4f2ff'], ['فالوبک داده', users.length - notBack, '#2fe39a'], ['فالوبک نداده', notBack, '#ff2e7e']].map(([l, n, c]) => `
        <div style="flex:1;min-width:140px;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)">
          <div style="font-size:26px;font-weight:900;color:${c}">${XAL.fa(n)}</div><div class="muted" style="font-size:12px">${l}</div></div>`).join('')}
      </div>
      <div class="row" style="margin-bottom:8px">
        <span class="chip" data-rel="no">فالوبک نداده</span><span class="chip" data-rel="yes">فالوبک داده</span><span class="chip" data-rel="all">همه</span>
        <span style="width:1px;height:20px;background:rgba(255,255,255,.12);margin:0 4px"></span>
        <span class="chip" data-f="verified">☑ فقط تیک آبی</span><span class="chip" data-f="notVerified">بدون تیک</span>
        <span class="chip" data-f="noAvatar">👤 بدون عکس</span><span class="chip" data-f="noBio">بدون بیو</span><span class="chip" data-f="locked">🔒 قفل</span>
        <span class="chip" data-f="hideWhite">⭐ پنهان کردن لیست سفید</span>
      </div>
      <div class="row" style="margin-bottom:10px">
        <input type="text" id="q" placeholder="جستجو در نام، یوزرنیم یا بیو…" style="flex:1;min-width:200px">
        <span class="muted" id="cnt"></span>
      </div>
      <div class="list scroll" style="max-height:min(46vh,420px);overflow:auto;border-radius:16px;background:rgba(0,0,0,.25);padding:6px"></div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost sm" id="all">انتخاب همه</button><button class="btn ghost sm" id="none">هیچ‌کدام</button>
        <button class="btn ghost sm" id="copy">کپی یوزرنیم‌ها</button><button class="btn ghost sm" id="csv">خروجی CSV</button>
        <button class="btn ghost sm" id="rescan">اسکن دوباره</button>
        <span class="muted" style="font-size:11px;margin-right:auto">اسکن: ${new Date(data.at).toLocaleString('fa-IR')}</span>
      </div>
      <div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)">
        <b id="sel">۰ انتخاب‌شده</b>
        <button class="btn" id="manual" style="margin-right:auto">آنفالو دستی (یکی‌یکی)</button>
        <button class="btn ghost" id="auto">آنفالو خودکار…</button>
      </div>`;
    const q = (s) => m.body.querySelector(s);
    const list = q('.list');

    const filtered = () => users.filter((u) => {
      if (f.rel === 'no' && u.followsYou) return false;
      if (f.rel === 'yes' && !u.followsYou) return false;
      if (f.verified && !u.verified) return false;
      if (f.notVerified && u.verified) return false;
      if (f.noAvatar && !u.noAvatar) return false;
      if (f.noBio && u.bio) return false;
      if (f.locked && !u.locked) return false;
      if (f.hideWhite && white.has(u.handle.toLowerCase())) return false;
      if (f.q && !`${u.name} ${u.handle} ${u.bio}`.toLowerCase().includes(f.q)) return false;
      return true;
    });

    function draw() {
      m.body.querySelectorAll('[data-rel]').forEach((c) => c.classList.toggle('on', c.dataset.rel === f.rel));
      m.body.querySelectorAll('[data-f]').forEach((c) => c.classList.toggle('on', f[c.dataset.f]));
      const rows = filtered();
      q('#cnt').textContent = `${XAL.fa(rows.length)} نفر`;
      q('#sel').textContent = `${XAL.fa(selected.size)} انتخاب‌شده`;
      list.innerHTML = rows.length ? '' : '<div class="muted" style="padding:30px;text-align:center">کسی با این فیلترها نیست 🎉</div>';
      rows.slice(0, limit).forEach((u) => {
        const key = u.handle.toLowerCase();
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;cursor:pointer;';
        row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,.05)'; };
        row.onmouseleave = () => { row.style.background = ''; };
        row.innerHTML = `
          <input type="checkbox" ${selected.has(key) ? 'checked' : ''} style="width:17px;height:17px;accent-color:#ff2e7e">
          <img src="${XAL.esc(u.avatar)}" style="width:40px;height:40px;border-radius:50%;background:#222;object-fit:cover;flex:none" alt="">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;unicode-bidi:plaintext;text-align:right">${XAL.esc(u.name)} ${u.verified ? '<span style="color:#1d9bf0">☑</span>' : ''} ${u.locked ? '🔒' : ''}
              <span class="muted" style="font-weight:400;direction:ltr;unicode-bidi:isolate">@${XAL.esc(u.handle)}</span></div>
            <div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;unicode-bidi:plaintext;text-align:right">${XAL.esc(u.bio) || '—'}</div>
          </div>
          ${u.followsYou ? '<span style="font-size:11px;color:#2fe39a;background:rgba(47,227,154,.1);padding:2px 8px;border-radius:99px">فالوبک داده</span>' : ''}
          <button title="لیست سفید: هیچ‌وقت آنفالو نشود" style="border:0;background:none;cursor:pointer;font-size:17px;opacity:${white.has(key) ? 1 : 0.3}">⭐</button>
          <a href="/${XAL.esc(u.handle)}" target="_blank" title="باز کردن پروفایل" style="color:#9a94b8;text-decoration:none;font-size:15px">↗</a>`;
        row.querySelector('input').addEventListener('change', (e) => { e.target.checked ? selected.add(key) : selected.delete(key); q('#sel').textContent = `${XAL.fa(selected.size)} انتخاب‌شده`; });
        row.querySelector('button').addEventListener('click', async (e) => {
          e.preventDefault();
          white.has(key) ? white.delete(key) : (white.add(key), selected.delete(key));
          await chrome.storage.local.set({ followWhitelist: [...white] });
          draw();
        });
        list.appendChild(row);
      });
      if (rows.length > limit) {
        const more = document.createElement('button');
        more.className = 'btn ghost sm'; more.style.cssText = 'width:100%;margin-top:6px';
        more.textContent = `نمایش ${XAL.fa(Math.min(200, rows.length - limit))} نفر دیگر`;
        more.addEventListener('click', () => { limit += 200; draw(); });
        list.appendChild(more);
      }
    }

    m.body.querySelectorAll('[data-rel]').forEach((c) => c.addEventListener('click', () => { f.rel = c.dataset.rel; draw(); }));
    m.body.querySelectorAll('[data-f]').forEach((c) => c.addEventListener('click', () => {
      f[c.dataset.f] = !f[c.dataset.f];
      if (c.dataset.f === 'verified' && f.verified) f.notVerified = false;
      if (c.dataset.f === 'notVerified' && f.notVerified) f.verified = false;
      draw();
    }));
    q('#q').addEventListener('input', (e) => { f.q = e.target.value.trim().toLowerCase(); draw(); });
    q('#all').addEventListener('click', () => { filtered().forEach((u) => { if (!white.has(u.handle.toLowerCase())) selected.add(u.handle.toLowerCase()); }); draw(); });
    q('#none').addEventListener('click', () => { selected.clear(); draw(); });
    q('#rescan').addEventListener('click', rescan);
    const chosen = () => users.filter((u) => selected.has(u.handle.toLowerCase()) && !white.has(u.handle.toLowerCase()));
    q('#copy').addEventListener('click', () => {
      const rows = selected.size ? chosen() : filtered();
      navigator.clipboard.writeText(rows.map((u) => `@${u.handle}`).join('\n'));
      XAL.toast(`${XAL.fa(rows.length)} یوزرنیم کپی شد ✓`);
    });
    q('#csv').addEventListener('click', () => {
      const rows = selected.size ? chosen() : filtered();
      const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = '﻿handle,name,follows_you,verified,locked,no_avatar,bio\n' +
        rows.map((u) => [u.handle, u.name, u.followsYou, u.verified, u.locked, u.noAvatar, u.bio].map(cell).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `following_${data.handle}.csv`; a.click();
    });

    const start = (mode, extra = {}) => {
      const rows = chosen();
      if (!rows.length) return XAL.toast('اول چند نفر را انتخاب کنید');
      XAL.bg({ type: 'start', kind: 'unfollow', mode, links: rows.map((u) => `https://x.com/${u.handle}`), closeTab: true, autoNext: false, ...extra });
      // they are on their way out of the list
      data.users = users.filter((u) => !rows.includes(u));
      chrome.storage.local.set({ followScan: data });
      m.close();
      XAL.toast(mode === 'manual' ? 'صف آنفالو شروع شد؛ در هر صفحه خودتان آنفالو کنید' : 'آنفالو خودکار شروع شد');
    };
    q('#manual').addEventListener('click', () => start('manual'));
    q('#auto').addEventListener('click', async () => {
      const { unfollowCfg = { min: 20, max: 40, cap: 50 } } = await chrome.storage.local.get('unfollowCfg');
      const { body, close } = XAL.modal({ title: '⚙️ آنفالو خودکار' });
      body.innerHTML = `
        <div style="padding:10px 12px;border-radius:12px;background:rgba(255,173,31,.1);border:1px solid rgba(255,173,31,.35);color:#ffd28a;font-size:12.5px;margin-bottom:14px">
          ⚠️ آنفالوی خودکار و انبوه خلاف قوانین X است و می‌تواند باعث محدود شدن حساب شود. با سقف پایین و فاصله‌ی زیاد استفاده کنید؛ حالت دستی امن‌تر است.</div>
        <div class="row" style="margin-bottom:10px"><span style="flex:1">فاصله بین هر آنفالو (ثانیه)</span>
          <input type="number" id="mn" min="10" value="${unfollowCfg.min}" style="width:70px"> تا <input type="number" id="mx" min="10" value="${unfollowCfg.max}" style="width:70px"></div>
        <div class="row" style="margin-bottom:16px"><span style="flex:1">حداکثر آنفالو در روز</span><input type="number" id="cap" min="1" max="400" value="${unfollowCfg.cap}" style="width:90px"></div>
        <button class="btn" id="go" style="width:100%">شروع با ${XAL.fa(chosen().length)} نفر</button>`;
      body.querySelector('#go').addEventListener('click', async () => {
        const min = Math.max(10, +body.querySelector('#mn').value || 20);
        const max = Math.max(min, +body.querySelector('#mx').value || 40);
        const cap = Math.max(1, Math.min(400, +body.querySelector('#cap').value || 50));
        await chrome.storage.local.set({ unfollowCfg: { min, max, cap } });
        close();
        start('auto', { delayMinMs: min * 1000, delayMaxMs: max * 1000, preMinMs: 1500, preMaxMs: 3500, dailyCap: cap });
      });
    });
    draw();
  }
})();
