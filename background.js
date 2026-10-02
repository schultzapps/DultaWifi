// DultaWifi background: runs the "flight" and decides when the Wi-Fi misbehaves.
//
// State (chrome.storage.local):
//   enabled      – the popup's on/off switch. While on and not logged in, every website
//                  redirects to the portal, exactly like a real captive portal.
//   connected    – the user got through the portal
//   mode         – 'clear' | 'normal' | 'throttle' | 'outage' | 'expired'
//   flightEndsAt – epoch ms; the simulation switches itself off at this point
//   opening      – what's left of the opening act (see OPENING_ACT)
//   splash       – the next portal load shows the "Connecting" spinner first. Set when a session
//                  starts and when the session expires; the portal clears it.

const SIM_MINUTES = 60;              // the whole thing turns itself off after this
const HONEYMOON_MINUTES = [0.5, 2];  // right after connecting it's perfect. Enjoy it.
const CLEAR_MINUTES = [10, 20];      // a long stretch where it just works, no lag at all
const CALM_MINUTES = [2, 5];         // works, with a little satellite lag
const ROUGH_GAP_MINUTES = [0.5, 1];  // barely recovers before the next problem
const ROUGH_PATCH_CHANCE = 0.25;
const CLEAR_STREAK_CHANCE = 0.35;
const SLOW_MINUTES = [1, 3];         // "throttle": everything crawls
const OUTAGE_MINUTES = [0.5, 1.5];
const INCIDENTS = [['throttle', 0.55], ['outage', 0.3], ['expired', 0.15]];

// Most people try this for a few minutes, so the first ~5 minutes run every headache once:
// honeymoon -> slow -> outage -> session expires. After you log back in, things space out.
const OPENING_ACT = ['throttle', 'outage', 'expired'];
const OPENING_GAP_MINUTES = [0.5, 0.75];       // laggy-but-working breather between them
const OPENING_INCIDENT_MINUTES = [0.5, 0.75];  // how long the opening slow spell and outage last
// (0.5 minutes is the shortest timer Chrome gives extensions.)

const BLOCK_RULE_ID = 100;
const PORTAL_REDIRECT_RULE_ID = 101;
const INCIDENT_SCRIPT_ID = 'dw-incident';
const INCIDENT_SCRIPTS = {
  timeout: 'incident-timeout.js',
  nointernet: 'incident-nointernet.js',
  expired: 'incident-captive.js'
};

const rand = ([min, max]) => min + Math.random() * (max - min);

function pickIncident() {
  let roll = Math.random();
  for (const [kind, weight] of INCIDENTS) {
    if ((roll -= weight) < 0) return kind;
  }
  return 'throttle';
}

// Alarms and messages can arrive together; apply state changes one at a time.
let queue = Promise.resolve();
const serial = (fn) => (...args) => (queue = queue.then(() => fn(...args)).catch(console.error));

async function getState() {
  const defaults = { enabled: false, connected: false, mode: 'normal', flightEndsAt: 0 };
  return { ...defaults, ...(await chrome.storage.local.get(null)) };
}

// Applies the current state to the network:
// - on but not logged in: every page you open goes to the portal, which remembers where you
//   were headed (?continue=), and nothing else loads
// - outage / expired session: sub-resources fail, and any page you open is replaced by the
//   matching Chrome error page (see chrome-pages.js)
async function applyNetwork() {
  const { enabled, connected, mode } = await getState();
  const captive = enabled && !connected;
  const incident = connected && (mode === 'outage' || mode === 'expired');

  const addRules = [];
  if (captive || incident) {
    addRules.push({
      id: BLOCK_RULE_ID,
      priority: 1,
      action: { type: 'block' },
      condition: { excludedResourceTypes: ['main_frame'], excludedRequestDomains: ['dultawifi.com'] }
    });
  }
  if (captive) {
    addRules.push({
      id: PORTAL_REDIRECT_RULE_ID,
      priority: 1,
      action: { type: 'redirect', redirect: { regexSubstitution: `${chrome.runtime.getURL('portal.html')}?continue=\\0` } },
      condition: { regexFilter: '^https?://.*', resourceTypes: ['main_frame'], excludedRequestDomains: ['dultawifi.com'] }
    });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID, PORTAL_REDIRECT_RULE_ID],
    addRules
  });

  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [INCIDENT_SCRIPT_ID] });
  if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: [INCIDENT_SCRIPT_ID] });
  if (!incident) return;

  const variant = mode === 'expired' ? 'expired' : (Math.random() < 0.6 ? 'timeout' : 'nointernet');
  await chrome.scripting.registerContentScripts([{
    id: INCIDENT_SCRIPT_ID,
    js: ['chrome-pages.js', INCIDENT_SCRIPTS[variant]],
    matches: ['http://*/*', 'https://*/*'],
    excludeMatches: ['*://dultawifi.com/*', '*://*.dultawifi.com/*'],
    runAt: 'document_start',
    persistAcrossSessions: false
  }]);
}

