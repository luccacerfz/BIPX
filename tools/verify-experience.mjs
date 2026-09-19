import { suiteUrl } from './quality-target.mjs';
import fs from "node:fs";
import path from "node:path";
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, evidenceDir, sampleAnimationFrames } from "./quality-browser.mjs";

const baseUrl = await suiteUrl("/?offline=1");
const browser = await chromium.launch(browserLaunchOptions);
const results = [];
try {
  for (const scenario of [
    { name: "desktop-experience", width: 1440, height: 900, mobile: false, character: "warrior" },
    { name: "compact-touch-experience", width: 390, height: 844, mobile: true, character: "dwarf" },
    { name: "landscape-touch-experience", width: 874, height: 402, mobile: true, character: "warrior" },
  ]) results.push(await runScenario(scenario));
  fs.writeFileSync(path.join(evidenceDir, "experience-summary.json"), `${JSON.stringify({ ok: true, results }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, evidenceDir, results }, null, 2));
} finally {
  await browser.close();
}

async function runScenario(scenario) {
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    deviceScaleFactor: scenario.mobile ? 3 : 1,
    isMobile: scenario.mobile,
    hasTouch: scenario.mobile,
    recordVideo: { dir: path.join(evidenceDir, "video"), size: { width: scenario.width, height: scenario.height } },
  });
  const page = await context.newPage();
  const telemetry = attachQualityTelemetry(page, scenario.name);
  let measured = {};
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("offline", "1");
    url.searchParams.delete("autoplay");
    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await waitForRuntimeAssets(page, telemetry);
    await page.waitForFunction(() => !!window.__zombieNightDebug && !!window.__bipxPresentation);
    await page.locator('#open-login-button').click();
    await page.locator(`label[for="character-${scenario.character}"]`).click();
    await waitForRuntimeAssets(page, telemetry);
    assert((await page.evaluate(() => window.__bipxCharacters.getState())).selected === scenario.character, "Visible character selector did not select the requested role");
    await page.locator('#login-back-button').click();
    await page.locator("#open-login-button").waitFor({ state: "visible" });
    await assertNoOverflow(page, scenario.name);
    await telemetry.capture("menu");

    await page.locator("#menu-help-button").click();
    await page.locator("#game-dialog[open]").waitFor();
    assert(await page.locator("#controls-content").isVisible(), "How to play did not open controls");
    await telemetry.capture("controls");
    await page.locator("#dialog-done").click();
    await page.locator("#menu-settings-button").click();
    await page.locator("#quality-select").selectOption("high");
    let settings = await page.evaluate(() => window.__bipxPresentation.getSettings());
    assert(settings.quality === "high", "Quality selector did not change actual renderer preference");
    await page.locator("#motion-toggle").check();
    settings = await page.evaluate(() => window.__bipxPresentation.getSettings());
    assert(settings.reducedMotion === true, "Reduced-motion control did not reach runtime preference");
    await telemetry.capture("settings");
    await page.locator("#dialog-done").click();
    await page.reload({ waitUntil: "networkidle" });
    await waitForRuntimeAssets(page, telemetry);
    assert((await page.evaluate(() => window.__bipxCharacters.getState())).selected === scenario.character, "Character selection did not persist across reload");
    await page.waitForFunction(() => !!window.__bipxPresentation);
    settings = await page.evaluate(() => window.__bipxPresentation.getSettings());
    assert(settings.quality === "high" && settings.reducedMotion === true, "Presentation settings did not persist across reload");
    await page.locator("#menu-settings-button").click();
    await page.locator("#quality-select").selectOption("auto");
    await page.locator("#motion-toggle").uncheck();
    await page.locator("#dialog-done").click();

    await page.locator("#menu-ranking-button").click();
    await page.locator("#ranking-back-button").waitFor({ state: "visible" });
    await telemetry.capture("ranking");
    await page.locator("#ranking-back-button").click();
    await page.locator("#open-login-button").click();
    await page.locator("#player-name").fill(scenario.mobile ? "QA Touch" : "QA Desktop");
    await telemetry.capture("login");
    await page.locator("#play-button").click();
    await page.waitForFunction(() => window.__zombieNightDebug.getState().state === "playing");
    await page.waitForTimeout(700);
    const initial = await page.evaluate(() => window.__zombieNightDebug.getState());
    const audio = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
    assert(audio.unlocked && audio.contextState === "running", "User interaction did not unlock AudioContext");
    assert(await page.locator("#message").evaluate((node) => getComputedStyle(node).display === "none" || node.classList.contains("is-hidden")), "Menu still intercepts gameplay");
    await telemetry.capture("playing");

    let activeInput;
    if (scenario.mobile) {
      const stick = await page.locator("#touch-stick").boundingBox();
      const fire = await page.locator("#touch-fire").boundingBox();
      assert(stick && fire && stick.width >= 44 && fire.width >= 44, "Touch targets missing or too small");
      const cdp = await context.newCDPSession(page);
      const point = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      point.y -= Math.min(30, stick.height / 3);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
      const firePoint = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point, firePoint] });
      await page.waitForTimeout(380);
      activeInput = await page.evaluate(() => window.__zombieNightDebug.getState());
      await telemetry.capture("simultaneous-touch-move-fire");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      assert(activeInput.player.z < initial.player.z - 0.1, "Actual touch drag did not move player");
    } else {
      await page.mouse.move(scenario.width * 0.7, scenario.height * 0.52);
      await page.keyboard.down("w");
      await page.mouse.down();
      await page.waitForTimeout(380);
      activeInput = await page.evaluate(() => window.__zombieNightDebug.getState());
      await telemetry.capture("keyboard-move-pointer-fire");
      await page.mouse.up();
      await page.keyboard.up("w");
      assert(activeInput.player.z < initial.player.z - 0.1, "Actual keyboard input did not move player");
    }
    if (scenario.character === "warrior") assert(activeInput.weapon === "katana" && activeInput.bullets === 0 && activeInput.swordSwingRemaining > 0, "Actual sword input did not animate melee without projectiles");
    else assert(activeInput.weapon === "pistol" && (activeInput.bullets > 0 || activeInput.kills > initial.kills), "Actual rifle input did not produce projectiles or hits");
    await page.waitForTimeout(200);
    const released = await page.evaluate(() => window.__zombieNightDebug.getState());
    await page.waitForTimeout(250);
    const settled = await page.evaluate(() => window.__zombieNightDebug.getState());
    assert(Math.abs(settled.player.z - released.player.z) < 0.1, "Movement remained stuck after input release");

    await page.locator("#pause-button").click();
    await page.locator("#game-dialog[open]").waitFor();
    const paused = await page.evaluate(() => window.__zombieNightDebug.getState());
    await page.waitForTimeout(450);
    const afterPause = await page.evaluate(() => window.__zombieNightDebug.getState());
    assert(paused.paused && afterPause.paused && afterPause.survivalTime === paused.survivalTime, "Solo pause did not freeze simulation time");
    await telemetry.capture("paused");
    await page.locator("#dialog-done").click();
    await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => window.__zombieNightDebug.getState());
    assert(!resumed.paused && resumed.survivalTime > afterPause.survivalTime, "Closing pause options did not resume simulation");
    const beforeMute = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
    await page.locator("#audio-toggle").click();
    const afterMute = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
    assert(afterMute.muted !== beforeMute.muted, "Visible audio toggle did not mute");
    await page.locator("#audio-toggle").click();
    await assertNoOverflow(page, scenario.name);
    const frameSample = await page.evaluate(sampleAnimationFrames, 3000);
    measured = { scenario: scenario.name, initial, activeInput, paused, afterPause, resumed, audio, frameSample, physicalDevice: false, audioListeningReview: "pending" };
    telemetry.report.measurements = measured;
    telemetry.assertClean();
    return measured;
  } catch (error) {
    telemetry.fail(error);
    throw error;
  } finally {
    await telemetry.save();
    const videoPath = await page.video()?.path();
    await context.close();
    if (videoPath) fs.writeFileSync(path.join(evidenceDir, `${scenario.name}-video.json`), `${JSON.stringify({ video: videoPath, source: "real browser capture with actual input", syntheticFixture: false }, null, 2)}\n`);
  }
}

async function assertNoOverflow(page, name) {
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  assert(overflow <= 1, `${name} horizontal page overflow: ${overflow}px`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
