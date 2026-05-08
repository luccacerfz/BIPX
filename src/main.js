import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import {
  forceConfigTarget,
  getAllOverrides,
  getConfig,
  getRuntimeConfig,
  resetAllConfig,
  resetConfig,
  setAllOverrides,
  setConfig,
  subscribeConfig,
} from "./config/index.js";

const canvas = document.querySelector("#game-canvas");
const healthFill = document.querySelector("#health-fill");
const healthValueElement = document.querySelector("#health-value");
const timeValueElement = document.querySelector("#time-value");
const scoreElement = document.querySelector("#score");
const killsElement = document.querySelector("#kills");
const waveElement = document.querySelector("#wave");
const levelValueElement = document.querySelector("#level-value");
const xpFillElement = document.querySelector("#xp-fill");
const xpValueElement = document.querySelector("#xp-value");
const weaponNameElement = document.querySelector("#weapon-name");
const weaponTimerElement = document.querySelector("#weapon-timer");
const skillListElement = document.querySelector("#skill-list");
const onlineCountElement = document.querySelector("#online-count");
const onlineStatusElement = document.querySelector("#online-status");
const partyListElement = document.querySelector("#party-list");
const leaderboardCountElement = document.querySelector("#leaderboard-count");
const leaderboardListElement = document.querySelector("#leaderboard-list");
const upgradePanel = document.querySelector("#upgrade-panel");
const upgradeOptionsElement = document.querySelector("#upgrade-options");
const message = document.querySelector("#message");
const messageKicker = document.querySelector("#message-kicker");
const messageTitle = document.querySelector("#message-title");
const messageCopy = document.querySelector("#message-copy");
const openLoginButton = document.querySelector("#open-login-button");
const playButton = document.querySelector("#play-button");
const playButtonLabel = document.querySelector("#play-button-label");
const multiplayerButton = document.querySelector("#multiplayer-button");
const loginBackButton = document.querySelector("#login-back-button");
const playerNameInput = document.querySelector("#player-name");
const touchStick = document.querySelector("#touch-stick");
const touchKnob = document.querySelector("#touch-knob");
const touchFire = document.querySelector("#touch-fire");
const queryParams = new URLSearchParams(window.location.search);
const multiplayerServerOrigin = "https://bipx-multiplayer-server.onrender.com";
const multiplayerEntryUrl = `https://bipx.vercel.app/?ws=${multiplayerServerOrigin.replace(/^http/, "ws")}/ws&room=cemiterio`;
const requestedQuality = sanitizeQuality(queryParams.get("quality"));
const perfOverlayEnabled = queryParams.get("perf") === "1";
const perfOverlay = perfOverlayEnabled ? createPerfOverlay() : null;

setViewportCssVars();
applyMobileLayoutState();

const qualityManager = {
  mode: requestedQuality,
  level: requestedQuality === "auto" ? getDefaultQualityLevel() : requestedQuality,
  effectBudget: 64,
  fpsLowTimer: 0,
  fpsHighTimer: 0,
  evaluationTimer: 0,
  pixelRatio: 1,
};

const perfStats = {
  dt: 0,
  frameMs: 0,
  updateMs: 0,
  renderMs: 0,
  fpsAverage: 60,
  skippedEffects: 0,
  poolExpansions: {},
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(getGameConfig("fog.color"));
scene.fog = new THREE.FogExp2(getGameConfig("fog.color"), getGameConfig("fog.density"));

const camera = new THREE.PerspectiveCamera(getGameConfig("camera.fov"), window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, getCameraHeight(), getCameraDepth());
scene.userData.editorRefs = {
  camera,
  fog: scene.fog,
  hemiLight: null,
  moonLight: null,
  playerLight: null,
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(getQualityPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
applyQualitySettings(true);
subscribeConfig(() => applyRuntimeConfig(true));

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const upVector = new THREE.Vector3(0, 1, 0);
const groundPlane = new THREE.Plane(upVector, 0);
const pointer = new THREE.Vector2(0, 0);
const pointerWorld = new THREE.Vector3(0, 0, -1);
const worldLimit = 55;
const maxActiveZombies = 90;
const spatialGridCellSize = 8;
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();

const assetCache = {
  geometries: new Map(),
  materials: new Map(),
};

const spatialGrid = {
  cells: new Map(),
  dirty: true,
  candidates: [],
};

const weapons = {
  pistol: { label: "Pistola", duration: 0 },
  flamethrower: { label: "Lanca", duration: 10, color: 0xff7a28 },
  axe: { label: "Machado", duration: 8, color: 0x7fd7ff },
  katana: { label: "Katana", duration: 10, color: 0x8ffcff },
  crossbow: { label: "Besta", duration: 11, color: 0xffd36d },
  talisman: { label: "Selo", duration: 9, color: 0xd978ff },
};

const hudWeaponIcons = {
  pistol: "🔫",
  flamethrower: "🔥",
  axe: "🪓",
  katana: "⚔",
  crossbow: "🏹",
  talisman: "📜",
  guardianBlade: "🗡",
  orbitOrb: "🟣",
  sealRain: "☄",
};

const hudUpgradeIcons = {
  damage: "◆",
  cadence: "⚡",
  area: "◎",
  speed: "👟",
  pickup: "🧲",
  maxHealth: "❤",
  projectile: "✦",
  autoWeapon: "★",
};

const monsterProfiles = {
  zombie: {
    label: "Zumbi",
    health: 2,
    speed: 3.3,
    radius: 0.78,
    damage: 8,
    score: 10,
    minWave: 1,
  },
  runner: {
    label: "Corredor",
    health: 1.5,
    speed: 6.1,
    radius: 0.58,
    damage: 6,
    score: 14,
    minWave: 2,
  },
  brute: {
    label: "Bruto",
    health: 8,
    speed: 2.2,
    radius: 1.18,
    damage: 15,
    score: 26,
    minWave: 3,
  },
  caster: {
    label: "Invocador",
    health: 3.5,
    speed: 2.8,
    radius: 0.82,
    damage: 7,
    score: 18,
    minWave: 4,
    projectileColor: 0xd978ff,
  },
  visor: {
    label: "Visor",
    health: 18,
    speed: 2.7,
    radius: 1.14,
    damage: 16,
    score: 90,
    minWave: 2,
    boss: true,
    projectileColor: 0x7edcff,
  },
  himetrica: {
    label: "Himetrica",
    health: 16,
    speed: 3.6,
    radius: 1.05,
    damage: 18,
    score: 95,
    minWave: 3,
    boss: true,
    projectileColor: 0xff9d28,
  },
  dinzo: {
    label: "Dinzo",
    health: 23,
    speed: 1.55,
    radius: 1.42,
    damage: 13,
    score: 105,
    minWave: 2,
    boss: true,
  },
  gitcity: {
    label: "GitCity",
    health: 32,
    speed: 1.15,
    radius: 1.58,
    damage: 22,
    score: 140,
    minWave: 4,
    boss: true,
  },
  sofra: {
    label: "SOFRA",
    health: 38,
    speed: 4.25,
    radius: 1.28,
    damage: 20,
    score: 180,
    minWave: 5,
    boss: true,
    projectileColor: 0x32b8ff,
  },
};

const autoWeaponProfiles = {
  guardianBlade: {
    label: "Lâmina Guardiã",
    color: 0x8ffcff,
    cooldown: 0.95,
    damage: 1.8,
    range: 24,
  },
  orbitOrb: {
    label: "Orbe Giratório",
    color: 0xd978ff,
    cooldown: 0.34,
    damage: 1.65,
    orbitRadius: 3.4,
    radius: 1.25,
  },
  sealRain: {
    label: "Chuva de Selos",
    color: 0xffd36d,
    cooldown: 1.45,
    damage: 5.6,
    radius: 3.5,
    range: 31,
  },
};

const upgradeDefinitions = [
  {
    id: "damage",
    label: "+Dano",
    description: "Aumenta todo dano causado por armas manuais e automáticas.",
    maxStacks: 6,
  },
  {
    id: "cadence",
    label: "+Cadência",
    description: "Reduz o tempo entre ataques e deixa sua build mais agressiva.",
    maxStacks: 5,
  },
  {
    id: "area",
    label: "+Área",
    description: "Aumenta cones, explosões, giros e zonas das armas automáticas.",
    maxStacks: 5,
  },
  {
    id: "speed",
    label: "+Velocidade",
    description: "Corre mais rápido para escapar do cerco da horda.",
    maxStacks: 4,
  },
  {
    id: "pickup",
    label: "+Raio de coleta",
    description: "Puxa cristais de XP de mais longe.",
    maxStacks: 5,
  },
  {
    id: "maxHealth",
    label: "+Vida máxima",
    description: "Aumenta sua vida máxima e cura uma parte na hora.",
    maxStacks: 4,
  },
  {
    id: "projectile",
    label: "+Projétil extra",
    description: "Armas de disparo soltam projéteis adicionais em leque.",
    maxStacks: 3,
  },
  {
    id: "autoWeapon",
    label: "Desbloquear arma automática",
    description: "Adiciona uma arma automática nova à sua build.",
    maxStacks: 2,
  },
];

const keys = new Set();
const zombies = [];
const bullets = [];
const enemyProjectiles = [];
const powerups = [];
const xpGems = [];
const effects = [];
const graveProps = [];
const remotePlayers = new Map();
const entityPools = {
  zombies: new Map(),
  bullets: [],
  enemyProjectiles: [],
  xpGems: [],
  effects: new Map(),
  prewarmed: false,
};
let nextZombieId = 1;

const multiplayer = {
  enabled: shouldUseMultiplayer(),
  color: "#74d1ff",
  connected: false,
  full: false,
  leaderboard: {
    totalPlayers: 0,
    players: [],
    recentSessions: [],
  },
  id: null,
  maxPlayers: 4,
  reconnectTimer: 0,
  reconnectAttempts: 0,
  room: sanitizeRoomName(queryParams.get("room")),
  sendTimer: 0,
  socket: null,
  spawn: new THREE.Vector3(0, 0, 0),
  status: "Solo",
  url: null,
};

const player = {
  name: loadPlayerName(),
  health: 100,
  maxHealth: 100,
  score: 0,
  kills: 0,
  wave: 0,
  level: 1,
  bestLevel: 1,
  xp: 0,
  xpToNext: 12,
  speed: 11,
  shotCooldown: 0,
  weapon: "pistol",
  weaponTimer: 0,
  axeSpinTimer: 0,
  upgradeStats: createDefaultUpgradeStats(),
  upgradeStacks: {},
  autoWeapons: createDefaultAutoWeapons(),
  pendingUpgradeChoices: [],
  pendingLevelUps: 0,
  position: new THREE.Vector3(0, 0, 0),
  aimDirection: new THREE.Vector3(0, 0, -1),
  mesh: createPlayerMesh(),
};

const game = {
  state: "menu",
  shooting: false,
  nextWaveDelay: 0,
  spawnTimer: 0,
  zombiesToSpawn: 0,
  powerupTimer: 0,
  survivalTime: 0,
  hudTimer: 0,
  leaderboardSubmitted: false,
  partyHudTimer: 0,
  labelTimer: 0,
  labelFrameReady: true,
  skillHudSignature: "",
  cameraLookDirection: new THREE.Vector3(0, 0, -1),
  touchVector: new THREE.Vector2(0, 0),
  touchStickPointerId: null,
  touchStickRect: null,
  touchAimActive: false,
  touchAimPointerId: null,
};

scene.add(player.mesh);
buildWorld();
if (playerNameInput) {
  playerNameInput.value = player.name;
}
updateMultiplayerHud();
updateLeaderboardHud();
void loadLeaderboardSnapshot();
if (multiplayer.enabled) {
  connectMultiplayer();
}
if (playButtonLabel && multiplayer.enabled) {
  playButtonLabel.textContent = "Jogar multiplayer";
}
updateHud();
animate();

openLoginButton?.addEventListener("click", () => {
  message.classList.add("message--login");
  playerNameInput?.focus();
});

loginBackButton?.addEventListener("click", () => {
  if (message.classList.contains("message--game-over")) {
    messageTitle.textContent = "BIPX";
    messageKicker.textContent = "☠ Noite Zumbi ☠";
    messageCopy.textContent = "Escolha seu nome antes de entrar no cemiterio.";
    playButton.innerHTML = "<span aria-hidden=\"true\">▶</span><span id=\"play-button-label\">Entrar no jogo</span>";
  }
  message.classList.remove("message--game-over");
  message.classList.remove("message--login");
});

playButton.addEventListener("click", () => {
  if (game.state !== "playing") {
    updateLocalPlayerName(playerNameInput?.value);
    startGame();
  }
});

multiplayerButton?.addEventListener("click", () => {
  updateLocalPlayerName(playerNameInput?.value);
  window.location.assign(multiplayerEntryUrl);
});

playerNameInput?.addEventListener("change", () => {
  updateLocalPlayerName(playerNameInput.value);
});

playerNameInput?.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    updateLocalPlayerName(playerNameInput.value);
    startGame();
  }
});

window.addEventListener("resize", resizeRenderer, { passive: true });
window.addEventListener("orientationchange", resizeRenderer, { passive: true });
window.visualViewport?.addEventListener("resize", resizeRenderer, { passive: true });
window.visualViewport?.addEventListener("scroll", resizeRenderer, { passive: true });
window.addEventListener("keydown", (event) => {
  const upgradeIndex = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].indexOf(event.code);
  if (upgradeIndex >= 0 && player.pendingUpgradeChoices.length > 0) {
    event.preventDefault();
    chooseUpgrade(upgradeIndex % 3);
    return;
  }

  keys.add(event.code);

  if (event.code === "Enter" && game.state !== "playing") {
    startGame();
  }

  if (event.code === "Space") {
    game.shooting = true;
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);

  if (event.code === "Space") {
    game.shooting = false;
  }
});

window.addEventListener("mousemove", (event) => updatePointerFromClient(event.clientX, event.clientY));

window.addEventListener("mousedown", (event) => {
  if (isInteractiveOverlay(event.target)) {
    return;
  }

  game.shooting = true;
});

window.addEventListener("mouseup", () => {
  game.shooting = false;
});

touchFire.addEventListener("pointerdown", handleFirePointerDown);
touchFire.addEventListener("pointermove", handleFirePointerMove);
touchFire.addEventListener("pointerup", handleFirePointerEnd);
touchFire.addEventListener("pointercancel", handleFirePointerEnd);
touchFire.addEventListener("lostpointercapture", handleFirePointerEnd);

touchStick.addEventListener("pointerdown", handleStickMove);
touchStick.addEventListener("pointermove", handleStickMove);
touchStick.addEventListener("pointerup", resetStick);
touchStick.addEventListener("pointercancel", resetStick);

upgradePanel?.addEventListener("mousedown", (event) => event.stopPropagation());
upgradePanel?.addEventListener("mouseup", (event) => event.stopPropagation());
upgradePanel?.addEventListener("click", (event) => event.stopPropagation());

upgradeOptionsElement?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const button = event.target.closest("[data-upgrade-index]");
  if (!button) {
    return;
  }

  chooseUpgrade(Number(button.dataset.upgradeIndex));
});

window.__zombieNightDebug = {
  getState() {
    return {
      state: game.state,
      health: player.health,
      maxHealth: player.maxHealth,
      score: player.score,
      kills: player.kills,
      wave: player.wave,
      level: player.level,
      bestLevel: player.bestLevel,
      xp: player.xp,
      xpToNext: player.xpToNext,
      xpGems: xpGems.length,
      pendingUpgradeChoices: player.pendingUpgradeChoices.map((choice) => choice.id),
      zombies: zombies.length,
      bullets: bullets.length,
      enemyProjectiles: enemyProjectiles.length,
      powerups: powerups.length,
      monsters: zombies.reduce((counts, zombie) => {
        counts[zombie.type] = (counts[zombie.type] ?? 0) + 1;
        return counts;
      }, {}),
      bossLabels: zombies.reduce((counts, zombie) => {
        if (zombie.labelSprite) {
          counts[zombie.type] = (counts[zombie.type] ?? 0) + 1;
        }
        return counts;
      }, {}),
      pendingZombies: game.zombiesToSpawn,
      spawnInterval: Number(getZombieSpawnInterval().toFixed(3)),
      weapon: player.weapon,
      weaponTimer: Number(player.weaponTimer.toFixed(2)),
      build: getPlayerBuildSummary(),
      autoWeapons: Object.fromEntries(
        Object.entries(player.autoWeapons).map(([id, state]) => [id, state.level]),
      ),
      upgradeStats: {
        damageMultiplier: Number(player.upgradeStats.damageMultiplier.toFixed(3)),
        cooldownMultiplier: Number(player.upgradeStats.cooldownMultiplier.toFixed(3)),
        areaMultiplier: Number(player.upgradeStats.areaMultiplier.toFixed(3)),
        speedMultiplier: Number(player.upgradeStats.speedMultiplier.toFixed(3)),
        pickupRadius: Number(player.upgradeStats.pickupRadius.toFixed(3)),
        projectileBonus: player.upgradeStats.projectileBonus,
      },
      survivalTime: Number(game.survivalTime.toFixed(2)),
      player: {
        name: player.name,
        x: Number(player.position.x.toFixed(3)),
        z: Number(player.position.z.toFixed(3)),
      },
      multiplayer: {
        connected: multiplayer.connected,
        id: multiplayer.id,
        players: getPartyPlayers().map((partyPlayer) => ({
          name: partyPlayer.name,
          health: partyPlayer.health,
          score: partyPlayer.score,
        })),
        leaderboard: multiplayer.leaderboard.players.map((leader) => ({
          rank: leader.rank,
          name: leader.name,
          bestScore: leader.bestScore,
        })),
        room: multiplayer.room,
        remotePlayers: remotePlayers.size,
        status: multiplayer.status,
      },
    };
  },
  getPerfStats: getPerfStats,
  start: startGame,
  equipWeapon: activateWeapon,
  grantXp(amount) {
    collectXp(Math.max(0, Number(amount) || 0));
  },
  chooseUpgrade(index = 0) {
    chooseUpgrade(Number(index) || 0);
  },
  spawnXpGem(value = 8) {
    spawnXpGem(player.position.clone().add(new THREE.Vector3(1.6, 0, 0)), Math.max(1, Number(value) || 1));
  },
  setSurvivalTime(seconds) {
    game.survivalTime = Math.max(0, Number(seconds) || 0);
  },
  spawnZombieAhead(distance = 3.4, type = "zombie") {
    const position = player.position.clone().addScaledVector(player.aimDirection, distance);
    spawnZombie(position.x, position.z, type);
  },
  spawnPowerup(type = "flamethrower") {
    spawnPowerup(type, player.position.x + 2.4, player.position.z);
  },
  stressLevel6(count = 90) {
    player.level = Math.max(player.level, 6);
    player.bestLevel = Math.max(player.bestLevel, player.level);
    player.wave = Math.max(player.wave, 6);
    player.autoWeapons.orbitOrb.level = 1;
    player.autoWeapons.sealRain.level = 1;
    game.survivalTime = Math.max(game.survivalTime, 85);
    const total = Math.max(0, Math.floor(Number(count) || 0));
    for (let index = 0; index < total; index += 1) {
      const angle = (index / Math.max(total, 1)) * Math.PI * 2;
      const distance = 12 + (index % 18) * 1.3;
      const type = ["zombie", "runner", "brute", "caster"][index % 4];
      spawnZombie(player.position.x + Math.cos(angle) * distance, player.position.z + Math.sin(angle) * distance, type);
    }
    rebuildSpatialGrid();
    updateHud(true);
  },
};

