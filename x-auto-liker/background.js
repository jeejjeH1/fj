// Two modes, both using one tab navigated to each link in turn:
// - manual: the extension only opens the links; the user likes and presses "Next" (popup,
//   on-page overlay or Alt+N). Event-driven, so it survives service-worker restarts.
// - auto: open, wait the user's "before like" time, like, then wait "between likes".
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

function summarize(results = [], mode = 'auto', kind = 'like') {
  const count = (r) => String(results.filter((x) => x.result === r).length)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  if (kind === 'unfollow') {
    return mode === 'manual'
      ? `${count('unfollowed')} آنفالو، ${count('skipped')} رد شد`
      : `${count('unfollowed')} آنفالو، ${count('already')} از قبل فالو نبود، ${count('error')} خطا`;
  }
  return mode === 'manual'
    ? `${count('liked')} لایک، ${count('skipped')} رد شد`
    : `${count('liked')} لایک، ${count('already')} از قبل، ${count('error')} خطا`;
}

// Sleeps in small steps so Stop takes effect quickly.
// Pause holds the run where it is: time spent paused does not count toward a wait.
let paused = false;
async function waitUnlessStopped(ms, runId) {
  let left = ms;
  while (left > 0) {
    if (runId !== currentRun) return false;
    if (paused) { await sleep(300); continue; }
    const step = Math.min(500, left);
    await sleep(step);
    left -= step;
  }
  return runId === currentRun;
}
async function waitWhilePaused(runId) {
  while (paused && runId === currentRun) await sleep(300);
  return runId === currentRun;
}


function navigateAndWait(tabId, url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('page load timeout'));
    }, timeoutMs);
    function onUpdated(id, info) {
      if (id !== tabId || info.status !== 'complete') return;
      // only the real page counts: a tab starts on about:blank, which can also report "complete"
      chrome.tabs.get(tabId).then((t) => {
        if (!t.url || t.url.startsWith('about:')) return;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }, () => {});
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

// Injected into a profile page (unfollow queue). Same contract as tweetActionInPage.
// The follow button is found by its data-testid when X provides one, and otherwise by its
// visible text / label (Following / Follow, in English or Persian), so it survives markup changes.
async function profileActionInPage(handle, action) {
  function followStateInPage() {
    const scope = document.querySelector('[data-testid="placementTracking"]') ||
      document.querySelector('[data-testid="userActions"]') || document.querySelector('main') || document;
    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
    // skip the confirmation dialog's own buttons and anything hidden
    const btns = [...scope.querySelectorAll('button, [role="button"]')]
      .filter((b) => b.offsetParent !== null && !b.closest('[role="dialog"], [role="alertdialog"]'));
    const label = (b) => norm(b.getAttribute('aria-label') || b.textContent);
    const unf = btns.find((b) => /-unfollow$/.test(b.dataset.testid || '') || /^(Following|Unfollow|دنبال می‌کنید)$/i.test(label(b)));
    if (unf) return { state: 'following', button: unf };
    const fol = btns.find((b) => /-follow$/.test(b.dataset.testid || '') || /^(Follow|دنبال کردن)$/i.test(label(b)));
    if (fol) return { state: 'follow', button: fol };
    return { state: null };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (location.pathname.startsWith('/i/flow/login') || document.querySelector('[data-testid="loginButton"]')) {
      return { result: 'error', detail: 'not logged in', fatal: true };
    }
    if (document.querySelector('[data-testid="emptyState"]')) return { result: 'error', detail: 'account not found' };
    if (/rate limit|too many requests|unusual activity|try again later/i.test(document.body?.innerText || '')) return { result: 'error', detail: 'X shows a limit', fatal: true, fatalReason: 'X نشان داد محدودیت یا فعالیت غیرعادی؛ برای امنیت حساب متوقف شد.' };
    const st = followStateInPage();
    if (st.state === 'follow') return { result: 'already' }; // not following anymore
    if (st.state === 'following') {
      if (action === 'find') return { result: 'ready' };
      st.button.click();
      for (let i = 0; i < 20; i++) {
        await sleep(250);
        // confirmation sheet: X's own confirm button, or a dialog button labelled Unfollow / آنفالو
        const sheet = document.querySelector('[data-testid="confirmationSheetConfirm"]') ||
          [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')]
            .find((b) => /^(Unfollow|آنفالو)$/i.test((b.textContent || '').trim()));
        sheet?.click();
        if (followStateInPage().state === 'follow') return { result: 'unfollowed' };
      }
      return { result: 'error', detail: 'unfollow not confirmed' };
    }
    await sleep(500);
  }
  return { result: 'error', detail: 'follow button not found' };
}

const KIND = {
  like: { func: tweetActionInPage, target: (url) => url.match(/status\/(\d+)/)[1], max: 30 },
  unfollow: { func: profileActionInPage, target: (url) => new URL(url).pathname.split('/')[1], max: 1000 },
};

async function runInTab(tabId, kind, url, action) {
  const k = KIND[kind];
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    func: k.func,
    args: [k.target(url), action],
  });
  return inj?.result || { result: 'error', detail: 'no result' };
}

