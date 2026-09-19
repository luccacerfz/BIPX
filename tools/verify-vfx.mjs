import fs from "node:fs";
import path from "node:path";
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, evidenceDir } from "./quality-browser.mjs";

const url = process.argv[2] || "http://127.0.0.1:5173/?offline=1&quality=high";
const browser = await chromium.launch(browserLaunchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const telemetry = attachQualityTelemetry(page, "vfx-integration");
telemetry.markFixture();
const results = [];
try {
  for (const [character, weapon, event] of [["warrior", "katana", "slash"], ["dwarf", "pistol", "muzzle"]]) {
    const menuUrl = new URL(url);
    menuUrl.searchParams.delete("autoplay");
    await page.goto(menuUrl.toString(), { waitUntil: "networkidle" });
    await waitForRuntimeAssets(page, telemetry);
    await page.locator('#open-login-button').click();
    await page.locator(`label[for="character-${character}"]`).click();
    await waitForRuntimeAssets(page, telemetry);
    await page.mouse.move(1050, 420);
    const before = await page.evaluate(() => {
      window.__zombieNightDebug.start();
      window.__zombieNightDebug.clearCombatEntities();
      return window.__zombieNightDebug.getVfxStats();
    });
    await page.mouse.down();
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => ({ vfx: window.__zombieNightDebug.getVfxStats(), presentation: window.__zombieNightDebug.getPresentationStats() }));
    await telemetry.capture(weapon);
    await page.mouse.up();
    const passed = after.vfx.events[event] > (before.events[event] || 0) && after.vfx.totalEmitted > before.totalEmitted;
    results.push({ character, weapon, expectedEvent: event, passed, before, after });
    assert(passed, `${weapon} fired without triggering actual ${event} integration`);
    assert(after.vfx.activeParticles <= after.vfx.particleCapacity, `${weapon} exceeded particle budget`);
    assert(after.vfx.activeGlyphs <= after.vfx.glyphCapacity, `${weapon} exceeded glyph budget`);
    assert(after.vfx.activeBeamSegments <= after.vfx.beamCapacity, `${weapon} exceeded beam budget`);
    assert(after.vfx.rejected === 0, `${weapon} submitted invalid effect coordinates/type`);
  }
  const enemyElements = [];
  for (const [type, family] of [['visor', 'glacial'], ['caster', 'void'], ['dinzo', 'toxic']]) {
    const before = await page.evaluate(type => {
      window.__zombieNightDebug.start();
      window.__zombieNightDebug.clearCombatEntities();
      const before = window.__zombieNightDebug.getElementalVfxStats();
      window.__zombieNightDebug.spawnZombieAhead(9, type);
      return before;
    }, type);
    await page.waitForFunction(({ family, count }) => window.__zombieNightDebug.getElementalVfxStats().events[`${family}Cast`] > count,
      { family, count: before.events[`${family}Cast`] }, { timeout: 10_000 });
    await telemetry.capture(`${family}-actual-cast`);
    await page.waitForFunction(({ family, count }) => window.__zombieNightDebug.getElementalVfxStats().events[`${family}Impact`] > count,
      { family, count: before.events[`${family}Impact`] }, { timeout: 10_000 });
    await telemetry.capture(`${family}-actual-impact`);
    const after = await page.evaluate(() => window.__zombieNightDebug.getElementalVfxStats());
    assert(after.events[`${family}Trail`] > before.events[`${family}Trail`], `${type}: actual travel did not emit a trail`);
    assert(after.rejected === 0, `${type}: rejected elemental event`);
    enemyElements.push({ type, family, before, after });
  }
  const modes = [];
  for (const quality of ["high", "medium", "low"]) {
    const stats = await page.evaluate((quality) => {
      window.__bipxPresentation.setQuality(quality);
      return { vfx: window.__zombieNightDebug.getVfxStats(), elemental: window.__zombieNightDebug.getElementalVfxStats(), presentation: window.__zombieNightDebug.getPresentationStats() };
    }, quality);
    assert(stats.vfx.quality === quality && stats.presentation.pipeline.quality === quality, `Quality ${quality} did not reach VFX and postprocessing`);
    assert(stats.elemental.quality === quality, `Quality ${quality} did not reach elemental VFX`);
    assert(stats.presentation.pipeline.passes === (quality === "high" ? 5 : 2), `Unexpected ${quality} postprocessing pass budget`);
    modes.push({ quality, stats });
    await page.waitForTimeout(100);
    await telemetry.capture(`quality-${quality}`);
  }
  const reduced = await page.evaluate(() => {
    window.__bipxPresentation.setReducedMotion(true);
    return window.__zombieNightDebug.getVfxStats();
  });
  assert(reduced.reducedMotion, "Reduced motion did not reach VFX engine");
  assert(await page.evaluate(() => window.__zombieNightDebug.getElementalVfxStats().reducedMotion), 'Reduced motion did not reach elemental VFX');
  const restarted = await page.evaluate(() => {
    window.__zombieNightDebug.start();
    return window.__zombieNightDebug.getVfxStats();
  });
  assert(restarted.attachedWeapons === 0, "Restart retained weapon-specific emitter attachments");
  telemetry.report.measurements = { results, enemyElements, modes, reduced, restarted };
  telemetry.report.coverageLimit = "Actual fixed-class sword/rifle and elemental enemy cast/trail/contact paths, shader compilation and quality budgets. Enemies are explicitly placed by a debug fixture; clearCombatEntities increases health. AI release and projectile collision execute unmodified. This is not natural spawning, subjective play or authoritative network-impact evidence. The full 21-effect catalogue is a separate synthetic fixture.";
  telemetry.assertClean();
  console.log(JSON.stringify({ ok: true, evidenceDir, classes: results.map(({ character, passed }) => ({ character, passed })), enemyElements: enemyElements.map(({ type, after }) => ({ type, events: after.events })), qualityModes: modes.map(mode => mode.quality), reducedMotion: reduced.reducedMotion }));
} catch (error) {
  telemetry.report.partialResults = results;
  telemetry.fail(error);
  throw error;
} finally {
  await telemetry.save();
  await browser.close();
}
function assert(condition, message) { if (!condition) throw new Error(message); }
