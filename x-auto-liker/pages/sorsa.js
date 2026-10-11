// Settings for the optional Sorsa Score badge: the user's own API key and an on/off switch.
const $ = (id) => document.getElementById(id);
if (new URLSearchParams(location.search).has('embed')) { document.body.classList.add('embed'); document.documentElement.classList.add('embed'); }
const say = (t, ok) => { $('msg').style.color = ok ? 'var(--green)' : '#ff8a95'; $('msg').textContent = t; };

async function load() {
  const { sorsa = {} } = await chrome.storage.local.get('sorsa');
  $('key').value = sorsa.key || '';
  $('on').checked = !!sorsa.enabled;
}
$('save').addEventListener('click', async () => {
  const key = $('key').value.trim();
  if ($('on').checked && !key) return say('اول کلید را وارد کنید.', false);
  await chrome.storage.local.set({ sorsa: { key, enabled: $('on').checked } });
  say('ذخیره شد ✓', true);
});
$('test').addEventListener('click', async () => {
  const key = $('key').value.trim();
  if (!key) return say('اول کلید را وارد کنید.', false);
  say('در حال تست…', true);
  const res = await chrome.runtime.sendMessage({ type: 'sorsaTest', key }).catch((e) => ({ ok: false, error: e.message }));
  if (res?.ok) say(res.score !== null && res.score !== undefined ? `✓ کلید معتبر است (نمونه: ${res.score})` : '✓ کلید معتبر است', true);
  else say(res?.error || 'خطا', false);
});
load();
