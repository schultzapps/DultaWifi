// Look-alikes of Chrome's own network error pages and captive-portal interstitial.
// The page is replaced in place at document_start, so the address bar keeps the real URL,
// just like a real Chrome error page. Strings match Chrome's English strings.
// All markup, icons and the runner game are original; nothing is copied from Chromium.

(() => {
  if (globalThis.DultaWifiChromePages) return;

  const CSS = `
    :root {
      --bg: #fff; --text: #5f6368; --heading: #202124; --code: #5f6368;
      --primary: #0b57d0; --primary-text: #fff; --link: #0b57d0; --icon: #757575;
      --secondary-border: #c4c7c5;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #202124; --text: #9aa0a6; --heading: #e8eaed; --code: #9aa0a6;
        --primary: #a8c7fa; --primary-text: #062e6f; --link: #a8c7fa; --icon: #9aa0a6;
        --secondary-border: #5f6368;
      }
      #dw-runner { filter: invert(1) hue-rotate(180deg); }
    }
    html, body { margin: 0; padding: 0; background: var(--bg); }
    body {
      color: var(--text); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 75%; word-wrap: break-word; -webkit-text-size-adjust: 100%;
    }
    .interstitial-wrapper {
      box-sizing: border-box; font-size: 1.25em; line-height: 1.6em;
      margin: 14vh auto 0; max-width: 600px; width: 100%;
    }
    @media (max-width: 700px) { .interstitial-wrapper { padding: 0 10%; } }
    .icon { width: 72px; height: 72px; margin: 0 0 40px; color: var(--icon); }
    .icon svg { width: 72px; height: 72px; display: block; }
    h1 { color: var(--heading); font-size: 1.6em; font-weight: normal; line-height: 1.25em; margin: 0 0 16px; }
    p { margin: 0; }
    ul { margin: 0; padding-inline-start: 40px; }
    #suggestions-list { margin-top: 15px; }
    #suggestions-list p { margin-block-end: 0; }
    #suggestions-list ul { margin-top: 12px; }
    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .error-code { color: var(--code); font-size: 0.86667em; margin-top: 15px; text-transform: uppercase; display: block; }
    .nav-wrapper { margin-top: 51px; }
    .nav-wrapper::after { clear: both; content: ""; display: table; width: 100%; }
    button {
      border: 0; border-radius: 20px; box-sizing: border-box; cursor: pointer;
      font-family: inherit; font-size: 0.875em; font-weight: 500; line-height: 20px;
      margin: 0; padding: 8px 16px; user-select: none;
    }
    .primary { background: var(--primary); color: var(--primary-text); float: right; }
    .left { float: left; }
    .secondary { background: transparent; color: var(--link); border: 1px solid var(--secondary-border); float: right; }
    #details { margin: 45px 0 50px; }
    #details .header { color: var(--heading); font-weight: 500; }
    #details .body { margin: 4px 0 20px; }
    .hidden { display: none !important; }
    #dw-runner { display: block; margin: 0 0 30px; height: 150px; outline: none; image-rendering: pixelated; }
  `;

  const ICON_PAGE = `
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <path d="M18 8h26l14 14v42H18z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
      <path d="M44 8v14h14" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="30" cy="37" r="3" fill="currentColor"/><circle cx="46" cy="37" r="3" fill="currentColor"/>
      <path d="M28 52c5-6 15-6 20 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

  const ICON_WIFI = `
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <path d="M8 28a40 40 0 0 1 56 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M17 38a27 27 0 0 1 38 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M26 48a14 14 0 0 1 20 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <circle cx="36" cy="58" r="5" fill="currentColor"/>
    </svg>`;

  function takeover(title, body) {
    window.stop();
    let html = document.documentElement;
    if (!html) {
      html = document.createElement('html');
      document.appendChild(html);
    }
    html.setAttribute('lang', 'en');
    html.setAttribute('dir', 'ltr');
    html.removeAttribute('class');
    html.removeAttribute('style');
    html.innerHTML = `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><title></title><style>${CSS}</style></head><body>${body}</body>`;
    document.title = title;
  }

  const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // When the "connection" comes back, Chrome reloads its error pages by itself.
  function reloadWhenOnline(modes) {
    let reloading = false;
    const check = async () => {
      const { connected, mode } = await chrome.storage.local.get(['connected', 'mode']);
      if (!reloading && (!connected || !modes.includes(mode))) {
        reloading = true;
        location.reload();
      }
    };
    chrome.storage.onChanged.addListener(check);
    setInterval(check, 4000);
  }

  // ---------- ERR_CONNECTION_TIMED_OUT ----------

  function timeout() {
    const host = escape(location.hostname);
    takeover(location.hostname, `
      <div class="interstitial-wrapper">
        <div id="main-content">
          <div class="icon">${ICON_PAGE}</div>
          <div id="main-message">
            <h1><span>This site can&rsquo;t be reached</span></h1>
            <p><strong>${host}</strong> took too long to respond.</p>
            <div id="suggestions-list">
              <p>Try:</p>
              <ul>
                <li>Checking the connection</li>
                <li><a href="#buttons" class="toggle-details">Checking the proxy and the firewall</a></li>
              </ul>
            </div>
            <div class="error-code">ERR_CONNECTION_TIMED_OUT</div>
          </div>
        </div>
        <div id="buttons" class="nav-wrapper">
          <button id="reload-button" class="primary left">Reload</button>
          <button id="details-button" class="secondary">Details</button>
        </div>
        <div id="details" class="hidden">
          <div class="header">Check your Internet connection</div>
          <div class="body">Check any cables and reboot any routers, modems, or other network devices you may be using.</div>
          <div class="header">Allow Chrome to access the network in your firewall or antivirus settings.</div>
          <div class="body">If it is already listed as a program allowed to access the network, try removing it from the list and adding it again.</div>
          <div class="header">If you use a proxy server&hellip;</div>
          <div class="body">Check your proxy settings or contact your network administrator to make sure the proxy server is working. If you don&rsquo;t believe you should be using a proxy server: Go to Applications &gt; System Settings &gt; Network, select the active network, click the Details&hellip; button, and deselect any proxies that may have been selected.</div>
        </div>
      </div>`);

    const toggle = (e) => {
      e?.preventDefault();
      const details = document.getElementById('details');
      details.classList.toggle('hidden');
      document.getElementById('details-button').textContent = details.classList.contains('hidden') ? 'Details' : 'Hide details';
    };
    document.getElementById('details-button').addEventListener('click', toggle);
    document.querySelector('.toggle-details').addEventListener('click', toggle);
    document.getElementById('reload-button').addEventListener('click', () => location.reload());
    reloadWhenOnline(['outage']);
  }

  // ---------- DNS_PROBE_FINISHED_NO_INTERNET (with the runner game) ----------

  function noInternet() {
    takeover(location.hostname, `
      <div class="interstitial-wrapper">
        <canvas id="dw-runner" tabindex="0" aria-label="Runner game. Press space to play."></canvas>
        <div id="main-content">
          <div id="main-message">
            <h1><span>No internet</span></h1>
            <div id="suggestions-list">
              <p>Try:</p>
              <ul>
                <li>Checking the network cables, modem, and router</li>
                <li>Reconnecting to Wi-Fi</li>
              </ul>
            </div>
            <div class="error-code">DNS_PROBE_FINISHED_NO_INTERNET</div>
          </div>
        </div>
      </div>`);
    startRunner(document.getElementById('dw-runner'));
    reloadWhenOnline(['outage']);
  }

  // ---------- Captive portal: "Connect to Wi-Fi" ----------

  function captive() {
    takeover('Connect to Wi-Fi', `
      <div class="interstitial-wrapper">
        <div id="main-content">
          <div class="icon">${ICON_WIFI}</div>
          <div id="main-message">
            <h1>Connect to Wi-Fi</h1>
            <p>The Wi-Fi you are using (DultaWiFi.com) may require you to visit its login page.</p>
          </div>
        </div>
        <div class="nav-wrapper">
          <button id="primary-button" class="primary">Connect</button>
        </div>
      </div>`);
    document.getElementById('primary-button').addEventListener('click', () => {
      window.open('https://dultawifi.com/', '_blank');
    });
    reloadWhenOnline(['expired']);
  }

  // ---------- The runner game ----------
  // Pixel art drawn on a grid; '#' is a filled pixel.

  const SPRITES = {
    dinoTop: [
      '...........########.',
      '..........##.#######',
      '..........##########',
      '..........##########',
      '..........##########',
      '..........#####.....',
      '..........########..',
      '#........#####......',
      '#.......######......',
      '##.....#########....',
      '###...######..#.....',
      '##############......',
      '.#############......',
      '..###########.......',
      '...#########........',
      '....#######.........'
    ],
    legsStand: ['.....###.##.........', '.....##...#.........', '.....#....#.........', '.....##...##........'],
    legsA: ['.....###.###........', '.....##.............', '.....#..............', '.....##.............'],
    legsB: ['.....######.........', '..........#.........', '..........#.........', '..........##........'],
    dead: [
      '...........########.',
      '..........#...######',
      '..........#.#.######',
      '..........#...######',
      '..........##########',
      '..........#####.....',
      '..........########..',
      '#........#####......',
      '#.......######......',
      '##.....#########....',
      '###...######..#.....',
      '##############......',
      '.#############......',
      '..###########.......',
      '...#########........',
      '....#######.........',
      '.....###.##.........',
      '.....##...#.........',
      '.....#....#.........',
      '.....##...##........'
    ],
    cactusSmall: [
      '...##...', '..####..', '..####..', '..####.#', '#.####.#', '#.####.#', '#.####.#', '#.######',
      '#.####..', '######..', '..####..', '..####..', '..####..', '..####..', '..####..', '..####..', '..####..'
    ],
    cactusLarge: [
      '.....##.....', '....####....', '....####....', '....####..##', '##..####..##', '##..####..##',
      '##..####..##', '##..####..##', '##..########', '##..#######.', '##..####....', '########....',
      '.#######....', '....####....', '....####....', '....####....', '....####....', '....####....',
      '....####....', '....####....', '....####....', '....####....', '....####....', '....####....'
    ],
    cloud: [
      '.........######.........', '.......##......##.......', '.....##..........###....', '..###...............##..',
      '.#....................#.', '########################'
    ]
  };

  const FONT = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
    6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '001', '001'], 8: ['111', '101', '111', '101', '111'],
    9: ['111', '101', '111', '001', '111'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
    G: ['111', '100', '101', '101', '111'], A: ['111', '101', '111', '101', '101'], M: ['101', '111', '111', '101', '101'],
    E: ['111', '100', '111', '100', '111'], O: ['111', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
    R: ['110', '101', '110', '101', '101']
  };

  function startRunner(canvas) {
    const ctx = canvas.getContext('2d');
    const INK = '#535353';
    const CLOUD = '#dadada';
    const S = 2; // pixel scale
    const H = 150;
    const GROUND = 140;
    let width = 600;

    const resize = () => {
      width = Math.min(600, canvas.parentElement.clientWidth);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${width}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', () => { resize(); draw(); });

    const sprite = (rows, x, y, color = INK, scale = S) => {
      ctx.fillStyle = color;
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === '#') ctx.fillRect(Math.round(x + c * scale), Math.round(y + r * scale), scale, scale);
        }
      });
    };

    const text = (str, x, y) => {
      let cx = x;
      for (const ch of str) {
        if (FONT[ch]) {
          FONT[ch].forEach((row, r) => {
            for (let c = 0; c < 3; c++) if (row[c] === '1') ctx.fillRect(cx + c * 2, y + r * 2, 2, 2);
          });
        }
        cx += 10;
      }
    };

    const DINO_W = 20 * S;
    const DINO_H = 20 * S;
    let hi = 0;
    let g;

    const reset = () => {
      g = {
        status: 'waiting', // waiting | intro | running | over
        dinoY: GROUND - DINO_H,
        vy: 0,
        speed: 6,
        distance: 0,
        frame: 0,
        groundX: 0,
        introWidth: DINO_W + 30,
        obstacles: [],
        nextGap: 300,
        clouds: [{ x: 420, y: 30 }, { x: 160, y: 55 }],
        last: performance.now()
      };
    };
    reset();

    const jump = () => {
      if (g.status === 'waiting') { g.status = 'intro'; g.vy = -10; requestAnimationFrame(loop); return; }
      if (g.status === 'over') {
        if (performance.now() - g.overAt < 600) return;
        reset(); g.status = 'running'; g.last = performance.now(); requestAnimationFrame(loop); return;
      }
      if (g.dinoY >= GROUND - DINO_H - 0.5) g.vy = -10;
    };

    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    document.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', jump);

    const spawn = () => {
      const large = Math.random() < 0.4;
      const count = 1 + Math.floor(Math.random() * (g.speed > 8 ? 3 : 2));
      const rows = large ? SPRITES.cactusLarge : SPRITES.cactusSmall;
      const w = rows[0].length * S;
      const h = rows.length * S;
      g.obstacles.push({ x: width + 10, rows, w: w * count - (count - 1) * 2, h, count, unit: w });
      g.nextGap = Math.max(240, (200 + Math.random() * 300) * (g.speed / 6));
    };

    const collides = (o) => {
      const pad = 6;
      const dx1 = 20 + pad, dx2 = 20 + DINO_W - pad;
      const dy1 = g.dinoY + pad, dy2 = g.dinoY + DINO_H - pad;
      const ox1 = o.x + 3, ox2 = o.x + o.w - 3;
      const oy1 = GROUND - o.h + 3, oy2 = GROUND;
      return dx1 < ox2 && dx2 > ox1 && dy1 < oy2 && dy2 > oy1;
    };

    function update(dt) {
      const step = dt / (1000 / 60);
      g.frame += step;

      g.vy += 0.6 * step;
      g.dinoY = Math.min(GROUND - DINO_H, g.dinoY + g.vy * step);
      if (g.dinoY >= GROUND - DINO_H) g.vy = 0;

      if (g.status === 'intro') {
        g.introWidth = Math.min(width, g.introWidth + 12 * step);
        if (g.introWidth >= width && g.dinoY >= GROUND - DINO_H) g.status = 'running';
        return;
      }

      g.speed = Math.min(13, g.speed + 0.001 * step);
      const move = g.speed * step;
      g.distance += move;
      g.groundX = (g.groundX + move) % 24;

      g.clouds.forEach((c) => { c.x -= move * 0.2; });
      g.clouds = g.clouds.filter((c) => c.x > -60);
      if (g.clouds.length < 3 && Math.random() < 0.004 * step) g.clouds.push({ x: width + 20, y: 20 + Math.random() * 50 });

      g.obstacles.forEach((o) => { o.x -= move; });
      g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10);
      const lastObstacle = g.obstacles[g.obstacles.length - 1];
      if (g.distance > 400 && (!lastObstacle || width - (lastObstacle.x + lastObstacle.w) > g.nextGap)) spawn();

      if (g.obstacles.some(collides)) {
        g.status = 'over';
        g.overAt = performance.now();
        hi = Math.max(hi, Math.floor(g.distance * 0.025));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, H);
      ctx.fillStyle = INK;

      if (g.status !== 'waiting') {
        g.clouds.forEach((c) => sprite(SPRITES.cloud, c.x, c.y, CLOUD, 2));
        const groundWidth = g.status === 'intro' ? g.introWidth : width;
        ctx.fillRect(0, GROUND - 2, groundWidth, 1);
        for (let x = -g.groundX; x < groundWidth; x += 24) {
          ctx.fillRect(x + 4, GROUND + 2, 2, 1);
          ctx.fillRect(x + 15, GROUND + 5, 3, 1);
        }
        g.obstacles.forEach((o) => {
          for (let i = 0; i < o.count; i++) sprite(o.rows, o.x + i * (o.unit - 2), GROUND - o.h);
        });
      }

      const dinoX = 20;
      if (g.status === 'over') {
        sprite(SPRITES.dead, dinoX, g.dinoY);
      } else {
        sprite(SPRITES.dinoTop, dinoX, g.dinoY);
        const airborne = g.dinoY < GROUND - DINO_H - 0.5;
        const legs = g.status !== 'running' || airborne ? SPRITES.legsStand : (Math.floor(g.frame / 6) % 2 ? SPRITES.legsA : SPRITES.legsB);
        sprite(legs, dinoX, g.dinoY + 16 * S);
      }

      if (g.status === 'running' || g.status === 'over') {
        const score = String(Math.floor(g.distance * 0.025)).padStart(5, '0').slice(-5);
        const scoreText = hi ? `HI ${String(hi).padStart(5, '0')}  ${score}` : score;
        ctx.fillStyle = INK;
        text(scoreText, width - scoreText.length * 10 - 10, 6);
      }

      if (g.status === 'over') {
        const msg = 'GAME OVER';
        const w = msg.length * 14;
        let x = (width - w) / 2;
        for (const ch of msg) { if (ch !== ' ') text(ch, x, 42); x += 14; }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, 82, 10, 0.3, Math.PI * 1.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width / 2 + 10, 66);
        ctx.lineTo(width / 2 + 10, 76);
        ctx.lineTo(width / 2 + 1, 76);
        ctx.fillStyle = INK;
        ctx.fill();
      }
    }

    function loop(now) {
      const dt = Math.min(50, now - g.last);
      g.last = now;
      update(dt);
      draw();
      if (g.status === 'intro' || g.status === 'running') requestAnimationFrame(loop);
    }

    draw();
  }

  globalThis.DultaWifiChromePages = { timeout, noInternet, captive };
})();
