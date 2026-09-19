import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir, waitForRuntimeAssets } from './quality-browser.mjs';

const scenarios = [
  { name: 'forward', keys: ['i', 'w'], moving: true },
  { name: 'stop', keys: ['i'], moving: false },
  { name: 'strafe-right', keys: ['i', 'd'], moving: true },
  { name: 'strafe-left-attack', keys: ['i', 'a', 'Space'], moving: true },
  { name: 'backward-attack', keys: ['i', 's', 'Space'], moving: true },
  { name: 'diagonal', keys: ['i', 'w', 'd'], moving: true },
  { name: 'reverse-diagonal', keys: ['i', 's', 'a'], moving: true },
  { name: 'idle', keys: [], moving: false },
];
const percentile = (samples, p) => samples.length ? [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * p) - 1] : null;
const browser = await chromium.launch(browserLaunchOptions);
const results = [];
try {
  for (const character of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: evidenceDir, size: { width: 1440, height: 900 } } });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `locomotion-${character}`);
    telemetry.report.scope = 'Real menu and keyboard input in the natural offline world; read-only controller observations. No target, health, camera, speed or clock fixtures. Contact telemetry is an authored-stance/IK diagnostic, not independent perceptual approval. Captured video requires review. Max upgrade speed and remote actors are outside this run.';
    const phases = [], held = new Set();
    async function keys(next) {
      for (const key of held) if (!next.includes(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of next) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
    }
    try {
      await page.goto(process.argv[2] || 'http://127.0.0.1:5173/?offline=1', { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${character}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`QA Motion ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      for (const scenario of scenarios) {
        await keys(scenario.keys);
        const samples = await page.evaluate(async () => {
          const samples = [], started = performance.now();
          await new Promise(resolve => {
            const sample = now => {
              const hero = window.__zombieNightDebug.getPresentationStats().assets.hero;
              const motion = hero.locomotion;
              samples.push({ elapsed: now - started, clip: hero.currentClip,
                gait: motion?.gait, direction: motion?.direction, timeScale: motion?.timeScale,
                speedMismatch: motion?.speedMismatch,
                contacts: motion?.footContacts?.map(foot => ({ ...foot, position: [...foot.position] })) ?? [] });
              if (now - started < 1800) requestAnimationFrame(sample); else resolve();
            };
            requestAnimationFrame(sample);
          });
          return samples;
        });
        const state = await page.evaluate(() => window.__zombieNightDebug.getState());
        const supported = samples.filter(sample => sample.elapsed >= 250).flatMap(sample => sample.contacts).filter(foot => foot.contact && Number.isFinite(foot.horizontalDrift));
        const drift = supported.map(foot => foot.horizontalDrift);
        const reach = supported.map(foot => foot.reachError).filter(Number.isFinite);
        const phase = { name: scenario.name, keys: scenario.keys, samples, state,
          supportedSamples: supported.length, plantedDriftP95Mps: percentile(drift, .95),
          reachErrorP95Meters: percentile(reach, .95), passed: false };
        phases.push(phase);
        assert.equal(state.state, 'playing', 'Natural world interrupted the locomotion sample');
        assert.ok(samples.every(sample => sample.gait), 'Locomotion telemetry missing');
        assert.ok(samples.flatMap(sample => sample.contacts).every(foot => foot.position.every(Number.isFinite)), 'Non-finite foot transform');
        if (scenario.moving) {
          assert.ok(supported.length > 8, `${scenario.name}: insufficient observed stance samples`);
          assert.ok(phase.plantedDriftP95Mps < .15, `${scenario.name}: planted foot drift ${phase.plantedDriftP95Mps} m/s`);
          assert.ok(phase.reachErrorP95Meters < .035, `${scenario.name}: unreachable foot support`);
        } else assert.equal(samples.at(-1).gait, 'Idle', 'Stopped character keeps locomoting');
        if (character === 'warrior') assert.equal(state.bullets, 0, 'Warrior emitted a projectile');
        phase.passed = true;
        if (['forward', 'strafe-left-attack', 'backward-attack', 'idle'].includes(scenario.name)) await telemetry.capture(scenario.name);
      }
      telemetry.assertClean();
    } catch (error) { telemetry.fail(error); process.exitCode = 1; }
    finally {
      await keys([]).catch(() => {});
      await telemetry.save({ measurements: { character, phases } });
      if (telemetry.report.sourceChangedDuringRun) { telemetry.report.assertions = 'candidate_changed_rerun_required'; process.exitCode = 1; }
      const video = page.video();
      await context.close();
      if (video) await video.saveAs(path.join(evidenceDir, `locomotion-${character}.webm`));
      results.push({ character, status: telemetry.report.assertions, sourceChangedDuringRun: telemetry.report.sourceChangedDuringRun,
        failure: telemetry.report.failure, phases: phases.map(({ samples, state, ...phase }) => phase) });
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'locomotion-game.json'), JSON.stringify({ results, perceptualApproval: 'pending' }, null, 2));
  console.log(JSON.stringify({ results, evidenceDir }));
}
