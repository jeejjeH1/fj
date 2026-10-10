// Runs the like queue: one tab, navigated to each link in turn. For each link: open, wait the
// user's "before like" time, like, then wait the "between likes" time before the next link.
// Progress lives in chrome.storage.local (runState) so the popup can be closed and reopened.

let currentRun = 0; // bumped on every start/stop; a loop exits once its id is stale
let keepAliveTimer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MV3 service workers are killed after ~30s without extension API activity.
// A cheap API call every 20s keeps it alive while a run is in progress.
function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
}
function stopKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

async function setState(patch) {
  const { runState = {} } = await chrome.storage.local.get('runState');
  const next = { ...runState, ...patch };
  await chrome.storage.local.set({ runState: next });
  return next;
}

function summarize(results = []) {
  const count = (kind) => String(results.filter((r) => r.result === kind).length)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  return `${count('liked')} لایک، ${count('already')} از قبل، ${count('error')} خطا`;
}

// Sleeps in small steps so Stop takes effect quickly.
async function waitUnlessStopped(ms, runId) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (runId !== currentRun) return false;
    await sleep(Math.min(500, end - Date.now()));
  }
  return runId === currentRun;
}

function navigateAndWait(tabId, url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('page load timeout'));
    }, timeoutMs);
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.update(tabId, { url }).catch((e) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(e);
    });
  });
}

// Injected into the tweet page. Must be self-contained.
// action 'find': wait until the focal tweet's like button is on screen (no click).
// action 'click': click like on the focal tweet and confirm it turned red.
async function tweetActionInPage(statusId, action) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The focal tweet is the article whose timestamp links to this status id.
  // Parent tweets (when the link is a reply) and replies link to their own ids.
  const findArticle = () => {
    const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
    return articles.find((a) => a.querySelector(`a[href*="/status/${statusId}"] time`)) ||
      articles.find((a) => a.getAttribute('tabindex') === '-1');
  };

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (location.pathname.startsWith('/i/flow/login') || document.querySelector('[data-testid="loginButton"]')) {
      return { result: 'error', detail: 'not logged in', fatal: true };
    }
    const article = findArticle();
    if (article) {
      if (article.querySelector('[data-testid="unlike"]')) return { result: 'already' };
      const btn = article.querySelector('[data-testid="like"]');
      if (btn) {
        if (action === 'find') return { result: 'ready' };
        btn.click();
        for (let i = 0; i < 20; i++) {
          await sleep(250);
          if (article.querySelector('[data-testid="unlike"]')) return { result: 'liked' };
        }
        return { result: 'error', detail: 'like not confirmed' };
      }
    }
    await sleep(500);
  }
  return { result: 'error', detail: 'tweet not found' };
}

async function runInTab(tabId, statusId, action) {
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    func: tweetActionInPage,
    args: [statusId, action],
  });
  return inj?.result || { result: 'error', detail: 'no result' };
}

const randBetween = (min, max) => min + Math.floor(Math.random() * (Math.max(min, max) - min + 1));

// opts: { links, preMinMs, preMaxMs, delayMinMs, delayMaxMs, closeTab }
async function run(opts) {
  const { links, closeTab } = opts;
  const runId = ++currentRun;
  startKeepAlive();
  await chrome.storage.local.set({
    runState: {
      running: true, queue: links, results: [], statusText: '', tabId: null,
      index: 0, phase: 'opening', phaseStart: Date.now(), phaseEnd: null,
    },
  });

  let tabId = null;
  const results = [];
  let stopReason = '';
  // Once Stop is pressed (or a new run starts) this loop must not write state anymore.
  const update = (patch) => (runId === currentRun ? setState(patch) : Promise.resolve());
  const phase = (name, index, ms = null) => update({
    phase: name, index, phaseStart: Date.now(), phaseEnd: ms === null ? null : Date.now() + ms,
  });

  try {
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    tabId = tab.id;
    await update({ tabId });

    for (let i = 0; i < links.length; i++) {
      if (runId !== currentRun) return;
      await phase('opening', i);

      const url = links[i];
      const statusId = url.match(/status\/(\d+)/)[1];
      let outcome;
      try {
        await navigateAndWait(tabId, url);
        outcome = await runInTab(tabId, statusId, 'find');
        if (outcome.result === 'ready') {
          const pre = randBetween(opts.preMinMs, opts.preMaxMs);
          if (pre > 0) {
            await phase('reading', i, pre);
            if (!(await waitUnlessStopped(pre, runId))) return;
          }
          await phase('liking', i);
          outcome = await runInTab(tabId, statusId, 'click');
        }
      } catch (e) {
        outcome = { result: 'error', detail: e.message };
      }

      if (runId !== currentRun) return;
      results.push({ url, result: outcome.result, detail: outcome.detail });
      await update({ results: [...results] });

      if (outcome.fatal) { stopReason = 'وارد حساب X نشده‌اید — اول لاگین کنید.'; break; }

      if (i < links.length - 1) {
        const wait = randBetween(opts.delayMinMs, opts.delayMaxMs);
        await phase('waiting', i + 1, wait);
        if (!(await waitUnlessStopped(wait, runId))) return;
      }
    }
  } catch (e) {
    stopReason = `خطا: ${e.message}`;
  }

  if (runId !== currentRun) return;
  const summary = summarize(results);

  if (tabId !== null && closeTab && !stopReason) {
    chrome.tabs.remove(tabId).catch(() => {});
  }
  stopKeepAlive();
  await setState({
    running: false,
    phase: stopReason ? 'stopped' : 'done',
    phaseEnd: null,
    statusText: stopReason ? `${stopReason} — ${summary}` : `تمام شد — ${summary}`,
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'start') {
    run({ ...msg, links: msg.links.slice(0, 30) });
    sendResponse({ ok: true });
  } else if (msg.type === 'stop') {
    currentRun++;
    stopKeepAlive();
    chrome.storage.local.get('runState').then(({ runState }) =>
      setState({
        running: false, phase: 'stopped', phaseEnd: null,
        statusText: `متوقف شد — ${summarize(runState?.results)}`,
      }));
    sendResponse({ ok: true });
  }
});

// If the worker was restarted mid-run, the loop is gone; mark the stale state as stopped.
chrome.runtime.onStartup.addListener(() => setState({ running: false }));
chrome.runtime.onInstalled.addListener(() => setState({ running: false }));
