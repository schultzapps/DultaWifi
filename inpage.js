// Runs in the page's own JavaScript world so it can slow down the page's network calls.
// It can't read extension storage, so it follows the data-dw-mode attribute set by content.js.
(() => {
  const mode = () => document.documentElement?.getAttribute('data-dw-mode') || 'off';
  const between = (min, max) => min + Math.random() * (max - min);

  // How a request to `url` should behave right now.
  function plan(url) {
    if (!/^https?:/i.test(url)) return null;
    switch (mode()) {
      case 'normal':
        return { delay: between(80, 400) }; // satellite latency
      case 'throttle':
        return Math.random() < 0.1
          ? { delay: between(12000, 22000), fail: true } // the occasional request that just dies
          : { delay: between(1200, 5000) };
      case 'outage':
      case 'expired':
        return { delay: between(8000, 20000) }; // hangs, then the network block makes it fail
      default:
        return null; // 'off', or 'clear' when it just works
    }
  }

  const resolveUrl = (value) => {
    try { return new URL(value, location.href).href; } catch { return ''; }
  };

  const wait = (ms, signal) => new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('The user aborted a request.', 'AbortError'));
    if (signal?.aborted) return abort();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); abort(); }, { once: true });
  });

  // fetch
  const nativeFetch = window.fetch;
  window.fetch = function fetch(input, init) {
    const plan_ = plan(resolveUrl(input instanceof Request ? input.url : String(input)));
    if (!plan_) return nativeFetch.call(window, input, init);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return wait(plan_.delay, signal).then(() => {
      if (plan_.fail) throw new TypeError('Failed to fetch');
      return nativeFetch.call(window, input, init);
    });
  };

  // XMLHttpRequest (async only; sync requests can't be delayed without freezing the page)
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, async) {
    this.__dw = { url: resolveUrl(String(url)), async: arguments.length < 3 || async !== false };
    return nativeOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const plan_ = this.__dw?.async ? plan(this.__dw.url) : null;
    if (!plan_) return nativeSend.call(this, body);
    setTimeout(() => {
      try { nativeSend.call(this, body); } catch { /* aborted while waiting */ }
    }, plan_.delay);
  };

  // WebSockets drop when the connection does (chat apps go to "Reconnecting…").
  const NativeWebSocket = window.WebSocket;
  const sockets = new Set();
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(target, args) {
      const socket = Reflect.construct(target, args);
      sockets.add(socket);
      socket.addEventListener('close', () => sockets.delete(socket));
      return socket;
    }
  });

  let lastMode = mode();
  new MutationObserver(() => {
    const current = mode();
    if (current !== lastMode && (current === 'outage' || current === 'expired')) {
      sockets.forEach((socket) => { try { socket.close(4000, 'Network unreachable'); } catch { /* already closed */ } });
    }
    lastMode = current;
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-dw-mode'] });
})();
