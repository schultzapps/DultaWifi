const $ = (id) => document.getElementById(id);
const send = (type, value) => chrome.runtime.sendMessage({ type, value });

const LABELS = {
  clear: ['Connected', 'Working perfectly. For now.'],
  normal: ['Connected', 'A little satellite lag.'],
  throttle: ['Slow', 'Pages crawl, images trickle in, videos buffer.'],
  outage: ['Outage', 'Pages show Chrome’s “can’t be reached” screens.'],
  expired: ['Session expired', 'Pages ask to log in to the Wi-Fi again.']
};

async function render() {
  const { enabled, connected, mode = 'normal', flightEndsAt = 0 } = await chrome.storage.local.get(null);
  $('power').checked = !!enabled;
  $('state').textContent = !enabled ? 'Grounded' : connected ? 'Cruising at 35,000 ft' : 'Cleared for takeoff';
  $('panel').classList.toggle('hidden', !connected);

  if (connected) {
    const minutes = Math.max(0, Math.ceil((flightEndsAt - Date.now()) / 60_000));
    const [status, detail] = LABELS[mode];
    $('dot').className = `dot ${mode}`;
    $('status').textContent = status;
    $('detail').textContent = `${detail} Turns off in ${minutes} min.`;
  }
}

$('power').addEventListener('change', (e) => send(e.target.checked ? 'enable' : 'land'));
document.querySelectorAll('[data-incident]').forEach((btn) => {
  btn.addEventListener('click', () => send('incident', btn.dataset.incident));
});
$('recover').addEventListener('click', () => send('recover', true));

chrome.storage.onChanged.addListener(render);
render();
