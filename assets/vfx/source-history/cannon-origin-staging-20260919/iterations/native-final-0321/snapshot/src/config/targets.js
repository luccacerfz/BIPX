export const CONFIG_TARGETS = Object.freeze(["desktop", "mobilePro", "mobile", "tablet"]);

let forcedTarget = null;

export function setForcedConfigTarget(target) {
  forcedTarget = CONFIG_TARGETS.includes(target) ? target : null;
}

export function getForcedConfigTarget() {
  return forcedTarget;
}

export function clearForcedConfigTarget() {
  forcedTarget = null;
}

export function resolveConfigTarget(options = {}) {
  if (CONFIG_TARGETS.includes(options.forcedTarget)) {
    return options.forcedTarget;
  }

  if (forcedTarget) {
    return forcedTarget;
  }

  const hasTouch = options.hasTouch ?? detectTouchDevice();
  const width = options.width ?? getViewportWidth();
  const height = options.height ?? getViewportHeight();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const deviceRatio = getDevicePixelRatio();

  if (hasTouch && shortestSide >= 390 && shortestSide <= 460 && longestSide >= 800 && longestSide <= 960 && deviceRatio >= 2.5) {
    return "mobilePro";
  }

  if (hasTouch && shortestSide < 680) {
    return "mobile";
  }

  if (hasTouch && shortestSide < 1100 && longestSide < 1600) {
    return "tablet";
  }

  return "desktop";
}

function detectTouchDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.("(pointer: coarse)")?.matches === true
  );
}

function getViewportWidth() {
  if (typeof window === "undefined") {
    return 1280;
  }

  return window.innerWidth || 1280;
}

function getViewportHeight() {
  if (typeof window === "undefined") {
    return 720;
  }

  return window.innerHeight || 720;
}

function getDevicePixelRatio() {
  if (typeof window === "undefined") {
    return 1;
  }

  return window.devicePixelRatio || 1;
}