// Daily unfollow counter, so the auto queue respects the user's cap.
const today = () => new Date().toISOString().slice(0, 10);
async function unfollowsToday() {
  const { unfollowLog } = await chrome.storage.local.get('unfollowLog');
  return unfollowLog?.day === today() ? unfollowLog.n : 0;
}
async function countUnfollow() {
  await chrome.storage.local.set({ unfollowLog: { day: today(), n: (await unfollowsToday()) + 1 } });
}

const randBetween = (min, max) => min + Math.floor(Math.random() * (Math.max(min, max) - min + 1));

// opts: { kind, links, preMinMs, preMaxMs, delayMinMs, delayMaxMs, closeTab, dailyCap }
async function run(opts) {
  const { links, closeTab } = opts;
  const kind = opts.kind || 'like';
  const runId = ++currentRun;
  paused = false;
  startKeepAlive();
  await chrome.storage.local.set({
    runState: {
      kind, mode: 'auto', running: true, queue: links, results: [], statusText: '', tabId: null,
      index: 0, phase: 'opening', phaseStart: Date.now(), phaseEnd: null,
    },
  });

  let tabId = null;
  const results = [];
  let stopReason = '';
  let errStreak = 0;
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
      let outcome;
      try {
        await navigateAndWait(tabId, url);
        outcome = await runInTab(tabId, kind, url, 'find');
        if (outcome.result === 'ready') {
          if (kind === 'unfollow' && (await unfollowsToday()) >= (opts.dailyCap || 50)) {
            stopReason = 'سقف روزانه‌ی آنفالو پر شد';
            break;
          }
          const pre = randBetween(opts.preMinMs, opts.preMaxMs);
          if (pre > 0) {
            await phase('reading', i, pre);
            if (!(await waitUnlessStopped(pre, runId))) return;
          }
          await phase('liking', i);
          if (!(await waitWhilePaused(runId))) return;
          outcome = await runInTab(tabId, kind, url, 'click');
          if (outcome.result === 'unfollowed') await countUnfollow();
        }
      } catch (e) {
        outcome = { result: 'error', detail: e.message };
      }

      if (runId !== currentRun) return;
      results.push({ url, result: outcome.result, detail: outcome.detail });
      await update({ results: [...results] });

      if (outcome.fatal) { stopReason = outcome.fatalReason || 'وارد حساب X نشده‌اید — اول لاگین کنید.'; break; }
      errStreak = outcome.result === 'error' ? errStreak + 1 : 0;
      if (errStreak >= 3) { stopReason = 'سه خطای پشت‌سرهم؛ برای امنیت حساب متوقف شد.'; break; }

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
  const summary = summarize(results, 'auto', kind);

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

/* ───────────── manual mode ───────────── */

// Injected: reads (never clicks) whether the focal tweet is liked.
async function readLikeStateInPage(statusId) {
  const findArticle = () => {
    const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
    return articles.find((a) => a.querySelector(`a[href*="/status/${statusId}"] time`)) ||
      articles.find((a) => a.getAttribute('tabindex') === '-1');
  };
  for (let i = 0; i < 6; i++) {
    const a = findArticle();
    if (a?.querySelector('[data-testid="unlike"]')) return 'liked';
    if (a?.querySelector('[data-testid="like"]')) return 'skipped';
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'skipped';
}

// Injected: reads (never clicks) whether you still follow this profile.
async function readFollowStateInPage() {
  function followStateInPage() {
    const scope = document.querySelector('[data-testid="placementTracking"]') ||
      document.querySelector('[data-testid="userActions"]') || document.querySelector('main') || document;
    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
    // skip the confirmation dialog's own buttons and anything hidden
    const btns = [...scope.querySelectorAll('button, [role="button"]')]
      .filter((b) => b.offsetParent !== null && !b.closest('[role="dialog"], [role="alertdialog"]'));
    const label = (b) => norm(b.getAttribute('aria-label') || b.textContent);
    const unf = btns.find((b) => /-unfollow$/.test(b.dataset.testid || '') || /^(Following|Unfollow|دنبال می‌کنید)$/i.test(label(b)));
    if (unf) return { state: 'following', button: unf };
    const fol = btns.find((b) => /-follow$/.test(b.dataset.testid || '') || /^(Follow|دنبال کردن)$/i.test(label(b)));
    if (fol) return { state: 'follow', button: fol };
    return { state: null };
  }
  for (let i = 0; i < 6; i++) {
    const st = followStateInPage();
    if (st.state === 'following') return 'skipped';
    if (st.state === 'follow') return 'unfollowed';
    await new Promise((r) => setTimeout(r, 250));
  }
  return 'skipped';
}

async function startManual({ links, closeTab, autoNext, kind = 'like' }) {
  currentRun++; // cancels any auto run still going
  paused = false;
  stopKeepAlive();
  // Save the state before the first page loads, so the on-page panel finds it.
  const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
  await chrome.storage.local.set({
    runState: {
      kind, mode: 'manual', running: true, queue: links, results: [], index: 0, tabId: tab.id,
      phase: 'manual', phaseStart: Date.now(), phaseEnd: null, closeTab, autoNext, statusText: '',
    },
  });
  await chrome.tabs.update(tab.id, { url: links[0] });
}

let advancing = false; // ignore double presses while the next page is being opened
async function manualNext() {
  if (advancing) return;
  const { runState: s } = await chrome.storage.local.get('runState');
  if (!s?.running || s.mode !== 'manual') return;
  advancing = true;
  try {
    const url = s.queue[s.index];
    let result = 'skipped';
    try {
      const [inj] = s.kind === 'unfollow'
        ? await chrome.scripting.executeScript({ target: { tabId: s.tabId }, func: readFollowStateInPage })
        : await chrome.scripting.executeScript({
          target: { tabId: s.tabId }, func: readLikeStateInPage, args: [url.match(/status\/(\d+)/)[1]],
        });
      result = inj?.result || 'skipped';
    } catch { /* tab on another page or closed: count as skipped */ }

    const results = [...s.results, { url, result }];
    const index = s.index + 1;
    if (index >= s.queue.length) {
      await finishManual({ ...s, results }, false);
      return;
    }
    await setState({ results, index, phaseStart: Date.now() });
    await chrome.tabs.update(s.tabId, { url: s.queue[index], active: true });
  } finally {
    advancing = false;
  }
}

async function finishManual(s, stopped) {
  if (s.closeTab && !stopped) chrome.tabs.remove(s.tabId).catch(() => {});
  await chrome.storage.local.set({
    runState: {
      ...s, running: false, phase: stopped ? 'stopped' : 'done', phaseEnd: null,
      statusText: `${stopped ? 'متوقف شد' : 'تمام شد'} — ${summarize(s.results, 'manual', s.kind)}`,
    },
  });
}

// Show the on-page panel each time the run's tab finishes loading a link.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const { runState: s } = await chrome.storage.local.get('runState');
  if (!s?.running || s.mode !== 'manual' || s.tabId !== tabId) return;
  chrome.scripting.executeScript({ target: { tabId }, files: ['overlay.js'] }).catch(() => {});
});

