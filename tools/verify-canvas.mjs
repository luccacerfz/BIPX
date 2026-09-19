import { suiteUrl } from './quality-target.mjs';
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry } from "./quality-browser.mjs";

const url = await suiteUrl("/?autoplay=1&offline=1");

const browser = await chromium.launch(browserLaunchOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const telemetry = attachQualityTelemetry(page, "canvas");

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForRuntimeAssets(page, telemetry);
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
  const avatarTierProbe = await page.evaluate(() => window.__zombieNightDebug.getAvatarTierForScore(20000));

  await page.keyboard.down("w");
  await page.waitForTimeout(450);
  await page.keyboard.up("w");

  const moved = await page.evaluate(() => window.__zombieNightDebug.getState());

  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.waitForTimeout(250);

  const fired = await page.evaluate(() => window.__zombieNightDebug.getState());
  await page.mouse.up();

  await telemetry.capture("natural-combat");
  telemetry.markFixture();
  const beforeAutoWeapon = await page.evaluate(() => {
    window.__zombieNightDebug.unlockAutoWeapon("guardianBlade");
    window.__zombieNightDebug.spawnZombieAhead(14, "runner");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(3400);
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

  const playerDamageState = await page.evaluate(() => window.__zombieNightDebug.damagePlayer(13));
  const beforeClassBuff = await page.evaluate(() => {
    window.__zombieNightDebug.equipWeapon("flamethrower");
    return window.__zombieNightDebug.getState();
  });
  // Arsenal pickups are relics: a temporary infusion of the class basic attack, without switching class.
  const beforeKatana = await page.evaluate(() => {
    window.__zombieNightDebug.clearCombatEntities();
    window.__zombieNightDebug.spawnZombieAhead(3, "runner");
    return window.__zombieNightDebug.getState();
  });
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  const afterKatana = await page.evaluate(() => window.__zombieNightDebug.getState());

  const monsterState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnZombieAhead(8, "brute");
    window.__zombieNightDebug.spawnZombieAhead(9, "caster");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(300);
  const casterState = await page.evaluate(() => window.__zombieNightDebug.getState());

  const bossState = await page.evaluate(() => {
    window.__zombieNightDebug.clearCombatEntities();
    window.__zombieNightDebug.spawnZombieAhead(11, "visor");
    window.__zombieNightDebug.spawnZombieAhead(12, "himetrica");
    window.__zombieNightDebug.spawnZombieAhead(13, "dinzo");
    window.__zombieNightDebug.spawnZombieAhead(14, "sofra");
    window.__zombieNightDebug.spawnZombieAhead(15, "gitcity");
    return window.__zombieNightDebug.getState();
  });

  const signatureBossAttackState = await collectProjectileEvidence(page, [
    ["visor", "evilEye"], ["himetrica", "lightning"], ["dinzo", "boleto"],
    ["sofra", "briefcase"], ["gitcity", "airplane"],
  ]);

  const hordePlusSpawnState = await page.evaluate(() => {
    window.__zombieNightDebug.clearCombatEntities();
    window.__zombieNightDebug.spawnDamageNumber(37, false);
    window.__zombieNightDebug.spawnDamageNumber(128, true);
    window.__zombieNightDebug.spawnTrap("profaneCircle", 4.8);
    window.__zombieNightDebug.spawnZombieAhead(8, "cowWalker");
    window.__zombieNightDebug.spawnZombieAhead(9, "cowCharger");
    window.__zombieNightDebug.spawnZombieAhead(10, "cowBrute");
    return window.__zombieNightDebug.getState();
  });

  await page.waitForTimeout(2100);
  const hordePlusTrapState = await page.evaluate(() => window.__zombieNightDebug.getState());

  const hordePlusBossState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnMilestoneBoss("angelSheep");
    window.__zombieNightDebug.spawnMilestoneBoss("bloodCow");
    window.__zombieNightDebug.spawnMilestoneBoss("plumaFinance");
    return window.__zombieNightDebug.getState();
  });

  const hordePlusAttackState = await collectProjectileEvidence(page, [
    ["angelSheep", "feather"], ["plumaFinance", "tornado"],
  ]);

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

  const potionDropState = await page.evaluate(() => {
    window.__zombieNightDebug.spawnHealthPotion(10);
    return window.__zombieNightDebug.getState();
  });

  const bossRewardChoices = await page.evaluate(() => {
    window.__zombieNightDebug.setLevel(10);
    window.__zombieNightDebug.openBossReward("visor");
    return window.__zombieNightDebug.getState();
  });

  const afterBossChoice = await page.evaluate(() => {
    window.__zombieNightDebug.chooseUpgrade(0);
    return window.__zombieNightDebug.getState();
  });

  const canvas = await page.evaluate(readCanvasStats);
  telemetry.report.canvas = canvas;

  assert(initial.state === "playing", "game did not enter playing state");
  assert(typeof initialAudio.supported === "boolean", "audio debug state did not expose support flag");
  assert(typeof initialAudio.muted === "boolean", "audio debug state did not expose mute flag");
  assert(toggledAudio.muted !== initialAudio.muted, "audio mute toggle did not change state");
  assert(restoredAudio.muted === initialAudio.muted, "audio mute toggle did not restore state");
  assert(leaderboardHeaders.some((header) => ["Level", "Nível"].includes(header)), "leaderboard header did not include a level column");
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
  assert(fired.character === "warrior" && fired.weapon === "katana" && fired.bullets === 0 && fired.swordSwingRemaining > 0, "Warrior input did not animate a sword strike without projectiles");
  assert(initial.autoWeapons.guardianBlade === 0, "guardian blade should not start unlocked");
  // Arsenal returned (loop/t3): Lâmina Guardiã is an autonomous companion again. It must strike the runner 14 m away
  // without any attack input, and it never turns the sword class into a shooter (no bullets).
  assert(afterAutoWeapon.score > beforeAutoWeapon.score && afterAutoWeapon.bullets === 0, "Guardian blade companion did not defeat the placed runner on its own, or created rifle projectiles");
  assert(afterXpPickup.xp > beforeXpPickup.xp || afterXpPickup.level > beforeXpPickup.level, "XP gem was not collected");
  assert(levelUpChoices.level > beforeLevelUp.level, "XP did not trigger level up");
  assert(levelUpChoices.pendingUpgradeChoices.length >= 1, "level up did not create upgrade choices");
  assert(JSON.stringify(afterUpgradeChoice.build) !== JSON.stringify(levelUpChoices.build), "upgrade choice did not alter build");
  assert(beforeClassBuff.character === "warrior" && beforeClassBuff.weapon === "katana" && beforeClassBuff.relic === "flamethrower" && beforeClassBuff.weaponTimer > 0, "Relic pickup did not infuse the sword while keeping the class weapon");
  assert(playerDamageState.damageNumberDetails.some(number => number.variant === "playerDamage"), "Player damage feedback missing");
  assert(afterKatana.weapon === "katana" && afterKatana.bullets === 0, "Sword attack created a projectile or switched weapon");
  assert(afterKatana.score > beforeKatana.score, "Actual sword input did not defeat the nearby runner");
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
  assert(hordePlusSpawnState.damageNumberDetails.some((number) => number.crit === false), "normal white damage number did not spawn");
  assert(hordePlusSpawnState.damageNumberDetails.some((number) => number.crit === true), "critical yellow damage number did not spawn");
  assert(hordePlusSpawnState.trapDetails.some((trap) => trap.type === "profaneCircle"), "profane trap did not spawn");
  assert(
    !hordePlusTrapState.trapDetails.some((trap) => trap.type === "profaneCircle" && !trap.triggered),
    "profane trap did not trigger or clear",
  );
  assert(hordePlusSpawnState.monsters.cowWalker >= 1, "cow walker did not spawn");
  assert(hordePlusSpawnState.monsters.cowCharger >= 1, "cow charger did not spawn");
  assert(hordePlusSpawnState.monsters.cowBrute >= 1, "cow brute did not spawn");
  assert(hordePlusBossState.monsters.angelSheep >= 1, "Ovelha Celestial boss did not spawn");
  assert(hordePlusBossState.monsters.bloodCow >= 1, "Vaca Sanguinaria boss did not spawn");
  assert(hordePlusBossState.monsters.plumaFinance >= 1, "Pluma Finance boss did not spawn");
  assert(hordePlusBossState.bossLabels.angelSheep >= 1, "Ovelha Celestial label did not spawn");
  assert(hordePlusBossState.bossLabels.bloodCow >= 1, "Vaca Sanguinaria label did not spawn");
  assert(hordePlusBossState.bossLabels.plumaFinance >= 1, "Pluma Finance label did not spawn");
  assert(
    hordePlusAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "angelSheep" && projectile.kind === "feather"),
    "Ovelha Celestial did not fire feather projectiles",
  );
  assert(
    hordePlusAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "plumaFinance" && projectile.kind === "tornado"),
    "Pluma Finance did not fire tornado projectiles",
  );
  assert(signatureBossAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "visor" && projectile.kind === "evilEye"), "Visor did not fire an evil-eye projectile");
  assert(signatureBossAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "himetrica" && projectile.kind === "lightning"), "Himetrica did not fire a lightning projectile");
  assert(signatureBossAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "dinzo" && projectile.kind === "boleto"), "Dinzo did not fire a boleto projectile");
  assert(signatureBossAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "sofra" && projectile.kind === "briefcase"), "Sofra did not fire a briefcase projectile");
  assert(signatureBossAttackState.observedEnemyProjectiles.some((projectile) => projectile.source === "gitcity" && projectile.kind === "airplane"), "GitCity did not fire a tiny airplane projectile");
  assert(lateSpawn.spawnInterval < initial.spawnInterval, "zombie spawn interval did not increase over time");
  assert(rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "rare"), "rare perk drop did not spawn");
  assert(rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "epic"), "epic perk drop did not spawn");
  assert(rarityDropState.powerupDetails.every((powerup) => powerup.ttl === 20), "ground drops did not expose a 20s lifetime");
  assert(
    rarityDropState.powerupDetails.some((powerup) => powerup.kind === "perk" && powerup.rarity === "legendary" && powerup.animated),
    "legendary perk drop did not spawn with animation flag",
  );
  assert(chestDropState.powerupDetails.some((powerup) => powerup.kind === "bossChest" && powerup.rarity === "rare"), "boss reward chest did not spawn as rare");
  assert(
    potionDropState.powerupDetails.some((powerup) => powerup.kind === "healthPotion" && powerup.amount === 10 && powerup.label === "+10 Vida"),
    "health potion drop did not spawn with +10 life",
  );
  assert(bossRewardChoices.pendingUpgradeSource === "bossChest", "boss reward did not open special choices");
  assert(
    bossRewardChoices.pendingUpgradeRarities.length === 3 &&
      bossRewardChoices.pendingUpgradeRarities.every((rarity) => ["rare", "epic", "legendary"].includes(rarity)),
    "boss reward choices were not all rare+",
  );
  assert(afterBossChoice.character === "warrior" && afterBossChoice.weapon === "katana", "Boss upgrade changed fixed warrior role");
  assert(canvas.uniqueColors >= 40, "canvas has too few color samples");
  assert(canvas.lumaStdDev >= 3, "canvas pixel variance is too low");

  telemetry.assertClean();
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
        beforeClassBuff,
        afterBossChoice,
        playerDamageState,
        beforeKatana,
        afterKatana,
        monsterState,
        casterState,
        bossState,
        signatureBossAttackState,
        hordePlusSpawnState,
        hordePlusTrapState,
        hordePlusBossState,
        hordePlusAttackState,
        lateSpawn,
        rarityDropState,
        chestDropState,
        bossRewardChoices,
        canvas,
      },
      null,
      2,
    ),
  );
} catch (error) {
  telemetry.fail(error);
  throw error;
} finally {
  await telemetry.save();
  await browser.close();
}


function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function collectProjectileEvidence(page, expected, durationMs = 2200) {
  const observed = new Map();
  const start = Date.now();
  let latest;
  do {
    latest = await page.evaluate(() => window.__zombieNightDebug.getState());
    for (const projectile of latest.enemyProjectileDetails) observed.set(`${projectile.source}:${projectile.kind}`, projectile);
    if (expected.every(([source, kind]) => observed.has(`${source}:${kind}`))) break;
    await page.waitForTimeout(50);
  } while (Date.now() - start < durationMs);
  return { ...latest, observedEnemyProjectiles: [...observed.values()], observationWindowMs: Date.now() - start };
}

async function readCanvasStats() {
  // With preserveDrawingBuffer=false, inspect the game frame before browser
  // presentation clears it. The game's render callback is already queued.
  await new Promise((resolve) => requestAnimationFrame(resolve));
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
