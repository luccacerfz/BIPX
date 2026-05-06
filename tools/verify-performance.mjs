import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/?autoplay=1&offline=1&quality=auto&perf=1";
const playwrightRoot = findPlaywrightRoot();
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightRoot);

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await runStressScenario("desktop", { width: 1280, height: 720 }, 24);
  const mobile = await runStressScenario("mobile", { width: 390, height: 844, isMobile: true, hasTouch: true }, 18);

  console.log(JSON.stringify({ ok: true, desktop, mobile }, null, 2));
} finally {
  await browser.close();
}

async function runStressScenario(name, viewport, minFps) {
  const page = await browser.newPage({ viewport });
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("offline", "1");
    url.searchParams.set("quality", "auto");
    url.searchParams.set("perf", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.__zombieNightDebug.stressLevel6(90));
    const frameSample = await page.evaluate(sampleAnimationFrames, 12_000);
    const stats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const state = await page.evaluate(() => window.__zombieNightDebug.getState());
    const expansionsBeforeRestart = JSON.stringify(stats.poolExpansions);

    await page.evaluate(() => window.__zombieNightDebug.start());
    await page.waitForTimeout(900);
    const restartStats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const expansionsAfterRestart = JSON.stringify(restartStats.poolExpansions);

    assert(stats.fpsAverage >= minFps, `${name} FPS too low: ${stats.fpsAverage}`);
    assert(frameSample.averageFps >= minFps, `${name} sampled FPS too low: ${frameSample.averageFps}`);
    assert(stats.entities.zombies >= 70, `${name} stress horde did not stay active`);
    assert(stats.entities.effects <= 86, `${name} effect budget was not enforced`);
    assert(expansionsAfterRestart === expansionsBeforeRestart, `${name} pools kept expanding after restart`);
    assert(restartStats.entities.zombies < state.zombies, `${name} restart did not clear stress horde`);

    return {
      fpsAverage: stats.fpsAverage,
      sampledFps: frameSample.averageFps,
      quality: stats.quality,
      updateMs: stats.updateMs,
      renderMs: stats.renderMs,
      drawCalls: stats.drawCalls,
      entities: stats.entities,
      poolExpansions: stats.poolExpansions,
      restartEntities: restartStats.entities,
    };
  } finally {
    await page.close();
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
