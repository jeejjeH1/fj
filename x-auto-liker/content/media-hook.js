// Runs in X's own page context (world: MAIN) at document_start.
// X plays videos from blob: streams, so the real MP4 links only exist in the API responses the page
// already receives. This reads those responses (it never sends requests of its own) and hands
// tweetId → media list to the content scripts via postMessage.
(() => {
  if (window.__xalMediaHook) return;
  window.__xalMediaHook = true;

  // Accounts seen so far, kept so the content script can ask for them after it has loaded.
  const usersBuf = new Map();
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.__xal === 'replayUsers') window.postMessage({ __xal: 'users', users: [...usersBuf.values()] }, location.origin);
    if (e.data?.__xal === 'resetUsers') usersBuf.clear();
  });

  // Accounts in X's own responses (e.g. the Following list): name, bio, and the follow relationship.
  function collectUsers(json) {
    const out = [];
    const seen = new WeakSet();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 60 || seen.has(o)) return;
      seen.add(o);
      if (o.rest_id && (o.legacy?.screen_name || o.core?.screen_name)) {
        const L = o.legacy || {}, C = o.core || {}, R = o.relationship_perspectives || {};
        const avatar = o.avatar?.image_url || L.profile_image_url_https || '';
        out.push({
          handle: L.screen_name || C.screen_name,
          name: L.name || C.name || '',
          bio: L.description || '',
          avatar,
          following: L.following ?? R.following,
          followsYou: !!(L.followed_by ?? R.followed_by),
          verified: !!(o.is_blue_verified || L.verified),
          locked: !!(L.protected ?? o.privacy?.protected),
          noAvatar: !avatar || /default_profile/.test(avatar),
          followers: L.followers_count ?? 0,
          friends: L.friends_count ?? 0,
          posts: L.statuses_count ?? 0,
          location: (typeof o.location === 'object' ? o.location?.location : o.location) || L.location || '',
          createdAt: L.created_at || C.created_at || '',
          id: o.rest_id,
        });
      }
      for (const k in o) walk(o[k], depth + 1);
    };
    walk(json, 0);
    return out;
  }

  function collect(json) {
    const found = {};
    const seen = new WeakSet();
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 60 || seen.has(o)) return;
      seen.add(o);
      if (o.id_str && o.extended_entities?.media) {
        const list = o.extended_entities.media.map((m) => {
          if (m.video_info?.variants) {
            const mp4 = m.video_info.variants.filter((v) => v.content_type === 'video/mp4')
              .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            return mp4[0] ? { type: m.type === 'animated_gif' ? 'gif' : 'video', url: mp4[0].url, poster: m.media_url_https } : null;
          }
          return m.media_url_https ? { type: 'photo', url: `${m.media_url_https}?name=orig`, poster: m.media_url_https } : null;
        }).filter(Boolean);
        if (list.length) found[o.id_str] = list;
      }
      for (const k in o) walk(o[k], depth + 1);
    };
    walk(json, 0);
    if (Object.keys(found).length) window.postMessage({ __xal: 'media', found }, location.origin);
    const users = collectUsers(json);
    if (users.length) {
      for (const u of users) if (u.handle) usersBuf.set(u.handle.toLowerCase(), { ...usersBuf.get(u.handle.toLowerCase()), ...u });
      window.postMessage({ __xal: 'users', users }, location.origin);
    }
  }

  const isApi = (url) => /\/i\/api\/|\/graphql\//.test(url || '');

  // The last Following / Followers request the page made (address + headers), so a sync can ask for
  // the next pages exactly the way X's own page does.
  const lastReq = {};
  const headersToObj = (h) => {
    const o = {};
    if (!h) return o;
    if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach((v, k) => { o[k] = v; });
    else if (Array.isArray(h)) h.forEach(([k, v]) => { o[k] = v; });
    else Object.assign(o, h);
    return o;
  };
  function captureReq(url, headers) {
    try {
      const m = /\/graphql\/[^/]+\/(Following|Followers)(?:\?|$)/.exec(String(url));
      if (m) lastReq[m[1].toLowerCase()] = { url: new URL(url, location.origin).href, headers: headersToObj(headers) };
    } catch { /* ignore */ }
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xalUrl = url;
    this.__xalHeaders = {};
    return origOpen.call(this, method, url, ...rest);
  };
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__xalHeaders) this.__xalHeaders[k] = v;
    return origSetHeader.call(this, k, v);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    captureReq(this.__xalUrl, this.__xalHeaders);
    if (isApi(String(this.__xalUrl))) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') collect(JSON.parse(this.responseText));
          else if (this.responseType === 'json') collect(this.response);
        } catch { /* not JSON */ }
      });
    }
    return origSend.apply(this, args);
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const first = args[0];
      captureReq(typeof first === 'string' ? first : first?.url, args[1]?.headers || first?.headers);
    } catch { /* ignore */ }
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (isApi(url)) res.clone().json().then(collect).catch(() => {});
    } catch { /* ignore */ }
    return res;
  };

  /* ───────────── list sync ─────────────
     Pages through the Following / Followers list with the same request X's page uses, a few accounts per
     call, with pauses. Read-only. Stops at once on a rate limit, an auth error, or when asked. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function bottomCursor(json) {
    let found = null;
    const seen = new WeakSet();
    const walk = (o, d) => {
      if (found || !o || typeof o !== 'object' || d > 60 || seen.has(o)) return;
      seen.add(o);
      if (o.cursorType === 'Bottom' && o.value) { found = o.value; return; }
      if (typeof o.entryId === 'string' && o.entryId.startsWith('cursor-bottom') && o.content?.value) { found = o.content.value; return; }
      for (const k in o) walk(o[k], d + 1);
    };
    walk(json, 0);
    return found;
  }

  let syncing = null;
  async function runSync(type) {
    const post = (m) => window.postMessage({ __xal: 'sync', type, ...m }, location.origin);
    const job = (syncing = { stop: false });
    // wait for the page's own first request for this list
    for (let i = 0; i < 40 && !lastReq[type] && !job.stop; i++) await sleep(500);
    const req = lastReq[type];
    if (!req) return post({ state: 'done', reason: 'no_request', users: [] });

    const all = new Map();
    let cursor = null, idle = 0, pages = 0, reason = 'end';
    while (!job.stop && pages < 400) {
      const u = new URL(req.url);
      let vars = {};
      try { vars = JSON.parse(u.searchParams.get('variables') || '{}'); } catch { /* keep empty */ }
      if (cursor) vars.cursor = cursor; else delete vars.cursor;
      u.searchParams.set('variables', JSON.stringify(vars));
      let res;
      try { res = await origFetch(u.href, { headers: req.headers, credentials: 'include' }); }
      catch { reason = 'network'; break; }
      if (res.status === 429) { reason = 'rate_limit'; break; }
      if (res.status === 401 || res.status === 403) { reason = 'auth'; break; }
      if (!res.ok) { reason = 'error'; break; }
      let json;
      try { json = await res.json(); } catch { reason = 'error'; break; }
      pages++;
      const before = all.size;
      for (const user of collectUsers(json)) if (user.handle) all.set(user.handle.toLowerCase(), user);
      idle = all.size > before ? 0 : idle + 1;
      post({ state: 'progress', count: all.size, pages });
      const next = bottomCursor(json);
      if (!next || next === cursor || idle >= 2) break;
      if (Number(res.headers.get('x-rate-limit-remaining')) === 1) { reason = 'rate_limit_soon'; break; }
      cursor = next;
      await sleep(700 + Math.random() * 700); // pause between calls
    }
    if (job.stop) reason = 'stopped';
    syncing = null;
    post({ state: 'done', reason, users: [...all.values()] });
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    if (e.data?.__xal === 'syncStart' && !syncing && (e.data.type === 'following' || e.data.type === 'followers')) runSync(e.data.type);
    if (e.data?.__xal === 'syncStop' && syncing) syncing.stop = true;
  });
})();
