import { suiteUrl } from './quality-target.mjs';
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, sampleAnimationFrames } from "./quality-browser.mjs";

const baseUrl = await suiteUrl("/?autoplay=1&offline=1&quality=auto&perf=1");

const scenarios = [
  { name: "iphone17-pro-portrait", width: 402, height: 874, dpr: 3, stress: true },
  { name: "iphone17-pro-landscape", width: 874, height: 402, dpr: 3, stress: true },
  { name: "compact-portrait", width: 390, height: 844, dpr: 3, stress: false },
  { name: "large-portrait", width: 430, height: 932, dpr: 3, stress: false },
];

const browser = await chromium.launch(browserLaunchOptions);

try {
  const results = [];
  for (const scenario of scenarios) {
    try { results.push({ ok: true, ...(await runScenario(scenario)) }); }
    catch (error) { results.push({ name: scenario.name, ok: false, error: error.message }); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ ok: results.every((result) => result.ok), results }, null, 2));
} finally {
  await browser.close();
}

async function runScenario(scenario) {
  const page = await browser.newPage({
    viewport: { width: scenario.width, height: scenario.height },
    deviceScaleFactor: scenario.dpr,
    isMobile: true,
    hasTouch: true,
  });

  const telemetry = attachQualityTelemetry(page, scenario.name);
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

    const initialLayout = await page.evaluate(readMobileLayout);
    telemetry.report.initialLayout = initialLayout;
    assert(initialLayout.state === "playing", `${scenario.name} did not autoplay`);
    assert(initialLayout.viewport.width === scenario.width, `${scenario.name} viewport width mismatch`);
    assert(initialLayout.metaViewport.includes("viewport-fit=cover"), `${scenario.name} viewport-fit missing`);
    assert(initialLayout.hud.height <= getHudLimit(scenario), `${scenario.name} HUD too tall: ${initialLayout.hud.height}`);
    assert(initialLayout.touchStick.width >= 44 && initialLayout.touchStick.height >= 44, `${scenario.name} stick target too small`);
    assert(initialLayout.touchFire.width >= 44 && initialLayout.touchFire.height >= 44, `${scenario.name} fire target too small`);
    assert(initialLayout.touchControls.height <= 130, `${scenario.name} controls too tall: ${initialLayout.touchControls.height}`);
    assert(initialLayout.hud.bottom + 8 < initialLayout.touchControls.y, `${scenario.name} HUD overlaps controls`);
    assert(initialLayout.bodyOverflowX <= 1, `${scenario.name} has horizontal overflow: ${initialLayout.bodyOverflowX}`);

    if (scenario.height >= scenario.width) {
      assert(initialLayout.leaderboard.height <= 30, `${scenario.name} leaderboard is not collapsed`);
      assert(initialLayout.touchControls.bottom <= scenario.height - 8, `${scenario.name} controls ignore bottom safe area`);
    }

    let stress = null;
    if (scenario.stress) {
      await page.evaluate(() => window.__zombieNightDebug.stressLevel6(90));
      const frameSample = await page.evaluate(sampleAnimationFrames, 8_000);
      const perf = await page.evaluate(() => window.__zombieNightDebug.getPerfStats());
      const stressedLayout = await page.evaluate(readMobileLayout);
      telemetry.report.measurements = { frameSample, perf, stressedLayout };

      assert(perf.fpsAverage >= 45, `${scenario.name} perf FPS too low: ${perf.fpsAverage}`);
      assert(frameSample.averageFps >= 45, `${scenario.name} sampled FPS too low: ${frameSample.averageFps}`);
      assert(perf.entities.zombies >= 70, `${scenario.name} stress horde did not stay active`);
      assert(stressedLayout.hud.height <= getHudLimit(scenario), `${scenario.name} stressed HUD grew too tall`);

      stress = {
        frameSample,
        fpsAverage: perf.fpsAverage,
        sampledFps: frameSample.averageFps,
        quality: perf.quality,
        pixelRatio: perf.pixelRatio,
        drawCalls: perf.drawCalls,
        entities: perf.entities,
      };
    }

    telemetry.assertClean();
    return {
      name: scenario.name,
      viewport: initialLayout.viewport,
      profile: initialLayout.perf.mobileLayout.profile,
      orientation: initialLayout.perf.mobileLayout.isPortrait ? "portrait" : "landscape",
      hud: initialLayout.hud,
      touchControls: initialLayout.touchControls,
      leaderboard: initialLayout.leaderboard,
      stress,
    };
  } catch (error) {
    telemetry.fail(error);
    throw error;
  } finally {
    await telemetry.save();
    await page.close();
  }
}

function readMobileLayout() {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      return null;
    }

    const box = element.getBoundingClientRect();
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      bottom: Math.round(box.bottom),
    };
  };

  return {
    state: window.__zombieNightDebug.getState().state,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    metaViewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "",
    bodyOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    hud: rect(".survivor-hud"),
    touchControls: rect(".touch-controls"),
    touchStick: rect("#touch-stick"),
    touchFire: rect("#touch-fire"),
    leaderboard: rect(".leaderboard-panel"),
    partyList: rect(".party-list"),
    perf: window.__zombieNightDebug.getPerfStats(),
  };
}

function getHudLimit(scenario) {
  return scenario.height >= scenario.width ? 62 : 58;
}


function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
