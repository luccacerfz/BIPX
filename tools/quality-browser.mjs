import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium as playwrightChromium, webkit as playwrightWebkit } from "playwright";
import { gpuLockedBrowserType } from "./quality-gpu-lock.mjs";

// Every browser a suite launches through this module first takes the shared GPU reservation (tools/quality-gpu-lock.mjs):
// atomic mkdir of /tmp/bipx-arpg-gpu.lock, 2 s retries for up to 25 min, released when the suite process ends. Importing this
// module for `evidenceDir`/`sourceFingerprint` alone (CPU suites) never touches the lock.
const lockOwner = `quality:${path.basename(process.argv[1] || "node", ".mjs")}`;
export const chromium = gpuLockedBrowserType(playwrightChromium, lockOwner);
export const webkit = gpuLockedBrowserType(playwrightWebkit, lockOwner);
export const browserLaunchOptions = {
  headless: process.env.BIPX_HEADLESS !== "0",
  ...(process.env.BIPX_BROWSER_CHANNEL ? { channel: process.env.BIPX_BROWSER_CHANNEL } : {}),
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const suite = path.basename(process.argv[1], ".mjs");
export const evidenceDir = path.resolve(process.env.BIPX_EVIDENCE_DIR || `output/playwright/${stamp}-${suite}`);
fs.mkdirSync(evidenceDir, { recursive: true });

export function redactPrivate(value) {
  if (typeof value === 'string') return value
    .replace(/([?&]resumeToken=)[^&\s"'<>)]*/gi, '$1[REDACTED]')
    .replace(/("resumeToken"\s*:\s*")[^"]*/gi, '$1[REDACTED]');
  if (Array.isArray(value)) return value.map(redactPrivate);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key.toLowerCase() === 'resumetoken' ? '[REDACTED]' : redactPrivate(item)]));
  return value;
}

