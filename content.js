// Runs on every page. Mirrors the Wi-Fi mode onto <html data-dw-mode="..."> (content.css and
// inpage.js key off it), makes clicks and form submits wait like they're going over a satellite,
// and makes images load slowly while the connection is throttled. Nothing is ever announced.

let mode = 'off';
let replaying = false;
let pending = null;

const between = (min, max) => min + Math.random() * (max - min);

// No entry means no delay: off, or 'clear' (the stretches where it just works).
const DELAYS = {
  normal: [150, 600],      // satellite round trip
  throttle: [2000, 6500],
  outage: [800, 2500],
  expired: [800, 2500]
};

// ---------- Mode ----------

function apply(next) {
  const previous = mode;
  mode = next;
  document.documentElement?.setAttribute('data-dw-mode', mode);
  if (mode === 'throttle' && previous !== 'throttle') markLoadedImages();
  if (mode !== 'throttle' && previous === 'throttle') clearImageEffects();
}

async function sync() {
  const { connected, mode: stored } = await chrome.storage.local.get(['connected', 'mode']);
  apply(connected ? stored || 'normal' : 'off');
}

chrome.storage.onChanged.addListener(sync);
sync();

// ---------- Slow images ----------
// Images already on screen stay; anything that loads during a slow spell paints in gradually
// (top-to-bottom like a baseline JPEG, or blurry-to-sharp like a progressive one), and a few never show.

function markLoadedImages() {
  document.querySelectorAll('img').forEach((img) => {
    if (img.complete && img.naturalWidth) img.setAttribute('data-dw-seen', '');
  });
}

function clearImageEffects() {
  document.querySelectorAll('img[data-dw-reveal], img[data-dw-stuck]').forEach((img) => {
    img.removeAttribute('data-dw-reveal');
    img.removeAttribute('data-dw-stuck');
  });
}

document.addEventListener('load', (event) => {
  const img = event.target;
  if (mode !== 'throttle' || !(img instanceof HTMLImageElement) || img.hasAttribute('data-dw-seen')) return;
  img.setAttribute('data-dw-seen', '');
  if (Math.random() < 0.08) {
    img.setAttribute('data-dw-stuck', '');
    return;
  }
  img.style.setProperty('--dw-reveal', `${between(3, 11).toFixed(1)}s`);
  img.setAttribute('data-dw-reveal', Math.random() < 0.5 ? 'scan' : 'blur');
}, true);

// ---------- Slow clicks and submits ----------
// The click is held, then replayed on the same element, so the site's own handlers
// (including single-page-app routers) still run normally.

function hold(event, replay) {
  event.preventDefault();
  event.stopImmediatePropagation();
  clearTimeout(pending);
  const [min, max] = DELAYS[mode];
  pending = setTimeout(() => {
    replaying = true;
    try { replay(); } finally { replaying = false; }
  }, between(min, max));
}

document.addEventListener('click', (event) => {
  if (!DELAYS[mode] || replaying || !event.isTrusted || event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

  const url = new URL(link.href, location.href);
  if (!/^https?:$/.test(url.protocol)) return;
  if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;

  hold(event, () => {
    if (link.isConnected) link.click();
    else location.href = url.href;
  });
}, true);

document.addEventListener('submit', (event) => {
  if (!DELAYS[mode] || replaying || event.defaultPrevented) return;
  const form = event.target;
  const submitter = event.submitter?.form === form ? event.submitter : undefined;
  hold(event, () => form.requestSubmit(submitter));
}, true);
