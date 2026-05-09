import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/?autoplay=1&offline=1&quality=auto&perf=1";
const playwrightRoot = findPlaywrightRoot();
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightRoot);

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await runStressScenario("desktop-lv16", { width: 1280, height: 720 }, 45);
  const mobile = await runStressScenario(
    "iphone17-lv16",
    { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    45,
  );

  console.log(JSON.stringify({ ok: true, desktop, mobile }, null, 2));
} finally {
  await browser.close();
}

async function runStressScenario(name, viewport, minFps) {
  const { width, height, ...contextOptions } = viewport;
  const context = await browser.newContext({ viewport: { width, height }, ...contextOptions });
  const page = await context.newPage();

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("offline", "1");
    url.searchParams.set("quality", "auto");
    url.searchParams.set("perf", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    await page.evaluate(() => window.__zombieNightDebug.stressLevel16(170));
    const frameSample = await page.evaluate(sampleAnimationFrames, 12_000);
    const stats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const state = await page.evaluate(() => window.__zombieNightDebug.getState());
    const integrity = await page.evaluate(() => window.__zombieNightDebug.getRenderIntegrity());
    const expansionsBeforeRestart = JSON.stringify(stats.poolExpansions);

    await page.evaluate(() => window.__zombieNightDebug.start());
    await page.waitForTimeout(900);
    const restartStats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const expansionsAfterRestart = JSON.stringify(restartStats.poolExpansions);

    assert(state.level >= 16, `${name} did not reach level 16`);
    assert(stats.entities.zombies >= 160, `${name} stress horde too small: ${stats.entities.zombies}`);
    assert(stats.instancedZombies >= 125, `${name} did not instance enough monsters: ${stats.instancedZombies}`);
    assert(stats.drawCalls < 130, `${name} draw calls too high: ${stats.drawCalls}`);
    assert(stats.entities.damageNumbers <= 42, `${name} damage number budget was not enforced`);
    assert(stats.fpsAverage >= minFps, `${name} FPS too low: ${stats.fpsAverage}`);
    assert(frameSample.averageFps >= minFps, `${name} sampled FPS too low: ${frameSample.averageFps}`);
    assert(stats.entities.effects <= 24, `${name} late-game effect budget was not enforced`);
    assert(integrity.invisibleZombies === 0, `${name} has invisible active zombies: ${integrity.invisibleZombies}`);
    assert(integrity.invisibleThreats === 0, `${name} has invisible threats: ${integrity.invisibleThreats}`);
    assert(integrity.closeInstancedThreats === 0, `${name} has close instanced threats: ${integrity.closeInstancedThreats}`);
    assert(integrity.objectAllocWarnings === 0, `${name} render fallback warnings: ${integrity.objectAllocWarnings}`);
    assert(expansionsAfterRestart === expansionsBeforeRestart, `${name} pools kept expanding after restart`);
    assert(restartStats.entities.zombies < state.zombies, `${name} restart did not clear stress horde`);

    return {
      fpsAverage: stats.fpsAverage,
      sampledFps: frameSample.averageFps,
      quality: stats.quality,
      pixelRatio: stats.pixelRatio,
      logicMs: stats.logicMs,
      renderMs: stats.renderMs,
      drawCalls: stats.drawCalls,
      visibleDetailedZombies: stats.visibleDetailedZombies,
      instancedZombies: stats.instancedZombies,
      labelUpdates: stats.labelUpdates,
      gridQueries: stats.gridQueries,
      renderIntegrity: integrity,
      entities: stats.entities,
      poolExpansions: stats.poolExpansions,
      restartEntities: restartStats.entities,
    };
  } finally {
    await context.close();
  }
}

function sampleAnimationFrames(durationMs) {
  return new Promise((resolve) => {
    const frames = [];
    const startedAt = performance.now();

    function tick(timestamp) {
      frames.push(timestamp);
      if (timestamp - startedAt >= durationMs) {
        const elapsedSeconds = Math.max((timestamp - frames[0]) / 1000, 0.001);
        resolve({
          frames: frames.length,
          averageFps: Number((frames.length / elapsedSeconds).toFixed(1)),
        });
        return;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}

function findPlaywrightRoot() {
  const paths = process.env.PATH.split(path.delimiter);

  for (const searchPath of paths) {
    const binaryPath = path.join(searchPath, "playwright");

    if (fs.existsSync(binaryPath)) {
      return path.dirname(fs.realpathSync(binaryPath));
    }
  }

  throw new Error("Playwright binary not found in PATH");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