window.__bipxConfig = {
  get(path) {
    return path ? getGameConfig(path) : getRuntimeConfig();
  },
  set(path, value) {
    setConfig(path, normalizeConfigConsoleValue(value));
    return getGameConfig(path);
  },
  reset(path) {
    if (path) {
      resetConfig(path);
    } else {
      resetAllConfig();
    }
    return getRuntimeConfig();
  },
  resetAll() {
    resetAllConfig();
    return getRuntimeConfig();
  },
  overrides() {
    return getAllOverrides();
  },
  import(overrides) {
    setAllOverrides(overrides);
    return getRuntimeConfig();
  },
  target(target) {
    forceConfigTarget(target);
    return getRuntimeConfig();
  },
  apply() {
    applyRuntimeConfig(true);
    return getRuntimeConfig();
  },
  help() {
    return [
      "__bipxConfig.get('camera.zoomScale')",
      "__bipxConfig.set('camera.zoomScale', 1.6)",
      "__bipxConfig.set('fog.density', 0.018)",
      "__bipxConfig.set('lighting.player.intensity', 4)",
      "__bipxConfig.set('lighting.player.distance', 42)",
      "__bipxConfig.target('mobilePro') // desktop | mobilePro | mobile | tablet",
      "__bipxConfig.reset('fog.density')",
      "__bipxConfig.resetAll()",
    ].join("\n");
  },
};

if (shouldLoadLocalEditor()) {
  void import("./editor/index.js");
}

function shouldLoadLocalEditor() {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const editorRequested = params.get("editor") === "1" || params.get("admin") === "editor";
  const localHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.");

  return localHost && editorRequested;
}

function normalizeConfigConsoleValue(value) {
  if (typeof value === "string" && value.startsWith("#")) {
    return value;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value !== "" ? numberValue : value;
}

if (queryParams.get("autoplay") === "1") {
  requestAnimationFrame(() => {
    startGame();

    if (queryParams.get("bosses") === "1") {
      spawnBossPreview();
    }
  });
}

function startGame() {
  prewarmEntityPools();
  applyQualitySettings(true);
  clearEntities();
  resetProgressionState();
  player.health = player.maxHealth;
  player.score = 0;
  player.kills = 0;
  player.wave = 0;
  player.shotCooldown = 0;
  player.weapon = "pistol";
  player.weaponTimer = 0;
  player.axeSpinTimer = 0;
  player.position.copy(getMultiplayerStartPosition());
  player.aimDirection.set(0, 0, -1);
  player.mesh.position.copy(player.position);
  game.state = "playing";
  game.nextWaveDelay = 0;
  game.spawnTimer = 0;
  game.zombiesToSpawn = 0;
  game.powerupTimer = 2.5;
  game.survivalTime = 0;
  game.hudTimer = 0;
  game.leaderboardSubmitted = false;
  game.partyHudTimer = 0;
  game.labelTimer = 0;
  game.labelFrameReady = true;
  game.skillHudSignature = "";
  game.cameraLookDirection.copy(player.aimDirection);
  game.touchAimActive = false;
  game.touchAimPointerId = null;
  resetStick();
  nextZombieId = 1;
  spatialGrid.dirty = true;
  message.classList.remove("message--game-over");
  message.classList.remove("message--login");
  message.classList.add("is-hidden");
  startNextWave();
  updateHud(true);
  updateMultiplayerHud();
}

function createDefaultUpgradeStats() {
  return {
    damageMultiplier: 1,
    cooldownMultiplier: 1,
    areaMultiplier: 1,
    speedMultiplier: 1,
    pickupRadius: 2.35,
    projectileBonus: 0,
  };
}

function createDefaultAutoWeapons() {
  return {
    guardianBlade: { level: 1, cooldown: 0.35, angle: 0 },
    orbitOrb: { level: 0, cooldown: 0, angle: Math.random() * Math.PI * 2 },
    sealRain: { level: 0, cooldown: 0, angle: 0 },
  };
}

function resetProgressionState() {
  player.maxHealth = 100;
  player.level = 1;
  player.bestLevel = 1;
  player.xp = 0;
  player.xpToNext = getXpToNext(1);
  player.upgradeStats = createDefaultUpgradeStats();
  player.upgradeStacks = {};
  player.autoWeapons = createDefaultAutoWeapons();
  player.pendingUpgradeChoices = [];
  player.pendingLevelUps = 0;
  renderUpgradeChoices();
}

function sanitizeQuality(value) {
  return ["auto", "high", "medium", "low"].includes(value) ? value : "auto";
}

function createPerfOverlay() {
  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed",
    "right:12px",
    "top:12px",
    "z-index:8",
    "padding:8px 10px",
    "border:1px solid rgba(255,255,255,.16)",
    "border-radius:8px",
    "background:rgba(4,8,10,.78)",
    "color:#8ef151",
    "font:700 11px ui-monospace, SFMono-Regular, Menlo, monospace",
    "pointer-events:none",
    "white-space:pre",
  ].join(";");
  document.body.appendChild(overlay);
  return overlay;
}

function renderPerfOverlay() {
  if (!perfOverlay) {
    return;
  }

  const stats = getPerfStats();
  perfOverlay.textContent = `FPS ${stats.fpsAverage} · ${stats.quality}/${stats.qualityMode}\nU ${stats.updateMs}ms R ${stats.renderMs}ms · DC ${stats.drawCalls}\nZ ${stats.entities.zombies} B ${stats.entities.bullets} XP ${stats.entities.xpGems} FX ${stats.entities.effects}`;
}

function getDefaultQualityLevel() {
  if (usesMobileTuning()) {
    return "medium";
  }

  return "high";
}

function setViewportCssVars() {
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth || 1280;
  const height = viewport?.height || window.innerHeight || 720;
  document.documentElement.style.setProperty("--app-width", `${width}px`);
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function applyMobileLayoutState() {
  const stats = getMobileLayoutStats();
  document.documentElement.dataset.mobileProfile = stats.profile;
  document.documentElement.dataset.orientation = stats.isPortrait ? "portrait" : "landscape";
  document.documentElement.dataset.touch = stats.hasTouch ? "true" : "false";
}

function getMobileLayoutStats() {
  const viewport = window.visualViewport;
  const width = viewport?.width || window.innerWidth || 1280;
  const height = viewport?.height || window.innerHeight || 720;
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const hasTouch = isTouchDevice();
  const deviceRatio = window.devicePixelRatio || 1;
  const isMobilePro =
    hasTouch && shortestSide >= 390 && shortestSide <= 460 && longestSide >= 800 && longestSide <= 960 && deviceRatio >= 2.5;
  const profile = isMobilePro
    ? "mobilePro"
    : hasTouch && shortestSide < 680
      ? "mobile"
      : hasTouch && shortestSide < 1100 && longestSide < 1600
        ? "tablet"
        : "desktop";

  return {
    width,
    height,
    shortestSide,
    longestSide,
    deviceRatio,
    hasTouch,
    isPortrait: height >= width,
    profile,
  };
}

function getMobileLayoutProfile() {
  return getMobileLayoutStats().profile;
}

function isTouchDevice() {
  return window.matchMedia?.("(pointer: coarse)")?.matches || navigator.maxTouchPoints > 0;
}

function isCompactViewport() {
  const viewport = window.visualViewport;
  return Math.min(viewport?.width || window.innerWidth, viewport?.height || window.innerHeight) < 680;
}

function usesMobileTuning() {
  return getMobileLayoutProfile() !== "desktop" || isCompactViewport();
}

function getGameConfig(path) {
  return getConfig(path);
}

function getQualityPixelRatio() {
  const deviceRatio = window.devicePixelRatio || 1;
  const mobileTuned = usesMobileTuning();
  const highRatio = mobileTuned ? getGameConfig("quality.mobileHighPixelRatio") : getGameConfig("quality.highPixelRatio");
  const mediumRatio = mobileTuned
    ? getGameConfig("quality.mobileMediumPixelRatio")
    : getGameConfig("quality.mediumPixelRatio");
  const lowRatio = mobileTuned ? getGameConfig("quality.mobileLowPixelRatio") : getGameConfig("quality.lowPixelRatio");

  if (qualityManager.level === "high") {
    return Math.min(deviceRatio, highRatio);
  }

  if (qualityManager.level === "medium") {
    return Math.min(deviceRatio, mediumRatio);
  }

  return Math.min(deviceRatio, lowRatio);
}

function applyQualitySettings(force = false) {
  const pixelRatio = getQualityPixelRatio();
  const mobileTuned = usesMobileTuning();
  qualityManager.effectBudget = mobileTuned
    ? qualityManager.level === "high"
      ? getGameConfig("quality.effectBudget.mobileHigh")
      : qualityManager.level === "medium"
        ? getGameConfig("quality.effectBudget.mobileMedium")
        : getGameConfig("quality.effectBudget.mobileLow")
    : qualityManager.level === "high"
      ? getGameConfig("quality.effectBudget.high")
      : qualityManager.level === "medium"
        ? getGameConfig("quality.effectBudget.medium")
        : getGameConfig("quality.effectBudget.low");

  if (force || Math.abs(pixelRatio - qualityManager.pixelRatio) > 0.01) {
    qualityManager.pixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  renderer.shadowMap.enabled = qualityManager.level === "high" || (qualityManager.level === "medium" && !mobileTuned);
}

function updateQualityManager(dt) {
  if (qualityManager.mode !== "auto") {
    return;
  }

  qualityManager.evaluationTimer -= dt;
  if (qualityManager.evaluationTimer > 0) {
    return;
  }

  qualityManager.evaluationTimer = 0.75;

  if (perfStats.fpsAverage < 36) {
    qualityManager.fpsLowTimer += 0.75;
    qualityManager.fpsHighTimer = 0;
  } else if (perfStats.fpsAverage > 55 && effects.length < qualityManager.effectBudget * 0.45) {
    qualityManager.fpsHighTimer += 0.75;
    qualityManager.fpsLowTimer = 0;
  } else {
    qualityManager.fpsLowTimer = Math.max(0, qualityManager.fpsLowTimer - 0.75);
    qualityManager.fpsHighTimer = Math.max(0, qualityManager.fpsHighTimer - 0.75);
  }

  if (qualityManager.fpsLowTimer >= 1.5 && qualityManager.level === "high") {
    qualityManager.level = "medium";
    qualityManager.fpsLowTimer = 0;
    applyQualitySettings();
  } else if (qualityManager.fpsLowTimer >= 1.5 && qualityManager.level === "medium") {
    qualityManager.level = "low";
    qualityManager.fpsLowTimer = 0;
    applyQualitySettings();
  } else if (qualityManager.fpsHighTimer >= 5 && qualityManager.level === "low") {
    qualityManager.level = "medium";
    qualityManager.fpsHighTimer = 0;
    applyQualitySettings();
  } else if (qualityManager.fpsHighTimer >= 7 && qualityManager.level === "medium") {
    qualityManager.level = "high";
    qualityManager.fpsHighTimer = 0;
    applyQualitySettings();
  }
}

function getSharedGeometry(key, factory) {
  if (!assetCache.geometries.has(key)) {
    assetCache.geometries.set(key, factory());
  }

  return assetCache.geometries.get(key);
}

function createPooledMaterial(color, transparent = false, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.05,
    transparent,
    opacity,
    roughness: 0.42,
    metalness: 0.08,
  });
}

function prewarmEntityPools() {
  if (entityPools.prewarmed) {
    return;
  }

  const zombieWarmup = [
    ["zombie", 34],
    ["runner", 22],
    ["brute", 18],
    ["caster", 16],
  ];

  for (const [type, count] of zombieWarmup) {
    for (let index = 0; index < count; index += 1) {
      releaseZombieMesh(createZombieMesh(type), type);
    }
  }

  for (let index = 0; index < 40; index += 1) {
    releaseProjectileMesh(createPooledProjectileMesh(), entityPools.bullets);
  }

  for (let index = 0; index < 28; index += 1) {
    releaseProjectileMesh(createPooledProjectileMesh(), entityPools.enemyProjectiles);
  }

  for (let index = 0; index < 120; index += 1) {
    releaseXpGemMesh(createPooledXpGemMesh());
  }

  for (let index = 0; index < 18; index += 1) {
    releaseEffectMesh(createPooledPulseEffect(), "pulse");
    releaseEffectMesh(createPooledExplosionEffect(), "explosion");
    releaseEffectMesh(createPooledBeamEffect(), "beam");
  }

  for (let index = 0; index < 10; index += 1) {
    releaseEffectMesh(createPooledSlashEffect(), "slash");
    releaseEffectMesh(createPooledConeEffect(), "cone");
    releaseEffectMesh(createPooledOrbitEffect(), "orbit");
  }

  entityPools.prewarmed = true;
}

function recordPoolExpansion(poolName) {
  perfStats.poolExpansions[poolName] = (perfStats.poolExpansions[poolName] || 0) + 1;
}

function buildWorld() {
  const hemiLight = new THREE.HemisphereLight(
    getGameConfig("lighting.hemi.skyColor"),
    getGameConfig("lighting.hemi.groundColor"),
    getGameConfig("lighting.hemi.intensity"),
  );
  scene.add(hemiLight);
  scene.userData.editorRefs.hemiLight = hemiLight;

  const moon = new THREE.DirectionalLight(getGameConfig("lighting.moon.color"), getGameConfig("lighting.moon.intensity"));
  moon.position.set(-20, 36, 18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(getGameConfig("lighting.moon.shadowMapSize"), getGameConfig("lighting.moon.shadowMapSize"));
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 95;
  moon.shadow.camera.left = -55;
  moon.shadow.camera.right = 55;
  moon.shadow.camera.top = 55;
  moon.shadow.camera.bottom = -55;
  moon.shadow.bias = getGameConfig("lighting.moon.shadowBias");
  scene.add(moon);
  scene.userData.editorRefs.moonLight = moon;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ color: 0x242c20, roughness: 0.94, metalness: 0.02 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(140, 56, 0x5f8d66, 0x304235);
  grid.material.transparent = true;
  grid.material.opacity = 0.3;
  scene.add(grid);

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x403423, roughness: 0.88 });
  for (let index = 0; index < 18; index += 1) {
    addFencePost(index * 6.5 - 55, -58, fenceMaterial);
    addFencePost(index * 6.5 - 55, 58, fenceMaterial);
    addFencePost(-58, index * 6.5 - 55, fenceMaterial);
    addFencePost(58, index * 6.5 - 55, fenceMaterial);
  }

  const graveMaterial = new THREE.MeshStandardMaterial({ color: 0xa0aa9b, roughness: 0.84 });
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x496b42, roughness: 0.88 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a4930, roughness: 0.88 });

  for (let index = 0; index < 52; index += 1) {
    const angle = index * 2.38;
    const distance = 11 + (index % 9) * 4.2;
    const x = Math.cos(angle) * distance + ((index % 3) - 1) * 2.1;
    const z = Math.sin(angle) * distance + (((index + 1) % 4) - 1.5) * 1.8;

    if (Math.abs(x) < 7 && Math.abs(z) < 7) {
      continue;
    }

    if (index % 5 === 0) {
      const tree = createTree(treeMaterial, trunkMaterial);
      tree.position.set(x, 0, z);
      tree.rotation.y = angle;
      scene.add(tree);
      graveProps.push(tree);
    } else {
      const grave = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.28), graveMaterial);
      grave.position.set(x, 0.9, z);
      grave.rotation.y = angle + Math.PI * 0.5;
      grave.castShadow = true;
      grave.receiveShadow = true;
      scene.add(grave);
      graveProps.push(grave);
    }
  }

  const reticle = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.035, 8, 42),
    new THREE.MeshBasicMaterial({ color: 0x8ef151, transparent: true, opacity: 0.85 }),
  );
  reticle.name = "reticle";
  reticle.rotation.x = Math.PI * 0.5;
  reticle.position.set(0, 0.06, -6);
  scene.add(reticle);
}

function addFencePost(x, z, material) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.8, 0.42), material);
  post.position.set(x, 0.9, z);
  post.castShadow = true;
  post.receiveShadow = true;
  scene.add(post);
}

function createTree(treeMaterial, trunkMaterial) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.4, 7), trunkMaterial);
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.55, 3.1, 8), treeMaterial);
  crown.position.y = 3.2;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  return group;
}

function createPlayerMesh() {
  const group = new THREE.Group();

  const uniform = new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.72 });
  const haoriDark = new THREE.MeshStandardMaterial({ color: 0x0f5b56, roughness: 0.78 });
  const haoriLight = new THREE.MeshStandardMaterial({ color: 0xded8c9, roughness: 0.82 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0f10, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89b74, roughness: 0.72 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x18110f, roughness: 0.86 });
  const wrap = new THREE.MeshStandardMaterial({ color: 0xefe7d2, roughness: 0.82 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x20282e, roughness: 0.45, metalness: 0.35 });
  const blade = new THREE.MeshStandardMaterial({
    color: 0xbffcff,
    emissive: 0x2cc9ff,
    emissiveIntensity: 0.8,
    roughness: 0.24,
    metalness: 0.35,
  });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.67, 1.18, 12), uniform);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.16, 0.72), trim);
  belt.position.y = 0.78;
  belt.castShadow = true;
  group.add(belt);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.78, 0.28), uniform);
  leftLeg.position.set(-0.22, 0.38, 0.02);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;
  group.add(rightLeg);

  const bootGeometry = new THREE.BoxGeometry(0.34, 0.22, 0.42);
  const leftBoot = new THREE.Mesh(bootGeometry, trim);
  leftBoot.position.set(-0.22, 0.08, -0.04);
  leftBoot.castShadow = true;
  group.add(leftBoot);

  const rightBoot = leftBoot.clone();
  rightBoot.position.x = 0.22;
  group.add(rightBoot);

  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.45, 0.08), haoriDark);
  backPanel.position.set(0, 1.12, 0.42);
  backPanel.castShadow = true;
  group.add(backPanel);

  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.38, 0.08), haoriLight);
  leftPanel.position.set(-0.46, 1.08, -0.08);
  leftPanel.rotation.z = -0.12;
  leftPanel.castShadow = true;
  group.add(leftPanel);

  const rightPanel = leftPanel.clone();
  rightPanel.material = haoriDark;
  rightPanel.position.x = 0.46;
  rightPanel.rotation.z = 0.12;
  group.add(rightPanel);

  const shoulderGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.4);
  const leftShoulder = new THREE.Mesh(shoulderGeometry, haoriLight);
  leftShoulder.position.set(-0.62, 1.42, -0.06);
  leftShoulder.rotation.z = -0.18;
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.material = haoriDark;
  rightShoulder.position.x = 0.62;
  rightShoulder.rotation.z = 0.18;
  group.add(rightShoulder);

  const armGeometry = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const leftArm = new THREE.Mesh(armGeometry, uniform);
  leftArm.position.set(-0.72, 1.02, -0.2);
  leftArm.rotation.x = -0.7;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 0.72;
  rightArm.rotation.x = -0.62;
  group.add(rightArm);

  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skin);
  leftHand.position.set(-0.65, 0.93, -0.7);
  leftHand.castShadow = true;
  group.add(leftHand);

  const rightHand = leftHand.clone();
  rightHand.position.x = 0.65;
  group.add(rightHand);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.2, 10), skin);
  neck.position.y = 1.68;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.39, 18, 10), hair);
  hairCap.position.set(0, 2.08, 0.02);
  hairCap.scale.set(1.08, 0.58, 1.02);
  hairCap.castShadow = true;
  group.add(hairCap);

  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 8), hair);
    lock.position.set(side * 0.32, 1.92, -0.08);
    lock.rotation.z = side * 0.28;
    lock.castShadow = true;
    group.add(lock);
  }

  const headband = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.08), wrap);
  headband.position.set(0, 2.02, -0.36);
  group.add(headband);

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x79f3ff,
    emissive: 0x2fbad0,
    emissiveIntensity: 0.65,
  });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMaterial);
  leftEye.position.set(-0.12, 1.96, -0.35);
  group.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.12;
  group.add(rightEye);

  for (let index = 0; index < 7; index += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.38, 8), hair);
    spike.position.set((index - 3) * 0.12, 2.2 + Math.sin(index) * 0.04, -0.08 + Math.cos(index) * 0.08);
    spike.rotation.x = 0.45 + index * 0.06;
    spike.rotation.z = (index - 3) * 0.2;
    spike.castShadow = true;
    group.add(spike);
  }

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.62, 12), wrap);
  hilt.position.set(0.05, 1.08, -0.78);
  hilt.rotation.x = Math.PI * 0.5;
  hilt.castShadow = true;
  group.add(hilt);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 20), metal);
  guard.position.set(0.05, 1.08, -1.1);
  guard.rotation.x = Math.PI * 0.5;
  group.add(guard);

  const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 1.65), blade);
  swordBlade.position.set(0.05, 1.1, -1.92);
  swordBlade.castShadow = true;
  group.add(swordBlade);

  const sheathedBlade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 1.75), metal);
  sheathedBlade.position.set(-0.54, 1.42, 0.34);
  sheathedBlade.rotation.z = -0.74;
  sheathedBlade.rotation.x = 0.24;
  sheathedBlade.castShadow = true;
  group.add(sheathedBlade);

  const bladeLight = new THREE.PointLight(0x7feaff, 1.6, 8);
  bladeLight.position.set(0.08, 1.2, -1.55);
  group.add(bladeLight);

  const playerLight = new THREE.PointLight(
    getGameConfig("lighting.player.color"),
    getGameConfig("lighting.player.intensity"),
    getGameConfig("lighting.player.distance"),
  );
  playerLight.position.set(0, getGameConfig("lighting.player.height"), 0);
  group.add(playerLight);
  if (!scene.userData.editorRefs.playerLight) {
    scene.userData.editorRefs.playerLight = playerLight;
  }

  return group;
}

