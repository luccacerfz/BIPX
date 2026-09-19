import { cloneDefaultConfig, mergeObjects } from "./defaults.js";
import { resolveConfigTarget, setForcedConfigTarget } from "./targets.js";

export const CONFIG_OVERRIDE_STORAGE_KEY = "bipx:config-overrides:v1";

const subscribers = new Set();
let cachedOverrides = loadStoredOverrides();

export function getRuntimeConfig(options = {}) {
  const target = resolveConfigTarget(options);
  const base = cloneDefaultConfig(target);
  return mergeObjects(base, cachedOverrides[target] ?? {});
}

export function getConfig(path, options = {}) {
  const config = getRuntimeConfig(options);
  return getByPath(config, path);
}

export function setConfig(path, value, options = {}) {
  const target = resolveConfigTarget(options);
  const targetOverrides = getTargetOverrides(target);
  setByPath(targetOverrides, path, value);
  persistOverrides();
  notifySubscribers({
    type: "set",
    target,
    path,
    value,
  });
}

export function resetConfig(path, options = {}) {
  const target = resolveConfigTarget(options);
  const targetOverrides = getTargetOverrides(target);
  unsetByPath(targetOverrides, path);
  persistOverrides();
  notifySubscribers({
    type: "reset",
    target,
    path,
  });
}

export function resetAllConfig(options = {}) {
  const target = resolveConfigTarget(options);
  delete cachedOverrides[target];
  persistOverrides();
  notifySubscribers({
    type: "reset-all",
    target,
  });
}

export function getAllOverrides() {
  return structuredClone(cachedOverrides);
}

export function setAllOverrides(overrides) {
  cachedOverrides = sanitizeOverrides(overrides);
  persistOverrides();
  notifySubscribers({
    type: "replace-all",
  });
}

export function forceConfigTarget(target) {
  setForcedConfigTarget(target);
  notifySubscribers({
    type: "force-target",
    target,
  });
}

export function subscribeConfig(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getTargetOverrides(target) {
  if (!cachedOverrides[target] || typeof cachedOverrides[target] !== "object") {
    cachedOverrides[target] = {};
  }

  return cachedOverrides[target];
}

function notifySubscribers(event) {
  for (const listener of subscribers) {
    listener(event);
  }
}

function loadStoredOverrides() {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(CONFIG_OVERRIDE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return sanitizeOverrides(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persistOverrides() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(CONFIG_OVERRIDE_STORAGE_KEY, JSON.stringify(cachedOverrides));
  } catch {
  }
}

function sanitizeOverrides(overrides) {
  if (!overrides || typeof overrides !== "object") {
    return {};
  }

  return mergeObjects({}, overrides);
}

function getByPath(input, path) {
  const segments = parsePath(path);
  let current = input;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function setByPath(input, path, value) {
  const segments = parsePath(path);
  let current = input;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }
    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;
}

function unsetByPath(input, path) {
  const segments = parsePath(path);
  let current = input;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!current[segment] || typeof current[segment] !== "object") {
      return;
    }
    current = current[segment];
  }

  delete current[segments[segments.length - 1]];
}

function parsePath(path) {
  if (!path || typeof path !== "string") {
    return [];
  }

  return path.split(".").filter(Boolean);
}
