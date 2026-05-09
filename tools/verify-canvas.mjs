import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const url = process.argv[2] ?? "http://127.0.0.1:5173/?autoplay=1";
const playwrightRoot = findPlaywrightRoot();
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightRoot);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const initial = await page.evaluate(() => window.__zombieNightDebug.getState());
  const initialAudio = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
  const toggledAudio = await page.evaluate(() => window.__zombieNightDebug.toggleMute());
  const restoredAudio = await page.evaluate(() => window.__zombieNightDebug.toggleMute());
  const leaderboardHeaders = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".main-menu__ranking-row--head span")).map((element) =>
      element.textContent.trim(),
    ),
  );
  const leaderboardAvatars = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".menu-player__avatar")).map((element) => ({
      tier: element.getAttribute("data-tier"),
      title: element.getAttribute("title") || "",
      label: element.querySelector(".menu-player__avatar-rank")?.textContent?.trim() || "",
    })),
  );
  const avatarTierProbe = await page.evaluate(() => window.__zombieNightDebug.getAvatarTierForScore(2000));

  await page.keyboard.down("w");
  await page.waitForTimeout(450);
  await page.keyboard.up("w");

  const moved = await page.evaluate(() => window.__zombieNightDebug.getState());

  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.waitForTimeout(250);

  const fired = await page.evaluate(() => window.__zombieNightDebug.getState());
  await page.mouse.up();

  const beforeAutoWeapon = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(14, "runner");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(1250);
  const afterAutoWeapon = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeXpPickup = await page.evaluate(() => {
    window.__zombieNightDebug.spawnXpGem(3);
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(450);
  const afterXpPickup = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeLevelUp = await page.evaluate(() => {
    const state = window.__zombieNightDebug.getState();
    window.__zombieNightDebug.grantXp(state.xpToNext);
    return state;
  });
  const levelUpChoices = await page.evaluate(() => window.__zombieNightDebug.getState());
  await page.keyboard.press("Digit1");
  const afterUpgradeChoice = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeFlame = await page.evaluate(() => {
    window.__zombieNightDebug.equipWeapon("flamethrower");
    window.__zombieNightDebug.spawnZombieAhead(3.4, "runner");
    return window.__zombieNightDebug.getState();
  });

  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();

  const afterFlame = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeAxe = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(2.4);
    window.__zombieNightDebug.equipWeapon("axe");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(250);
  const afterAxe = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeKatana = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(3, "runner");
    window.__zombieNightDebug.equipWeapon("katana");
    return window.__zombieNightDebug.getState();
  });

  await page.mouse.down();
  await page.waitForTimeout(160);
  await page.mouse.up();

  const afterKatana = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeCrossbow = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(5, "runner");
    window.__zombieNightDebug.equipWeapon("crossbow");
    return window.__zombieNightDebug.getState();
  });

  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();

  const afterCrossbow = await page.evaluate(() => window.__zombieNightDebug.getState());

  const beforeTalisman = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(4.4, "runner");
    window.__zombieNightDebug.equipWeapon("talisman");
    return window.__zombieNightDebug.getState();
  });

  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();

  const afterTalisman = await page.evaluate(() => window.__zombieNightDebug.getState());

  const monsterState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(8, "brute");
    window.__zombieNightDebug.spawnZombieAhead(9, "caster");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(300);
  const casterState = await page.evaluate(() => window.__zombieNightDebug.getState());

  const bossState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(11, "visor");
    window.__zombieNightDebug.spawnZombieAhead(12, "himetrica");
    window.__zombieNightDebug.spawnZombieAhead(13, "dinzo");
    window.__zombieNightDebug.spawnZombieAhead(14, "sofra");
    window.__zombieNightDebug.spawnZombieAhead(15, "gitcity");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(400);
  const lateSpawn = await page.evaluate(() => {
    window.__zombieNightDebug.setSurvivalTime(85);
    return window.__zombieNightDebug.getState();
  });

  const rarityDropState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnPerkDrop("soulMagnet", "rare");
    window.__zombieNightDebug.spawnPerkDrop("sealRitual", "epic");
    window.__zombieNightDebug.spawnPerkDrop("cuttingMoon", "legendary");
    return window.__zombieNightDebug.getState();
  });

  const chestDropState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnBossRewardChest("visor");
    return window.__zombieNightDebug.getState();
  });

  const bossRewardChoices = await page.evaluate(() => {
    window.__zombieNightDebug.setLevel(10);
    window.__zombieNightDebug.openBossReward("visor");
    return window.__zombieNightDebug.getState();
  });

  const evolutionState = await page.evaluate(() => {
    window.__zombieNightDebug.chooseUpgrade(0);
    window.__zombieNightDebug.grantPerk("bladeEcho");
    window.__zombieNightDebug.grantPerk("bladeEcho");
    return window.__zombieNightDebug.getState();
  });

  const canvas = await page.evaluate(readCanvasStats);

  assert(initial.state === "playing", "game did not enter playing state");
  assert(typeof initialAudio.supported === "boolean", "audio debug state did not expose support flag");
  assert(typeof initialAudio.muted === "boolean", "audio debug state did not expose mute flag");
  assert(toggledAudio.muted !== initialAudio.muted, "audio mute toggle did not change state");
  assert(restoredAudio.muted === initialAudio.muted, "audio mute toggle did not restore state");
  assert(leaderboardHeaders.includes("Level"), "leaderboard header did not include Level column");
  assert(leaderboardHeaders.includes("Pontuação"), "leaderboard header did not include score column");
  assert(avatarTierProbe.tier === "diamond", "score-based diamond avatar threshold is wrong");
  assert(
    leaderboardAvatars.every((avatar) =>
      ["bronze", "silver", "gold", "platinum", "diamond", "master", "legend"].includes(avatar.tier),
    ),
    "leaderboard avatar tier outside score rank set",
  );
  assert(initial.wave >= 1, "wave did not start");
  assert(initial.zombies >= 1, "zombies did not spawn");
  assert(initial.powerups === 0, "weapon powerups spawned without kills");
  assert(moved.player.z < initial.player.z - 0.1, "keyboard movement did not change player position");
  assert(fired.bullets >= 1, "shooting did not create bullets");
  assert(initial.autoWeapons.guardianBlade === 1, "guardian blade did not start unlocked");
  assert(afterAutoWeapon.score > beforeAutoWeapon.score, "automatic weapon did not defeat a monster without shooting");
  assert(afterAutoWeapon.xpGems > beforeAutoWeapon.xpGems, "defeated monster did not drop XP");
  assert(afterXpPickup.xp > beforeXpPickup.xp || afterXpPickup.level > beforeXpPickup.level, "XP gem was not collected");
  assert(levelUpChoices.level > beforeLevelUp.level, "XP did not trigger level up");
  assert(levelUpChoices.pendingUpgradeChoices.length >= 1, "level up did not create upgrade choices");
  assert(JSON.stringify(afterUpgradeChoice.build) !== JSON.stringify(levelUpChoices.build), "upgrade choice did not alter build");
  assert(beforeFlame.weapon === "flamethrower", "flamethrower did not equip");
  assert(afterFlame.score > beforeFlame.score, "flamethrower did not defeat a monster");
  assert(beforeAxe.weapon === "axe", "axe did not equip");
  assert(afterAxe.score > beforeAxe.score, "axe spin did not defeat a zombie");
  assert(beforeKatana.weapon === "katana", "katana did not equip");
  assert(afterKatana.score > beforeKatana.score, "katana slash did not defeat a runner");
  assert(beforeCrossbow.weapon === "crossbow", "crossbow did not equip");
  assert(afterCrossbow.score > beforeCrossbow.score, "crossbow did not defeat a runner");
  assert(beforeTalisman.weapon === "talisman", "talisman did not equip");
  assert(afterTalisman.score > beforeTalisman.score, "talisman blast did not defeat a runner");
  assert(
    afterTalisman.powerupDetails.some((powerup) => powerup.hasLabel && powerup.label.startsWith("1 ")),
    "kill weapon drop did not create a labeled pickup",
  );
  assert(monsterState.monsters.brute >= 1, "brute monster did not spawn");
  assert(monsterState.monsters.caster >= 1, "caster monster did not spawn");
  assert(casterState.enemyProjectiles >= 1 || casterState.health < monsterState.health, "caster did not attack");
  assert(bossState.monsters.visor >= 1, "Visor boss did not spawn");
  assert(bossState.monsters.himetrica >= 1, "Himetrica boss did not spawn");
  assert(bossState.monsters.dinzo >= 1, "Dinzo boss did not spawn");
  assert(bossState.monsters.sofra >= 1, "Sofra boss did not spawn");
  assert(bossState.monsters.gitcity >= 1, "GitCity boss did not spawn");
  assert(bossState.bossLabels.visor >= 1, "Visor label did not spawn");
  assert(bossState.bossLabels.himetrica >= 1, "Himetrica label did not spawn");
  assert(bossState.bossLabels.dinzo >= 1, "Dinzo label did not spawn");
  assert(bossState.bossLabels.sofra >= 1, "Sofra label did not spawn");
  assert(bossState.bossLabels.gitcity >= 1, "GitCity label did not spawn");
  assert(lateSpawn.enemyProjectileDetails.some((projectile) => projectile.source === "visor" && projectile.kind === "evilEye"), "Visor did not fire an evil-eye projectile");
  assert(lateSpawn.enemyProjectileDetails.some((projectile) => projectile.source === "himetrica" && projectile.kind === "lightning"), "Himetrica did not fire a lightning projectile");
  assert(lateSpawn.enemyProjectileDetails.some((projectile) => projectile.source === "dinzo" && projectile.kind === "boleto"), "Dinzo did not fire a boleto projectile");
  assert(lateSpawn.enemyProjectileDetails.some((projectile) => projectile.source === "sofra" && projectile.kind === "briefcase"), "Sofra did not fire a briefcase projectile");
  assert(lateSpawn.enemyProjectileDetails.some((projectile) => projectile.source === "gitcity" && projectile.kind === "airplane"), "GitCity did not fire a tiny airplane projectile");
  assert(lateSpawn.spawnInterval < initial.spawnInterval, "zombie spawn interval did not increase over time");
  assert(rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "rare"), "rare perk drop did not spawn");
  assert(rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "epic"), "epic perk drop did not spawn");
  assert(
    rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "legendary" && powerup.animated),
    "legendary perk drop did not spawn with animation flag",
  );
  assert(chestDropState.powerupDetails.some((powerup) => powerup.kind === "bossChest" && powerup.rarity === "rare"), "boss reward chest did not spawn as rare");
  assert(bossRewardChoices.pendingUpgradeSource === "bossChest", "boss reward did not open special choices");
  assert(
    bossRewardChoices.pendingUpgradeRarities.length === 3 &&
      bossRewardChoices.pendingUpgradeRarities.every((rarity) => ["rare", "epic", "legendary"].includes(rarity)),
    "boss reward choices were not all rare+",
  );
  assert(evolutionState.evolvedWeapons.guardianBlade === "eclipseBlade", "guardian blade did not evolve into eclipse blade");
  assert(canvas.uniqueColors >= 40, "canvas has too few color samples");
  assert(canvas.lumaStdDev >= 3, "canvas pixel variance is too low");

  console.log(
    JSON.stringify(
      {
        ok: true,
        initial,
        initialAudio,
        toggledAudio,
        restoredAudio,
        leaderboardHeaders,
        leaderboardAvatars,
        avatarTierProbe,
        moved,
        fired,
        beforeAutoWeapon,
        afterAutoWeapon,
        beforeXpPickup,
        afterXpPickup,
        beforeLevelUp,
        levelUpChoices,
        afterUpgradeChoice,
        beforeFlame,
        afterFlame,
        beforeAxe,
        afterAxe,
        beforeKatana,
        afterKatana,
        beforeCrossbow,
        afterCrossbow,
        beforeTalisman,
        afterTalisman,
        monsterState,
        casterState,
        bossState,
        lateSpawn,
        rarityDropState,
        chestDropState,
        bossRewardChoices,
        evolutionState,
        canvas,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
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

function readCanvasStats() {
  const canvasElement = document.querySelector("#game-canvas");
  const gl = canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
  const pixels = new Uint8Array(canvasElement.width * canvasElement.height * 4);

  gl.readPixels(0, 0, canvasElement.width, canvasElement.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const uniqueColors = new Set();
  let samples = 0;
  let lumaSum = 0;
  let lumaSquaredSum = 0;

  for (let index = 0; index < pixels.length; index += 64) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    uniqueColors.add(`${red},${green},${blue}`);
    lumaSum += luma;
    lumaSquaredSum += luma * luma;
    samples += 1;
  }

  const lumaMean = lumaSum / samples;
  const lumaVariance = lumaSquaredSum / samples - lumaMean * lumaMean;

  return {
    width: canvasElement.width,
    height: canvasElement.height,
    samples,
    uniqueColors: uniqueColors.size,
    lumaStdDev: Number(Math.sqrt(Math.max(lumaVariance, 0)).toFixed(2)),
  };
}