export function sourceFingerprint() {
  const files = new Set(["index.html", "styles.css", "server.mjs", "package.json", "package-lock.json"]);
  function visit(directory, allFiles = false) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(directory, entry.name);
      if (entry.name === "source-history") continue;
      if (entry.isDirectory()) visit(name, allFiles);
      else if (allFiles || /\.(mjs|js|json|glsl|css|html|wasm|bin|glb|gltf)$/.test(name)) files.add(name);
    }
  }
  visit("src");
  visit("vendor", true);
  visit("assets", true);
  return Object.fromEntries([...files].filter((file) => fs.existsSync(file)).sort().map((file) => [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
}

export async function waitForRuntimeAssets(page, telemetry, { timeoutMs = 45_000 } = {}) {
  const startedAt = Date.now();
  try {
    await page.waitForFunction(() => {
      const assets = window.__zombieNightDebug?.getPresentationStats?.().assets;
      const character = window.__bipxCharacters?.getState?.();
      const enemiesReady = !assets?.enemies || (assets.enemies.loaded && ['orc', 'monsters'].every(id => assets.enemies.libraries?.includes(id)));
      return assets?.errors?.length > 0 || character?.error || (assets?.hero?.loaded && assets?.world?.loaded && enemiesReady && !character?.loading);
    }, null, { timeout: timeoutMs });
  } catch (error) {
    const stats = await page.evaluate(() => window.__zombieNightDebug?.getPresentationStats?.() ?? null).catch(() => null);
    if (telemetry) telemetry.report.assetReadinessFailure = { message: error.message, stats };
    throw new Error(`Visual assets did not become ready within ${timeoutMs}ms: ${JSON.stringify(stats?.assets ?? null)}`);
  }
  const stats = await page.evaluate(async () => {
    await document.fonts.ready;
    // The load callback has attached the model; allow it to update skeletons and
    // reach rendering before captures or frame-time sampling begin.
    for (let frame = 0; frame < 3; frame += 1) await new Promise(requestAnimationFrame);
    return window.__zombieNightDebug.getPresentationStats();
  });
  const assets = stats.assets;
  const character = await page.evaluate(() => window.__bipxCharacters?.getState?.() ?? null);
  if (character?.error) throw new Error(`Selected character failed to load: ${character.error}`);
  if (assets.errors?.length) throw new Error(`Visual assets reported errors: ${JSON.stringify(assets.errors)}`);
  if (!(assets.hero.loaded && assets.hero.skinnedMeshes > 0 && assets.hero.bones > 0 && assets.hero.clips?.length > 0)) {
    throw new Error(`Loaded hero is missing skinned animation data: ${JSON.stringify(assets.hero)}`);
  }
  if (!(assets.world.loaded && assets.world.props > 0 && assets.world.batches > 0)) {
    throw new Error(`Loaded world is missing rendered prop batches: ${JSON.stringify(assets.world)}`);
  }
  const readiness = { observedAt: new Date().toISOString(), waitMs: Date.now() - startedAt, character, assets, atmosphere: stats.atmosphere, pipeline: stats.pipeline };
  if (telemetry) (telemetry.report.assetReadiness ??= []).push(readiness);
  return readiness;
}

export function attachQualityTelemetry(page, name) {
  const startedSources = sourceFingerprint();
  const report = {
    scenario: name,
    startedAt: new Date().toISOString(),
    evidenceKind: "real_browser_runtime",
    browserLaunch: browserLaunchOptions,
    syntheticFixture: false,
    screenshots: [],
    pageErrors: [],
    consoleErrors: [],
    warnings: [],
    failedRequests: [],
    httpErrors: [],
    assertions: "pending",
  };
  const responses = new WeakMap();
  page.on("pageerror", (error) => report.pageErrors.push(redactPrivate(error.stack || error.message)));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(redactPrivate({ message: message.text(), location: message.location() }));
    if (message.type() === "warning") report.warnings.push(redactPrivate(message.text()));
  });
  page.on("requestfailed", (request) => report.failedRequests.push(redactPrivate({ url: request.url(), failure: request.failure(), resourceType: request.resourceType(), method: request.method(), response: responses.get(request) ?? null, timing: request.timing(), observedAt: new Date().toISOString(), pageUrl: page.url() })));
  page.on("response", (response) => {
    responses.set(response.request(), { status: response.status(), contentType: response.headers()["content-type"], contentLength: response.headers()["content-length"] ?? null });
    if (response.status() >= 400) report.httpErrors.push(redactPrivate({ url: response.url(), status: response.status() }));
  });
  return {
    report,
    markFixture() { report.syntheticFixture = true; report.evidenceKind = "real_browser_with_debug_fixture"; },
    async capture(label) {
      const filename = `${name}-${label}.png`;
      await page.screenshot({ path: path.join(evidenceDir, filename), fullPage: true });
      report.screenshots.push(filename);
      return filename;
    },
    assertClean() {
      const failures = [report.pageErrors, report.consoleErrors, report.failedRequests, report.httpErrors].flat();
      if (failures.length) throw new Error(`${name}: browser diagnostics failed: ${JSON.stringify(failures)}`);
      report.assertions = "passed";
    },
    fail(error) { report.assertions = "failed"; report.failure = redactPrivate(error.stack || String(error)); },
    async save(details = {}) {
      Object.assign(report, redactPrivate(details));
      report.finishedAt = new Date().toISOString();
      report.url = redactPrivate(page.url());
      report.browser = page.context().browser()?.version();
      report.viewport = page.viewportSize();
      report.environment = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        devicePixelRatio,
        maxTouchPoints: navigator.maxTouchPoints,
        coarsePointer: matchMedia("(pointer: coarse)").matches,
        graphics: (() => {
          const canvas = document.querySelector("#game-canvas");
          const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
          if (!gl) return null;
          const extension = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            version: gl.getParameter(gl.VERSION),
            renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          };
        })(),
      })).catch(() => null);
      report.sourceHashes = startedSources;
      report.sourceHashScope = "Application src including nested render/assets/audio/vendor modules, root vendor runtime, assets including models/textures/audio, package metadata; unique paths; archived source-history excluded";
      report.sourceChangedDuringRun = JSON.stringify(startedSources) !== JSON.stringify(sourceFingerprint());
      await this.capture("final").catch((error) => { report.captureFailure = error.message; });
      fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(redactPrivate(report), null, 2)}\n`);
    },
  };
}

export function sampleAnimationFrames(durationMs) {
  return new Promise((resolve) => {
    const frames = [];
    const startedAt = performance.now();
    function tick(timestamp) {
      frames.push(timestamp);
      if (timestamp - startedAt >= durationMs) {
        const intervals = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b);
        const elapsedSeconds = Math.max((timestamp - frames[0]) / 1000, 0.001);
        const percentile = (p) => Number((intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * p) - 1)] || 0).toFixed(2));
        resolve({
          frames: frames.length,
          durationMs: Number((timestamp - frames[0]).toFixed(2)),
          averageFps: Number(((frames.length - 1) / elapsedSeconds).toFixed(1)),
          frameTimeP95Ms: percentile(0.95),
          frameTimeP99Ms: percentile(0.99),
          worstFrameMs: percentile(1),
          framesOver50Ms: intervals.filter((ms) => ms > 50).length,
          environmentLimit: "Chromium on this host; viewport emulation is not physical mobile hardware evidence",
        });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
