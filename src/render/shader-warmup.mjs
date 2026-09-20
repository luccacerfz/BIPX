const DEFAULT_MAX_CASES = 128;
const DEFAULT_CASE_TIMEOUT_MS = 15_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 120_000;

export function createShaderWarmupState({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') throw new TypeError('shader warmup requires a monotonic clock');
  return {
    status: 'idle', phase: 'waiting', now, promise: null, error: null,
    totalCases: 0, completedCases: 0, currentCase: null, caseEvents: [],
    startedAt: 0, readyAt: 0, elapsedMs: 0, maxCaseMs: 0,
    timeoutCount: 0, generation: 0,
  };
}

function boundedDeadline(promise, timeoutMs, { setTimer, clearTimer, state, label }) {
  let timer = null;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      callback(value);
    };
    timer = setTimer(() => {
      state.timeoutCount += 1;
      finish(reject, new Error(`shader warmup timeout (${label}, ${timeoutMs} ms)`));
    }, timeoutMs);
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
  });
}

/**
 * Runs a bounded, serial list of real shader preparation cases.
 * A timeout fails closed. The caller must reload before retrying because a
 * renderer compile promise cannot be cancelled by Three.js r164.
 */
export function startShaderWarmup(state, cases, {
  runCase,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
  now = state?.now,
  maxCases = DEFAULT_MAX_CASES,
  caseTimeoutMs = DEFAULT_CASE_TIMEOUT_MS,
  totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onProgress = null,
} = {}) {
  if (!state || typeof state !== 'object') throw new TypeError('shader warmup state is required');
  if (state.promise) return state.promise;
  if (state.status === 'ready') return Promise.resolve(state);
  if (!['idle', 'preparing'].includes(state.status)) return Promise.reject(new Error(`shader warmup cannot restart from ${state.status}; reload required`));
  if (!Array.isArray(cases) || cases.length === 0) throw new TypeError('shader warmup cases must be non-empty');
  if (!Number.isInteger(maxCases) || maxCases < 1 || cases.length > maxCases) {
    throw new RangeError(`shader warmup case limit exceeded (${cases.length}/${maxCases})`);
  }
  if (typeof runCase !== 'function' || typeof now !== 'function' || typeof yieldControl !== 'function') {
    throw new TypeError('shader warmup requires runCase, monotonic now, and yieldControl');
  }
  if (![caseTimeoutMs, totalTimeoutMs].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('shader warmup deadlines must be finite and positive');
  }

  const generation = ++state.generation;
  state.status = 'running';
  state.phase = 'shader-compilation';
  state.error = null;
  state.totalCases = cases.length;
  state.completedCases = 0;
  state.currentCase = null;
  state.caseEvents = [];
  state.startedAt = now();
  state.readyAt = 0;
  state.elapsedMs = 0;
  state.maxCaseMs = 0;

  const task = (async () => {
    try {
      for (const item of cases) {
        if (generation !== state.generation) throw new Error('shader warmup generation changed');
        const id = String(item?.id ?? '');
        if (!id || id.length > 120) throw new TypeError('shader warmup case id is invalid');
        const beforeYield = now();
        const totalRemaining = totalTimeoutMs - (beforeYield - state.startedAt);
        if (totalRemaining <= 0) throw new Error(`shader warmup total timeout (${totalTimeoutMs} ms)`);
        await yieldControl();
        const started = now();
        const remaining = totalTimeoutMs - (started - state.startedAt);
        if (remaining <= 0) throw new Error(`shader warmup total timeout (${totalTimeoutMs} ms)`);
        state.currentCase = id;
        onProgress?.(state);
        const deadlineMs = Math.min(caseTimeoutMs, remaining);
        const operation = Promise.resolve().then(() => runCase(item));
        await boundedDeadline(operation, deadlineMs, { setTimer, clearTimer, state, label: id });
        const durationMs = Math.max(0, now() - started);
        state.completedCases += 1;
        state.maxCaseMs = Math.max(state.maxCaseMs, durationMs);
        state.elapsedMs = Math.max(0, now() - state.startedAt);
        state.caseEvents.push({ id, durationMs });
        onProgress?.(state);
      }
      state.status = 'ready';
      state.phase = 'complete';
      state.currentCase = null;
      state.readyAt = now();
      state.elapsedMs = Math.max(0, state.readyAt - state.startedAt);
      onProgress?.(state);
      return state;
    } catch (error) {
      state.status = 'failed';
      state.phase = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      state.currentCase = null;
      state.elapsedMs = Math.max(0, now() - state.startedAt);
      onProgress?.(state);
      throw error;
    }
  })();
  state.promise = task;
  task.finally(() => {
    if (state.promise === task) state.promise = null;
  }).catch(() => {});
  return task;
}

export function getShaderWarmupSnapshot(state) {
  return {
    status: state?.status ?? 'missing',
    phase: state?.phase ?? 'missing',
    totalCases: state?.totalCases ?? 0,
    completedCases: state?.completedCases ?? 0,
    currentCase: state?.currentCase ?? null,
    startedAt: state?.startedAt ?? 0,
    readyAt: state?.readyAt ?? 0,
    elapsedMs: state?.elapsedMs ?? 0,
    maxCaseMs: state?.maxCaseMs ?? 0,
    timeoutCount: state?.timeoutCount ?? 0,
    error: state?.error ?? null,
    caseEvents: state?.caseEvents?.map(event => ({ ...event })) ?? [],
  };
}

export function isShaderWarmupReady(state) {
  return state?.status === 'ready' && state.totalCases > 0 &&
    state.completedCases === state.totalCases && state.error === null;
}

// Ready-case materials own Three.js WebGLProgram cache references; disposing
// those materials immediately after compile would evict the prepared programs.
export function shouldRetainShaderWarmupResources(state) {
  return isShaderWarmupReady(state);
}

/** Keep successful program-owning materials alive until a real document exit. */
export function createShaderWarmupResourceLifetime(state, releaseResources) {
  if (!state || typeof releaseResources !== 'function') throw new TypeError('warmup resource lifetime requires state and release callback');
  let retained = false;
  let released = false;
  const release = () => {
    if (released) return { retained, released: true, alreadyReleased: true };
    released = true;
    retained = false;
    return { retained: false, released: true, alreadyReleased: false, releaseSucceeded: releaseResources() !== false };
  };
  return {
    finalize() {
      if (released) return { retained: false, released: true, alreadyReleased: true };
      if (shouldRetainShaderWarmupResources(state)) {
        retained = true;
        return { retained: true, released: false, releaseAt: 'pagehide' };
      }
      return release();
    },
    pagehide(event) {
      if (event?.persisted === true) return { retained, released, deferredForBackForwardCache: true };
      return release();
    },
    get retained() { return retained; },
    get released() { return released; },
  };
}