function createZombieMesh(type = "zombie") {
  if (monsterProfiles[type]?.boss) {
    return createBossMesh(type);
  }

  const group = new THREE.Group();
  group.userData.lodState = "detail";
  const palettes = {
    zombie: { skin: 0x76a64f, cloth: 0x5d3b3b, eye: 0xff514d },
    runner: { skin: 0x8ad05d, cloth: 0x273545, eye: 0x87f7ff },
    brute: { skin: 0x8c6c4c, cloth: 0x493028, eye: 0xff9538 },
    caster: { skin: 0x6f58a8, cloth: 0x272039, eye: 0xd978ff },
  };
  const palette = palettes[type] ?? palettes.zombie;
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.82 });
  const shirt = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.86 });
  const eye = new THREE.MeshStandardMaterial({
    color: palette.eye,
    emissive: palette.eye,
    emissiveIntensity: 1.6,
  });
  const bone = new THREE.MeshStandardMaterial({ color: 0xc7c0a2, roughness: 0.8 });

  const bodyRadius = type === "runner" ? 0.44 : type === "brute" ? 0.9 : 0.62;
  const bodyHeight = type === "brute" ? 1.72 : type === "runner" ? 1.32 : 1.45;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius * 0.86, bodyRadius, bodyHeight, 8), shirt);
  body.position.y = 0.86;
  body.castShadow = true;
  group.add(body);

  const headSize = type === "brute" ? 0.5 : type === "runner" ? 0.34 : 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headSize, 14, 10), skin);
  head.position.y = type === "brute" ? 1.86 : type === "runner" ? 1.64 : 1.72;
  head.castShadow = true;
  group.add(head);

  const armGeometry = new THREE.BoxGeometry(
    type === "brute" ? 0.34 : 0.24,
    type === "brute" ? 0.34 : 0.26,
    type === "runner" ? 1.28 : 1.12,
  );
  const leftArm = new THREE.Mesh(armGeometry, skin);
  leftArm.position.set(type === "brute" ? -0.86 : -0.62, 1.12, -0.25);
  leftArm.rotation.z = 0.2;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = type === "brute" ? 0.86 : 0.62;
  rightArm.rotation.z = -0.2;
  group.add(rightArm);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
  leftEye.position.set(-0.14, head.position.y + 0.06, -headSize * 0.86);
  group.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.14;
  group.add(rightEye);

  if (type === "runner") {
    const leftClaw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 8), bone);
    leftClaw.position.set(-0.72, 0.92, -0.9);
    leftClaw.rotation.x = Math.PI * 0.5;
    group.add(leftClaw);

    const rightClaw = leftClaw.clone();
    rightClaw.position.x = 0.72;
    group.add(rightClaw);
  }

  if (type === "brute") {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.28, 0.55), skin);
    shoulder.position.y = 1.42;
    shoulder.castShadow = true;
    group.add(shoulder);

    for (const side of [-1, 1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 8), bone);
      spike.position.set(side * 0.55, 2.08, -0.08);
      spike.rotation.z = side * 0.55;
      spike.castShadow = true;
      group.add(spike);
    }
  }

  if (type === "caster") {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.82, 12, 1, true), shirt);
    hood.position.y = 1.9;
    hood.castShadow = true;
    group.add(hood);

    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.85, 8), bone);
    staff.position.set(0.72, 1.0, -0.12);
    staff.rotation.z = -0.16;
    staff.castShadow = true;
    group.add(staff);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), eye);
    orb.position.set(0.86, 1.9, -0.16);
    group.add(orb);

    const light = new THREE.PointLight(palette.eye, 1.2, 6);
    light.position.copy(orb.position);
    group.add(light);
  }

  attachZombieLodProxy(group, type, palette, bodyRadius, bodyHeight);
  return group;
}

function attachZombieLodProxy(group, type, palette, bodyRadius, bodyHeight) {
  const detailChildren = [...group.children];
  const proxy = new THREE.Mesh(
    getSharedGeometry(`zombie-proxy-${type}`, () =>
      new THREE.CylinderGeometry(bodyRadius * 0.82, bodyRadius * 0.96, bodyHeight + 0.55, 5),
    ),
    getZombieProxyMaterial(type, palette),
  );
  proxy.name = "zombie-lod-proxy";
  proxy.position.y = type === "brute" ? 1.15 : 1;
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  proxy.visible = false;
  proxy.userData.isLodProxy = true;
  group.userData.detailChildren = detailChildren;
  group.userData.lodProxy = proxy;
  group.add(proxy);
}

function getZombieProxyMaterial(type, palette) {
  const key = `zombie-proxy-${type}`;
  if (!assetCache.materials.has(key)) {
    assetCache.materials.set(
      key,
      new THREE.MeshBasicMaterial({
        color: palette.cloth,
        fog: true,
      }),
    );
  }

  return assetCache.materials.get(key);
}

function createBossMesh(type) {
  if (type === "sofra") {
    return createSofraMesh();
  }

  if (type === "visor") {
    return createVisorMesh();
  }

  if (type === "himetrica") {
    return createHimetricaMesh();
  }

  if (type === "dinzo") {
    return createDinzoMesh();
  }

  return createGitCityMesh();
}

function createVisorMesh() {
  const group = new THREE.Group();
  const ice = new THREE.MeshStandardMaterial({
    color: 0x1e9dff,
    emissive: 0x145ccf,
    emissiveIntensity: 0.5,
    roughness: 0.38,
    metalness: 0.08,
  });
  const darkIce = new THREE.MeshStandardMaterial({ color: 0x0b315f, roughness: 0.68 });
  const crystal = new THREE.MeshStandardMaterial({
    color: 0xb8f3ff,
    emissive: 0x5fdcff,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.92,
    roughness: 0.22,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.12, 2.25, 9), ice);
  body.position.y = 1.16;
  body.castShadow = true;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.34), darkIce);
  chest.position.set(0, 1.44, -0.42);
  chest.castShadow = true;
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 12), ice);
  head.position.y = 2.55;
  head.scale.set(0.9, 1.05, 0.86);
  head.castShadow = true;
  group.add(head);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.82, 8), crystal);
    horn.position.set(side * 0.34, 3.05, -0.04);
    horn.rotation.z = side * -0.48;
    horn.castShadow = true;
    group.add(horn);

    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.52, 8), crystal);
    claw.position.set(side * 0.92, 1.22, -0.7);
    claw.rotation.x = Math.PI * 0.5;
    claw.rotation.z = side * 0.22;
    group.add(claw);
  }

  for (let index = 0; index < 6; index += 1) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.58, 7), crystal);
    spike.position.set((index - 2.5) * 0.18, 2.0 + Math.sin(index) * 0.12, 0.58);
    spike.rotation.x = -0.55;
    spike.castShadow = true;
    group.add(spike);
  }

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8feff,
    emissive: 0xa9f5ff,
    emissiveIntensity: 1,
  });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMaterial);
    eye.position.set(side * 0.18, 2.58, -0.45);
    group.add(eye);
  }

  const light = new THREE.PointLight(0x7edcff, 2.4, 10);
  light.position.y = 2.3;
  group.add(light);

  return group;
}

function createHimetricaMesh() {
  const group = new THREE.Group();
  const ember = new THREE.MeshStandardMaterial({
    color: 0xff7a18,
    emissive: 0xa83b05,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 0.68 });
  const lightning = new THREE.MeshBasicMaterial({ color: 0xfff06d, transparent: true, opacity: 0.88 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.02, 1.95, 10), ember);
  body.position.y = 1.08;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), ember);
  head.position.y = 2.3;
  head.castShadow = true;
  group.add(head);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.06, 8, 28), black);
  belt.position.y = 0.86;
  belt.rotation.x = Math.PI * 0.5;
  group.add(belt);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.25, 0.28), ember);
    arm.position.set(side * 0.88, 1.18, -0.18);
    arm.rotation.z = side * 0.2;
    arm.rotation.x = -0.25;
    arm.castShadow = true;
    group.add(arm);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.08), lightning);
    bolt.position.set(side * 1.08, 1.58, -0.42);
    bolt.rotation.z = side * 0.62;
    bolt.castShadow = true;
    group.add(bolt);
  }

  for (let index = 0; index < 5; index += 1) {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.07), lightning);
    segment.position.set((index - 2) * 0.22, 2.78 + (index % 2) * 0.08, -0.1);
    segment.rotation.z = (index % 2 === 0 ? 0.6 : -0.6);
    group.add(segment);
  }

  const light = new THREE.PointLight(0xff9d28, 2.8, 11);
  light.position.y = 1.8;
  group.add(light);

  return group;
}

function createDinzoMesh() {
  const group = new THREE.Group();
  const slime = new THREE.MeshStandardMaterial({
    color: 0xf5f4e9,
    emissive: 0xb5c6d6,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.02,
  });
  const wet = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.45 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.25, 22, 14), slime);
  body.position.y = 0.68;
  body.scale.set(1.55, 0.48, 1);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), slime);
  head.position.set(0, 1.08, -0.74);
  head.scale.set(1.2, 0.82, 0.94);
  head.castShadow = true;
  group.add(head);

  const trail = new THREE.Mesh(new THREE.CircleGeometry(1.65, 28), wet);
  trail.rotation.x = -Math.PI * 0.5;
  trail.position.set(0, 0.035, 0.58);
  trail.scale.set(1.5, 0.72, 1);
  group.add(trail);

  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.64, 8), slime);
    stalk.position.set(side * 0.28, 1.56, -0.88);
    stalk.rotation.z = side * 0.22;
    group.add(stalk);

    const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eye);
    eyeBall.position.set(side * 0.36, 1.84, -0.92);
    group.add(eyeBall);
  }

  return group;
}

function createGitCityMesh() {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x6f7d86, roughness: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282c, roughness: 0.76 });
  const windowLight = new THREE.MeshStandardMaterial({
    color: 0xf4d475,
    emissive: 0xf0b13b,
    emissiveIntensity: 0.7,
    roughness: 0.4,
  });
  const antenna = new THREE.MeshStandardMaterial({ color: 0xbfd2df, roughness: 0.48, metalness: 0.22 });

  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.75, 3.05, 1.3), concrete);
  tower.position.y = 1.62;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 1.48), dark);
  roof.position.y = 3.25;
  roof.castShadow = true;
  group.add(roof);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.035), windowLight);
      windowPane.position.set((col - 1) * 0.48, 0.72 + row * 0.48, -0.67);
      group.add(windowPane);
    }
  }

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.52, 0.42), dark);
    leg.position.set(side * 0.54, 0.18, 0.08);
    leg.castShadow = true;
    group.add(leg);

    const antennaRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8), antenna);
    antennaRod.position.set(side * 0.42, 3.82, 0);
    antennaRod.rotation.z = side * 0.2;
    group.add(antennaRod);
  }

  const redLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5757, emissive: 0xff2525, emissiveIntensity: 1.1 }),
  );
  redLight.position.set(0, 4.24, 0);
  group.add(redLight);

  const glow = new THREE.PointLight(0xf4d475, 1.4, 8);
  glow.position.y = 2.0;
  group.add(glow);

  return group;
}

function createSofraMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: 0x108ee8,
    emissive: 0x075dd6,
    emissiveIntensity: 0.52,
    roughness: 0.42,
  });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xe6e8ed, roughness: 0.78 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x17233f, roughness: 0.72 });
  const tie = new THREE.MeshStandardMaterial({ color: 0x5734a8, emissive: 0x23105a, emissiveIntensity: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x081019, roughness: 0.64 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xd6f5ff, roughness: 0.48 });
  const flame = new THREE.MeshBasicMaterial({ color: 0x60d7ff, transparent: true, opacity: 0.72 });
  const eye = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9df7ff, emissiveIntensity: 1.9 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 1.68, 10), shirt);
  torso.position.y = 1.44;
  torso.rotation.x = -0.08;
  torso.castShadow = true;
  group.add(torso);

  const rippedHem = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.42, 8, 1, true), shirt);
  rippedHem.position.y = 0.7;
  rippedHem.rotation.y = Math.PI / 8;
  rippedHem.castShadow = true;
  group.add(rippedHem);

  const tieMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.18, 0.06), tie);
  tieMesh.position.set(0, 1.46, -0.76);
  tieMesh.rotation.z = -0.14;
  group.add(tieMesh);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.035), bone);
  badge.position.set(0.38, 1.72, -0.78);
  group.add(badge);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 12), skin);
  head.position.set(0, 2.55, -0.05);
  head.scale.set(0.95, 1.08, 0.86);
  head.castShadow = true;
  group.add(head);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.22), dark);
  jaw.position.set(0, 2.28, -0.46);
  jaw.rotation.x = -0.14;
  group.add(jaw);

  for (const side of [-1, 1]) {
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eye);
    eyeMesh.position.set(side * 0.19, 2.61, -0.43);
    group.add(eyeMesh);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), dark);
    brow.position.set(side * 0.19, 2.75, -0.42);
    brow.rotation.z = side * -0.24;
    group.add(brow);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.46, 0.28), skin);
    arm.position.set(side * 0.94, 1.42, -0.2);
    arm.rotation.z = side * 0.22;
    arm.rotation.x = -0.28;
    arm.castShadow = true;
    group.add(arm);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.34), shirt);
    sleeve.position.set(side * 0.76, 1.86, -0.08);
    sleeve.rotation.z = side * 0.16;
    sleeve.castShadow = true;
    group.add(sleeve);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), skin);
    hand.position.set(side * 1.08, 0.72, -0.62);
    hand.scale.set(1.15, 0.75, 1);
    group.add(hand);

    for (let finger = 0; finger < 4; finger += 1) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.46, 8), dark);
      claw.position.set(side * (1.12 + finger * 0.04), 0.58 - finger * 0.025, -0.84);
      claw.rotation.x = Math.PI * 0.5;
      claw.rotation.z = side * (0.18 + finger * 0.08);
      group.add(claw);
    }

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.08, 0.34), pants);
    leg.position.set(side * 0.32, 0.18, 0.03);
    leg.castShadow = true;
    group.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.78), dark);
    shoe.position.set(side * 0.34, -0.42, -0.18);
    shoe.castShadow = true;
    group.add(shoe);

    const shoulderFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 9), flame);
    shoulderFlame.position.set(side * 0.66, 2.34, 0.14);
    shoulderFlame.rotation.z = side * -0.2;
    group.add(shoulderFlame);
  }

  for (let tuft = 0; tuft < 4; tuft += 1) {
    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 7), dark);
    hair.position.set((tuft - 1.5) * 0.12, 3.0 + tuft * 0.02, -0.06);
    hair.rotation.z = (tuft - 1.5) * -0.28;
    group.add(hair);
  }

  for (let index = 0; index < 7; index += 1) {
    const aura = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 8), flame);
    const angle = (index / 7) * Math.PI * 2;
    aura.position.set(Math.cos(angle) * 0.82, 1.55 + (index % 3) * 0.35, Math.sin(angle) * 0.44 + 0.22);
    aura.rotation.z = Math.sin(angle) * 0.28;
    group.add(aura);
  }

  const light = new THREE.PointLight(0x32b8ff, 4.2, 16);
  light.position.y = 2.0;
  group.add(light);

  return group;
}

function createPowerupMesh(type) {
  const group = new THREE.Group();
  const glowColor = weapons[type]?.color ?? 0x7fd7ff;
  const metal = new THREE.MeshStandardMaterial({ color: 0x30383b, roughness: 0.5, metalness: 0.25 });
  const glow = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.2,
    roughness: 0.45,
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.045, 8, 36),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.72 }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = 0.08;
  group.add(ring);

  if (type === "flamethrower") {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.18, 14), glow);
    tank.rotation.z = Math.PI * 0.5;
    tank.position.y = 0.72;
    tank.castShadow = true;
    group.add(tank);

    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.18), metal);
    nozzle.position.set(0.52, 0.76, 0);
    nozzle.castShadow = true;
    group.add(nozzle);

    const pilot = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 12), glow);
    pilot.rotation.z = -Math.PI * 0.5;
    pilot.position.set(1.1, 0.76, 0);
    group.add(pilot);
  }

  if (type === "axe") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 1.55, 8), metal);
    handle.rotation.z = Math.PI * 0.5;
    handle.position.y = 0.74;
    handle.castShadow = true;
    group.add(handle);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.12), glow);
    blade.position.set(0.62, 0.9, 0);
    blade.rotation.z = 0.26;
    blade.castShadow = true;
    group.add(blade);
  }

  if (type === "katana") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.56, 10), metal);
    handle.rotation.z = Math.PI * 0.5;
    handle.position.y = 0.76;
    handle.castShadow = true;
    group.add(handle);

    const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.06), glow);
    bladeMesh.position.set(0.7, 0.78, 0);
    bladeMesh.castShadow = true;
    group.add(bladeMesh);
  }

  if (type === "crossbow") {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.18), metal);
    stock.position.y = 0.74;
    stock.castShadow = true;
    group.add(stock);

    for (const side of [-1, 1]) {
      const limb = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.14), glow);
      limb.position.set(side * 0.38, 0.86, 0);
      limb.rotation.z = side * 0.55;
      limb.castShadow = true;
      group.add(limb);
    }

    const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.48, 10), glow);
    bolt.rotation.z = -Math.PI * 0.5;
    bolt.position.set(0.76, 0.74, 0);
    group.add(bolt);
  }

  if (type === "talisman") {
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.08), glow);
    tablet.position.y = 0.82;
    tablet.rotation.z = 0.18;
    tablet.castShadow = true;
    group.add(tablet);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.82 }),
    );
    halo.position.y = 0.84;
    halo.rotation.x = Math.PI * 0.5;
    group.add(halo);
  }

  const light = new THREE.PointLight(glowColor, 1.6, 7);
  light.position.y = 1.1;
  group.add(light);

  return group;
}

function getZombiePool(type) {
  if (!entityPools.zombies.has(type)) {
    entityPools.zombies.set(type, []);
  }

  return entityPools.zombies.get(type);
}

function acquireZombieMesh(type) {
  const pool = getZombiePool(type);
  let mesh = pool.pop();
  if (!mesh) {
    mesh = createZombieMesh(type);
    recordPoolExpansion(`zombie:${type}`);
  }

  mesh.visible = true;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  setZombieLod(mesh, false);
  applyMeshQuality(mesh, monsterProfiles[type]?.boss ? 90 : 42);
  return mesh;
}

