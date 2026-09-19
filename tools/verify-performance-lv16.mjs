import { suiteUrl } from './quality-target.mjs';
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, sampleAnimationFrames } from "./quality-browser.mjs";

const baseUrl = await suiteUrl("/?autoplay=1&offline=1&quality=auto&perf=1");

const browser = await chromium.launch(browserLaunchOptions);

const results = [];
try {
  for (const [name, viewport, minFps] of [
    ["desktop-lv16", { width: 1280, height: 720 }, 24],
    ["iphone17-lv16", { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 42],
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
  const context = await browser.newContext({ viewport: { width, height }, ...contextOptions });
  const page = await context.newPage();

  const telemetry = attachQualityTelemetry(page, name);
  telemetry.markFixture();
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("offline", "1");
    url.searchParams.set("quality", "auto");
    url.searchParams.set("perf", "1");
    url.searchParams.set("monsterLod", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await waitForRuntimeAssets(page, telemetry);
    await page.waitForTimeout(1400);
    await page.evaluate(() => window.__zombieNightDebug.stressLevel16(360));
    const frameSample = await page.evaluate(sampleAnimationFrames, 12_000);
    const stats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const state = await page.evaluate(() => window.__zombieNightDebug.getState());
    telemetry.report.measurements = { frameSample, stats, state };
    await telemetry.capture("dense-measured");
    const integrity = await page.evaluate(() => window.__zombieNightDebug.getRenderIntegrity());
    const expansionsBeforeRestart = JSON.stringify(stats.poolExpansions);

    await page.evaluate(() => window.__zombieNightDebug.start());
    await page.waitForTimeout(900);
    const restartStats = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
    const expansionsAfterRestart = JSON.stringify(restartStats.poolExpansions);

    assert(state.level >= 16, `${name} did not reach level 16`);
    assert(stats.entities.zombies >= 340, `${name} stress horde too small: ${stats.entities.zombies}`);
    assert(stats.instancedZombies >= 120, `${name} did not keep far monsters rendered efficiently: ${stats.instancedZombies}`);
    assert(stats.visibleDetailedZombies >= 10, `${name} did not keep enough detailed monsters visible: ${stats.visibleDetailedZombies}`);
    assert(stats.drawCalls < 390, `${name} draw calls too high for high-visibility hordes: ${stats.drawCalls}`);
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

    telemetry.assertClean();
    return {
      frameSample,
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
  } catch (error) {
    telemetry.fail(error);
    throw error;
  } finally {
    await telemetry.save();
    await context.close();
  }
}


function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
