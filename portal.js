const $ = (id) => document.getElementById(id);
const between = (min, max) => min + Math.random() * (max - min);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIEWS = ['home', 'login', 'connecting', 'connected'];
const AD_SECONDS = 30;
const SCENE_SECONDS = 6;

// Closed captions for the sponsor video: [from second, to second, text]
const CAPTIONS = [
  [0.4, 3, 'Now boarding:'],
  [3, 5.8, 'fast, free Wi-Fi for all Dulta SkyMyles members.'],
  [6.4, 9, 'Stream your shows.'],
  [9, 11.8, 'Scroll your feeds. Send that email.'],
  [12.4, 15, 'All from thirty-five thousand feet.'],
  [15, 17.8, 'And you never miss a thing.'],
  [18.4, 21, 'You don’t even need to be'],
  [21, 23.8, 'a Tee-Mobile customer.'],
  [24.4, 27, 'Fast, free Wi-Fi on Dulta.'],
  [27, 29.8, 'Presented by Tee-Mobile.']
];

const SHEETS = {
  messaging: ['Free Messaging', 'iMessage, WhatsApp and Facebook Messenger are free on every flight. Connect to DultaWiFi.com and open your messaging app. No login required.'],
  studio: ['Dulta Studio', 'Watch hundreds of free movies and TV shows on your seatback screen. Headphones are available from a flight attendant.'],
  app: ['Fly Dulta App', 'Open the Fly Dulta app to see your boarding pass, track your bags and get gate information.'],
  join: ['Join SkyMyles', 'Joining SkyMyles is free. Download the Fly Dulta app and join in minutes, then log in here for Fast, Free Wi-Fi.']
};

const CONTINUE_KEY = 'dw-continue';

let state = { connected: false, mode: 'normal' };
let attempts = 0;
let player = null;

// ---------- Where you were headed ----------
// Like a real captive portal, every website you open while not logged in lands here with
// ?continue=<the page you wanted>. Remember it, tidy the address bar, and send you there after.

(function rememberDestination() {
  const marker = '?continue=';
  const at = location.href.indexOf(marker);
  if (at === -1) return;
  sessionStorage.setItem(CONTINUE_KEY, location.href.slice(at + marker.length));
  history.replaceState(null, '', location.pathname);
})();

// ---------- Routing ----------

function show(view) {
  if (!VIEWS.includes(view)) view = 'home';
  // Connecting can only be reached through the login button, not a refresh or Back.
  if (view === 'connecting' && !player) view = 'home';
  VIEWS.forEach((v) => $(v).classList.toggle('hidden', v !== view));
  if (view !== 'connecting') stopPlayer();
  window.scrollTo(0, 0);
}

function go(view) {
  if (location.hash === `#${view}`) show(view);
  else location.hash = view;
}

window.addEventListener('hashchange', () => show(location.hash.slice(1)));

// ---------- Connection state ----------

const isOnline = () => state.connected && state.mode !== 'expired';

function renderState() {
  $('access').classList.toggle('hidden', isOnline());
  $('wifi-ok').classList.toggle('hidden', !isOnline());
  $('tile-wifi-cta').textContent = isOnline() ? 'You’re Connected' : 'Access Free Wi-Fi';
}

async function loadState() {
  state = { ...state, ...(await chrome.storage.local.get(['connected', 'mode'])) };
  renderState();
}

chrome.storage.onChanged.addListener(loadState);

// ---------- Home ----------

function startAccess() {
  if (isOnline()) go('connected');
  else go('login');
}
$('access').addEventListener('click', startAccess);
$('tile-wifi-cta').addEventListener('click', startAccess);

function selectTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  $('tab-indicator').style.transform = name === 'trip' ? 'translateX(100%)' : 'none';
  $('tab-exclusives').classList.toggle('hidden', name !== 'exclusives');
  $('tab-trip').classList.toggle('hidden', name !== 'trip');
}
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.tab)));
document.querySelectorAll('[data-tab-link]').forEach((el) => el.addEventListener('click', () => selectTab(el.dataset.tabLink)));

document.querySelectorAll('[data-sheet]').forEach((el) => {
  el.addEventListener('click', () => {
    const [title, body] = SHEETS[el.dataset.sheet];
    $('sheet-title').textContent = title;
    $('sheet-body').textContent = body;
    $('sheet').classList.remove('hidden');
  });
});
$('sheet-close').addEventListener('click', () => $('sheet').classList.add('hidden'));
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) $('sheet').classList.add('hidden'); });

// ---------- Login ----------
// Shows a remembered ("Keep Me Logged In") number. Click it to type your own; anything works.
// Nothing typed is saved or sent anywhere, and there is no password field.

async function memberNumber() {
  let { member } = await chrome.storage.local.get('member');
  if (!member) {
    member = String(Math.floor(1000 + Math.random() * 9000));
    await chrome.storage.local.set({ member });
  }
  $('member-number').placeholder = `•••••••${member}`;
}

// The "?" sits inside the checkbox's label; clicking it shouldn't toggle the box.
document.querySelector('.keep .help').addEventListener('click', (e) => e.preventDefault());

$('member-number').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click();
});

$('login-btn').addEventListener('click', async () => {
  const btn = $('login-btn');
  if (btn.disabled) return;
  btn.disabled = true;
  $('login-error').classList.add('hidden');
  btn.innerHTML = '<span class="pending"><i></i><i></i><i></i></span>';
  attempts++;

  await sleep(between(1800, 4200));
  btn.disabled = false;
  btn.innerHTML = '<span>Log In</span>';

  // The first try fails a good share of the time. As it does.
  if (attempts === 1 && Math.random() < 0.4) {
    $('login-error').classList.remove('hidden');
    return;
  }
  attempts = 0;
  player = new AdPlayer();
  go('connecting');
  player.play().then(finishConnecting);
});

