import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, sampleAnimationFrames } from "./quality-browser.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/?autoplay=1&offline=1&quality=auto&perf=1";

const browser = await chromium.launch(browserLaunchOptions);

const results = [];
try {
  for (const [name, viewport, minFps] of [
    ["desktop", { width: 1280, height: 720 }, 24],
    ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true }, 18],
  ]) {
    try { results.push({ name, ok: true, ...(await runStressScenario(name, viewport, minFps)) }); }
    catch (error) { results.push({ name, ok: false, error: error.message }); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ ok: results.every((result) => result.ok), results }, null, 2));
} finally {
  await browser.close();
}

async function runStressScenario(name, viewport, minFps) {
  const { width, height, ...contextOptions } = viewport;
  const page = await browser.newPage({ viewport: { width, height }, ...contextOptions });
  const telemetry = attachQualityTelemetry(page, name);
  telemetry.markFixture();
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("offline", "1");
    url.searchParams.set("quality", "auto");
    url.searchParams.set("perf", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await waitForRuntimeAssets(page, telemetry);
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.__zombieNightDebug.stressLevel6(90));
    const frameSample = await page.evaluate(sampleAnimationFrames, 12_000);
    const stats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const state = await page.evaluate(() => window.__zombieNightDebug.getState());
    telemetry.report.measurements = { frameSample, stats, state };
    await telemetry.capture("dense-measured");
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

    telemetry.assertClean();
    return {
      frameSample,
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
  } catch (error) {
    telemetry.fail(error);
    throw error;
  } finally {
    await telemetry.save();
    await page.close();
  }
}


function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
