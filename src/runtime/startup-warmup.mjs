/**
 * Bounded, synchronous pool-preparation scheduler.
 *
 * The scheduler deliberately knows nothing about Three.js or game state.  A
 * caller supplies one operation for each item in the immutable plan.  This
 * keeps the lifecycle testable without replacing the real pool factories and
 * makes it impossible for a retry to allocate a second pool: progress lives
 * in one state object and a ready scheduler is a no-op.
 */

export function createStartupWarmupState(plan, now = () => performance.now()) {
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new TypeError("startup warmup plan must contain at least one item");
  }
  return {
    plan,
    status: "idle",
    cursor: 0,
    totalItems: plan.length,
    processedItems: 0,
    frames: 0,
    chunks: 0,
    startedAt: 0,
    readyAt: 0,
    lastChunkMs: 0,
    maxChunkMs: 0,
    error: null,
    now,
  };
}

export function createStartupWarmupPlan() {
  const plan = [];
  const add = (kind, count, type = null) => {
    for (let index = 0; index < count; index += 1) plan.push({ kind, type });
  };
  for (const [type, count] of [
    ["zombie", 140], ["runner", 120], ["brute", 112], ["caster", 112],
    ["cowWalker", 90], ["cowCharger", 78], ["cowBrute", 64], ["visor", 2],
    ["himetrica", 1], ["dinzo", 1], ["gitcity", 2], ["sofra", 1],
    ["angelSheep", 1], ["bloodCow", 1], ["plumaFinance", 1],
  ]) add("zombie", count, type);
  add("bullet", 80);
  add("enemyProjectile", 56);
  add("xpGem", 180);
  for (const kind of ["pulse", "explosion", "beam"]) add(kind, 18);
  for (const kind of ["slash", "cone", "orbit"]) add(kind, 10);
  add("trap", 18);
  add("damageNumber", 54);
  return Object.freeze(plan);
}

export function beginStartupWarmup(state) {
  if (!state || state.status === "ready" || state.status === "running") {
    return state?.status === "ready";
  }
  if (state.status === "failed" || state.status === "cancelled") {
    return false;
  }
  state.status = "running";
  state.startedAt = state.now();
  return false;
}

export function stepStartupWarmup(state, { budgetMs = 2, maxItems = 64, perform } = {}) {
  if (!state || state.status !== "running") {
    return { status: state?.status ?? "missing", processed: 0, done: state?.status === "ready" };
  }
  if (typeof perform !== "function") {
    throw new TypeError("startup warmup requires an item operation");
  }
  const frameStartedAt = state.now();
  let processed = 0;
  const itemLimit = Math.max(1, Math.floor(maxItems));
  const timeLimit = Math.max(0, Number(budgetMs) || 0);

  while (state.cursor < state.totalItems && processed < itemLimit) {
    if (processed > 0 && state.now() - frameStartedAt >= timeLimit) break;
    const item = state.plan[state.cursor];
    try {
      perform(item, state.cursor);
    } catch (error) {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : String(error);
      state.lastChunkMs = state.now() - frameStartedAt;
      state.maxChunkMs = Math.max(state.maxChunkMs, state.lastChunkMs);
      state.chunks += 1;
      return { status: state.status, processed, done: false, error: state.error };
    }
    state.cursor += 1;
    state.processedItems += 1;
    processed += 1;
  }

  const chunkMs = state.now() - frameStartedAt;
  state.frames += 1;
  state.chunks += 1;
  state.lastChunkMs = chunkMs;
  state.maxChunkMs = Math.max(state.maxChunkMs, chunkMs);
  if (state.cursor >= state.totalItems) {
    state.status = "ready";
    state.readyAt = state.now();
  }
  return { status: state.status, processed, done: state.status === "ready", chunkMs };
}

export function resetStartupWarmup(state) {
  // Once an item was allocated, resetting would duplicate a pool entry. A
  // caller must keep the partial state or reload the module-owned graph.
  if (!state || state.status === "running" || state.processedItems > 0) return false;
  state.status = "idle";
  state.cursor = 0;
  state.processedItems = 0;
  state.frames = 0;
  state.chunks = 0;
  state.startedAt = 0;
  state.readyAt = 0;
  state.lastChunkMs = 0;
  state.maxChunkMs = 0;
  state.error = null;
  return true;
}