// ---------- Connecting: the sponsor video ----------

class AdPlayer {
  constructor() {
    this.elapsed = 0;
    this.stopped = false;
    this.bufferAt = between(8, 16);
    this.bufferFor = between(2, 5);
    this.buffered = 0;
    this.sound = null;
  }

  play() {
    this.render();
    $('player').classList.remove('is-buffering');
    this.dotsTimer = animateDots();
    return new Promise((resolve) => {
      let last = performance.now();
      this.timer = setInterval(() => {
        if (this.stopped) return;
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;

        const buffering = this.elapsed >= this.bufferAt && this.buffered < this.bufferFor;
        $('player').classList.toggle('is-buffering', buffering);
        if (buffering) {
          this.buffered += dt;
          this.sound?.pause();
          return;
        }
        this.sound?.resume();
        this.elapsed = Math.min(AD_SECONDS, this.elapsed + dt);
        this.render();
        if (this.elapsed >= AD_SECONDS) {
          clearInterval(this.timer);
          this.sound?.stop();
          resolve();
        }
      }, 100);
    });
  }

  render() {
    const remaining = Math.ceil(AD_SECONDS - this.elapsed);
    $('ad-time').textContent = `00:${String(remaining).padStart(2, '0')}`;
    $('ad-progress').style.width = `${(this.elapsed / AD_SECONDS) * 100}%`;

    const sceneIndex = Math.min(4, Math.floor(this.elapsed / SCENE_SECONDS));
    document.querySelectorAll('.scene').forEach((scene) => {
      scene.classList.toggle('active', Number(scene.dataset.scene) === sceneIndex);
    });

    const caption = CAPTIONS.find(([from, to]) => this.elapsed >= from && this.elapsed < to);
    const text = caption ? caption[2] : '';
    if ($('ad-caption').textContent !== text) $('ad-caption').textContent = text;
  }

  toggleSound() {
    if (this.sound) {
      this.sound.stop();
      this.sound = null;
    } else {
      this.sound = new AdMusic();
    }
    $('sound-state').textContent = this.sound ? 'On' : 'Off';
    $('sound-icon').setAttribute('href', this.sound ? '#speaker' : '#muted');
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.sound?.stop();
    this.sound = null;
    $('sound-state').textContent = 'Off';
    $('sound-icon').setAttribute('href', '#muted');
  }
}

function animateDots() {
  const dots = [...$('dots').children];
  let i = 0;
  dots.forEach((d, n) => d.classList.toggle('on', n === 0));
  return setInterval(() => {
    i = (i + 1) % dots.length;
    dots.forEach((d, n) => d.classList.toggle('on', n === i));
  }, 650);
}

function stopPlayer() {
  if (!player) return;
  player.stop();
  clearInterval(player.dotsTimer);
  player = null;
}

$('sound').addEventListener('click', () => player?.toggleSound());

async function finishConnecting() {
  if (!player || player.stopped) return;
  // The video ends. It keeps "Connecting" for a while anyway.
  $('ad-caption').textContent = '';
  await sleep(between(2500, 7000));
  if (!player || player.stopped) return;
  await chrome.runtime.sendMessage({ type: 'connect' });
  clearInterval(player.dotsTimer);
  player = null;
  go('connected');
}

// Upbeat, generic "commercial" bed, generated with Web Audio so there are no audio files.
class AdMusic {
  constructor() {
    this.ctx = new AudioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.16;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    this.out.connect(filter).connect(this.ctx.destination);

    this.beat = 60 / 112;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    // I–V–vi–IV in D
    this.chords = [[294, 370, 440], [220, 277, 330], [247, 294, 370], [196, 247, 294]];
    this.timer = setInterval(() => this.schedule(), 50);
  }

  note(freq, start, length, type, gain) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + Math.min(0.03, length / 3));
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(env).connect(this.out);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  kick(start) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.18);
    env.gain.setValueAtTime(0.7, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(env).connect(this.out);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  schedule() {
    const eighth = this.beat / 2;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const chord = this.chords[Math.floor(this.step / 16) % 4];
      if (this.step % 16 === 0) chord.forEach((f) => this.note(f, this.nextTime, this.beat * 8, 'sine', 0.12));
      if (this.step % 4 === 0) this.kick(this.nextTime);
      this.note(chord[this.step % 3] * 2, this.nextTime, eighth * 0.9, 'triangle', 0.08);
      this.nextTime += eighth;
      this.step++;
    }
  }

  pause() { if (this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
  stop() { clearInterval(this.timer); this.ctx.close(); }
}

// ---------- Connected ----------

$('browse').addEventListener('click', () => {
  const destination = sessionStorage.getItem(CONTINUE_KEY);
  sessionStorage.removeItem(CONTINUE_KEY);
  location.href = destination || 'https://www.google.com/';
});

// ---------- Boot ----------
// Starting a session (or coming back after it expired) begins on a spinner for 5-7 seconds,
// then the page fades in. Any other load of the portal shows up straight away.

async function boot() {
  await loadState();
  show(location.hash.slice(1));
  const { splash } = await chrome.storage.local.get('splash');
  if (!splash) {
    $('splash').remove();
    document.body.classList.add('booted');
    return;
  }
  await chrome.storage.local.set({ splash: false });
  document.body.classList.add('splashing');
  await sleep(between(5000, 7000));
  document.body.classList.add('booted');
  setTimeout(() => $('splash').remove(), 800);
}

renderFlight();
memberNumber();
boot();
