const CSS_FALLBACK_OFF = 'arpg-pulse-css-off';
const WAAPI_LINEAR = { easing: 'linear' };

const visuals = {
  'is-pressed': {
    selector: null, suppressor: null,
    keyframes: [{ transform: 'scale(1)', easing: 'ease-out' }, { transform: 'scale(.93)' }],
    timing: { duration: 80, ...WAAPI_LINEAR },
  },
  'is-ready-ping': {
    selector: null, suppressor: 'arpg-pulse-waapi-ready',
    keyframes: [
      { transform: 'scale(1)', offset: 0, easing: 'cubic-bezier(.2, .9, .3, 1.25)' },
      { transform: 'scale(1.13)', offset: .35, easing: 'cubic-bezier(.2, .9, .3, 1.25)' },
      { transform: 'scale(1)', offset: 1 },
    ],
    timing: { duration: 420, ...WAAPI_LINEAR },
    ring: {
      pseudoElement: '::after',
      keyframes: [
        { opacity: 1, transform: 'scale(1)', easing: 'ease-out' },
        { opacity: 0, transform: 'scale(1.28)' },
      ],
      timing: { duration: 500, fill: 'forwards', ...WAAPI_LINEAR },
    },
  },
  'is-denied': {
    selector: null, suppressor: 'arpg-pulse-waapi-denied',
    keyframes: [
      { transform: 'translateX(0)', offset: 0, easing: 'ease-in-out' },
      { transform: 'translateX(-4px)', offset: .16, easing: 'ease-in-out' },
      { transform: 'translateX(4px)', offset: .33, easing: 'ease-in-out' },
      { transform: 'translateX(-4px)', offset: .5, easing: 'ease-in-out' },
      { transform: 'translateX(4px)', offset: .66, easing: 'ease-in-out' },
      { transform: 'translateX(-2px)', offset: .83, easing: 'ease-in-out' },
      { transform: 'translateX(0)', offset: 1 },
    ],
    timing: { duration: 360, ...WAAPI_LINEAR },
  },
  'is-short': {
    selector: '.arpg-orb__rim', suppressor: 'arpg-pulse-waapi-short',
    keyframes: [
      { boxShadow: '0 0 0 0 #ff3b4f00, inset 0 0 0 2px #191a18', offset: 0, easing: 'ease-out' },
      { boxShadow: '0 0 0 5px #ff3b4fb3, inset 0 0 0 2px #191a18', offset: .3, easing: 'ease-out' },
      { boxShadow: '0 0 0 9px #ff3b4f00, inset 0 0 0 2px #191a18', offset: 1 },
    ],
    timing: { duration: 500, ...WAAPI_LINEAR },
  },
  'is-hurt': {
    selector: '.arpg-orb__reflection', suppressor: 'arpg-pulse-waapi-hurt',
    keyframes: [
      { backgroundColor: '#ffffff8c', easing: 'ease-out' },
      { backgroundColor: '#fff0' },
    ],
    timing: { duration: 320, ...WAAPI_LINEAR },
  },
  'is-healed': {
    selector: '.arpg-orb__rim', suppressor: 'arpg-pulse-waapi-healed',
    keyframes: [
      { boxShadow: '0 0 0 0 #7dffb400, inset 0 0 0 2px #191a18', offset: 0, easing: 'ease-out' },
      { boxShadow: '0 0 0 4px #7dffb4cc, 0 0 22px #7dffb4aa, inset 0 0 0 2px #191a18', offset: .25, easing: 'ease-out' },
      { boxShadow: '0 0 0 10px #7dffb400, inset 0 0 0 2px #191a18', offset: 1 },
    ],
    timing: { duration: 600, ...WAAPI_LINEAR },
  },
};

export const HUD_PULSE_VISUALS = visuals;