async function setMode(mode) {
  await chrome.storage.local.set({ mode });
  await applyNetwork();
}

// The good part between incidents. Its length and quality vary so the bad parts are never predictable.
async function calm({ honeymoon = false, steady = false } = {}) {
  const { opening = [] } = await chrome.storage.local.get('opening');
  let mode = 'normal';
  let minutes;
  if (honeymoon) {
    mode = 'clear';
    minutes = rand(HONEYMOON_MINUTES);
  } else if (!steady && opening.length) {
    minutes = rand(OPENING_GAP_MINUTES);
  } else if (!steady && Math.random() < ROUGH_PATCH_CHANCE) {
    minutes = rand(ROUGH_GAP_MINUTES);
  } else if (!steady && Math.random() < CLEAR_STREAK_CHANCE) {
    mode = 'clear';
    minutes = rand(CLEAR_MINUTES);
  } else {
    minutes = rand(CALM_MINUTES);
  }
  await setMode(mode);
  chrome.alarms.create('incident', { delayInMinutes: minutes });
}

// ---------- Actions ----------

// The popup switch. Nothing happens until you open a website.
async function enable() {
  await chrome.storage.local.set({ enabled: true, splash: true });
  await applyNetwork();
}

async function connect() {
  const state = await getState();
  if (!state.connected) {
    await chrome.storage.local.set({
      enabled: true,
      connected: true,
      flightEndsAt: Date.now() + SIM_MINUTES * 60_000,
      opening: OPENING_ACT
    });
    chrome.alarms.create('landing', { delayInMinutes: SIM_MINUTES });
  }
  await chrome.alarms.clear('incident');
  await chrome.alarms.clear('recover');
  await calm({ honeymoon: !state.connected });
}

// Off switch (popup toggle, shortcut, 60-minute timer, Chrome restart). Everything goes back to normal.
async function land() {
  await chrome.alarms.clearAll();
  await chrome.storage.local.set({ enabled: false, connected: false, flightEndsAt: 0, opening: [], splash: true });
  await chrome.storage.local.remove('flight');
  await setMode('normal');
}

async function startIncident(kind) {
  const state = await getState();
  if (!state.connected) return;
  if (Date.now() >= state.flightEndsAt) return land();

  await chrome.alarms.clear('incident');
  await chrome.alarms.clear('recover');

  // Scheduled incidents work through the opening act first; popup triggers pass a kind and skip it.
  let scripted = false;
  if (!kind) {
    const { opening = [] } = await chrome.storage.local.get('opening');
    if (opening.length) {
      kind = opening[0];
      scripted = true;
      await chrome.storage.local.set({ opening: opening.slice(1) });
    }
  }
  kind ||= pickIncident();
  if (kind === 'expired') await chrome.storage.local.set({ splash: true });
  await setMode(kind);

  // An expired session stays expired until you log in again on the portal.
  if (kind !== 'expired') {
    const range = scripted ? OPENING_INCIDENT_MINUTES : kind === 'outage' ? OUTAGE_MINUTES : SLOW_MINUTES;
    chrome.alarms.create('recover', { delayInMinutes: rand(range) });
  }
}

// `manual` comes from the popup's "Back to normal" button, which should do exactly that.
async function recover(manual) {
  const state = await getState();
  if (!state.connected) return;
  await chrome.alarms.clear('recover');
  await calm({ steady: manual === true });
}

const actions = {
  enable: serial(enable),
  connect: serial(connect),
  land: serial(land),
  incident: serial(startIncident),
  recover: serial(recover)
};

// ---------- Wiring ----------

chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === 'incident') actions.incident();
  if (name === 'recover') actions.recover();
  if (name === 'landing') actions.land();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const action = actions[msg?.type];
  if (!action) return false;
  action(msg.value).then(() => sendResponse({ ok: true }));
  return true; // keep the channel open for the async response
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'emergency-landing') actions.land();
});

// Install, update, or browser restart: start on the ground.
const boot = serial(land);
chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);
