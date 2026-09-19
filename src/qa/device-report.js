// Device QA mode for the owner's physical-device sessions.
//
// Does NOTHING unless the URL carries `?qa=<code>` (letters, digits, `_` and `-`, up to 96 characters).
// Tip for the orchestrator: issue the candidate manifest SHA-256 as the code (optionally followed by
// `-<device>`), so the pasted report references its candidate by itself in the evidence lint.
//
// With the flag it records, with negligible overhead (one requestAnimationFrame callback that increments a
// histogram bin; everything else is event driven): frame-time percentiles per minute (p50/p95/p99, frames
// longer than 50 ms), long tasks, orientation changes, env(safe-area-inset-*), viewport sizes, user agent,
// the WebGL renderer string, AudioContext state transitions and visibility changes. A small
// "Copiar relatório QA" button copies a compact JSON to the clipboard.
//
// Isolation: imports nothing, never touches gameplay state, never reads src/main.js internals.

function startDeviceReport(code) {
  const startedAtMs = performance.now();
  const startedAt = new Date().toISOString();
  const seconds = () => Math.round(performance.now() - startedAtMs) / 1000;
  const LIMIT = 60;
  const keep = (list, entry, limit = LIMIT) => { if (list.length < limit) list.push(entry); else list.dropped = (list.dropped ?? 0) + 1; };
  const withDropped = (list) => ({ entries: [...list], dropped: list.dropped ?? 0 });

  // ---- Frame times: 0.5 ms histogram bins up to 200 ms, last bin is overflow. ---------------------------
  const BIN_MS = 0.5;
  const BINS = 400;
  const LONG_FRAME_MS = 50;
  const newWindow = () => ({ bins: new Uint32Array(BINS), frames: 0, sumMs: 0, long: 0, maxMs: 0, over10Ms: 0, over16_7Ms: 0, over33Ms: 0, over50Ms: 0, startedMs: performance.now(), hiddenMs: 0 });
  let minute = newWindow();
  const total = newWindow();
  const minutes = [];
  let lastFrame = 0;
  let activeLastFrame = 0;
  let hiddenSince = document.hidden ? performance.now() : 0;

  // Premium frames are kept in a separate, event-observed window. The legacy
  // total above intentionally remains untouched for historical reports; it can
  // include boot/menu/loading frames and is never promoted by a scenario label.
  const newGameplayWindow = () => ({ bins: new Uint32Array(BINS), frames: 0, sumMs: 0, long: 0, maxMs: 0, over10Ms: 0, over16_7Ms: 0, over33Ms: 0, over50Ms: 0, startedMs: null, endMs: null, activeMs: 0, lastActiveMs: null, startReason: null, endReason: null });
  const gameplay = { active: false, current: null, windows: [], total: newGameplayWindow(), transitions: 0,
    observedBy: ['bipx:qa-gameplay-state', 'visibilitychange', 'pagehide', 'pageshow'] };
  const recordFrame = (window, delta) => {
    const bin = delta >= BINS * BIN_MS ? BINS - 1 : Math.max(0, Math.floor(delta / BIN_MS));
    window.bins[bin] += 1; window.frames += 1; window.sumMs += delta;
    if (delta > 10) window.over10Ms += 1;
    if (delta > 16.7) window.over16_7Ms += 1;
    if (delta > 33) window.over33Ms += 1;
    if (delta > 50) window.over50Ms += 1;
    if (delta > LONG_FRAME_MS) window.long += 1;
    if (delta > window.maxMs) window.maxMs = delta;
  };
  const finishGameplayWindow = (window, nowMs, reason) => {
    if (!window) return;
    if (window.lastActiveMs !== null) window.activeMs += Math.max(0, nowMs - window.lastActiveMs);
    window.lastActiveMs = null; window.endMs = nowMs; window.endReason = reason;
  };
  const setGameplayActive = (active, reason) => {
    const nowMs = performance.now();
    if (Boolean(active) === gameplay.active) return;
    gameplay.active = Boolean(active); gameplay.transitions += 1;
    if (gameplay.active) {
      const window = newGameplayWindow(); window.startedMs = nowMs; window.lastActiveMs = nowMs; window.startReason = reason;
      gameplay.current = window;
      if (gameplay.total.startedMs === null) gameplay.total.startedMs = nowMs;
      gameplay.total.lastActiveMs = nowMs;
    } else {
      // Close the rAF interval at the observed transition; do not bridge a
      // pause/hidden gap into the next active window.
      activeLastFrame = 0;
      finishGameplayWindow(gameplay.current, nowMs, reason);
      if (gameplay.current?.frames > 0) gameplay.windows.push(gameplay.current);
      gameplay.current = null;
      finishGameplayWindow(gameplay.total, nowMs, reason);
    }
  };
  let latestBridge = null;
  const consumeGameplayBridge = (detail, reason = 'bipx:qa-gameplay-state') => {
    const valid = detail?.producer === 'bipx-qa-gameplay-state' && detail?.version === 1
      && typeof detail.gameState === 'string' && typeof detail.paused === 'boolean'
      && typeof detail.characterLoading === 'boolean' && typeof detail.isMultiplayerSuspended === 'boolean';
    if (!valid) { latestBridge = null; setGameplayActive(false, `${reason}:bridge-unavailable`); return; }
    latestBridge = detail;
    const active = !document.hidden && detail.gameState === 'playing' && !detail.paused && !detail.characterLoading && !detail.isMultiplayerSuspended;
    setGameplayActive(active, reason);
  };
  window.addEventListener('bipx:qa-gameplay-state', event => consumeGameplayBridge(event.detail));
  consumeGameplayBridge(window.__bipxQaGameplayState?.current, 'bridge-initial');

  const percentile = (window, fraction) => {
    if (!window.frames) return null;
    const target = Math.ceil(window.frames * fraction);
    let seen = 0;
    for (let index = 0; index < BINS; index += 1) {
      seen += window.bins[index];
      if (seen >= target) return Math.min(window.maxMs, index === BINS - 1 ? window.maxMs : (index + 1) * BIN_MS);
    }
    return Math.round(window.maxMs * 10) / 10;
  };
  const summarize = (window, endMs) => {
    const activeMs = Math.max(0, endMs - window.startedMs - window.hiddenMs);
    return { frames: window.frames, meanMs: window.frames ? Math.round((window.sumMs / window.frames) * 100) / 100 : null, fps: activeMs > 0 ? Math.round((window.frames / activeMs) * 10000) / 10 : null, p50Ms: percentile(window, 0.5), p95Ms: percentile(window, 0.95), p99Ms: percentile(window, 0.99), maxMs: window.maxMs, over10Ms: window.over10Ms, over16_7Ms: window.over16_7Ms, over33Ms: window.over33Ms, over50Ms: window.over50Ms, longFrames: window.long, activeS: Math.round(activeMs / 100) / 10 };
  };
  const summarizeGameplay = (window, nowMs) => {
    if (!window || window.startedMs === null) return null;
    const activeMs = Math.max(0, window.activeMs + (window.lastActiveMs === null ? 0 : nowMs - window.lastActiveMs));
    const endMs = window.endMs ?? nowMs;
    return { frames: window.frames, samples: window.frames, meanMs: window.frames ? Math.round((window.sumMs / window.frames) * 100) / 100 : null, fps: activeMs > 0 ? Math.round((window.frames / activeMs) * 10000) / 10 : null, p50Ms: percentile(window, 0.5), p95Ms: percentile(window, 0.95), p99Ms: percentile(window, 0.99), maxMs: window.maxMs, over10Ms: window.over10Ms, over16_7Ms: window.over16_7Ms, over33Ms: window.over33Ms, over50Ms: window.over50Ms, longFrames: window.long, activeS: Math.round(activeMs) / 1000, startS: Math.round(window.startedMs - startedAtMs) / 1000, endS: Math.round(endMs - startedAtMs) / 1000, startReason: window.startReason, endReason: window.endReason };
  };
  const rollMinute = (nowMs) => { keep(minutes, { minute: minutes.length + (minutes.dropped ?? 0) + 1, endS: seconds(), ...summarize(minute, nowMs) }, 180); minute = newWindow(); };
  const onFrame = (timestamp) => {
    if (lastFrame) {
      const delta = timestamp - lastFrame;
      recordFrame(minute, delta); recordFrame(total, delta);
    }
    lastFrame = timestamp;
    if (gameplay.active) {
      if (activeLastFrame) {
        const delta = timestamp - activeLastFrame;
        recordFrame(gameplay.total, delta); recordFrame(gameplay.current, delta);
      }
      activeLastFrame = timestamp;
    } else activeLastFrame = 0;
    if (timestamp - minute.startedMs >= 60000) rollMinute(timestamp);
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  // ---- Long tasks (Chromium only; Safari reports supported: false). -----------------------------------------
  const longTasks = { supported: false, count: 0, totalMs: 0, maxMs: 0, recent: [] };
  try {
    if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      longTasks.supported = true;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.count += 1;
          longTasks.totalMs = Math.round(longTasks.totalMs + entry.duration);
          if (entry.duration > longTasks.maxMs) longTasks.maxMs = Math.round(entry.duration);
          longTasks.recent.push({ atS: Math.round((entry.startTime - startedAtMs) / 100) / 10, ms: Math.round(entry.duration) });
          if (longTasks.recent.length > 20) longTasks.recent.shift();
        }
      }).observe({ type: 'longtask', buffered: true });
    }
  } catch { /* unsupported: keep supported false */ }

  // ---- Safe areas, viewports, orientation. -----------------------------------------------------------------
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  const readSafeArea = () => { const style = getComputedStyle(probe); return { top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 }; };
  const readViewport = () => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, visualWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null, visualHeight: window.visualViewport ? Math.round(window.visualViewport.height) : null, visualScale: window.visualViewport ? Math.round(window.visualViewport.scale * 100) / 100 : null, screenWidth: screen.width, screenHeight: screen.height, devicePixelRatio: window.devicePixelRatio });
  const readOrientation = () => ({ type: screen.orientation?.type ?? (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'), angle: screen.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : null) });
  const viewports = [];
  const safeAreas = [];
  const orientationChanges = [];
  let lastLayoutKey = '';
  const recordLayout = (reason) => {
    const viewport = readViewport();
    const safeArea = readSafeArea();
    const key = JSON.stringify([viewport, safeArea]);
    if (key === lastLayoutKey) return;
    lastLayoutKey = key;
    keep(viewports, { atS: seconds(), reason, ...viewport }, 40);
    keep(safeAreas, { atS: seconds(), ...safeArea }, 40);
  };
  let lastOrientation = '';
  const recordOrientation = (reason) => {
    const orientation = readOrientation();
    const key = `${orientation.type}:${orientation.angle}`;
    if (key !== lastOrientation) { if (lastOrientation) keep(orientationChanges, { atS: seconds(), reason, ...orientation, innerWidth: window.innerWidth, innerHeight: window.innerHeight }); lastOrientation = key; }
    recordLayout(reason);
    schedulePlace();
  };

  // ---- Visibility and page lifecycle. ------------------------------------------------------------------------
  const visibility = [];
  const onVisibility = (type) => {
    const nowMs = performance.now();
    if (document.hidden && !hiddenSince) hiddenSince = nowMs;
    if (!document.hidden && hiddenSince) { minute.hiddenMs += nowMs - hiddenSince; total.hiddenMs += nowMs - hiddenSince; hiddenSince = 0; }
    lastFrame = 0; // the gap while hidden is not a long frame
    activeLastFrame = 0;
    if (document.hidden) setGameplayActive(false, type);
    else consumeGameplayBridge(latestBridge ?? window.__bipxQaGameplayState?.current, type);
    keep(visibility, { atS: seconds(), type, state: document.visibilityState });
  };
  document.addEventListener('visibilitychange', () => onVisibility('visibilitychange'));
  for (const type of ['pagehide', 'pageshow']) window.addEventListener(type, () => onVisibility(type));
  for (const type of ['freeze', 'resume']) document.addEventListener(type, () => onVisibility(type));

  // ---- AudioContext state transitions: observe construction, never alter behaviour. ---------------------------
  const audio = { supported: false, contexts: 0, transitions: [] };
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Native = window[name];
    if (typeof Native !== 'function') continue;
    audio.supported = true;
    try {
      const proxy = new Proxy(Native, {
        construct(target, args, newTarget) {
          const context = Reflect.construct(target, args, newTarget === proxy ? target : newTarget);
          try {
            const id = audio.contexts += 1;
            keep(audio.transitions, { atS: seconds(), context: id, state: context.state, event: 'created' });
            context.addEventListener('statechange', () => keep(audio.transitions, { atS: seconds(), context: id, state: context.state, event: 'statechange' }));
          } catch { /* observation only */ }
          return context;
        },
      });
      window[name] = proxy;
    } catch { /* leave the native constructor untouched */ }
  }

  // ---- WebGL renderer string: read from the game's own context when possible (no new context). ---------------
  let webgl = null;
  const readWebgl = () => {
    if (webgl?.renderer) return webgl;
    const describe = (gl, from) => { const info = gl.getExtension('WEBGL_debug_renderer_info'); return { from, version: gl.getParameter(gl.VERSION), renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) }; };
    try {
      const canvas = document.getElementById('game-canvas');
      const existing = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (existing && !existing.isContextLost()) { webgl = describe(existing, 'game-canvas'); return webgl; }
    } catch { /* fall through */ }
    try {
      const scratch = document.createElement('canvas');
      scratch.width = 1; scratch.height = 1;
      const gl = scratch.getContext('webgl2') || scratch.getContext('webgl');
      if (gl) { webgl = describe(gl, 'scratch-canvas'); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    } catch (error) { webgl = { error: String(error?.message ?? error) }; }
    return webgl;
  };

  // ---- location.href without tokens: only known harmless parameters keep their value. -------------------------
  const SAFE_PARAMS = new Set(['qa', 'offline', 'quality', 'perf', 'autoplay', 'bosses', 'monsterLod', 'character']);
  const safeHref = () => {
    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams();
      for (const [name, value] of url.searchParams) params.append(name, SAFE_PARAMS.has(name) ? value : '[redacted]');
      const query = params.toString(); // URLSearchParams.size is missing on older Safari
      return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
    } catch { return null; }
  };

  // Explicit metadata is opt-in so this observer never guesses refresh mode or
  // conflates rAF with CPU/Worker/network time. The game remains untouched.
  const readPerformanceContext = () => {
    const context = window.__bipxQaPerformanceContext;
    if (!context || typeof context !== 'object') return { source: 'rAF', candidate: null, hardware: null, resolution: null, backend: null, quality: null, durationS: null, refreshHz: null, refreshMode: null, visibility: document.visibilityState, scenario: null, cpuMs: null, workerMs: null, networkMs: null };
    return {
      source: 'rAF', candidate: context.candidate ?? null, hardware: context.hardware ?? null, resolution: context.resolution ?? null,
      backend: context.backend ?? null, quality: context.quality ?? null, durationS: context.durationS ?? null,
      refreshHz: context.refreshHz ?? null, refreshMode: context.refreshMode ?? null, visibility: document.visibilityState,
      scenario: context.scenario ?? null, cpuMs: context.cpuMs ?? null, workerMs: context.workerMs ?? null, networkMs: context.networkMs ?? null,
    };
  };

  const buildReport = () => {
    const nowMs = performance.now();
    recordLayout('report');
    const activeWindows = gameplay.windows.map(window => summarizeGameplay(window, nowMs));
    if (gameplay.current?.frames > 0) activeWindows.push(summarizeGameplay(gameplay.current, nowMs));
    const activeTotal = summarizeGameplay(gameplay.total, nowMs);
    return {
      kind: 'bipx-device-qa-report',
      version: 1,
      code,
      startedAt,
      copiedAt: new Date().toISOString(),
      durationS: seconds(),
      href: safeHref(),
      performanceContractVersion: 2,
      capture: readPerformanceContext(),
      userAgent: navigator.userAgent,
      platform: { uaPlatform: navigator.userAgentData?.platform ?? null, uaMobile: navigator.userAgentData?.mobile ?? null, maxTouchPoints: navigator.maxTouchPoints ?? null, hardwareConcurrency: navigator.hardwareConcurrency ?? null, deviceMemoryGb: navigator.deviceMemory ?? null, language: navigator.language ?? null, coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? null, reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? null, standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? null },
      webgl: readWebgl(),
      frames: { longFrameMs: LONG_FRAME_MS, binMs: BIN_MS, histogram: { binMs: BIN_MS, semantics: 'interval-estimate', exact: false }, total: summarize(total, nowMs), legacyTotal: summarize(total, nowMs), currentMinute: summarize(minute, nowMs), minutes: [...minutes], minutesDropped: minutes.dropped ?? 0,
        activeGameplay: { observedBy: [...gameplay.observedBy], transitions: gameplay.transitions, histogram: { binMs: BIN_MS, semantics: 'interval-estimate', exact: false }, total: activeTotal, windows: activeWindows } },
      longTasks: { ...longTasks, recent: [...longTasks.recent] },
      orientation: { current: readOrientation(), changes: withDropped(orientationChanges) },
      safeArea: { current: readSafeArea(), history: withDropped(safeAreas) },
      viewport: { current: readViewport(), history: withDropped(viewports) },
      audio: { supported: audio.supported, contexts: audio.contexts, transitions: withDropped(audio.transitions) },
      visibility: { current: document.visibilityState, changes: withDropped(visibility) },
    };
  };

  // ---- The button: small, top-left under the HUD, never on top of an existing control. ---------------------------
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'qa-report-button';
  button.textContent = 'Copiar relatório QA';
  button.setAttribute('aria-label', 'Copiar relatório QA para a área de transferência');
  button.style.cssText = 'position:fixed;z-index:2147483000;box-sizing:border-box;min-width:44px;min-height:44px;max-width:124px;margin:0;padding:4px 9px;font:600 11px/1.15 system-ui,-apple-system,sans-serif;letter-spacing:.01em;text-align:left;color:#e6f0f0;background:rgba(7,20,27,.66);border:1px solid rgba(174,196,202,.4);border-radius:6px;opacity:.78;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none';
  for (const type of ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend']) button.addEventListener(type, (event) => event.stopPropagation(), { passive: true });

  const OBSTACLES = '.survivor-hud,.game-tools,.leaderboard-panel,.arpg-hud,.touch-stick,.touch-fire,.first-run-hint,.main-menu__region,.upgrade-panel__shell,button,a[href],input,select,textarea,summary,[role="button"]';
  const isVisible = (element) => { if (element === button || element.closest('#qa-report-button,#qa-report-fallback')) return false; const rect = element.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return false; const style = getComputedStyle(element); return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.01; };
  const place = () => {
    if (document.hidden || !button.isConnected) return;
    const safeArea = readSafeArea();
    const width = button.offsetWidth || 124;
    const height = button.offsetHeight || 44;
    const left = Math.max(8, safeArea.left);
    const hud = document.querySelector('.survivor-hud');
    const hudRect = hud && isVisible(hud) ? hud.getBoundingClientRect() : null;
    const firstTop = Math.ceil(Math.max(8, safeArea.top, hudRect ? hudRect.bottom + 8 : 0));
    const obstacles = [...document.querySelectorAll(OBSTACLES)].filter(isVisible).map((element) => element.getBoundingClientRect());
    const lastTop = Math.max(firstTop, window.innerHeight - height - Math.max(8, safeArea.bottom));
    let top = firstTop;
    for (; top <= lastTop; top += 4) {
      const clash = obstacles.some((rect) => left < rect.right + 6 && left + width > rect.left - 6 && top < rect.bottom + 6 && top + height > rect.top - 6);
      if (!clash) break;
    }
    if (top > lastTop) top = firstTop;
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
  };
  let placeQueued = false;
  function schedulePlace() { if (placeQueued) return; placeQueued = true; setTimeout(() => { placeQueued = false; place(); }, 120); }

  const showFallback = (text) => {
    document.getElementById('qa-report-fallback')?.remove();
    const panel = document.createElement('div');
    panel.id = 'qa-report-fallback';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Relatório QA para copiar manualmente');
    panel.style.cssText = 'position:fixed;z-index:2147483001;inset:12px;display:flex;flex-direction:column;gap:8px;padding:12px;background:#07141bf5;border:1px solid #aec4ca66;border-radius:8px;color:#e6f0f0;font:13px/1.35 system-ui,sans-serif';
    const hint = document.createElement('p');
    hint.style.margin = '0';
    hint.textContent = 'Não foi possível copiar sozinho. Selecione tudo, copie e cole no formulário da sessão.';
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.value = text;
    area.style.cssText = 'flex:1;min-height:120px;width:100%;box-sizing:border-box;font:11px/1.3 ui-monospace,monospace;color:#e6f0f0;background:#0b1c25;border:1px solid #aec4ca44;border-radius:4px;padding:8px';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Fechar';
    close.style.cssText = 'min-height:44px;font:600 14px system-ui,sans-serif;color:#07141b;background:#c6a675;border:0;border-radius:6px';
    close.addEventListener('click', () => panel.remove());
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'keyup']) panel.addEventListener(type, (event) => event.stopPropagation());
    panel.append(hint, area, close);
    document.body.append(panel);
    area.focus();
    area.select();
  };
  const legacyCopy = (text) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    area.remove();
    return copied;
  };
  let labelTimer = 0;
  const flash = (text) => { button.textContent = text; clearTimeout(labelTimer); labelTimer = setTimeout(() => { button.textContent = 'Copiar relatório QA'; }, 2500); };
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    const text = JSON.stringify(buildReport());
    window.__bipxQaReport.lastCopied = text;
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch { copied = false; }
    if (!copied) copied = legacyCopy(text);
    if (copied) flash('Copiado ✓'); else { flash('Copie manualmente'); showFallback(text); }
    button.blur();
  });

  window.__bipxQaReport = { code, getReport: buildReport, lastCopied: null };
  const mount = () => {
    document.body.append(probe, button);
    lastOrientation = `${readOrientation().type}:${readOrientation().angle}`;
    recordLayout('start');
    place();
    window.addEventListener('resize', () => recordOrientation('resize'));
    window.addEventListener('orientationchange', () => recordOrientation('orientationchange'));
    screen.orientation?.addEventListener?.('change', () => recordOrientation('screen.orientation'));
    window.visualViewport?.addEventListener?.('resize', () => recordOrientation('visualViewport'));
    setInterval(place, 1000); // the HUD grows and shrinks with the run; one cheap layout read per second
  };
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount, { once: true });
}

let qaCode = null;
try { qaCode = new URLSearchParams(window.location.search).get('qa'); } catch { qaCode = null; }
if (qaCode && /^[A-Za-z0-9_-]{1,96}$/.test(qaCode)) startDeviceReport(qaCode);