function releaseZombieMesh(mesh, type) {
  if (!mesh) {
    return;
  }

  scene.remove(mesh);
  mesh.visible = false;
  mesh.position.set(9999, 9999, 9999);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  setZombieLod(mesh, false);
  getZombiePool(type).push(mesh);
}

function createPooledProjectileMesh() {
  const geometry = getSharedGeometry("projectile-sphere", () => new THREE.SphereGeometry(0.16, 10, 8));
  const mesh = new THREE.Mesh(geometry, createPooledMaterial(0xfff2a3));
  mesh.castShadow = qualityManager.level === "high";
  mesh.visible = false;
  return mesh;
}

function acquireProjectileMesh(pool, color, radius) {
  let mesh = pool.pop();
  if (!mesh) {
    mesh = createPooledProjectileMesh();
    recordPoolExpansion(pool === entityPools.bullets ? "bullets" : "enemyProjectiles");
  }

  mesh.visible = true;
  mesh.scale.setScalar(radius / 0.3);
  mesh.material.color.setHex(color);
  mesh.material.emissive.setHex(color);
  mesh.material.opacity = 1;
  mesh.castShadow = qualityManager.level === "high";
  return mesh;
}

function releaseProjectileMesh(mesh, pool) {
  if (!mesh) {
    return;
  }

  scene.remove(mesh);
  mesh.visible = false;
  mesh.position.set(9999, 9999, 9999);
  mesh.scale.set(1, 1, 1);
  pool.push(mesh);
}

function createPooledXpGemMesh() {
  const geometry = getSharedGeometry("xp-gem-small", () => new THREE.OctahedronGeometry(0.24, 0));
  const mesh = new THREE.Mesh(geometry, createPooledMaterial(0x74d1ff));
  mesh.castShadow = false;
  mesh.visible = false;
  return mesh;
}

function acquireXpGemMesh(color, value) {
  let mesh = entityPools.xpGems.pop();
  if (!mesh) {
    mesh = createPooledXpGemMesh();
    recordPoolExpansion("xpGems");
  }

  const scale = value >= 25 ? 1.42 : 1;
  mesh.visible = true;
  mesh.scale.setScalar(scale);
  mesh.material.color.setHex(color);
  mesh.material.emissive.setHex(color);
  mesh.material.opacity = 1;
  mesh.castShadow = qualityManager.level === "high";
  return mesh;
}

function releaseXpGemMesh(mesh) {
  if (!mesh) {
    return;
  }

  scene.remove(mesh);
  mesh.visible = false;
  mesh.position.set(9999, 9999, 9999);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  entityPools.xpGems.push(mesh);
}

function getEffectPool(type) {
  if (!entityPools.effects.has(type)) {
    entityPools.effects.set(type, []);
  }

  return entityPools.effects.get(type);
}

function acquireEffectMesh(type, factory) {
  const pool = getEffectPool(type);
  let mesh = pool.pop();
  if (!mesh) {
    mesh = factory();
    recordPoolExpansion(`effect:${type}`);
  }

  mesh.visible = true;
  mesh.userData.effectPoolType = type;
  return mesh;
}

function releaseEffectMesh(mesh, type = mesh?.userData?.effectPoolType) {
  if (!mesh || !type) {
    return;
  }

  scene.remove(mesh);
  mesh.visible = false;
  mesh.position.set(9999, 9999, 9999);
  mesh.rotation.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.traverse((child) => {
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.opacity = material.userData.baseOpacity ?? material.opacity ?? 1;
      }
    }
  });
  getEffectPool(type).push(mesh);
}

function createTransparentMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function createPooledPulseEffect() {
  const ring = new THREE.Mesh(
    getSharedGeometry("effect-pulse-ring", () => new THREE.TorusGeometry(1, 0.055, 8, 72)),
    createTransparentMaterial(0x8ef151, 0.78),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.userData.baseOpacity = 0.78;
  ring.userData.effectPoolType = "pulse";
  return ring;
}

function createPooledExplosionEffect() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    getSharedGeometry("effect-explosion-ring", () => new THREE.TorusGeometry(1, 0.055, 8, 72)),
    createTransparentMaterial(0xffd36d, 0.72),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.userData.baseOpacity = 0.72;
  group.add(ring);

  const flare = new THREE.Mesh(
    getSharedGeometry("effect-explosion-flare", () => new THREE.SphereGeometry(0.7, 14, 8)),
    createTransparentMaterial(0xffd36d, 0.34),
  );
  flare.position.y = 0.64;
  flare.userData.baseOpacity = 0.34;
  group.add(flare);
  group.userData.effectPoolType = "explosion";
  return group;
}

function createPooledBeamEffect() {
  const beam = new THREE.Mesh(
    getSharedGeometry("effect-beam", () => new THREE.CylinderGeometry(0.045, 0.045, 1, 8)),
    createTransparentMaterial(0x74d1ff, 0.82),
  );
  beam.userData.baseOpacity = 0.82;
  beam.userData.effectPoolType = "beam";
  return beam;
}

function createPooledSlashEffect() {
  const group = new THREE.Group();
  const arc = new THREE.Mesh(
    getSharedGeometry("effect-slash-arc", () => new THREE.TorusGeometry(1, 0.045, 8, 48, Math.PI * 0.92)),
    createTransparentMaterial(0x8ffcff, 0.78),
  );
  arc.rotation.x = Math.PI * 0.5;
  arc.position.z = -0.42;
  arc.userData.baseOpacity = 0.78;
  group.add(arc);
  group.userData.effectPoolType = "slash";
  return group;
}

function createPooledConeEffect() {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(
    getSharedGeometry("effect-cone", () => new THREE.ConeGeometry(1, 1, 16, 1, true)),
    createTransparentMaterial(0xff7a28, 0.42),
  );
  cone.userData.baseOpacity = 0.42;
  group.add(cone);
  group.userData.effectPoolType = "cone";
  return group;
}

function createPooledOrbitEffect() {
  const group = new THREE.Group();
  const orb = new THREE.Mesh(
    getSharedGeometry("effect-orbit-orb", () => new THREE.SphereGeometry(0.28, 14, 10)),
    createTransparentMaterial(0xd978ff, 0.86),
  );
  orb.userData.baseOpacity = 0.86;
  group.add(orb);

  const ring = new THREE.Mesh(
    getSharedGeometry("effect-orbit-ring", () => new THREE.TorusGeometry(1, 0.035, 8, 42)),
    createTransparentMaterial(0xd978ff, 0.58),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = -0.3;
  ring.userData.baseOpacity = 0.58;
  group.add(ring);
  group.userData.effectPoolType = "orbit";
  return group;
}

function tintEffect(mesh, color, opacityMultiplier = 1) {
  mesh.traverse((child) => {
    if (!child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material.color) {
        material.color.setHex(color);
      }
      material.opacity = (child.userData.baseOpacity ?? material.userData.baseOpacity ?? material.opacity ?? 1) * opacityMultiplier;
      material.userData.baseOpacity = material.opacity;
    }
  });
}

function applyMeshQuality(mesh, shadowDistance) {
  const shadowEnabled = qualityManager.level !== "low";
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = shadowEnabled && shadowDistance > 18;
      child.receiveShadow = shadowEnabled && shadowDistance > 18;
    }
  });
}

function animate() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.035);
  const frameStartedAt = performance.now();
  perfStats.dt = rawDt;
  perfStats.frameMs = rawDt * 1000;
  const instantFps = rawDt > 0 ? 1 / rawDt : 60;
  perfStats.fpsAverage = perfStats.fpsAverage * 0.94 + instantFps * 0.06;
  updateQualityManager(rawDt);
  updateLabelThrottle(dt);
  const updateStartedAt = performance.now();

  if (game.state === "playing") {
    game.survivalTime += dt;
    updateAim();
    updatePlayer(dt);
    updatePowerups(dt);
    updateXpGems(dt);
    ensureSpatialGrid();
    updateActiveWeapon(dt);
    updateShooting(dt);
    updateAutoWeapons(dt);
    updateUpgradeChoices(dt);
    updateSpawning(dt);
    updateZombies(dt);
    rebuildSpatialGrid();
    updateEnemyProjectiles(dt);
    updateBullets(dt);
    updateWaveFlow(dt);
    updateHud();
  } else {
    updateAim();
  }

  updateMultiplayer(dt);
  updateCamera(dt);
  updateEffects(dt);
  animateProps(clock.elapsedTime);
  perfStats.updateMs = performance.now() - updateStartedAt;
  const renderStartedAt = performance.now();
  renderer.render(scene, camera);
  perfStats.renderMs = performance.now() - renderStartedAt;
  perfStats.drawCalls = renderer.info.render.calls;
  perfStats.totalFrameMs = performance.now() - frameStartedAt;
  requestAnimationFrame(animate);
}

function updateLabelThrottle(dt) {
  game.labelTimer -= dt;
  game.labelFrameReady = game.labelTimer <= 0;

  if (game.labelFrameReady) {
    game.labelTimer = usesMobileTuning()
      ? getGameConfig("gameplay.labels.mobileInterval")
      : getGameConfig("gameplay.labels.desktopInterval");
  }
}

function updateAim() {
  if (game.touchAimActive || game.touchVector.lengthSq() > 0.0025) {
    const reticle = scene.getObjectByName("reticle");
    if (reticle) {
      reticle.position.copy(player.position).addScaledVector(player.aimDirection, 5);
      reticle.position.y = 0.06;
    }

    player.mesh.rotation.y = getForwardRotation(player.aimDirection);
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, pointerWorld);

  const direction = tempVectorC.subVectors(pointerWorld, player.position);
  direction.y = 0;

  if (direction.lengthSq() > 0.1) {
    player.aimDirection.copy(direction.normalize());
  }

  player.mesh.rotation.y = getForwardRotation(player.aimDirection);

  const reticle = scene.getObjectByName("reticle");
  if (reticle) {
    reticle.position.copy(pointerWorld);
    reticle.position.y = 0.06;
  }
}

function updatePlayer(dt) {
  const move = tempVectorB.set(0, 0, 0);

  if (keys.has("KeyW") || keys.has("ArrowUp")) move.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) move.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) move.x += 1;

  if (move.lengthSq() > 1) {
    move.normalize();
  }

  if (game.touchVector.lengthSq() > 0) {
    move.x += game.touchVector.x;
    move.z += game.touchVector.y;
  }

  const moveLengthSq = move.lengthSq();
  if (moveLengthSq > 0) {
    if (moveLengthSq > 1) {
      move.normalize();
    }
    player.position.addScaledVector(move, player.speed * player.upgradeStats.speedMultiplier * dt);
  }

  const distanceFromCenter = Math.hypot(player.position.x, player.position.z);
  if (distanceFromCenter > worldLimit) {
    player.position.multiplyScalar(worldLimit / distanceFromCenter);
  }

  player.mesh.position.copy(player.position);
}

function updatePowerups(dt) {
  game.powerupTimer -= dt;

  if (game.powerupTimer <= 0 && powerups.length < 3) {
    spawnPowerup(randomPowerupType());
    game.powerupTimer = getPowerupInterval();
  }

  for (let index = powerups.length - 1; index >= 0; index -= 1) {
    const powerup = powerups[index];
    powerup.age += dt;
    powerup.mesh.rotation.y += dt * 1.9;
    powerup.mesh.position.y = powerup.baseY + Math.sin(powerup.age * 4.4) * 0.16;

    if (distanceXZSquared(player.position, powerup.mesh.position) < powerup.radius * powerup.radius) {
      activateWeapon(powerup.type);
      removePowerup(index);
    }
  }
}

function spawnXpGem(position, value = 3) {
  const gemValue = Math.max(1, Math.floor(value));
  const color = gemValue >= 25 ? 0xffd36d : gemValue >= 7 ? 0xd978ff : 0x74d1ff;
  const mesh = acquireXpGemMesh(color, gemValue);
  mesh.position.copy(position);
  mesh.position.y = 0.52;
  scene.add(mesh);

  xpGems.push({
    mesh,
    value: gemValue,
    age: Math.random() * Math.PI * 2,
    baseY: 0.52,
    radius: 0.5,
  });
}

function updateXpGems(dt) {
  for (let index = xpGems.length - 1; index >= 0; index -= 1) {
    const gem = xpGems[index];
    gem.age += dt;
    gem.mesh.rotation.y += dt * 3.1;
    gem.mesh.rotation.x += dt * 1.7;
    gem.mesh.position.y = gem.baseY + Math.sin(gem.age * 4.2) * 0.11;

    const distanceSq = distanceXZSquared(player.position, gem.mesh.position);
    const pickupRadiusSq = player.upgradeStats.pickupRadius * player.upgradeStats.pickupRadius;
    if (distanceSq < pickupRadiusSq && distanceSq > 0.0064) {
      const distance = Math.sqrt(distanceSq);
      const pullStrength = 1 - Math.min(distance / player.upgradeStats.pickupRadius, 1);
      gem.mesh.position.x += (player.position.x - gem.mesh.position.x) * Math.min(1, dt * (3.8 + pullStrength * 10));
      gem.mesh.position.z += (player.position.z - gem.mesh.position.z) * Math.min(1, dt * (3.8 + pullStrength * 10));
    }

    const collectRadius = gem.radius + 0.72;
    if (distanceXZSquared(player.position, gem.mesh.position) < collectRadius * collectRadius) {
      collectXp(gem.value);
      removeXpGem(index);
    }
  }
}

function collectXp(value) {
  player.xp += Math.max(0, Math.floor(value));

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.bestLevel = Math.max(player.bestLevel, player.level);
    player.xpToNext = getXpToNext(player.level);
    player.pendingLevelUps += 1;
    spawnLevelPulse();
  }

  if (player.pendingLevelUps > 0 && player.pendingUpgradeChoices.length === 0) {
    openUpgradeChoices();
  }

  updateHud();
}

function getXpToNext(level) {
  return 10 + level * 7 + Math.floor(level ** 1.35);
}

function getXpValueForZombie(type) {
  const profile = monsterProfiles[type] ?? monsterProfiles.zombie;

  if (profile.boss) {
    return 34 + Math.floor(player.wave * 2.5);
  }

  if (type === "brute" || type === "caster") {
    return 8 + Math.floor(player.wave * 0.35);
  }

  if (type === "runner") {
    return 5 + Math.floor(player.wave * 0.2);
  }

  return 3 + Math.floor(player.wave * 0.12);
}

function updateUpgradeChoices() {
  if (player.pendingLevelUps > 0 && player.pendingUpgradeChoices.length === 0) {
    openUpgradeChoices();
  }
}

function openUpgradeChoices() {
  const choices = getRandomUpgradeChoices();
  if (choices.length === 0) {
    player.pendingLevelUps = 0;
    player.pendingUpgradeChoices = [];
  } else {
    player.pendingUpgradeChoices = choices;
  }

  renderUpgradeChoices();
}

function getRandomUpgradeChoices() {
  const available = upgradeDefinitions.filter((upgrade) => isUpgradeAvailable(upgrade));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function isUpgradeAvailable(upgrade) {
  const stacks = player.upgradeStacks[upgrade.id] || 0;

  if (upgrade.id === "autoWeapon") {
    return getNextUnlockableAutoWeapon() !== null && stacks < upgrade.maxStacks;
  }

  return stacks < upgrade.maxStacks;
}

function chooseUpgrade(index) {
  const choice = player.pendingUpgradeChoices[index];
  if (!choice) {
    return;
  }

  applyUpgrade(choice);
  player.pendingLevelUps = Math.max(0, player.pendingLevelUps - 1);
  player.pendingUpgradeChoices = [];

  if (player.pendingLevelUps > 0) {
    openUpgradeChoices();
  } else {
    renderUpgradeChoices();
  }

  updateHud();
}

function applyUpgrade(upgrade) {
  player.upgradeStacks[upgrade.id] = (player.upgradeStacks[upgrade.id] || 0) + 1;

  if (upgrade.id === "damage") {
    player.upgradeStats.damageMultiplier += 0.16;
  }

  if (upgrade.id === "cadence") {
    player.upgradeStats.cooldownMultiplier = Math.max(0.48, player.upgradeStats.cooldownMultiplier * 0.9);
  }

  if (upgrade.id === "area") {
    player.upgradeStats.areaMultiplier += 0.13;
  }

  if (upgrade.id === "speed") {
    player.upgradeStats.speedMultiplier += 0.1;
  }

  if (upgrade.id === "pickup") {
    player.upgradeStats.pickupRadius += 1.2;
  }

  if (upgrade.id === "maxHealth") {
    player.maxHealth += 18;
    player.health = Math.min(player.maxHealth, player.health + 18);
  }

  if (upgrade.id === "projectile") {
    player.upgradeStats.projectileBonus += 1;
  }

  if (upgrade.id === "autoWeapon") {
    const weaponId = getNextUnlockableAutoWeapon();
    if (weaponId) {
      player.autoWeapons[weaponId].level = 1;
      player.autoWeapons[weaponId].cooldown = 0.2;
      spawnWeaponPulse(autoWeaponProfiles[weaponId].color);
    }
  }
}

function getNextUnlockableAutoWeapon() {
  for (const weaponId of ["orbitOrb", "sealRain"]) {
    if ((player.autoWeapons[weaponId]?.level || 0) <= 0) {
      return weaponId;
    }
  }

  return null;
}

function renderUpgradeChoices() {
  if (!upgradePanel || !upgradeOptionsElement) {
    return;
  }

  if (player.pendingUpgradeChoices.length === 0) {
    upgradePanel.classList.add("is-hidden");
    upgradeOptionsElement.innerHTML = "";
    return;
  }

  upgradePanel.classList.remove("is-hidden");
  upgradeOptionsElement.innerHTML = player.pendingUpgradeChoices
    .map((upgrade, index) => {
      const stacks = player.upgradeStacks[upgrade.id] || 0;
      const description = upgrade.id === "autoWeapon" ? getAutoWeaponUnlockDescription() : upgrade.description;
      return `
        <button class="upgrade-card" type="button" data-upgrade-index="${index}">
          <span class="upgrade-card__key">${index + 1}</span>
          <strong>${escapeHtml(upgrade.label)}</strong>
          <span>${escapeHtml(description)}</span>
          <span>${stacks}/${upgrade.maxStacks} stacks</span>
        </button>
      `;
    })
    .join("");
}

function getAutoWeaponUnlockDescription() {
  const weaponId = getNextUnlockableAutoWeapon();
  const label = weaponId ? autoWeaponProfiles[weaponId].label : "arsenal completo";
  return `Desbloqueia ${label} para atacar sem segurar o tiro.`;
}

function spawnLevelPulse() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.06, 8, 72),
    new THREE.MeshBasicMaterial({ color: 0x8ef151, transparent: true, opacity: 0.82, depthWrite: false }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(player.position);
  ring.position.y = 0.22;
  addTimedEffect(ring, 0.55, true);
}

function updateActiveWeapon(dt) {
  if (player.weapon !== "pistol") {
    player.weaponTimer -= dt;

    if (player.weaponTimer <= 0) {
      resetWeapon();
    }
  }

  if (player.axeSpinTimer > 0) {
    player.axeSpinTimer = Math.max(0, player.axeSpinTimer - dt);
    damageZombiesInRadius(4.4, 8, false);
  }
}

function updateShooting(dt) {
  player.shotCooldown -= dt;

  if (player.weapon === "flamethrower") {
    updateFlamethrower(dt);
    return;
  }

  if (player.weapon === "axe") {
    updateAxeAttack();
    return;
  }

  if (player.weapon === "katana") {
    updateKatanaAttack();
    return;
  }

  if (player.weapon === "crossbow") {
    updateCrossbowAttack();
    return;
  }

  if (player.weapon === "talisman") {
    updateTalismanAttack();
    return;
  }

  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = getPlayerCooldown(Math.max(0.1, 0.2 - player.wave * 0.006));
  spawnBullet();
  sendMultiplayerAttack("pistol");
}

