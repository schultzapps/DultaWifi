// One consistent, plausible flight per session, shared by the portal and the popup.

const AIRPORTS = {
  ATL: ['Atlanta', 'America/New_York'],
  BOS: ['Boston', 'America/New_York'],
  DTW: ['Detroit', 'America/Detroit'],
  JFK: ['New York-JFK', 'America/New_York'],
  LAX: ['Los Angeles', 'America/Los_Angeles'],
  MCO: ['Orlando', 'America/New_York'],
  MSP: ['Minneapolis', 'America/Chicago'],
  SEA: ['Seattle', 'America/Los_Angeles'],
  SFO: ['San Francisco', 'America/Los_Angeles'],
  SLC: ['Salt Lake City', 'America/Denver']
};

// [from, to, block minutes, miles]
const ROUTES = [
  ['ATL', 'LAX', 290, 1946],
  ['DTW', 'SEA', 295, 1927],
  ['MSP', 'BOS', 165, 1124],
  ['JFK', 'SLC', 310, 1990],
  ['ATL', 'SEA', 320, 2182],
  ['LAX', 'JFK', 330, 2475],
  ['SLC', 'ATL', 225, 1590],
  ['BOS', 'ATL', 160, 946],
  ['MSP', 'SFO', 250, 1589],
  ['DTW', 'MCO', 155, 957]
];

async function getFlight() {
  const { flight } = await chrome.storage.local.get('flight');
  if (flight) return flight;

  const [from, to, minutes, miles] = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  const created = {
    number: `DL${Math.floor(300 + Math.random() * 2600)}`,
    from, to, miles,
    departedAt: Date.now() - (35 + Math.random() * 25) * 60_000,
    durationMs: minutes * 60_000
  };
  await chrome.storage.local.set({ flight: created });
  return created;
}

function localTime(ms, airport) {
  return new Date(ms)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: AIRPORTS[airport][1] })
    .replace(' ', '')
    .toLowerCase();
}

function flightStats(flight) {
  const elapsed = Date.now() - flight.departedAt;
  const progress = Math.min(0.97, Math.max(0.03, elapsed / flight.durationMs));
  const remainingMin = Math.max(6, Math.round((flight.durationMs - elapsed) / 60_000));
  const jitter = (n) => Math.round((Math.random() - 0.5) * n);
  return {
    progress,
    remaining: remainingMin >= 60 ? `${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m` : `${remainingMin}m`,
    departs: localTime(flight.departedAt, flight.from),
    arrives: localTime(flight.departedAt + flight.durationMs, flight.to),
    localTimeAtDestination: localTime(Date.now(), flight.to),
    altitude: `${(36000 + jitter(4) * 100).toLocaleString()} ft`,
    groundSpeed: `${512 + jitter(24)} mph`,
    outsideTemp: `${-54 + jitter(6)}°F`,
    milesToGo: `${Math.round(flight.miles * (1 - progress)).toLocaleString()} mi`
  };
}

// Fills every element carrying data-flight="key" and keeps them current.
async function renderFlight() {
  const flight = await getFlight();
  const paint = () => {
    const stats = flightStats(flight);
    const values = {
      ...stats,
      number: flight.number,
      from: flight.from,
      to: flight.to,
      fromCity: AIRPORTS[flight.from][0],
      toCity: AIRPORTS[flight.to][0]
    };
    document.querySelectorAll('[data-flight]').forEach((el) => {
      el.textContent = values[el.dataset.flight] ?? '';
    });
    document.querySelectorAll('[data-flight-progress]').forEach((el) => {
      el.style.setProperty('--progress', stats.progress);
    });
  };
  paint();
  setInterval(paint, 20_000);
}
