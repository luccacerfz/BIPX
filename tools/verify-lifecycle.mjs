import { suiteUrl } from './quality-target.mjs';
import fs from "node:fs";
import path from "node:path";
import { attachAllocationTrace } from "./arpg-resource-allocation-trace.mjs";
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, evidenceDir } from "./quality-browser.mjs";

const browser = await chromium.launch(browserLaunchOptions);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const telemetry = attachQualityTelemetry(page, "lifecycle-keyboard");
const cannonLifecycle = process.env.BIPX_LIFECYCLE_CANNON === '1';
const details = { keyboardFocus: [], restarts: [], coverageLimit: "Short lifecycle regression. Does not prove long-session stability, screen-reader behavior, complete contrast/zoom coverage or adverse network recovery." };
try {
  if (cannonLifecycle && process.env.BIPX_LIFECYCLE_UUID === '1') details.allocationTrace = await attachAllocationTrace(page);
  await page.addInitScript(() => {
    window.__lifecycleFocusEvents = [];
    const record = event => {
      const read = () => ({ type: event.type, at: performance.now(), hidden: document.hidden, focused: document.hasFocus(), game: window.__zombieNightDebug?.getState?.().state, paused: window.__zombieNightDebug?.getState?.().paused });
      window.__lifecycleFocusEvents.push(read());
      setTimeout(() => window.__lifecycleFocusEvents.push({ ...read(), afterHandlers: true }), 0);
    };
    window.addEventListener('focus', record); window.addEventListener('blur', record);
    document.addEventListener('visibilitychange', record);
  });
  await page.goto(await suiteUrl("/?offline=1"), { waitUntil: "networkidle" });
  await waitForRuntimeAssets(page, telemetry);
  // Traverse the actual tab order; do not programmatically focus the target.
  let helpFocused = false;
  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.id || "");
    details.keyboardFocus.push(id);
    if (id === "menu-help-button") { helpFocused = true; break; }
  }
  assert(helpFocused, "Keyboard tab order did not reach How to play");
  await page.keyboard.press("Enter");
  await page.locator("#game-dialog[open]").waitFor();
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => ({ inside: document.querySelector("#game-dialog").contains(document.activeElement), documentFocused: document.hasFocus(), tag: document.activeElement?.tagName, id: document.activeElement?.id }));
    (details.modalFocus ??= []).push(focus);
    // Native dialogs may tab into browser chrome. That is not an interactive
    // background-page focus escape; retain evidence of the distinction.
    assert(focus.inside || (!focus.documentFocused && focus.tag === "BODY"), `Tab focused the background while modal: ${JSON.stringify(focus)}`);
  }
  await page.keyboard.press("Escape");
  assert(await page.evaluate(() => document.activeElement?.id === "menu-help-button"), "Closing dialog did not restore keyboard focus to opener");
  assert(await page.evaluate(() => window.__zombieNightDebug.getState().state !== "playing"), "Keyboard help dialog accidentally started gameplay");
  await page.locator("#open-login-button").click();
  if (cannonLifecycle) {
    await page.locator('label[for="character-dwarf"]').click();
    await waitForRuntimeAssets(page, telemetry);
  }
  await page.locator("#player-name").fill("QA Lifecycle");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === "playing");
  await page.waitForTimeout(250);
  // Playwright enables focus emulation for each Chromium page. Disable it here
  // so a real tab switch can produce actual blur/visibility lifecycle events.
  const mainCdp = await context.newCDPSession(page);
  await mainCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront();
  const beforeBlur = await page.evaluate(() => window.__zombieNightDebug.getState());
  const other = await context.newPage();
  const otherCdp = await context.newCDPSession(other);
  await otherCdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(350);
  details.tabSwitch = { original: await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus(), state: window.__zombieNightDebug.getState() })), other: await other.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() })) };
  await page.bringToFront();
  const blurred = await page.evaluate(() => window.__zombieNightDebug.getState());
  details.focusEvents = await page.evaluate(() => window.__lifecycleFocusEvents);
  assert(blurred.paused, "Leaving the actual tab did not pause a solo game");
  await page.waitForTimeout(250);
  const held = await page.evaluate(() => window.__zombieNightDebug.getState());
  assert(held.survivalTime === blurred.survivalTime, "Blur pause did not hold simulation time");
  await page.keyboard.press("Escape");
  await page.locator("#game-dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const resumed = await page.evaluate(() => window.__zombieNightDebug.getState());
  assert(!resumed.paused && resumed.survivalTime > held.survivalTime, "Player could not resume a game paused by tab switch");
  await other.close();
  details.blur = { beforeBlur, blurred, held, resumed };

  telemetry.markFixture();
  const lifecycleCycles = cannonLifecycle ? 6 : 3;
  for (let cycle = 0; cycle < lifecycleCycles; cycle += 1) {
    const cannonPhase = ['cast', 'travel', 'impact'][cycle % 3];
    let cannonBeforeDeath;
    if (details.allocationTrace) await page.evaluate(p=>window.__gpuAllocationPhase=p,`cycle-${cycle + 1}-${cannonPhase}`);
    if (cannonLifecycle) {
      await page.locator('#game-canvas').focus();
      await page.waitForFunction(()=>window.__zombieNightDebug.getArpgState().skills[0].enabled);
      await page.keyboard.down('i');await page.keyboard.press('1');await page.keyboard.up('i');
      await page.waitForFunction(phase=>window.__zombieNightDebug.getClassSkillVfxStats().cannon.casts.some(c=>c.phase===phase),cannonPhase);
      cannonBeforeDeath=await page.evaluate(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon);
    }
    await page.evaluate(() => window.__zombieNightDebug.damagePlayer(999999));
    await page.waitForFunction(() => window.__zombieNightDebug.getState().state === "dead");
    await page.waitForTimeout(350);
    const dead = await page.evaluate(() => ({ game: window.__zombieNightDebug.getState(), presentation: window.__zombieNightDebug.getPresentationStats() }));
    assert(dead.game.health <= 0 && dead.presentation.assets.hero.currentClip === "Death", "Death did not reach health state and imported hero animation");
    if (cannonLifecycle) {
      dead.cannon=await page.evaluate(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon);
      (details.cannonLifecycleAttempts ??= []).push({phase:cannonPhase,beforeDeath:cannonBeforeDeath,afterDeath:dead.cannon});
      assert(dead.cannon.casts.length===0,'Death retained cannon presentation');
    }
    assert(await page.locator("#play-button").isVisible(), "Game over did not offer a visible restart");
    await telemetry.capture(`death-${cycle + 1}`);
    await page.locator("#play-button").click();
    await page.waitForFunction(() => window.__zombieNightDebug.getState().state === "playing");
    await waitForRuntimeAssets(page, telemetry);
    await page.waitForTimeout(250);
    const restarted = await page.evaluate(() => ({ game: window.__zombieNightDebug.getState(), presentation: window.__zombieNightDebug.getPresentationStats(), vfx: window.__zombieNightDebug.getVfxStats(), perf: window.__zombieNightDebug.getPerfStats() }));
    assert(restarted.game.health === restarted.game.maxHealth && restarted.game.kills === 0 && restarted.game.score === 0, "Restart did not reset health and score");
    assert(restarted.game.survivalTime < 2 && !restarted.game.paused, "Restart retained time or pause state");
    assert(restarted.presentation.assets.hero.currentClip !== "Death", "Restart retained dead character animation");
    assert(restarted.vfx.attachedWeapons === 0, "Restart retained temporary weapon emitters");
    assert(restarted.perf.renderIntegrity.invisibleThreats === 0, "Restart created invisible threats");
    if (cannonLifecycle) {
      restarted.cannon=await page.evaluate(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon);
      assert(restarted.cannon.casts.length===0,'Restart retained cannon presentation');
    }
    if (details.allocationTrace) restarted.allocationSnapshot=await page.evaluate(()=>window.__gpuAllocationSnapshot());
    details.restarts.push({ cannonBeforeDeath, dead, restarted });
  }
  const resources = details.restarts.map(({ restarted }) => restarted.presentation.resources).filter(Boolean);
  if (resources.length === lifecycleCycles) {
    // Cannon needs the first full cast/travel/impact sequence to render all
    // lazily uploaded phases before repeating the identical sequence.
    const warmIndex = cannonLifecycle ? 2 : 0;
    const baseline = resources[warmIndex];
    assert(resources.slice(warmIndex + 1).every(r => r.geometries <= baseline.geometries && r.textures <= baseline.textures), "GPU geometry/texture counts grow across repeated restart");
    if (details.allocationTrace) {
      const warm = details.restarts[warmIndex].restarted.allocationSnapshot;
      const deltas = details.restarts.slice(warmIndex + 1).map(r=>{const snap=r.restarted.allocationSnapshot;return {phase:snap.phase,geometries:snap.geometries.filter(x=>!warm.geometries.some(w=>w.uuid===x.uuid)),textures:snap.textures.filter(x=>!warm.textures.some(w=>w.uuid===x.uuid))}});
      details.allocationDeltasAfterWarm=deltas;
      assert(deltas.every(d=>d.geometries.length===0&&d.textures.length===0),'New GPU resource UUIDs appeared after full phase warmup');
    }
    details.resourceStability = { observed: true, counts: resources, warmIndex, repeatedPhases: cannonLifecycle ? ['cast','travel','impact'] : null };
  } else details.resourceStability = { observed: false, reason: "Runtime GPU resource counts not exposed" };
  telemetry.report.measurements = details;
  telemetry.assertClean();
  console.log(JSON.stringify({ ok: true, evidenceDir, details }, null, 2));
} catch (error) {
  telemetry.report.measurements = details;
  telemetry.fail(error);
  process.exitCode = 1;
} finally {
  await telemetry.save();
  await browser.close();
}
function assert(condition, message) { if (!condition) throw new Error(message); }