function updateFlamethrower(dt) {
  if (!game.shooting) {
    return;
  }

  damageZombiesInCone(10.5, Math.cos(0.58), 12 * dt, false);

  if (player.shotCooldown <= 0) {
    player.shotCooldown = getPlayerCooldown(0.065);
    spawnFlameBurst();
    sendMultiplayerAttack("flamethrower");
  }
}

function updateAxeAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = getPlayerCooldown(0.48);
  startAxeSpin();
  sendMultiplayerAttack("axe");
}

function updateKatanaAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = getPlayerCooldown(0.28);
  damageZombiesInCone(5.8, Math.cos(0.92), 7, true);
  spawnKatanaSlash();
  sendMultiplayerAttack("katana");
}

function updateCrossbowAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = getPlayerCooldown(0.36);
  spawnPlayerProjectiles({
    color: weapons.crossbow.color,
    damage: 5,
    lifespan: 1.7,
    pierceHits: 3,
    radius: 0.24,
    speed: 42,
  });
  sendMultiplayerAttack("crossbow");
}

function updateTalismanAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = getPlayerCooldown(0.72);
  spawnPlayerProjectiles({
    color: weapons.talisman.color,
    damage: 3,
    explodeDamage: 5,
    explodeRadius: 4.8,
    lifespan: 1.35,
    radius: 0.32,
    speed: 25,
  });
  sendMultiplayerAttack("talisman");
}

function spawnBullet() {
  spawnPlayerProjectiles({
    color: 0xfff2a3,
    damage: 1,
    lifespan: 1.25,
    radius: 0.3,
    speed: 33,
  });
}

function spawnPlayerProjectiles(config) {
  const count = 1 + player.upgradeStats.projectileBonus;
  const spreadStep = count > 1 ? 0.12 : 0;

  for (let index = 0; index < count; index += 1) {
    const angleOffset = (index - (count - 1) / 2) * spreadStep;
    spawnProjectile({
      ...config,
      angleOffset,
      damage: config.damage * player.upgradeStats.damageMultiplier,
      explodeDamage: (config.explodeDamage || 0) * player.upgradeStats.damageMultiplier,
      explodeRadius: (config.explodeRadius || 0) * player.upgradeStats.areaMultiplier,
      radius: config.radius * Math.sqrt(player.upgradeStats.areaMultiplier),
    });
  }
}

function spawnProjectile({
  color,
  damage,
  explodeDamage = 0,
  explodeRadius = 0,
  lifespan,
  pierceHits = 0,
  radius,
  speed,
  origin = player.position,
  direction = player.aimDirection,
  angleOffset = 0,
}) {
  const projectileDirection = rotateDirectionY(direction, angleOffset);
  const mesh = acquireProjectileMesh(entityPools.bullets, color, radius);
  mesh.position.copy(origin);
  mesh.position.y = 1.12;
  mesh.position.addScaledVector(projectileDirection, 1.25);
  scene.add(mesh);

  bullets.push({
    mesh,
    age: 0,
    damage,
    explodeDamage,
    explodeRadius,
    hitZombies: new Set(),
    lifespan,
    pierceHits,
    radius,
    velocity: projectileDirection.multiplyScalar(speed),
  });
}

function updateAutoWeapons(dt) {
  updateGuardianBlade(dt);
  updateOrbitOrb(dt);
  updateSealRain(dt);
}

function updateGuardianBlade(dt) {
  const weapon = player.autoWeapons.guardianBlade;
  if (!weapon?.level) {
    return;
  }

  const profile = autoWeaponProfiles.guardianBlade;
  weapon.cooldown -= dt;

  if (weapon.cooldown > 0) {
    return;
  }

  const target = getClosestZombie(player.position, profile.range);
  if (!target) {
    weapon.cooldown = Math.min(weapon.cooldown + 0.1, 0.18);
    return;
  }

  weapon.cooldown = getPlayerCooldown(profile.cooldown);
  const origin = player.position.clone();
  const direction = target.zombie.mesh.position.clone().sub(origin);
  direction.y = 0;

  if (direction.lengthSq() < 0.01) {
    direction.copy(player.aimDirection);
  } else {
    direction.normalize();
  }

  damageZombie(target.index, profile.damage * player.upgradeStats.damageMultiplier, true);
  spawnGuardianBladeEffect(origin, direction, profile.color);
  sendMultiplayerAttack("guardianBlade", origin, direction);
}

function updateOrbitOrb(dt) {
  const weapon = player.autoWeapons.orbitOrb;
  if (!weapon?.level) {
    return;
  }

  const profile = autoWeaponProfiles.orbitOrb;
  weapon.angle += dt * 3.4;
  weapon.cooldown -= dt;

  if (weapon.cooldown > 0) {
    return;
  }

  weapon.cooldown = getPlayerCooldown(profile.cooldown);
  const orbitRadius = profile.orbitRadius * Math.sqrt(player.upgradeStats.areaMultiplier);
  const origin = player.position
    .clone()
    .add(new THREE.Vector3(Math.cos(weapon.angle) * orbitRadius, 0, Math.sin(weapon.angle) * orbitRadius));
  const direction = origin.clone().sub(player.position).normalize();
  const radius = profile.radius * player.upgradeStats.areaMultiplier;
  const damage = profile.damage * player.upgradeStats.damageMultiplier;
  damageZombiesAtPoint(origin, radius, damage, false);
  spawnOrbitOrbEffect(origin, profile.color, radius);
  sendMultiplayerAttack("orbitOrb", origin, direction);
}

function updateSealRain(dt) {
  const weapon = player.autoWeapons.sealRain;
  if (!weapon?.level) {
    return;
  }

  const profile = autoWeaponProfiles.sealRain;
  weapon.cooldown -= dt;

  if (weapon.cooldown > 0) {
    return;
  }

  const target = getClosestZombie(player.position, profile.range);
  if (!target) {
    weapon.cooldown = Math.min(weapon.cooldown + 0.16, 0.24);
    return;
  }

  weapon.cooldown = getPlayerCooldown(profile.cooldown);
  const origin = target.zombie.mesh.position.clone();
  const direction = origin.clone().sub(player.position);
  direction.y = 0;

  if (direction.lengthSq() < 0.01) {
    direction.copy(player.aimDirection);
  } else {
    direction.normalize();
  }

  const radius = profile.radius * player.upgradeStats.areaMultiplier;
  const damage = profile.damage * player.upgradeStats.damageMultiplier;
  damageZombiesAtPoint(origin, radius, damage, false);
  spawnSealRainEffect(origin, profile.color, radius);
  sendMultiplayerAttack("sealRain", origin, direction);
}

function getClosestZombie(origin, maxRange = Infinity) {
  let closest = null;
  let closestDistanceSq = maxRange * maxRange;
  const candidates = Number.isFinite(maxRange) ? queryZombiesNear(origin, maxRange) : zombies;

  for (const zombie of candidates) {
    const distanceSq = distanceXZSquared(origin, zombie.mesh.position);

    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closest = { zombie, index: getZombieIndex(zombie), distance: Math.sqrt(distanceSq) };
    }
  }

  return closest;
}

function spawnGuardianBladeEffect(origin, direction, color) {
  spawnRemoteBeam(origin, direction, color, 7);
  const slashOrigin = tempVectorA.copy(origin).addScaledVector(direction, 2.6);
  spawnRemoteSlash(slashOrigin, direction, color);
}

function spawnOrbitOrbEffect(origin, color, radius) {
  const group = acquireEffectMesh("orbit", createPooledOrbitEffect);
  group.position.copy(origin);
  group.position.y = 0.52;
  group.scale.setScalar(radius);
  tintEffect(group, color);
  addTimedEffect(group, 0.26, false, "orbit");
}

function spawnSealRainEffect(origin, color, radius) {
  const marker = acquireEffectMesh("beam", createPooledBeamEffect);
  marker.position.copy(origin);
  marker.position.y = 2.9;
  marker.scale.set(1.9, 4.8, 1.9);
  marker.quaternion.identity();
  tintEffect(marker, color, 0.85);
  addTimedEffect(marker, 0.24, false, "beam");
  spawnExplosion(origin, color, radius);
}

function getPlayerCooldown(seconds) {
  return Math.max(0.045, seconds * player.upgradeStats.cooldownMultiplier);
}

function spawnPowerup(type = randomPowerupType(), x, z) {
  if (!weapons[type] || type === "pistol") {
    return;
  }

  const position =
    Number.isFinite(x) && Number.isFinite(z) ? new THREE.Vector3(x, 0, z) : getRandomPowerupPosition();
  const mesh = createPowerupMesh(type);
  mesh.position.set(position.x, 0.36, position.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  powerups.push({
    type,
    mesh,
    age: Math.random() * Math.PI,
    baseY: 0.36,
    radius: 1.45,
  });
}

function activateWeapon(type) {
  if (!weapons[type] || type === "pistol") {
    return;
  }

  player.weapon = type;
  player.weaponTimer = weapons[type].duration;
  player.shotCooldown = 0;

  if (type === "axe") {
    startAxeSpin();
  } else {
    spawnWeaponPulse(weapons[type].color);
  }

  updateHud();
}

function resetWeapon() {
  player.weapon = "pistol";
  player.weaponTimer = 0;
  player.axeSpinTimer = 0;
}

function randomPowerupType() {
  const types = ["flamethrower", "axe", "katana", "crossbow", "talisman"];
  return types[Math.floor(Math.random() * types.length)];
}

function getRandomPowerupPosition() {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 34;
    const position = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);

    if (distanceXZ(position, player.position) > 8) {
      return position;
    }
  }

  return new THREE.Vector3(12, 0, -10);
}

function getPowerupInterval() {
  return Math.max(4.2, 10 - player.wave * 0.28 - game.survivalTime * 0.025) + Math.random() * 2.5;
}

function spawnFlameBurst() {
  const direction = tempVectorA.copy(player.aimDirection).normalize();
  const flame = acquireEffectMesh("cone", createPooledConeEffect);
  flame.position.copy(player.position).addScaledVector(direction, 3.05);
  flame.position.y = 1.02;
  flame.quaternion.setFromUnitVectors(upVector, direction);
  flame.scale.set(1.25, 4.6, 1.25);
  tintEffect(flame, 0xff7a28);
  addTimedEffect(flame, 0.16, false, "cone");
}

function startAxeSpin() {
  player.axeSpinTimer = 0.36;
  spawnWeaponPulse(0x7fd7ff);
}

function spawnKatanaSlash() {
  const slash = acquireEffectMesh("slash", createPooledSlashEffect);
  slash.position.copy(player.position);
  slash.position.y = 0.28;
  slash.rotation.y = getForwardRotation(player.aimDirection) - Math.PI * 0.5;
  slash.scale.setScalar(2.75);
  tintEffect(slash, weapons.katana.color, 1.1);
  addTimedEffect(slash, 0.2, true, "slash");
}

function spawnExplosion(position, color, radius) {
  const group = acquireEffectMesh("explosion", createPooledExplosionEffect);
  group.position.copy(position);
  group.position.y = 0.24;
  group.scale.setScalar(radius);
  tintEffect(group, color);
  addTimedEffect(group, 0.32, false, "explosion");
}

function spawnWeaponPulse(color) {
  const ring = acquireEffectMesh("pulse", createPooledPulseEffect);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(player.position);
  ring.position.y = 0.18;
  ring.scale.setScalar(3.9);
  tintEffect(ring, color);
  addTimedEffect(ring, 0.36, true, "pulse");
}

function startNextWave() {
  player.wave += 1;
  waveElement.textContent = player.wave.toString();
  game.zombiesToSpawn = Math.min(8 + player.wave * 4 + Math.floor(game.survivalTime / 12), 130);
  game.spawnTimer = 0.2;
}

function updateSpawning(dt) {
  if (game.zombiesToSpawn <= 0) {
    return;
  }

  if (zombies.length >= maxActiveZombies) {
    game.spawnTimer = Math.min(game.spawnTimer, 0.22);
    return;
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer > 0) {
    return;
  }

  spawnZombie();
  game.zombiesToSpawn -= 1;
  game.spawnTimer = getZombieSpawnInterval();
}

function getZombieSpawnInterval() {
  return Math.max(0.08, 0.82 - player.wave * 0.045 - game.survivalTime * 0.006);
}

function spawnZombie(x, z, type = pickMonsterType()) {
  const profile = monsterProfiles[type] ?? monsterProfiles.zombie;
  const mesh = acquireZombieMesh(type);
  mesh.userData.poolType = type;
  if (Number.isFinite(x) && Number.isFinite(z)) {
    mesh.position.set(x, 0, z);
  } else {
    const angle = Math.random() * Math.PI * 2;
    const distance = 28 + Math.random() * 22;
    mesh.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
  }
  scene.add(mesh);

  const maxHealth = profile.health + Math.floor(player.wave / 3) + Math.floor(game.survivalTime / 90);
  const labelSprite = profile.boss ? createBossLabelSprite(profile.label, maxHealth, type) : null;
  if (labelSprite) {
    scene.add(labelSprite);
  }

  zombies.push({
    id: nextZombieId,
    mesh,
    type,
    health: maxHealth,
    maxHealth,
    labelSprite,
    speed: profile.speed + Math.min(player.wave * 0.2 + game.survivalTime * 0.012, 5.4) + Math.random() * 0.7,
    attackCooldown: 0,
    damage: profile.damage,
    radius: profile.radius,
    score: profile.score,
    shadowEnabled: null,
    summonCooldown: type === "sofra" ? 1.8 : 0,
    wobble: Math.random() * Math.PI * 2,
  });
  if (labelSprite) {
    updateBossLabelPosition(zombies[zombies.length - 1], true);
  }
  nextZombieId += 1;
  spatialGrid.dirty = true;
}

function createBossLabelSprite(label, maxHealth, type) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(5.4, 1.8, 1);
  sprite.renderOrder = 20;
  sprite.userData = {
    canvas,
    context: canvas.getContext("2d"),
    label,
    maxHealth,
    lastLabelHealth: maxHealth,
    lastLabelUpdate: 0,
    texture,
    type,
  };

  updateBossLabel(sprite, maxHealth, true);
  return sprite;
}

function updateBossLabel(sprite, health, force = false) {
  const { canvas, context, label, maxHealth, texture, type } = sprite.userData;
  const now = performance.now();
  const healthDelta = Math.abs(health - (sprite.userData.lastLabelHealth ?? maxHealth));

  if (!force && usesMobileTuning() && now - (sprite.userData.lastLabelUpdate || 0) < 90 && healthDelta < maxHealth * 0.035) {
    return;
  }

  const healthRatio = Math.max(0, Math.min(1, health / maxHealth));
  const accent = getBossAccentColor(type);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(5, 8, 10, 0.84)";
  context.fillRect(16, 10, 352, 104);
  context.strokeStyle = accent;
  context.lineWidth = 4;
  context.strokeRect(16, 10, 352, 104);

  context.fillStyle = "#f6fbff";
  context.font = "900 38px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 192, 40);

  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.fillRect(48, 72, 288, 22);
  context.fillStyle = accent;
  context.fillRect(48, 72, 288 * healthRatio, 22);
  context.strokeStyle = "rgba(255, 255, 255, 0.5)";
  context.lineWidth = 2;
  context.strokeRect(48, 72, 288, 22);

  context.fillStyle = "#f6fbff";
  context.font = "800 16px Inter, Arial, sans-serif";
  context.fillText(`VIDA ${Math.ceil(health)}/${Math.ceil(maxHealth)}`, 192, 105);

  texture.needsUpdate = true;
  sprite.userData.lastLabelHealth = health;
  sprite.userData.lastLabelUpdate = now;
}

function updateBossLabelPosition(zombie, force = false) {
  if (!zombie.labelSprite) {
    return;
  }

  if (!force && !game.labelFrameReady) {
    return;
  }

  zombie.labelSprite.position.copy(zombie.mesh.position);
  zombie.labelSprite.position.y = getBossLabelHeight(zombie.type);
}

function getBossLabelHeight(type) {
  if (type === "gitcity") {
    return 5.15;
  }

  if (type === "sofra") {
    return 4.25;
  }

  if (type === "dinzo") {
    return 2.95;
  }

  return 3.65;
}

function getBossAccentColor(type) {
  if (type === "sofra") {
    return "#32b8ff";
  }

  if (type === "visor") {
    return "#7edcff";
  }

  if (type === "himetrica") {
    return "#ff9d28";
  }

  if (type === "dinzo") {
    return "#f5f4e9";
  }

  return "#f4d475";
}

function spawnBossPreview() {
  const previewBosses = [
    ["visor", -8, -7],
    ["himetrica", 8, -8],
    ["dinzo", -10, 7],
    ["gitcity", 10, 8],
    ["sofra", 0, 11],
  ];

  for (const [type, x, z] of previewBosses) {
    spawnZombie(player.position.x + x, player.position.z + z, type);
  }
}

function pickMonsterType() {
  const availableTypes = Object.entries(monsterProfiles)
    .filter(([, profile]) => player.wave >= profile.minWave)
    .map(([type]) => type);

  if (!availableTypes.includes("zombie")) {
    availableTypes.push("zombie");
  }

  const weights = {
    zombie: 1,
    runner: Math.min(0.35 + player.wave * 0.08 + game.survivalTime * 0.004, 1.35),
    brute: Math.min(0.2 + player.wave * 0.045 + game.survivalTime * 0.002, 0.85),
    caster: Math.min(0.18 + player.wave * 0.04 + game.survivalTime * 0.002, 0.75),
    visor: Math.min(0.035 + game.survivalTime * 0.0009 + player.wave * 0.006, 0.13),
    himetrica: Math.min(0.028 + game.survivalTime * 0.0008 + player.wave * 0.005, 0.11),
    dinzo: Math.min(0.032 + game.survivalTime * 0.0009 + player.wave * 0.005, 0.12),
    gitcity: Math.min(0.018 + game.survivalTime * 0.0007 + player.wave * 0.004, 0.085),
    sofra: Math.min(0.012 + game.survivalTime * 0.00055 + player.wave * 0.0035, 0.065),
  };

  const totalWeight = availableTypes.reduce((sum, type) => sum + (weights[type] ?? 0.02), 0);
  let roll = Math.random() * totalWeight;

  for (const type of availableTypes) {
    roll -= weights[type] ?? 0.02;
    if (roll <= 0) {
      return type;
    }
  }

  return "zombie";
}

function updateZombies(dt) {
  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    const zombie = zombies[index];
    const target = getClosestPlayerTarget(zombie.mesh.position);
    if (!target) {
      continue;
    }

    const toTarget = tempVectorA.subVectors(target.position, zombie.mesh.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    zombie.attackCooldown -= dt;
    updateZombieLod(zombie);
    updateSofraSummons(zombie, dt);

    if (canUseRangedAttack(zombie.type, distance)) {
      if (distance > 0.05) {
        toTarget.normalize();
        zombie.mesh.rotation.y = getForwardRotation(toTarget);
      }

      if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown = getRangedCooldown(zombie.type);
        spawnEnemyProjectile(zombie, target);
      }

      updateBossLabelPosition(zombie);
      continue;
    }

    if (distance > 0.05) {
      toTarget.normalize();
      zombie.mesh.position.addScaledVector(toTarget, zombie.speed * dt);
      zombie.mesh.rotation.y = getForwardRotation(toTarget);
    }

    if (distance < zombie.radius + 0.72 && zombie.attackCooldown <= 0) {
      zombie.attackCooldown = 0.62;
      damagePlayerTarget(target, zombie.damage + Math.floor(player.wave * 0.55));
    }

    updateBossLabelPosition(zombie);
  }

  spatialGrid.dirty = true;
}

