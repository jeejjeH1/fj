const MAX_LINKS = 30;

const $ = (id) => document.getElementById(id);
const els = {
  links: $('links'), count: $('count'), delay: $('delay'), jitter: $('jitter'),
  closeTab: $('closeTab'), start: $('start'), stop: $('stop'),
  status: $('status'), progress: $('progress'), log: $('log'),
};

const RESULT_LABEL = {
  liked: '✓ لایک شد',
  already: '• از قبل لایک بود',
  error: '✗ خطا',
  pending: '…',
};

// Pulls tweet URLs out of free text, normalizes them to x.com and dedupes by status id.
// Accepts status links (x.com/user/status/ID) and intent links (x.com/intent/like?tweet_id=ID),
// with or without https://. Intent links become x.com/i/status/ID, which X redirects to the tweet.
function parseLinks(text) {
  const re = /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)|intent\/(?:like|favorite)\?(?:[^\s]*&)?tweet_id=(\d+))/g;
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(re)) {
    const id = m[2] || m[3];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m[2] ? `https://x.com/${m[1]}/status/${id}` : `https://x.com/i/status/${id}`);
  }
  return out;
}

function updateCount() {
  const n = parseLinks(els.links.value).length;
  els.count.textContent = n;
  els.count.style.color = n > MAX_LINKS ? '#f4212e' : '';
}

function render(state) {
  const running = !!state?.running;
  els.start.disabled = running;
  els.stop.disabled = !running;
  els.links.disabled = running;

  if (!state || !state.queue) return;
  const done = state.results.length;
  const total = state.queue.length;
  els.progress.max = total || 1;
  els.progress.value = done;
  els.status.textContent = state.statusText || (running ? `در حال اجرا… ${done}/${total}` : 'آماده');

  els.log.innerHTML = '';
  state.queue.forEach((url, i) => {
    const r = state.results[i];
    const li = document.createElement('li');
    const kind = r ? r.result : (running && i === done ? 'pending' : null);
    if (kind) li.className = kind;
    li.textContent = url.replace('https://x.com/', '') + (kind ? `  ${RESULT_LABEL[kind]}` : '') +
      (r?.detail ? ` (${r.detail})` : '');
    els.log.appendChild(li);
  });
}

async function init() {
  const { settings, runState } = await chrome.storage.local.get(['settings', 'runState']);
  if (settings) {
    els.links.value = settings.linksText ?? '';
    els.delay.value = settings.delay ?? 10;
    els.jitter.value = settings.jitter ?? 5;
    els.closeTab.checked = settings.closeTab ?? true;
  }
  updateCount();
  render(runState);
}

function saveSettings() {
  chrome.storage.local.set({
    settings: {
      linksText: els.links.value,
      delay: Number(els.delay.value),
      jitter: Number(els.jitter.value),
      closeTab: els.closeTab.checked,
    },
  });
}

els.links.addEventListener('input', () => { updateCount(); saveSettings(); });
[els.delay, els.jitter, els.closeTab].forEach((el) => el.addEventListener('change', saveSettings));

els.start.addEventListener('click', async () => {
  const links = parseLinks(els.links.value);
  if (links.length === 0) {
    els.status.textContent = 'هیچ لینک معتبری پیدا نشد.';
    return;
  }
  if (links.length > MAX_LINKS) {
    els.status.textContent = `حداکثر ${MAX_LINKS} لینک مجاز است (الان ${links.length} تاست).`;
    return;
  }
  const delay = Math.max(1, Number(els.delay.value) || 1);
  const jitter = Math.max(0, Number(els.jitter.value) || 0);
  saveSettings();
  await chrome.runtime.sendMessage({
    type: 'start',
    links, delayMs: delay * 1000, jitterMs: jitter * 1000, closeTab: els.closeTab.checked,
  });
});

els.stop.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'stop' }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.runState) render(changes.runState.newValue);
});

init();
