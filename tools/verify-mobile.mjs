import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/?autoplay=1&offline=1&quality=auto&perf=1";
const playwrightRoot = findPlaywrightRoot();
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightRoot);

const scenarios = [
  { name: "iphone17-pro-portrait", width: 402, height: 874, dpr: 3, stress: true },
  { name: "iphone17-pro-landscape", width: 874, height: 402, dpr: 3, stress: true },
  { name: "compact-portrait", width: 390, height: 844, dpr: 3, stress: false },
  { name: "large-portrait", width: 430, height: 932, dpr: 3, stress: false },
];

const browser = await chromium.launch({ headless: true });

try {
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
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

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("offline", "1");
    url.searchParams.set("quality", "auto");
    url.searchParams.set("perf", "1");

    await page.goto(url.toString(), { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);

    const initialLayout = await page.evaluate(readMobileLayout);
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

      assert(perf.fpsAverage >= 45, `${scenario.name} perf FPS too low: ${perf.fpsAverage}`);
      assert(frameSample.averageFps >= 45, `${scenario.name} sampled FPS too low: ${frameSample.averageFps}`);
      assert(perf.entities.zombies >= 70, `${scenario.name} stress horde did not stay active`);
      assert(stressedLayout.hud.height <= getHudLimit(scenario), `${scenario.name} stressed HUD grew too tall`);

      stress = {
        fpsAverage: perf.fpsAverage,
        sampledFps: frameSample.averageFps,
        quality: perf.quality,
        pixelRatio: perf.pixelRatio,
        drawCalls: perf.drawCalls,
        entities: perf.entities,
      };
    }

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
  } finally {
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