function updateSofraSummons(zombie, dt) {
  if (zombie.type !== "sofra" || zombies.length >= maxActiveZombies - 3) {
    return;
  }

  zombie.summonCooldown -= dt;
  if (zombie.summonCooldown > 0) {
    return;
  }

  zombie.summonCooldown = 5.5;
  const summonTypes = ["runner", "zombie", "caster"];
  const summonCount = player.wave >= 8 ? 3 : 2;

  for (let index = 0; index < summonCount; index += 1) {
    const angle = (index / summonCount) * Math.PI * 2 + Math.random() * 0.35;
    const distance = 2.2 + Math.random() * 1.3;
    const type = summonTypes[(index + player.wave) % summonTypes.length];
    spawnZombie(
      zombie.mesh.position.x + Math.cos(angle) * distance,
      zombie.mesh.position.z + Math.sin(angle) * distance,
      type,
    );
  }

  spawnExplosion(zombie.mesh.position, monsterProfiles.sofra.projectileColor, 2.6);
}

function updateZombieLod(zombie) {
  if (monsterProfiles[zombie.type]?.boss) {
    return;
  }

  const distanceSq = distanceXZSquared(player.position, zombie.mesh.position);
  const detailDistance = getZombieDetailDistance();
  const wantsProxy = distanceSq > detailDistance * detailDistance;
  setZombieLod(zombie.mesh, wantsProxy);

  const shadowDistance = qualityManager.level === "high" ? 28 : qualityManager.level === "medium" ? 17 : 0;
  const wantsShadow = !wantsProxy && distanceSq < shadowDistance * shadowDistance;

  if (zombie.shadowEnabled === wantsShadow) {
    return;
  }

  zombie.shadowEnabled = wantsShadow;
  zombie.mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = wantsShadow;
      child.receiveShadow = wantsShadow && qualityManager.level === "high";
    }
  });
}

function getZombieDetailDistance() {
  let baseDistance = qualityManager.level === "high" ? 24 : qualityManager.level === "medium" ? 15 : 8.5;
  if (usesMobileTuning()) {
    baseDistance *= 0.82;
  }

  if (zombies.length > 70) {
    return baseDistance * 0.75;
  }

  if (zombies.length > 45) {
    return baseDistance * 0.9;
  }

  return baseDistance;
}

function setZombieLod(mesh, useProxy) {
  const detailChildren = mesh.userData.detailChildren;
  const proxy = mesh.userData.lodProxy;
  if (!detailChildren || !proxy) {
    return;
  }

  const nextState = useProxy ? "proxy" : "detail";
  if (mesh.userData.lodState === nextState) {
    return;
  }

  for (const child of detailChildren) {
    child.visible = !useProxy;
  }
  proxy.visible = useProxy;
  mesh.userData.lodState = nextState;
}

function getClosestPlayerTarget(position) {
  let closestTarget = null;
  let closestDistance = Infinity;

  for (const target of getLivingPlayerTargets()) {
    const distance = distanceXZ(position, target.position);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestTarget = target;
    }
  }

  return closestTarget;
}

function getLivingPlayerTargets() {
  const targets = [];

  if (game.state === "playing" && player.health > 0) {
    targets.push({
      id: multiplayer.id || "local",
      isLocal: true,
      position: player.position,
      radius: 0.64,
    });
  }

  for (const remotePlayer of remotePlayers.values()) {
    if (remotePlayer.state === "playing" && remotePlayer.health > 0) {
      targets.push({
        id: remotePlayer.id,
        isLocal: false,
        position: remotePlayer.mesh.position,
        radius: 0.64,
        remotePlayer,
      });
    }
  }

  return targets;
}

function getProjectileHitTarget(projectile) {
  for (const target of getLivingPlayerTargets()) {
    if (distanceXZ(projectile.mesh.position, target.position) < projectile.radius + target.radius) {
      return target;
    }
  }

  return null;
}

function damagePlayerTarget(target, amount) {
  if (target.isLocal) {
    damageLocalPlayer(amount);
    return;
  }

  damageRemotePlayer(target.id, amount);
}

function damageLocalPlayer(amount) {
  player.health = Math.max(0, player.health - amount);
  pulseHealth();

  if (player.health <= 0) {
    endGame();
  }
}

function damageRemotePlayer(playerId, amount) {
  const remotePlayer = remotePlayers.get(playerId);

  if (!remotePlayer || remotePlayer.health <= 0) {
    return;
  }

  remotePlayer.health = Math.max(0, remotePlayer.health - amount);
  updatePlayerLabel(remotePlayer.labelSprite, remotePlayer.name, remotePlayer.color, remotePlayer.health, remotePlayer.maxHealth);

  sendMultiplayerMessage({
    type: "damagePlayer",
    targetId: playerId,
    amount,
  });
}

function canUseRangedAttack(type, distance) {
  return (
    (type === "caster" && distance < 16 && distance > 4.2) ||
    (type === "visor" && distance < 18 && distance > 4.4) ||
    (type === "himetrica" && distance < 15 && distance > 3.6) ||
    (type === "sofra" && distance < 20 && distance > 3.8)
  );
}

function getRangedCooldown(type) {
  if (type === "sofra") {
    return 0.72;
  }

  if (type === "visor") {
    return 1.1;
  }

  if (type === "himetrica") {
    return 0.85;
  }

  return 1.45;
}

function spawnEnemyProjectile(zombie, target = getClosestPlayerTarget(zombie.mesh.position)) {
  if (!target) {
    return;
  }

  const direction = target.position.clone().sub(zombie.mesh.position);
  direction.y = 0;

  if (direction.lengthSq() <= 0.01) {
    return;
  }

  direction.normalize();
  const profile = monsterProfiles[zombie.type] ?? monsterProfiles.caster;
  const projectileColor = profile.projectileColor ?? 0xd978ff;
  const projectileSpeed = zombie.type === "sofra" ? 23 : zombie.type === "himetrica" ? 19 : zombie.type === "visor" ? 13 : 14;
  const projectileSize = zombie.type === "sofra" ? 0.28 : zombie.type === "visor" ? 0.3 : zombie.type === "himetrica" ? 0.2 : 0.24;
  const mesh = acquireProjectileMesh(entityPools.enemyProjectiles, projectileColor, projectileSize + 0.18);
  mesh.position.copy(zombie.mesh.position);
  mesh.position.y = 1.38;
  mesh.position.addScaledVector(direction, 0.9);
  scene.add(mesh);

  enemyProjectiles.push({
    mesh,
    age: 0,
    damage: zombie.damage + Math.floor(player.wave * 0.35),
    lifespan: 2.25,
    radius: projectileSize + 0.18,
    color: projectileColor,
    targetId: target.id,
    velocity: direction.multiplyScalar(projectileSpeed),
  });
}

function updateEnemyProjectiles(dt) {
  for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = enemyProjectiles[index];
    projectile.age += dt;
    projectile.mesh.position.addScaledVector(projectile.velocity, dt);

    const hitTarget = getProjectileHitTarget(projectile);
    if (hitTarget) {
      damagePlayerTarget(hitTarget, projectile.damage);
      spawnExplosion(projectile.mesh.position, projectile.color, 2.4);
      removeEnemyProjectile(index);
      continue;
    }

    if (projectile.age > projectile.lifespan || Math.abs(projectile.mesh.position.x) > 70 || Math.abs(projectile.mesh.position.z) > 70) {
      removeEnemyProjectile(index);
    }
  }
}

function updateBullets(dt) {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = bullets[bulletIndex];
    bullet.age += dt;
    bullet.mesh.position.addScaledVector(bullet.velocity, dt);

    let hit = false;
    const candidates = [...queryZombiesNear(bullet.mesh.position, bullet.radius + 2.1)];
    for (const zombie of candidates) {
      if (bullet.hitZombies.has(zombie.id)) {
        continue;
      }

      const hitRadius = bullet.radius + zombie.radius;

      if (distanceXZSquared(bullet.mesh.position, zombie.mesh.position) < hitRadius * hitRadius) {
        hit = true;
        bullet.hitZombies.add(zombie.id);
        const zombieIndex = getZombieIndex(zombie);
        damageZombie(zombieIndex, bullet.damage, true);

        if (bullet.explodeRadius > 0) {
          damageZombiesAtPoint(bullet.mesh.position, bullet.explodeRadius, bullet.explodeDamage || bullet.damage, false);
          spawnExplosion(bullet.mesh.position, weapons.talisman.color, bullet.explodeRadius);
          break;
        }

        if (bullet.pierceHits > 0) {
          bullet.pierceHits -= 1;
          hit = false;
          continue;
        }

        break;
      }
    }

    if (
      hit ||
      bullet.age > bullet.lifespan ||
      Math.abs(bullet.mesh.position.x) > 70 ||
      Math.abs(bullet.mesh.position.z) > 70
    ) {
      removeBullet(bulletIndex);
    }
  }
}

function damageZombiesInCone(range, minDot, amount, shouldFlash) {
  damageZombiesInConeFrom(
    player.position,
    player.aimDirection,
    range * player.upgradeStats.areaMultiplier,
    minDot,
    amount * player.upgradeStats.damageMultiplier,
    shouldFlash,
  );
}

function damageZombiesInConeFrom(origin, direction, range, minDot, amount, shouldFlash, awardRewards = true) {
  const candidates = [...queryZombiesNear(origin, range)];
  const rangeSq = range * range;

  for (const zombie of candidates) {
    tempVectorA.subVectors(zombie.mesh.position, origin);
    tempVectorA.y = 0;
    const distanceSq = tempVectorA.lengthSq();

    if (distanceSq <= 0.0025 || distanceSq > rangeSq) {
      continue;
    }

    const dot = tempVectorA.normalize().dot(direction);
    if (dot >= minDot) {
      const index = getZombieIndex(zombie);
      damageZombie(index, amount, shouldFlash, awardRewards);
    }
  }
}

function damageZombiesInRadius(radius, amount, shouldFlash) {
  damageZombiesInRadiusAt(
    player.position,
    radius * player.upgradeStats.areaMultiplier,
    amount * player.upgradeStats.damageMultiplier,
    shouldFlash,
  );
}

function damageZombiesInRadiusAt(origin, radius, amount, shouldFlash, awardRewards = true) {
  const candidates = [...queryZombiesNear(origin, radius)];
  const radiusSq = radius * radius;

  for (const zombie of candidates) {
    if (distanceXZSquared(origin, zombie.mesh.position) <= radiusSq) {
      const index = getZombieIndex(zombie);
      damageZombie(index, amount, shouldFlash, awardRewards);
    }
  }
}

function damageZombiesAtPoint(position, radius, amount, shouldFlash, awardRewards = true) {
  const candidates = [...queryZombiesNear(position, radius)];
  const radiusSq = radius * radius;

  for (const zombie of candidates) {
    if (distanceXZSquared(position, zombie.mesh.position) <= radiusSq) {
      const index = getZombieIndex(zombie);
      damageZombie(index, amount, shouldFlash, awardRewards);
    }
  }
}

function damageZombie(index, amount, shouldFlash, awardRewards = true) {
  const zombie = zombies[index];

  if (!zombie) {
    return false;
  }

  zombie.health -= amount;

  if (shouldFlash) {
    flashZombie(zombie.mesh);
  }

  if (zombie.labelSprite) {
    updateBossLabel(zombie.labelSprite, zombie.health);
  }

  if (zombie.health <= 0) {
    const xpPosition = zombie.mesh.position.clone();
    const xpValue = getXpValueForZombie(zombie.type);
    const shouldBurst = zombie.type === "sofra";
    removeZombie(index);
    if (shouldBurst) {
      spawnSofraDeathBurst(xpPosition);
    }
    if (awardRewards) {
      spawnXpGem(xpPosition, xpValue);
      player.kills += 1;
      player.score += zombie.score;
    }
    return true;
  }

  return false;
}

function spawnSofraDeathBurst(position) {
  spawnExplosion(position, monsterProfiles.sofra.projectileColor, 5.2);
  damageZombiesAtPoint(position, 5.2, 12 + player.wave * 0.8, true, false);

  for (const target of getLivingPlayerTargets()) {
    if (distanceXZ(position, target.position) < 5.4) {
      damagePlayerTarget(target, 10 + Math.floor(player.wave * 0.45));
    }
  }
}

function updateWaveFlow(dt) {
  if (game.zombiesToSpawn > 0 || zombies.length > 0) {
    game.nextWaveDelay = 1.5;
    return;
  }

  game.nextWaveDelay -= dt;
  if (game.nextWaveDelay <= 0) {
    startNextWave();
  }
}

function addTimedEffect(mesh, duration, followPlayer = false, poolType = mesh.userData?.effectPoolType || null) {
  if (effects.length >= qualityManager.effectBudget) {
    perfStats.skippedEffects += 1;
    if (poolType) {
      releaseEffectMesh(mesh, poolType);
    } else {
      disposeObject(mesh);
    }
    return;
  }

  scene.add(mesh);
  mesh.traverse((child) => {
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];

    for (const material of materials) {
      material.userData.baseOpacity = material.opacity ?? 1;
    }
  });
  effects.push({ mesh, duration, age: 0, followPlayer, poolType, baseScale: mesh.scale.clone() });
}

function updateEffects(dt) {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index];
    effect.age += dt;
    const fade = Math.max(0, 1 - effect.age / effect.duration);

    if (effect.followPlayer) {
      effect.mesh.position.x = player.position.x;
      effect.mesh.position.z = player.position.z;
    }

    const scaleBoost = 1 + (1 - fade) * 0.32;
    effect.mesh.scale.set(
      effect.baseScale.x * scaleBoost,
      effect.baseScale.y * scaleBoost,
      effect.baseScale.z * scaleBoost,
    );
    effect.mesh.traverse((child) => {
      const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];

      for (const material of materials) {
        material.opacity = (material.userData.baseOpacity ?? 1) * fade;
      }
    });

    if (effect.age >= effect.duration) {
      const [expired] = effects.splice(index, 1);
      if (expired.poolType) {
        releaseEffectMesh(expired.mesh, expired.poolType);
      } else {
        scene.remove(expired.mesh);
        disposeObject(expired.mesh);
      }
    }
  }
}

function updateCamera(dt) {
  const lookAlpha = 1 - Math.pow(usesMobileTuning() ? 0.045 : 0.012, dt);
  game.cameraLookDirection.lerp(player.aimDirection, lookAlpha);
  if (game.cameraLookDirection.lengthSq() < 0.1) {
    game.cameraLookDirection.copy(player.aimDirection);
  } else {
    game.cameraLookDirection.normalize();
  }

  const cameraTarget = tempVectorB.copy(player.position).addScaledVector(game.cameraLookDirection, getCameraLookAhead());
  cameraTarget.y = 1.2;

  const desiredPosition = tempVectorC.set(
    player.position.x,
    player.position.y + getCameraHeight(),
    player.position.z + getCameraDepth(),
  );
  camera.position.lerp(desiredPosition, 1 - Math.pow(usesMobileTuning() ? 0.008 : 0.001, dt));
  camera.lookAt(cameraTarget);
}

function getCameraZoomScale() {
  return getGameConfig("camera.zoomScale");
}

function getCameraHeight() {
  return getGameConfig("camera.height") * getCameraZoomScale();
}

function getCameraDepth() {
  return getGameConfig("camera.depth") * getCameraZoomScale();
}

function getCameraLookAhead() {
  return getGameConfig("camera.lookAhead") * getCameraZoomScale();
}

function animateProps(time) {
  player.mesh.position.y = Math.sin(time * 8) * 0.035;

  for (const zombie of zombies) {
    zombie.mesh.position.y = Math.sin(time * 6 + zombie.wobble) * 0.05;
  }

  for (const prop of graveProps) {
    prop.rotation.x = Math.sin(time * 0.7 + prop.position.x) * 0.015;
  }
}

function removeZombie(index) {
  const [zombie] = zombies.splice(index, 1);
  if (zombie.labelSprite) {
    scene.remove(zombie.labelSprite);
    zombie.labelSprite.material.map.dispose();
    zombie.labelSprite.material.dispose();
  }
  releaseZombieMesh(zombie.mesh, zombie.type);
  spatialGrid.dirty = true;
}

function removeBullet(index) {
  const [bullet] = bullets.splice(index, 1);
  releaseProjectileMesh(bullet.mesh, entityPools.bullets);
}

function removeEnemyProjectile(index) {
  const [projectile] = enemyProjectiles.splice(index, 1);
  releaseProjectileMesh(projectile.mesh, entityPools.enemyProjectiles);
}

function removePowerup(index) {
  const [powerup] = powerups.splice(index, 1);
  scene.remove(powerup.mesh);
  disposeObject(powerup.mesh);
}

function removeXpGem(index) {
  const [gem] = xpGems.splice(index, 1);
  releaseXpGemMesh(gem.mesh);
}

function clearEntities() {
  while (zombies.length > 0) {
    removeZombie(zombies.length - 1);
  }

  while (bullets.length > 0) {
    removeBullet(bullets.length - 1);
  }

  while (enemyProjectiles.length > 0) {
    removeEnemyProjectile(enemyProjectiles.length - 1);
  }

  while (powerups.length > 0) {
    removePowerup(powerups.length - 1);
  }

  while (xpGems.length > 0) {
    removeXpGem(xpGems.length - 1);
  }

  while (effects.length > 0) {
    const [effect] = effects.splice(effects.length - 1, 1);
    if (effect.poolType) {
      releaseEffectMesh(effect.mesh, effect.poolType);
    } else {
      scene.remove(effect.mesh);
      disposeObject(effect.mesh);
    }
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function flashZombie(mesh) {
  mesh.scale.set(1.12, 0.9, 1.12);
  setTimeout(() => {
    mesh.scale.set(1, 1, 1);
  }, 80);
}

function pulseHealth() {
  healthFill.animate(
    [
      { filter: "brightness(1.8)" },
      { filter: "brightness(1)" },
    ],
    { duration: 180, easing: "ease-out" },
  );
}

function endGame() {
  game.state = "dead";
  game.shooting = false;
  player.pendingUpgradeChoices = [];
  player.pendingLevelUps = 0;
  renderUpgradeChoices();
  sendMultiplayerState();
  void submitSoloLeaderboardSession();
  messageKicker.textContent = `Onda ${player.wave}`;
  messageTitle.textContent = "Fim da noite";
  messageCopy.textContent = `${player.score} pontos · Nivel ${player.bestLevel}`;
  playButton.innerHTML = "<span aria-hidden=\"true\">↻</span>Reiniciar";
  message.classList.add("message--game-over");
  message.classList.add("message--login");
  message.classList.remove("is-hidden");
}

function updateHud(force = false) {
  if (!force) {
    game.hudTimer -= perfStats.dt || 0.016;
    if (game.hudTimer > 0) {
      return;
    }
    game.hudTimer = usesMobileTuning()
      ? getGameConfig("gameplay.hud.mobileInterval")
      : getGameConfig("gameplay.hud.desktopInterval");
  }

  const healthRatio = Math.max(player.health, 0) / player.maxHealth;
  const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNext));
  healthFill.style.transform = `scaleX(${healthRatio})`;
  timeValueElement.textContent = formatSurvivalTime(game.survivalTime);
  healthValueElement.textContent = `${Math.ceil(Math.max(player.health, 0))}/${Math.ceil(player.maxHealth)}`;
  scoreElement.textContent = formatHudNumber(player.score);
  killsElement.textContent = formatHudNumber(player.kills);
  waveElement.textContent = Math.max(player.wave, 1).toString();
  levelValueElement.textContent = player.level.toString();
  xpFillElement.style.transform = `scaleX(${xpRatio})`;
  xpValueElement.textContent = `${Math.floor(player.xp)}/${Math.floor(player.xpToNext)}`;
  weaponNameElement.textContent = weapons[player.weapon].label;
  weaponTimerElement.textContent = player.weapon === "pistol" ? "READY" : `${Math.ceil(player.weaponTimer)}s`;
  renderSkillHud();
  renderPerfOverlay();
}

function formatSurvivalTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatHudNumber(value) {
  return Math.floor(Number(value) || 0).toLocaleString("en-US");
}

function renderSkillHud() {
  if (!skillListElement) {
    return;
  }

  const skills = getHudSkills();
  const signature = skills.map((skill) => `${skill.icon}:${skill.level}:${skill.title}`).join("|");
  if (game.skillHudSignature === signature) {
    return;
  }

  game.skillHudSignature = signature;
  skillListElement.innerHTML = skills
    .map(
      (skill) => `
        <span class="skill-chip" title="${escapeHtml(skill.title)}">
          <span>${skill.icon}</span>
          <small>LVL ${skill.level}</small>
        </span>
      `,
    )
    .join("");
}

function getHudSkills() {
  const skills = [
    {
      icon: hudWeaponIcons[player.weapon] || "⚔",
      title: weapons[player.weapon]?.label || "Arma",
      level: player.weapon === "pistol" ? 1 : Math.max(1, Math.ceil(player.weaponTimer)),
    },
  ];

  for (const [weaponId, state] of Object.entries(player.autoWeapons)) {
    if (state.level > 0) {
      skills.push({
        icon: hudWeaponIcons[weaponId] || "✦",
        title: autoWeaponProfiles[weaponId]?.label || weaponId,
        level: state.level,
      });
    }
  }

  for (const [upgradeId, stacks] of Object.entries(player.upgradeStacks)) {
    if (stacks > 0) {
      const definition = upgradeDefinitions.find((upgrade) => upgrade.id === upgradeId);
      skills.push({
        icon: hudUpgradeIcons[upgradeId] || "◆",
        title: definition?.label || upgradeId,
        level: stacks,
      });
    }
  }

  return skills.slice(
    0,
    usesMobileTuning() ? getGameConfig("gameplay.skillHud.mobileMaxEntries") : getGameConfig("gameplay.skillHud.desktopMaxEntries"),
  );
}

function loadPlayerName() {
  const queryName = queryParams.get("name");
  let savedName = "";

  try {
    savedName = window.localStorage?.getItem("zombieNightPlayerName") || "";
  } catch {
  }

  return sanitizePlayerName(queryName || savedName || "Cacador");
}

function updateLocalPlayerName(name) {
  player.name = sanitizePlayerName(name || player.name);

  if (playerNameInput) {
    playerNameInput.value = player.name;
  }

  try {
    window.localStorage?.setItem("zombieNightPlayerName", player.name);
  } catch {
  }

  sendMultiplayerMessage({
    type: "profile",
    name: player.name,
  });
}

function sanitizePlayerName(name) {
  return String(name || "Cacador")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, 16) || "Cacador";
}

function shouldUseMultiplayer() {
  if (!("WebSocket" in window) || queryParams.get("offline") === "1") {
    return false;
  }

  return queryParams.has("ws");
}

function sanitizeRoomName(roomName) {
  return String(roomName || "cemiterio")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 28) || "cemiterio";
}

