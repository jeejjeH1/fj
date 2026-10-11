// Runs in X's own page context (world: MAIN) at document_start.
// X plays videos from blob: streams, so the real MP4 links only exist in the API responses the page
// already receives. This reads those responses (it never sends requests of its own) and hands
// tweetId → media list to the content scripts via postMessage.
(() => {
  if (window.__xalMediaHook) return;
  window.__xalMediaHook = true;

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
  }

  const isApi = (url) => /\/i\/api\/|\/graphql\//.test(url || '');

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xalUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
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
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (isApi(url)) res.clone().json().then(collect).catch(() => {});
    } catch { /* ignore */ }
    return res;
  };
})();