// Closing the run's tab ends a manual run.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { runState: s } = await chrome.storage.local.get('runState');
  if (s?.running && s.mode === 'manual' && s.tabId === tabId) finishManual(s, true);
});

chrome.commands.onCommand.addListener((cmd) => { if (cmd === 'next-link') manualNext(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'pause' || msg.type === 'resume') {
    paused = msg.type === 'pause';
    setState({ paused });
    sendResponse({ ok: true });
  } else if (msg.type === 'start') {
    const links = msg.links.slice(0, KIND[msg.kind || 'like'].max);
    if (msg.mode === 'manual') startManual({ ...msg, links });
    else run({ ...msg, links });
    sendResponse({ ok: true });
  } else if (msg.type === 'next') {
    manualNext();
    sendResponse({ ok: true });
  } else if (msg.type === 'stop') {
    currentRun++;
    stopKeepAlive();
    chrome.storage.local.get('runState').then(({ runState }) => {
      if (runState?.mode === 'manual') return finishManual(runState, true);
      return setState({
        running: false, phase: 'stopped', phaseEnd: null,
        statusText: `متوقف شد — ${summarize(runState?.results, 'auto', runState?.kind)}`,
      });
    });
    sendResponse({ ok: true });
  } else if (msg.type === 'fetchDataURL') {
    fetchDataURL(msg.url).then((dataURL) => sendResponse({ dataURL }), () => sendResponse({}));
    return true; // async response
  } else if (msg.type === 'download') {
    chrome.downloads.download({ url: msg.url, filename: msg.filename, conflictAction: 'uniquify' })
      .then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: e.message }));
    return true;
  } else if (msg.type === 'openPage') {
    chrome.tabs.create({ url: chrome.runtime.getURL(msg.page) });
    sendResponse({ ok: true });
  }
});

// Images for the tweet-card canvas: fetched here (host permission, no CORS taint) as data: URLs.
async function fetchDataURL(url) {
  if (!/^https:\/\/(pbs|abs)\.twimg\.com\//.test(url)) throw new Error('blocked host');
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(bin)}`;
}

// If the browser restarted, the run's tab is gone; mark the stale state as stopped.
// (A manual run survives worker restarts, so only reset on startup/update, not on wake-up.)
chrome.runtime.onStartup.addListener(() => { paused = false; setState({ running: false, paused: false }); });
chrome.runtime.onInstalled.addListener(() => setState({ running: false }));
