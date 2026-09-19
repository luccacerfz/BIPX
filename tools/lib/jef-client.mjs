// Minimal TypeSafe System One client for development tools (native fetch, no SDK: production has no npm install).
//   - POST https://api.typesafe.ai/v1/systemone with `Authorization: Bearer <key>`;
//   - retries 429 / 529 (and transport errors) with exponential backoff, honouring Retry-After, capped;
//   - 30 s timeout per attempt, enforced even when the injected fetch ignores AbortSignal;
//   - the key lives only in the request header; `redactSecrets` scrubs anything that goes to disk;
//   - `fetch`, `sleep` and `clock` are injectable so tests never touch the network.

import { ENDPOINT } from './jef-questions.mjs';

const KEY_PATTERNS = [/apikey_[A-Za-z0-9_-]+/g, /(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi];

export function redactSecrets(value, secrets = []) {
  const known = secrets.filter((secret) => typeof secret === 'string' && secret.length >= 6);
  const scrub = (text) => {
    let output = text;
    for (const secret of known) {
      output = output.split(secret).join('[REDACTED]');
      const escaped = JSON.stringify(secret).slice(1, -1);
      if (escaped !== secret) output = output.split(escaped).join('[REDACTED]');
    }
    return output.replace(KEY_PATTERNS[0], '[REDACTED]').replace(KEY_PATTERNS[1], '$1[REDACTED]');
  };
  if (typeof value === 'string') return scrub(value);
  if (value === undefined) return undefined;
  return JSON.parse(scrub(JSON.stringify(value)));
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createJefClient({ apiKey, fetch: fetchImpl = globalThis.fetch, endpoint = ENDPOINT, timeoutMs = 30_000, maxAttempts = 3, retryStatuses = [429, 529], baseDelayMs = 1000, maxBackoffMs = 10_000, sleep = defaultSleep, clock = () => performance.now() } = {}) {
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('createJefClient needs an apiKey (read it from TYPESAFE_API_KEY; never hard-code it).');
  if (typeof fetchImpl !== 'function') throw new Error('createJefClient needs a fetch implementation.');

  async function attempt(body) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error(`TypeSafe request timed out after ${timeoutMs} ms`), { timedOut: true })); }, timeoutMs); });
    try {
      const response = await Promise.race([
        fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: controller.signal }),
        timeout,
      ]);
      const text = await Promise.race([response.text(), timeout]);
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
      return { status: response.status, ok: response.ok, body: parsed, rawText: parsed === null ? text.slice(0, 2000) : undefined, retryAfter: Number(response.headers?.get?.('retry-after')) || null };
    } finally { clearTimeout(timer); }
  }

  async function ask(body) {
    const startedAt = clock();
    let last = null;
    for (let index = 0; index < maxAttempts; index += 1) {
      let retryDelayMs = null;
      try {
        const result = await attempt(body);
        last = { ok: result.ok && result.body !== null, status: result.status, body: result.body, error: result.ok ? (result.body === null ? 'Response was not JSON' : null) : `TypeSafe HTTP ${result.status}`, rawText: result.rawText, attempts: index + 1 };
        if (retryStatuses.includes(result.status)) retryDelayMs = Math.min(result.retryAfter ? result.retryAfter * 1000 : baseDelayMs * 2 ** index, maxBackoffMs);
      } catch (error) {
        last = { ok: false, status: null, body: null, error: redactSecrets(String(error?.message ?? error), [apiKey]), attempts: index + 1 };
        if (!error?.timedOut) retryDelayMs = Math.min(baseDelayMs * 2 ** index, maxBackoffMs);
      }
      if (retryDelayMs === null || index === maxAttempts - 1) break;
      await sleep(retryDelayMs);
    }
    return { ...last, latencyMs: Math.round(clock() - startedAt) };
  }

  return { ask, endpoint };
}