function getMultiplayerUrl() {
  const explicitUrl = queryParams.get("ws");

  if (explicitUrl) {
    try {
      const websocketUrl = new URL(explicitUrl);
      websocketUrl.searchParams.set("room", multiplayer.room);
      websocketUrl.searchParams.set("name", player.name);
      return websocketUrl.toString();
    } catch {
      return null;
    }
  }

  if (!window.location.host) {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(multiplayer.room)}&name=${encodeURIComponent(player.name)}`;
}

function connectMultiplayer() {
  const websocketUrl = getMultiplayerUrl();

  if (!websocketUrl) {
    multiplayer.status = "Solo";
    updateMultiplayerHud();
    return;
  }

  multiplayer.url = websocketUrl;
  multiplayer.status = "Conectando";
  updateMultiplayerHud();

  const socket = new WebSocket(websocketUrl);
  multiplayer.socket = socket;

  socket.addEventListener("open", () => {
    multiplayer.reconnectAttempts = 0;
    multiplayer.status = "Entrando";
    updateMultiplayerHud();
  });

  socket.addEventListener("message", (event) => {
    handleMultiplayerMessage(event.data);
  });

  socket.addEventListener("close", () => {
    if (multiplayer.socket !== socket) {
      return;
    }

    multiplayer.socket = null;
    multiplayer.connected = false;
    multiplayer.id = null;
    clearRemotePlayers();

    if (!multiplayer.full) {
      multiplayer.status = multiplayer.enabled ? "Reconectando" : "Solo";
      multiplayer.reconnectTimer = Math.min(8, 2 + multiplayer.reconnectAttempts * 1.5);
      multiplayer.reconnectAttempts += 1;
    }

    updateMultiplayerHud();
  });

  socket.addEventListener("error", () => {
    multiplayer.status = multiplayer.full ? "Sala cheia" : "Offline";
    updateMultiplayerHud();
  });
}

function handleMultiplayerMessage(rawMessage) {
  let messageData;

  try {
    messageData = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (messageData.type === "roomFull") {
    multiplayer.full = true;
    multiplayer.status = "Sala cheia";
    updateMultiplayerHud();
    return;
  }

  if (messageData.type === "welcome") {
    multiplayer.connected = true;
    multiplayer.full = false;
    multiplayer.id = messageData.id;
    multiplayer.maxPlayers = messageData.maxPlayers ?? 4;
    multiplayer.room = sanitizeRoomName(messageData.room);
    multiplayer.status = `Sala ${multiplayer.room}`;
    updateLeaderboard(messageData.leaderboard);
    multiplayer.spawn.set(Number(messageData.spawn?.x) || 0, 0, Number(messageData.spawn?.z) || 0);

    const selfSnapshot = messageData.players?.find((playerData) => playerData.id === multiplayer.id);
    if (selfSnapshot) {
      player.name = sanitizePlayerName(selfSnapshot.name);
      multiplayer.color = selfSnapshot.color || multiplayer.color;
      if (playerNameInput) {
        playerNameInput.value = player.name;
      }
    }

    if (game.state !== "playing") {
      player.position.copy(multiplayer.spawn);
      player.mesh.position.copy(player.position);
    }

    clearRemotePlayers();
    for (const remotePlayer of messageData.players ?? []) {
      if (remotePlayer.id !== multiplayer.id) {
        upsertRemotePlayer(remotePlayer);
      }
    }

    updateMultiplayerHud();
    sendMultiplayerState();
    updateLocalPlayerName(playerNameInput?.value || player.name);
    return;
  }

  if (messageData.type === "playerJoined") {
    upsertRemotePlayer(messageData.player);
    updateMultiplayerHud();
    return;
  }

  if (messageData.type === "playerState") {
    const remotePlayer = remotePlayers.get(messageData.id);
    if (remotePlayer) {
      updateRemotePlayerState(remotePlayer, messageData.state);
    }
    return;
  }

  if (messageData.type === "playerProfile") {
    if (messageData.player?.id === multiplayer.id) {
      player.name = sanitizePlayerName(messageData.player.name);
      multiplayer.color = messageData.player.color || multiplayer.color;
    } else {
      upsertRemotePlayer(messageData.player);
    }

    updateMultiplayerHud();
    return;
  }

  if (messageData.type === "playerDamaged") {
    applyNetworkPlayerState(messageData.id, messageData.state, messageData.amount);
    return;
  }

  if (messageData.type === "leaderboard") {
    updateLeaderboard(messageData.leaderboard);
    return;
  }

  if (messageData.type === "playerAttack") {
    handleRemoteAttack(messageData.id, messageData.attack);
    return;
  }

  if (messageData.type === "playerLeft") {
    removeRemotePlayer(messageData.id);
    updateMultiplayerHud();
  }
}

function updateMultiplayer(dt) {
  if (multiplayer.reconnectTimer > 0) {
    multiplayer.reconnectTimer -= dt;

    if (multiplayer.reconnectTimer <= 0 && multiplayer.enabled && !multiplayer.socket && !multiplayer.full) {
      connectMultiplayer();
    }
  }

  if (multiplayer.connected) {
    multiplayer.sendTimer -= dt;

    if (multiplayer.sendTimer <= 0) {
      multiplayer.sendTimer = 0.05;
      sendMultiplayerState();
    }
  }

  updateRemotePlayers(dt);
  game.partyHudTimer -= dt;
  if (game.partyHudTimer <= 0) {
    game.partyHudTimer = usesMobileTuning()
      ? getGameConfig("gameplay.partyHud.mobileInterval")
      : getGameConfig("gameplay.partyHud.desktopInterval");
    updateMultiplayerHud();
  }
}

function getPlayerBuildSummary() {
  const unlockedWeapons = Object.entries(player.autoWeapons)
    .filter(([, state]) => state.level > 0)
    .map(([weaponId]) => autoWeaponProfiles[weaponId]?.label)
    .filter(Boolean);

  const upgrades = Object.entries(player.upgradeStacks)
    .filter(([, stacks]) => stacks > 0)
    .map(([upgradeId, stacks]) => {
      const definition = upgradeDefinitions.find((upgrade) => upgrade.id === upgradeId);
      return `${definition?.label || upgradeId} x${stacks}`;
    });

  return [...unlockedWeapons, ...upgrades].slice(0, 8);
}

function getPerfStats() {
  const poolUsage = {
    zombies: Object.fromEntries([...entityPools.zombies.entries()].map(([type, pool]) => [type, pool.length])),
    bullets: entityPools.bullets.length,
    enemyProjectiles: entityPools.enemyProjectiles.length,
    xpGems: entityPools.xpGems.length,
    effects: Object.fromEntries([...entityPools.effects.entries()].map(([type, pool]) => [type, pool.length])),
  };

  return {
    fpsAverage: Number(perfStats.fpsAverage.toFixed(1)),
    quality: qualityManager.level,
    qualityMode: qualityManager.mode,
    mobileLayout: getMobileLayoutStats(),
    pixelRatio: Number(qualityManager.pixelRatio.toFixed(2)),
    updateMs: Number(perfStats.updateMs.toFixed(2)),
    renderMs: Number(perfStats.renderMs.toFixed(2)),
    frameMs: Number(perfStats.totalFrameMs?.toFixed(2) || 0),
    drawCalls: renderer.info.render.calls,
    skippedEffects: perfStats.skippedEffects,
    entities: {
      zombies: zombies.length,
      bullets: bullets.length,
      enemyProjectiles: enemyProjectiles.length,
      xpGems: xpGems.length,
      effects: effects.length,
      remotePlayers: remotePlayers.size,
    },
    poolUsage,
    poolExpansions: { ...perfStats.poolExpansions },
  };
}

function sendMultiplayerState() {
  sendMultiplayerMessage({
    type: "state",
    state: {
      x: player.position.x,
      z: player.position.z,
      rotation: player.mesh.rotation.y,
      aimX: player.aimDirection.x,
      aimZ: player.aimDirection.z,
      health: player.health,
      maxHealth: player.maxHealth,
      score: player.score,
      wave: Math.max(player.wave, 1),
      level: player.level,
      bestLevel: player.bestLevel,
      build: getPlayerBuildSummary(),
      weapon: player.weapon,
      shooting: game.shooting,
      state: game.state,
    },
  });
}

function sendMultiplayerAttack(kind, origin = player.position, direction = player.aimDirection) {
  const attackDirection = direction.lengthSq() < 0.01 ? player.aimDirection : direction;

  sendMultiplayerMessage({
    type: "attack",
    attack: {
      kind,
      weapon: autoWeaponProfiles[kind] ? kind : player.weapon,
      x: origin.x,
      z: origin.z,
      aimX: attackDirection.x,
      aimZ: attackDirection.z,
    },
  });
}

function sendMultiplayerMessage(messageData) {
  if (!multiplayer.connected || multiplayer.socket?.readyState !== WebSocket.OPEN) {
    return;
  }

  multiplayer.socket.send(JSON.stringify(messageData));
}

function upsertRemotePlayer(playerData) {
  if (!playerData || playerData.id === multiplayer.id) {
    return null;
  }

  let remotePlayer = remotePlayers.get(playerData.id);

  if (!remotePlayer) {
    remotePlayer = createRemotePlayer(playerData);
    remotePlayers.set(playerData.id, remotePlayer);
    scene.add(remotePlayer.mesh);
    scene.add(remotePlayer.labelSprite);
  }

  remotePlayer.name = playerData.name || remotePlayer.name;
  remotePlayer.color = playerData.color || remotePlayer.color;
  updateRemotePlayerState(remotePlayer, playerData.state);
  return remotePlayer;
}

function createRemotePlayer(playerData) {
  const mesh = createPlayerMesh();
  const color = new THREE.Color(playerData.color || "#74d1ff");
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.045, 8, 42),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 }),
  );
  marker.rotation.x = Math.PI * 0.5;
  marker.position.y = 0.08;
  mesh.add(marker);

  return {
    id: playerData.id,
    name: playerData.name || "P?",
    color: playerData.color || "#74d1ff",
    health: 100,
    maxHealth: 100,
    score: 0,
    wave: 1,
    level: 1,
    bestLevel: 1,
    build: [],
    weapon: "pistol",
    shooting: false,
    state: "menu",
    combatTimer: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    labelSprite: createPlayerLabelSprite(playerData.name || "P?", playerData.color || "#74d1ff"),
    aimDirection: new THREE.Vector3(0, 0, -1),
    targetPosition: new THREE.Vector3(0, 0, 0),
  };
}

function updateRemotePlayerState(remotePlayer, state) {
  if (!state) {
    return;
  }

  remotePlayer.targetPosition.set(Number(state.x) || 0, 0, Number(state.z) || 0);
  remotePlayer.aimDirection.set(Number(state.aimX) || 0, 0, Number(state.aimZ) || -1);

  if (remotePlayer.aimDirection.lengthSq() < 0.01) {
    remotePlayer.aimDirection.set(0, 0, -1);
  } else {
    remotePlayer.aimDirection.normalize();
  }

  remotePlayer.maxHealth = Math.max(1, Math.min(300, Number(state.maxHealth) || remotePlayer.maxHealth || 100));
  remotePlayer.health = Math.max(0, Math.min(remotePlayer.maxHealth, Number(state.health) || 0));
  remotePlayer.score = Math.max(0, Number(state.score) || 0);
  remotePlayer.wave = Math.max(1, Number(state.wave) || 1);
  remotePlayer.level = Math.max(1, Number(state.level) || 1);
  remotePlayer.bestLevel = Math.max(remotePlayer.level, Number(state.bestLevel) || remotePlayer.level);
  remotePlayer.build = Array.isArray(state.build) ? state.build.slice(0, 8) : [];
  remotePlayer.weapon = weapons[state.weapon] ? state.weapon : "pistol";
  remotePlayer.shooting = Boolean(state.shooting);
  remotePlayer.state = state.state || "menu";
  updatePlayerLabel(remotePlayer.labelSprite, remotePlayer.name, remotePlayer.color, remotePlayer.health, remotePlayer.maxHealth);
}

function applyNetworkPlayerState(playerId, state, amount = 0) {
  if (!state) {
    return;
  }

  if (playerId === multiplayer.id) {
    const previousHealth = player.health;
    player.maxHealth = Math.max(1, Math.min(300, Number(state.maxHealth) || player.maxHealth));
    player.health = Math.max(0, Math.min(player.maxHealth, Number(state.health) || 0));

    if (player.health < previousHealth || amount > 0) {
      pulseHealth();
    }

    if (player.health <= 0 && game.state === "playing") {
      endGame();
    }

    updateHud();
    return;
  }

  const remotePlayer = remotePlayers.get(playerId);
  if (remotePlayer) {
    updateRemotePlayerState(remotePlayer, state);
  }
}

function updateRemotePlayers(dt) {
  const moveAlpha = 1 - Math.pow(0.0008, dt);
  const turnAlpha = 1 - Math.pow(0.001, dt);

  for (const remotePlayer of remotePlayers.values()) {
    remotePlayer.mesh.position.x += (remotePlayer.targetPosition.x - remotePlayer.mesh.position.x) * moveAlpha;
    remotePlayer.mesh.position.z += (remotePlayer.targetPosition.z - remotePlayer.mesh.position.z) * moveAlpha;
    remotePlayer.mesh.position.y = Math.sin(clock.elapsedTime * 8 + remotePlayer.phase) * 0.035;
    remotePlayer.mesh.rotation.y = lerpAngle(
      remotePlayer.mesh.rotation.y,
      getForwardRotation(remotePlayer.aimDirection),
      turnAlpha,
    );

    if (game.labelFrameReady) {
      remotePlayer.labelSprite.position.copy(remotePlayer.mesh.position);
      remotePlayer.labelSprite.position.y = 3.1;
    }
    remotePlayer.combatTimer = Math.max(0, remotePlayer.combatTimer - dt);

    if (remotePlayer.shooting && remotePlayer.state === "playing" && remotePlayer.combatTimer <= 0) {
      remotePlayer.combatTimer = getRemoteAttackInterval(remotePlayer.weapon);
      spawnRemoteAttackVisual(
        remotePlayer.mesh.position,
        remotePlayer.aimDirection,
        remotePlayer.weapon,
        remotePlayer.color,
      );
    }
  }
}

function handleRemoteAttack(playerId, attack) {
  const remotePlayer = remotePlayers.get(playerId);
  const origin = new THREE.Vector3(Number(attack?.x) || 0, 0, Number(attack?.z) || 0);
  const direction = new THREE.Vector3(Number(attack?.aimX) || 0, 0, Number(attack?.aimZ) || -1);

  if (direction.lengthSq() < 0.01) {
    direction.set(0, 0, -1);
  } else {
    direction.normalize();
  }

  const weapon = autoWeaponProfiles[attack?.kind]
    ? attack.kind
    : weapons[attack?.weapon]
      ? attack.weapon
      : attack?.kind || "pistol";
  spawnRemoteAttackVisual(origin, direction, weapon, remotePlayer?.color || "#74d1ff");
  applyRemoteAttackDamage(origin, direction, weapon);
}

function applyRemoteAttackDamage(origin, direction, weapon) {
  if (game.state !== "playing") {
    return;
  }

  if (weapon === "flamethrower") {
    damageZombiesInConeFrom(origin, direction, 10.5, Math.cos(0.58), 1.1, false, false);
    return;
  }

  if (weapon === "axe") {
    damageZombiesInRadiusAt(origin, 4.4, 5, false, false);
    return;
  }

  if (weapon === "katana") {
    damageZombiesInConeFrom(origin, direction, 5.8, Math.cos(0.92), 5, true, false);
    return;
  }

  if (weapon === "crossbow") {
    damageZombiesInConeFrom(origin, direction, 28, Math.cos(0.08), 4, true, false);
    return;
  }

  if (weapon === "talisman") {
    const explosionPoint = origin.clone().addScaledVector(direction, 8.5);
    damageZombiesAtPoint(explosionPoint, 4.8, 4, false, false);
    spawnExplosion(explosionPoint, weapons.talisman.color, 4.8);
    return;
  }

  if (weapon === "guardianBlade") {
    damageZombiesInConeFrom(origin, direction, 24, Math.cos(0.04), 1.6, true, false);
    return;
  }

  if (weapon === "orbitOrb") {
    damageZombiesAtPoint(origin, 1.45, 1.4, false, false);
    return;
  }

  if (weapon === "sealRain") {
    damageZombiesAtPoint(origin, 3.5, 4.8, false, false);
    spawnExplosion(origin, autoWeaponProfiles.sealRain.color, 3.5);
    return;
  }

  damageZombiesInConeFrom(origin, direction, 24, Math.cos(0.06), 1, true, false);
}

function spawnRemoteAttackVisual(origin, direction, weapon, fallbackColor) {
  const color = getWeaponColorValue(weapon, fallbackColor);

  if (weapon === "flamethrower") {
    spawnDirectionalConeEffect(origin, direction, color);
    return;
  }

  if (weapon === "axe") {
    spawnRemotePulse(origin, color, 3.8);
    return;
  }

  if (weapon === "katana") {
    spawnRemoteSlash(origin, direction, color);
    return;
  }

  if (weapon === "guardianBlade") {
    spawnGuardianBladeEffect(origin, direction, color);
    return;
  }

  if (weapon === "orbitOrb") {
    spawnOrbitOrbEffect(origin, color, autoWeaponProfiles.orbitOrb.radius);
    return;
  }

  if (weapon === "sealRain") {
    spawnSealRainEffect(origin, color, autoWeaponProfiles.sealRain.radius);
    return;
  }

  spawnRemoteBeam(origin, direction, color, weapon === "crossbow" ? 8.5 : weapon === "talisman" ? 6 : 5.5);
}

function spawnDirectionalConeEffect(origin, direction, color) {
  const normalizedDirection = tempVectorA.copy(direction).normalize();
  const flame = acquireEffectMesh("cone", createPooledConeEffect);
  flame.position.copy(origin).addScaledVector(normalizedDirection, 3.05);
  flame.position.y = 1.02;
  flame.quaternion.setFromUnitVectors(upVector, normalizedDirection);
  flame.scale.set(1.15, 4.2, 1.15);
  tintEffect(flame, color, 0.9);
  addTimedEffect(flame, 0.16, false, "cone");
}

function spawnRemoteBeam(origin, direction, color, length) {
  const normalizedDirection = tempVectorA.copy(direction).normalize();
  const beam = acquireEffectMesh("beam", createPooledBeamEffect);
  beam.position.copy(origin);
  beam.position.y = 1.12;
  beam.position.addScaledVector(normalizedDirection, length * 0.5);
  beam.quaternion.setFromUnitVectors(upVector, normalizedDirection);
  beam.scale.set(1, length, 1);
  tintEffect(beam, color);
  addTimedEffect(beam, 0.14, false, "beam");
}

function spawnRemotePulse(origin, color, radius) {
  const ring = acquireEffectMesh("pulse", createPooledPulseEffect);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(origin);
  ring.position.y = 0.18;
  ring.scale.setScalar(radius);
  tintEffect(ring, color);
  addTimedEffect(ring, 0.28, false, "pulse");
}

function spawnRemoteSlash(origin, direction, color) {
  const slash = acquireEffectMesh("slash", createPooledSlashEffect);
  slash.position.copy(origin);
  slash.position.y = 0.28;
  slash.rotation.y = getForwardRotation(direction) - Math.PI * 0.5;
  slash.scale.setScalar(2.55);
  tintEffect(slash, color);
  addTimedEffect(slash, 0.2, false, "slash");
}

function getRemoteAttackInterval(weapon) {
  if (weapon === "flamethrower") {
    return 0.14;
  }

  if (weapon === "axe") {
    return 0.48;
  }

  if (weapon === "katana") {
    return 0.28;
  }

  if (weapon === "crossbow") {
    return 0.36;
  }

  if (weapon === "talisman") {
    return 0.72;
  }

  return 0.2;
}

function getWeaponColorValue(weapon, fallbackColor) {
  if (autoWeaponProfiles[weapon]?.color) {
    return autoWeaponProfiles[weapon].color;
  }

  if (weapons[weapon]?.color) {
    return weapons[weapon].color;
  }

  return new THREE.Color(fallbackColor || "#74d1ff").getHex();
}

function createPlayerLabelSprite(label, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(3.2, 1.2, 1);
  sprite.renderOrder = 18;
  sprite.userData = {
    canvas,
    context: canvas.getContext("2d"),
    texture,
  };

  updatePlayerLabel(sprite, label, color, 100);
  return sprite;
}

function updatePlayerLabel(sprite, label, color, health, maxHealth = 100) {
  const { canvas, context, texture } = sprite.userData;
  const healthRatio = Math.max(0, Math.min(1, health / maxHealth));

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(5, 8, 10, 0.76)";
  context.fillRect(24, 10, 208, 68);
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.strokeRect(24, 10, 208, 68);
  context.fillStyle = "#f6fbff";
  context.font = "900 28px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 128, 32);
  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.fillRect(52, 56, 152, 12);
  context.fillStyle = color;
  context.fillRect(52, 56, 152 * healthRatio, 12);
  texture.needsUpdate = true;
}

function removeRemotePlayer(playerId) {
  const remotePlayer = remotePlayers.get(playerId);

  if (!remotePlayer) {
    return;
  }

  scene.remove(remotePlayer.mesh);
  scene.remove(remotePlayer.labelSprite);
  disposeObject(remotePlayer.mesh);
  remotePlayer.labelSprite.material.map.dispose();
  remotePlayer.labelSprite.material.dispose();
  remotePlayers.delete(playerId);
}

function clearRemotePlayers() {
  for (const playerId of [...remotePlayers.keys()]) {
    removeRemotePlayer(playerId);
  }
}

function getMultiplayerStartPosition() {
  if (multiplayer.connected) {
    return multiplayer.spawn.clone();
  }

  return new THREE.Vector3(0, 0, 0);
}

function updateMultiplayerHud() {
  if (!onlineCountElement || !onlineStatusElement) {
    return;
  }

  if (multiplayer.connected) {
    onlineCountElement.textContent = `${remotePlayers.size + 1}/${multiplayer.maxPlayers}`;
    onlineStatusElement.textContent = `Sala ${multiplayer.room}`;
    updatePartyHud();
    return;
  }

  onlineCountElement.textContent = multiplayer.full ? "Cheia" : "Solo";
  onlineStatusElement.textContent = multiplayer.status;
  updatePartyHud();
}

function updatePartyHud() {
  if (!partyListElement) {
    return;
  }

  const partyPlayers = getPartyPlayers();
  if (partyPlayers.length <= 1) {
    partyListElement.innerHTML = "";
    return;
  }

  partyListElement.innerHTML = partyPlayers
    .slice(0, multiplayer.maxPlayers)
    .map((partyPlayer, index) => {
      const healthRatio = Math.max(0, Math.min(1, partyPlayer.health / partyPlayer.maxHealth));
      const displayName = truncateHudName(partyPlayer.name, usesMobileTuning() ? 7 : 12);
      return `
        <div class="party-card${partyPlayer.isLocal ? " party-card--local" : ""}" style="--party-color: ${partyPlayer.color}">
          <div class="party-card__top">
            <span>${index + 1}. ${escapeHtml(displayName)}${partyPlayer.isLocal ? " você" : ""}</span>
            <span class="party-card__score">Nv ${partyPlayer.level}</span>
          </div>
          <div class="party-card__health" aria-hidden="true">
            <div class="party-card__health-fill" style="transform: scaleX(${healthRatio})"></div>
          </div>
          <div class="party-card__meta">${Math.floor(partyPlayer.health)}/${Math.floor(partyPlayer.maxHealth)} vida · ${Math.floor(partyPlayer.score)} pts</div>
        </div>
      `;
    })
    .join("");
}

function truncateHudName(name, maxLength) {
  const safeName = String(name || "P?");
  return safeName.length > maxLength ? `${safeName.slice(0, Math.max(1, maxLength - 1))}…` : safeName;
}

function getPartyPlayers() {
  const partyPlayers = [
    {
      id: multiplayer.id || "local",
      name: player.name,
      health: player.health,
      maxHealth: player.maxHealth,
      score: player.score,
      level: player.level,
      color: multiplayer.color,
      isLocal: true,
    },
  ];

  for (const remotePlayer of remotePlayers.values()) {
    partyPlayers.push({
      id: remotePlayer.id,
      name: remotePlayer.name,
      health: remotePlayer.health,
      maxHealth: remotePlayer.maxHealth,
      score: remotePlayer.score,
      level: remotePlayer.level,
      color: remotePlayer.color,
      isLocal: false,
    });
  }

  return partyPlayers.sort((first, second) => second.score - first.score || second.level - first.level || second.health - first.health);
}

function updateLeaderboard(leaderboard) {
  if (!leaderboard) {
    return;
  }

  multiplayer.leaderboard = {
    totalPlayers: Number(leaderboard.totalPlayers) || 0,
    players: Array.isArray(leaderboard.players) ? leaderboard.players.slice(0, 10) : [],
    recentSessions: Array.isArray(leaderboard.recentSessions) ? leaderboard.recentSessions.slice(0, 10) : [],
  };
  updateLeaderboardHud();
}

async function loadLeaderboardSnapshot() {
  try {
    const response = await fetch(getLeaderboardApiUrl("/api/leaderboard"), { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    updateLeaderboard(await response.json());
  } catch {
  }
}

async function submitSoloLeaderboardSession() {
  if (game.leaderboardSubmitted || multiplayer.connected) {
    return;
  }

  game.leaderboardSubmitted = true;

  try {
    const response = await fetch(getLeaderboardApiUrl("/api/leaderboard/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: player.name,
        score: player.score,
        wave: Math.max(player.wave, 1),
        level: player.level,
        bestLevel: player.bestLevel,
        build: getPlayerBuildSummary(),
        durationMs: Math.floor(game.survivalTime * 1000),
      }),
    });

    if (response.ok) {
      updateLeaderboard(await response.json());
    }
  } catch {
  }
}

function getLeaderboardApiUrl(pathname) {
  const wsOrigin = getExplicitWebsocketOrigin();
  if (wsOrigin) {
    return `${wsOrigin}${pathname}`;
  }

  if (window.location.hostname === "bipx.vercel.app") {
    return `${multiplayerServerOrigin}${pathname}`;
  }

  return pathname;
}

function getExplicitWebsocketOrigin() {
  const explicitUrl = queryParams.get("ws");
  if (!explicitUrl) {
    return null;
  }

  try {
    const websocketUrl = new URL(explicitUrl);
    websocketUrl.protocol = websocketUrl.protocol === "wss:" ? "https:" : "http:";
    websocketUrl.pathname = "";
    websocketUrl.search = "";
    websocketUrl.hash = "";
    return websocketUrl.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function updateLeaderboardHud() {
  if (!leaderboardListElement || !leaderboardCountElement) {
    return;
  }

  const leaders = multiplayer.leaderboard.players;
  leaderboardCountElement.textContent = `${multiplayer.leaderboard.totalPlayers} players`;

  if (leaders.length === 0) {
    leaderboardListElement.innerHTML = `
      <li>
        <span class="leaderboard-list__rank">–</span>
        <span>Nenhum historico ainda</span>
        <span class="leaderboard-list__meta">jogue</span>
      </li>
    `;
    return;
  }

  leaderboardListElement.innerHTML = leaders
    .slice(0, 6)
    .map((leader) => {
      const bestScore = Math.floor(Number(leader.bestScore) || 0);
      const bestWave = Math.floor(Number(leader.bestWave) || 1);
      const bestLevel = Math.floor(Number(leader.bestLevel) || 1);
      return `
        <li>
          <span class="leaderboard-list__rank">#${leader.rank}</span>
          <span>${escapeHtml(leader.name)}</span>
          <span class="leaderboard-list__meta">${bestScore} pts · O${bestWave} · Nv${bestLevel}</span>
        </li>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lerpAngle(from, to, alpha) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function rotateDirectionY(direction, angle) {
  const normalized = direction.clone();

  if (normalized.lengthSq() < 0.01) {
    normalized.set(0, 0, -1);
  } else {
    normalized.normalize();
  }

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new THREE.Vector3(
    normalized.x * cos - normalized.z * sin,
    0,
    normalized.x * sin + normalized.z * cos,
  ).normalize();
}

function updatePointerFromClient(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
}

function isInteractiveOverlay(target) {
  return target instanceof Element && Boolean(target.closest("button, input, .touch-controls, .message, .upgrade-panel"));
}

function handleFirePointerDown(event) {
  event.preventDefault();
  touchFire.setPointerCapture?.(event.pointerId);
  game.shooting = true;
  game.touchAimPointerId = event.pointerId;
  handleFireAim(event, true);
}

function handleFirePointerMove(event) {
  if (game.touchAimPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  handleFireAim(event, false);
}

function handleFirePointerEnd(event) {
  if (game.touchAimPointerId !== null && event.pointerId !== game.touchAimPointerId) {
    return;
  }

  game.shooting = false;
  game.touchAimActive = false;
  game.touchAimPointerId = null;
}

function handleFireAim(event, allowAssist) {
  updatePointerFromClient(event.clientX, event.clientY);

  const rect = touchFire.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offsetX = event.clientX - centerX;
  const offsetY = event.clientY - centerY;
  const rawDistance = Math.hypot(offsetX, offsetY);
  const deadZone = rect.width * getTouchFireAimDeadZone();

  if (rawDistance > deadZone) {
    setTouchAimDirection(offsetX, offsetY, 0.34);
    game.touchAimActive = true;
    return;
  }

  game.touchAimActive = allowAssist && applyTouchAimAssist();
}

function applyTouchAimAssist() {
  if (!usesMobileTuning()) {
    return false;
  }

  const target = getClosestZombie(player.position, getGameConfig("gameplay.touch.aimAssistRange"));
  if (!target) {
    return false;
  }

  const direction = tempVectorA.subVectors(target.zombie.mesh.position, player.position);
  direction.y = 0;
  if (direction.lengthSq() < 0.1) {
    return false;
  }

  setTouchAimDirection(direction.x, direction.z, 0.28);
  return true;
}

function handleStickMove(event) {
  event.preventDefault();
  if (event.type === "pointerdown" || game.touchStickPointerId === null) {
    const rect = touchStick.getBoundingClientRect();
    game.touchStickPointerId = event.pointerId;
    game.touchStickRect = {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      width: rect.width,
    };
    touchStick.setPointerCapture?.(event.pointerId);
  } else if (game.touchStickPointerId !== event.pointerId) {
    return;
  }

  const rect = game.touchStickRect;
  const offsetX = event.clientX - rect.centerX;
  const offsetY = event.clientY - rect.centerY;
  const maxDistance = rect.width * getTouchStickRadiusFactor();
  const rawDistance = Math.hypot(offsetX, offsetY);
  const distance = Math.min(rawDistance, maxDistance);
  const angle = Math.atan2(offsetY, offsetX);
  const knobX = Math.cos(angle) * distance;
  const knobY = Math.sin(angle) * distance;
  const rawStrength = maxDistance > 0 ? distance / maxDistance : 0;
  const deadZone = getTouchDeadZone();
  const strength = rawStrength <= deadZone ? 0 : Math.min(1, (rawStrength - deadZone) / (1 - deadZone));
  const response = Math.pow(
    strength,
    usesMobileTuning()
      ? getGameConfig("gameplay.touch.responseMobileExponent")
      : getGameConfig("gameplay.touch.responseDesktopExponent"),
  );

  touchKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  game.touchVector.set(Math.cos(angle) * response, Math.sin(angle) * response);

  if (game.touchVector.lengthSq() > 0.0025) {
    setTouchAimDirection(game.touchVector.x, game.touchVector.y, 0.55);
  }
}

function resetStick(event) {
  if (event && game.touchStickPointerId !== null && game.touchStickPointerId !== event.pointerId) {
    return;
  }

  touchKnob.style.transform = "translate(-50%, -50%)";
  game.touchVector.set(0, 0);
  game.touchStickPointerId = null;
  game.touchStickRect = null;
}

function setTouchAimDirection(x, z, alpha = 1) {
  const direction = tempVectorA.set(x, 0, z);
  if (direction.lengthSq() < 0.001) {
    return;
  }

  direction.normalize();
  player.aimDirection.lerp(direction, alpha);
  if (player.aimDirection.lengthSq() < 0.01) {
    player.aimDirection.copy(direction);
  } else {
    player.aimDirection.normalize();
  }
}

function getTouchStickRadiusFactor() {
  return usesMobileTuning() ? getGameConfig("gameplay.touch.stickRadiusMobile") : getGameConfig("gameplay.touch.stickRadiusDesktop");
}

function getTouchDeadZone() {
  return usesMobileTuning() ? getGameConfig("gameplay.touch.deadZoneMobile") : getGameConfig("gameplay.touch.deadZoneDesktop");
}

function getTouchFireAimDeadZone() {
  return getGameConfig("gameplay.touch.fireAimDeadZone");
}

function resizeRenderer() {
  setViewportCssVars();
  applyMobileLayoutState();
  applyRuntimeConfig(false);
  applyQualitySettings(true);
}

function applyRuntimeConfig(updateQuality = true) {
  const fogColor = getGameConfig("fog.color");
  scene.background.set(fogColor);
  scene.fog.color.set(fogColor);
  scene.fog.density = getGameConfig("fog.density");
  camera.fov = getGameConfig("camera.fov");
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const refs = scene.userData.editorRefs;
  refs.hemiLight?.color.set(getGameConfig("lighting.hemi.skyColor"));
  refs.hemiLight?.groundColor.set(getGameConfig("lighting.hemi.groundColor"));
  if (refs.hemiLight) {
    refs.hemiLight.intensity = getGameConfig("lighting.hemi.intensity");
  }

  if (refs.moonLight) {
    refs.moonLight.color.set(getGameConfig("lighting.moon.color"));
    refs.moonLight.intensity = getGameConfig("lighting.moon.intensity");
    refs.moonLight.shadow.bias = getGameConfig("lighting.moon.shadowBias");
    updateShadowMapSize(refs.moonLight, getGameConfig("lighting.moon.shadowMapSize"));
  }

  if (refs.playerLight) {
    refs.playerLight.color.set(getGameConfig("lighting.player.color"));
    refs.playerLight.intensity = getGameConfig("lighting.player.intensity");
    refs.playerLight.distance = getGameConfig("lighting.player.distance");
    refs.playerLight.position.y = getGameConfig("lighting.player.height");
  }

  if (updateQuality) {
    applyQualitySettings(true);
  }
}

function updateShadowMapSize(light, mapSize) {
  const nextSize = Math.max(256, Math.floor(Number(mapSize) || 1024));
  if (light.shadow.mapSize.x === nextSize && light.shadow.mapSize.y === nextSize) {
    return;
  }

  light.shadow.mapSize.set(nextSize, nextSize);
  light.shadow.map?.dispose();
  light.shadow.map = null;
  light.shadow.needsUpdate = true;
}

function ensureSpatialGrid() {
  if (spatialGrid.dirty) {
    rebuildSpatialGrid();
  }
}

function rebuildSpatialGrid() {
  spatialGrid.cells.clear();

  for (const zombie of zombies) {
    const key = getSpatialCellKey(zombie.mesh.position.x, zombie.mesh.position.z);
    let cell = spatialGrid.cells.get(key);

    if (!cell) {
      cell = [];
      spatialGrid.cells.set(key, cell);
    }

    cell.push(zombie);
  }

  spatialGrid.dirty = false;
}

function getSpatialCellKey(x, z) {
  return `${Math.floor(x / spatialGridCellSize)},${Math.floor(z / spatialGridCellSize)}`;
}

function queryZombiesNear(position, radius) {
  ensureSpatialGrid();
  spatialGrid.candidates.length = 0;
  const minX = Math.floor((position.x - radius) / spatialGridCellSize);
  const maxX = Math.floor((position.x + radius) / spatialGridCellSize);
  const minZ = Math.floor((position.z - radius) / spatialGridCellSize);
  const maxZ = Math.floor((position.z + radius) / spatialGridCellSize);

  for (let cellX = minX; cellX <= maxX; cellX += 1) {
    for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
      const cell = spatialGrid.cells.get(`${cellX},${cellZ}`);
      if (cell) {
        spatialGrid.candidates.push(...cell);
      }
    }
  }

  return spatialGrid.candidates;
}

function getZombieIndex(zombie) {
  return zombies.indexOf(zombie);
}

function distanceXZSquared(first, second) {
  const dx = first.x - second.x;
  const dz = first.z - second.z;
  return dx * dx + dz * dz;
}

function distanceXZ(first, second) {
  return Math.sqrt(distanceXZSquared(first, second));
}

function getForwardRotation(direction) {
  return Math.atan2(-direction.x, -direction.z);
}