export function createHudPulseController({
  reducedMotion = () => false,
  setTimer = (callback, duration) => globalThis.setTimeout(callback, duration),
  clearTimer = (timer) => globalThis.clearTimeout(timer),
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  const byElement = new WeakMap();
  const active = new Set();

  function cancelFallbackFrames(record) {
    for (const frame of record.frames) frame.cancel(frame.id);
    record.frames.length = 0;
  }

  function scheduleFallbackFrame(record, callback) {
    const cancel = typeof requestFrame === 'function' && typeof cancelFrame === 'function' ? cancelFrame : clearTimer;
    const schedule = typeof requestFrame === 'function' ? requestFrame : (fn) => setTimer(fn, 16);
    const frame = { id: null, cancel };
    frame.id = schedule(() => {
      const index = record.frames.indexOf(frame);
      if (index !== -1) record.frames.splice(index, 1);
      callback();
    });
    record.frames.push(frame);
  }

  function syncCssFallbackOff(element) {
    const entries = byElement.get(element);
    const required = entries && [...entries.values()].some(record => record.active && record.cssFallbackOff);
    if (required) element.classList.add(CSS_FALLBACK_OFF);
    else element.classList.remove(CSS_FALLBACK_OFF);
  }

  function setCssFallbackOff(record, required) {
    record.cssFallbackOff = required;
    syncCssFallbackOff(record.element);
  }

  function startTimer(record, duration) {
    if (!record.active || record.timer !== null) return;
    record.timer = setTimer(() => {
      record.timer = null;
      removeRecord(record);
    }, duration);
  }

  function removeRecord(record, { removeState = true } = {}) {
    if (!record.active) return;
    record.active = false;
    if (record.timer !== null) clearTimer(record.timer);
    cancelFallbackFrames(record);
    record.animation?.cancel?.();
    record.ringAnimation?.cancel?.();
    if (record.suppressor) record.element.classList.remove(record.suppressor);
    setCssFallbackOff(record, false);
    if (removeState) record.element.classList.remove(record.className);
    const entries = byElement.get(record.element);
    if (entries?.get(record.className) === record) entries.delete(record.className);
    active.delete(record);
    record.timer = null;
  }

  function startCssFallback(record, duration, { suppressOnly = false } = {}) {
    setCssFallbackOff(record, true);
    if (suppressOnly) {
      startTimer(record, duration);
      return;
    }
    // The first frame commits animation:none; the second re-enables the CSS animation.
    // This forces a restart without synchronously asking layout for a dimension.
    scheduleFallbackFrame(record, () => {
      if (!record.active) return;
      scheduleFallbackFrame(record, () => {
        if (!record.active) return;
        setCssFallbackOff(record, false);
        startTimer(record, duration);
      });
    });
  }

  function runAnimation(record, visual, duration) {
    const target = visual.selector ? record.element.querySelector(visual.selector) : record.element;
    if (reducedMotion()) {
      record.motionPaused = true;
      if (record.suppressor) startCssFallback(record, duration, { suppressOnly: true });
      else startTimer(record, duration);
      return;
    }
    if (!target || typeof target.animate !== 'function') {
      if (visual.suppressor) startCssFallback(record, duration);
      else startTimer(record, duration);
      return;
    }

    try {
      record.animation = target.animate(visual.keyframes, visual.timing);
      if (visual.ring) {
        record.ringAnimation = record.element.animate(visual.ring.keyframes, {
          ...visual.ring.timing,
          pseudoElement: visual.ring.pseudoElement,
        });
      }
      if (visual.suppressor) record.element.classList.add(visual.suppressor);
      startTimer(record, duration);
    } catch {
      record.animation?.cancel?.();
      record.ringAnimation?.cancel?.();
      record.animation = null;
      record.ringAnimation = null;
      if (visual.suppressor) startCssFallback(record, duration);
      else startTimer(record, duration);
    }
  }

  function pulse(element, className, duration) {
    if (!element || !Number.isFinite(duration) || duration < 0) return null;
    let entries = byElement.get(element);
    if (!entries) byElement.set(element, (entries = new Map()));
    const previous = entries.get(className);
    if (previous) removeRecord(previous, { removeState: false });

    const visual = visuals[className];
    const record = {
      element, className, suppressor: visual?.suppressor ?? null,
      visual: visual ?? null, duration, motionPaused: false, cssFallbackOff: false,
      animation: null, ringAnimation: null, timer: null, frames: [], active: true,
    };
    entries.set(className, record);
    active.add(record);
    element.classList.add(className);
    if (visual) runAnimation(record, visual, duration);
    else startTimer(record, duration);
    return record;
  }

  function cancelAnimations() {
    for (const record of active) {
      record.animation?.cancel?.();
      record.ringAnimation?.cancel?.();
      record.animation = null;
      record.ringAnimation = null;
      cancelFallbackFrames(record);
      if (record.suppressor) record.element.classList.remove(record.suppressor);
      record.motionPaused = Boolean(record.visual);
      if (record.suppressor) setCssFallbackOff(record, true);
      // CSS restart staging can be canceled before it installs its expiry timer.
      // Reduced motion cancels only visuals; the state class must still expire.
      startTimer(record, record.duration);
    }
  }

  function resumeAnimations() {
    if (reducedMotion()) return;
    for (const record of active) {
      if (!record.active || !record.motionPaused || !record.visual) continue;
      record.motionPaused = false;
      if (record.suppressor) {
        // Restart the original CSS keyframes with the same non-flushing two-frame path.
        startCssFallback(record, record.duration);
      } else {
        runAnimation(record, record.visual, record.duration);
      }
    }
  }

  function cancelAll() {
    for (const record of [...active]) removeRecord(record);
  }

  return { pulse, cancelAnimations, resumeAnimations, cancelAll, get activeCount() { return active.size; } };
}
