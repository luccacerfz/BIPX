import { createCasterProjectilePresenter, withCasterProjectilePresentation } from './combat/caster-projectile-presentation.mjs';
import { stepCasterCaller } from './combat/caster-caller-boundary.mjs';
import { cancelCasterCast } from './combat/caster-cast.mjs';
import { casterVisual, createCasterPresentationInbox } from './combat/caster-presentation.mjs';
import * as THREE from "../vendor/three/three.module.js";
import { createWorldLabelLayout } from "./ui/world-label-layout.js";
import { createCinematicPipeline } from "./render/cinematic-pipeline.js";
import { shareEnvironmentCutawayDepth } from "./render/environment-cutaway.js";
import { createCemetery } from "./render/cemetery.js";
import { createWorldAtmosphere } from "./render/atmosphere.js";
import { loadAssetDressing } from "./render/asset-dressing.js";
import { createAnimatedEnemies } from "./render/animated-enemies.js";
import { createVisualMotion, sampleVisualMotion } from "./render/visual-motion.js";
import { loadEnemyLibrary } from "./assets/enemy-library.js";
import { loadMonsterLibrary } from "./assets/monster-library.js";
import { loadEnemyLodLibrary } from "./assets/enemy-lod-library.js";
import { playableCharacters, readCharacterPreference, loadPlayableCharacter } from "./assets/playable-characters.js";
import { loadPresentationPreferences, savePresentationPreferences } from "./render/preferences.js";
import { createCollisionWorld, createActorIndex, moveActor, stepActor, sweepStatic, pullActors, findFreePosition } from "./physics/contacts.mjs";
import { separateControlledActors } from "./combat/crowd-control.mjs";
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from "./render/environment-layout.js";
import { getPursuitDirection } from "./physics/navigation.mjs";
import { createSkillState, skillSnapshot, restoreSkillSnapshot, getClassSkills, getClassSkill, getSkillHud, beginSkill, advanceSkills, getSkillModifiers, isSkillMoving, applySkillControl, tickSkillControl, cancelSkills } from "./combat/class-skills.mjs";
import { createClassSkillVfx } from "./vfx/class-skill-vfx.js";
import { createCombatVfx } from "./vfx/combat-vfx.js";
import { createHazardVfx } from "./vfx/hazard-vfx.js";
import { createElementalVfx } from "./vfx/elemental-vfx.js";
import { createArsenalVfx } from "./vfx/arsenal-vfx.js";
import { RELICS, RELIC_IDS, BOSS_RELIC_DROPS, FALLBACK_INFUSION_SECONDS, AUTO_WEAPONS, AUTO_WEAPON_IDS, nextRelicDrop, isAutoWeaponEvolved, getRelicName, createArsenalState, relicAttack, advanceArsenal, cancelArsenal } from "./combat/arsenal.mjs";
import { emitProjectileCast, emitProjectileTrail, emitProjectileImpact } from "./vfx/elemental-projectiles.js";
import { createLocalLeaderboard } from "./progression/local-leaderboard.mjs";
import { SKILL_UPGRADES, SKILL_UPGRADE_WEIGHTS, EXHAUSTED_REWARD, isUpgradeForClass, getSkillMods, describeSkillUpgrade, getSkillUpgradeTag, getSkillUpgradeIcon, getOwnedSkillUpgrades } from "./progression/skill-upgrades.mjs";
import { getSkillDamageTaken, creditSkillKill } from "./combat/class-skills.mjs";
import { paintBossLabel } from "./ui/boss-label-painter.js";
import { createSampleBank } from "./audio/sample-bank.js";
import { RIFLE_COLLISION_HEIGHT, enemyProjectileCollisionHeight } from "./combat/collision-heights.mjs";
import { segmentCircleContact } from "./combat/projectile-sweep.js";
import { getMeleeTiming, beginMeleeAttack, advanceMeleeAttack, isWithinMeleeArc } from "./combat/melee-timing.mjs";
import { heroProfile, heroMaxHealth, createHeroCombatState, beginBasicAttack, swingDuration, meleeShape, insideMeleeShape, rifleShot, assistRifleAim, basicPower, skillPower, monsterWeight, applyHeroKnockback, advanceHeroKnockback, resolveIncomingDamage, resolveLeech, xpToNext as heroXpToNext, waveSpawnBudget, spawnInterval as heroSpawnInterval, spawnDistance as heroSpawnDistance } from "./combat/hero-power.mjs";
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
const audioToggleButton = document.querySelector("#audio-toggle");
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
const menuRankingButton = document.querySelector("#menu-ranking-button");
const playButton = document.querySelector("#play-button");
const playButtonLabel = document.querySelector("#play-button-label");
const multiplayerButton = document.querySelector("#multiplayer-button");
const loginBackButton = document.querySelector("#login-back-button");
const rankingBackButton = document.querySelector("#ranking-back-button");
const menuLeaderboardCountElement = document.querySelector("#menu-leaderboard-count");
const menuLeaderboardListElement = document.querySelector("#menu-leaderboard-list");
const playerNameInput = document.querySelector("#player-name");
const touchStick = document.querySelector("#touch-stick");
const touchKnob = document.querySelector("#touch-knob");
const touchFire = document.querySelector("#touch-fire");
const queryParams = new URLSearchParams(window.location.search);
const multiplayerServerOrigin = "https://bipx-multiplayer-server.onrender.com";
let soloRecordStorage;
try { soloRecordStorage = window.localStorage; } catch {}
const soloLeaderboard = createLocalLeaderboard(soloRecordStorage);
const presentationPreferences = loadPresentationPreferences();
const requestedQuality = sanitizeQuality(queryParams.get("quality") || presentationPreferences.quality);
let cinematicPipeline = null;
let combatVfx = null;
let classSkillVfx = null;
const worldLabelLayout = createWorldLabelLayout(THREE);
let classSkillState;
let arpgHudTimer = 0;
let pendingSkillRequest = null;
let onlineSkillMotion = null;
let zombieNavigationBudget = 4;
let zombieNavigationTick = 0;
let zombieActorIndex = null;
let remoteSkillSnapshots = [];
const persistentSkillPresentation = new Map();
const preparingWarCries = new Map();
const retiredWarCries = new Set();
const activeDashTransforms = new Map();
const retiredDashTransforms = new Set();
const skillPresentationHistory = [];
const skillSoundTravel = new Set();
let hazardVfx = null;
let elementalVfx = null;
let arsenalVfx = null;
let cemetery = null;
let worldAtmosphere = null;
let heroVisual = null;
const heroVisualMotion = createVisualMotion();
let animatedEnemies = null;
let enemyLodLibrary = null;
const enemyLodProfiles = {
  orcPeon: { id: 'orcPeon', height: 2.5 },
  zombie: { id: 'zombie', height: 2.55 },
  runner: { id: 'zombie', height: 2.3 },
  brute: { id: 'brute', height: 3.3 },
  caster: { id: 'lich', height: 2.8 },
  visor: { id: 'lich', height: 3.5 },
};
let characterPreview = true;
let selectedCharacter = readCharacterPreference();
let characterLoading = true;
let characterLoadVersion = 0;
let characterError = null;
const readyCharacters = new Set();
let pendingSwordStrike = null;
// Hero power (src/combat/hero-power.mjs): combo, hit-grace and leech budget for the local hero. Solo authority; online it only predicts the combo.
let heroCombat = createHeroCombatState(selectedCharacter);
let swordSwingRemaining = 0;
let keyboardAimActive = false;
let keyboardAimReleaseUntil = 0;
const swordSwingDirection = new THREE.Vector3(0, 0, -1);
let worldVisuals = null;
const visualAssetErrors = [];
let paused = false;
let cameraTrauma = 0;
let footstepVisual = null;
let footstepSerial = 0;
let weaponFireEmitter = null;
// Solo authority for relics and automatic weapons (multiplayer: the server owns the equivalent state).
let arsenalState = createArsenalState(), arsenalContext = null, arsenalTargetStamp = -1;
const arsenalBodies = [], arsenalTargets = [], arsenalSweepOptions = { kind: 'projectile' };
const arsenalLoadout = Object.fromEntries(AUTO_WEAPON_IDS.map((weaponId) => [weaponId, { level: 0, evolved: false }]));
let playerMoveBlend = 0;
let playerSwingTime = 0;
const perfOverlayEnabled = queryParams.get("perf") === "1";
const perfOverlay = perfOverlayEnabled ? createPerfOverlay() : null;
let runtimeReady = false;

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
  logicMs: 0,
  renderMs: 0,
  fpsAverage: 60,
  visibleDetailedZombies: 0,
  instancedZombies: 0,
  labelUpdates: 0,
  gridQueries: 0,
  objectAllocWarnings: 0,
  skippedEffects: 0,
  poolExpansions: {},
};

const audioManager = {
  samples: null,
  context: null,
  masterGain: null,
  musicGain: null,
  noiseBuffer: null,
  music: null,
  muted: loadAudioMuted(),
  unlocked: false,
  activeVoices: 0,
  musicPulseTimer: 0,
  lastPlayed: new Map(),
  lastEvent: "idle",
  masterVolume: 0.72,
  groups: {
    music: 0.62,
    player: 0.82,
    weapons: 0.72,
    monsters: 0.52,
    bosses: 0.88,
    ui: 0.72,
    drops: 0.82,
    xp: 0.48,
  },
  init() {
    this.updateToggle();
  },
  ensureContext() {
    if (this.context) {
      return true;
    }

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      this.updateToggle();
      return false;
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(compressor);
    compressor.connect(this.context.destination);
    this.samples = createSampleBank(this.context, this.masterGain);
    this.noiseBuffer = this.createNoiseBuffer();
    this.applyMasterVolume();
    this.updateToggle();
    return true;
  },
  unlock() {
    if (!this.ensureContext()) {
      return false;
    }

    const finalizeUnlock = () => {
      this.unlocked = true;
      this.updateToggle();
      if (game.state === "playing" && !this.muted) {
        this.startMusic();
      }
    };

    if (this.context.state === "suspended") {
      this.context.resume().then(finalizeUnlock).catch(() => this.updateToggle());
    } else {
      finalizeUnlock();
    }

    return true;
  },
  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlock();
      this.play("uiSelect", { priority: 3 });
    }
    return this.getState();
  },
  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      localStorage.setItem("bipxAudioMuted", this.muted ? "1" : "0");
    } catch {
      // localStorage can be unavailable in privacy modes.
    }
    this.applyMasterVolume();
    this.updateToggle();
  },
  applyMasterVolume() {
    if (!this.masterGain || !this.context) {
      return;
    }

    const targetVolume = this.muted ? 0.0001 : this.masterVolume;
    this.masterGain.gain.setTargetAtTime(targetVolume, this.context.currentTime, 0.025);
  },
  updateToggle() {
    if (!audioToggleButton) {
      return;
    }

    audioToggleButton.textContent = this.muted ? "Som: OFF" : "Som: ON";
    audioToggleButton.setAttribute("aria-pressed", this.muted ? "true" : "false");
    audioToggleButton.title = this.unlocked ? "Alternar som" : "Clique para liberar o som";
  },
  startRun() {
    this.play("gameStart", { priority: 3 });
    if (this.unlocked && !this.muted) {
      this.startMusic();
    }
  },
  endRun() {
    this.play("gameOver", { priority: 4 });
    this.stopMusic(1.15);
  },
  update(dt) {
    if (!this.context || !this.unlocked || this.muted) {
      return;
    }

    if (game.state !== "playing") {
      this.fadeMusicToSilence();
      return;
    }

    this.startMusic();
    this.updateMusicLayers(dt);
  },
  startMusic() {
    if (!this.context || this.music) {
      return;
    }

    const base = this.createMusicOscillator("sine", 46);
    const horde = this.createMusicOscillator("sawtooth", 92);
    const boss = this.createMusicOscillator("triangle", 34);
    const danger = this.createMusicOscillator("square", 176);
    this.music = { base, horde, boss, danger };
    this.musicPulseTimer = 0.2;
  },
  createMusicOscillator(type, frequency) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.value = type === "square" ? 520 : 180;
    gain.gain.value = 0.0001;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    oscillator.start();
    return { oscillator, gain, filter };
  },
  createNoiseBuffer() {
    const duration = 1.8;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      previous = previous * 0.58 + (Math.random() * 2 - 1) * 0.42;
      data[index] = previous;
    }
    return buffer;
  },
  updateMusicLayers(dt) {
    if (!this.music) {
      return;
    }

    const now = this.context.currentTime;
    const hordeIntensity = audioClamp01((zombies.length - 10) / 105);
    const hasBoss = zombies.some((zombie) => monsterProfiles[zombie.type]?.boss);
    const dangerIntensity = player.health / player.maxHealth < 0.34 ? 1 : 0;
    this.musicGain.gain.setTargetAtTime(this.groups.music, now, 0.08);
    this.music.base.gain.gain.setTargetAtTime(0.028, now, 0.25);
    this.music.horde.gain.gain.setTargetAtTime(0.018 * hordeIntensity, now, 0.18);
    this.music.boss.gain.gain.setTargetAtTime(hasBoss ? 0.028 : 0.0001, now, 0.16);
    this.music.danger.gain.gain.setTargetAtTime(0.012 * dangerIntensity, now, 0.05);
    this.music.horde.filter.frequency.setTargetAtTime(140 + hordeIntensity * 420, now, 0.12);
    this.music.danger.oscillator.frequency.setTargetAtTime(176 + Math.sin(performance.now() * 0.018) * 9, now, 0.02);

    this.musicPulseTimer -= dt;
    if (this.musicPulseTimer <= 0) {
      this.musicPulseTimer = Math.max(0.34, 0.86 - hordeIntensity * 0.28 - (hasBoss ? 0.16 : 0));
      this.play("musicPulse", { priority: 0, hordeIntensity, boss: hasBoss });
    }
  },
  fadeMusicToSilence() {
    if (!this.music || !this.context) {
      return;
    }

    this.musicGain.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.2);
  },
  stopMusic(fadeSeconds = 0.35) {
    if (!this.music || !this.context) {
      return;
    }

    const music = this.music;
    const stopAt = this.context.currentTime + fadeSeconds;
    this.musicGain.gain.setTargetAtTime(0.0001, this.context.currentTime, Math.max(0.03, fadeSeconds * 0.35));
    for (const layer of Object.values(music)) {
      try {
        layer.oscillator.stop(stopAt + 0.08);
      } catch {
        // Stopping an already-stopped oscillator is harmless.
      }
    }
    this.music = null;
  },
  play(type, options = {}) {
    if (this.muted || !this.unlocked || !this.ensureContext()) {
      return false;
    }

    if (!this.canPlay(type, options)) {
      return false;
    }

    this.lastEvent = type;
    if (this.samples?.play(type, options)) return true;
    switch (type) {
      case "gameStart":
        this.playTone({ group: "ui", frequency: 146, duration: 0.18, gain: 0.08, type: "triangle" });
        this.playTone({ group: "ui", frequency: 293, duration: 0.28, gain: 0.06, delay: 0.08, type: "sine" });
        break;
      case "gameOver":
        this.playTone({ group: "ui", frequency: 180, duration: 0.5, gain: 0.09, type: "sawtooth", endFrequency: 58 });
        this.playNoise({ group: "monsters", duration: 0.38, gain: 0.05, filterFrequency: 420 });
        break;
      case "uiSelect":
        this.playTone({ group: "ui", frequency: 380, duration: 0.08, gain: 0.035, type: "triangle" });
        this.playTone({ group: "ui", frequency: 570, duration: 0.08, gain: 0.025, delay: 0.045, type: "triangle" });
        break;
      case "pistol":
        this.playTone({ group: "weapons", frequency: 760, duration: 0.045, gain: 0.04, type: "square", endFrequency: 380 });
        this.playNoise({ group: "weapons", duration: 0.035, gain: 0.035, filterFrequency: 2400 });
        break;
      case "flamethrower":
        this.playNoise({ group: "weapons", duration: 0.11, gain: 0.045, filterFrequency: 720 });
        this.playTone({ group: "weapons", frequency: 92, duration: 0.1, gain: 0.025, type: "sawtooth" });
        break;
      case "axe":
        this.playNoise({ group: "weapons", duration: 0.14, gain: 0.05, filterFrequency: 980 });
        this.playTone({ group: "weapons", frequency: 190, duration: 0.13, gain: 0.045, type: "triangle", endFrequency: 90 });
        break;
      case "katana":
      case "autoBlade":
        this.playTone({ group: "weapons", frequency: 620, duration: 0.16, gain: 0.035, type: "triangle", endFrequency: 1180 });
        this.playNoise({ group: "weapons", duration: 0.08, gain: 0.025, filterFrequency: 3200 });
        break;
      case "crossbow":
        this.playTone({ group: "weapons", frequency: 510, duration: 0.14, gain: 0.04, type: "triangle", endFrequency: 260 });
        break;
      case "thunderstaff":
        this.playNoise({ group: "weapons", duration: 0.09, gain: 0.045, filterFrequency: 4200 });
        this.playTone({ group: "weapons", frequency: 980, duration: 0.12, gain: 0.035, type: "square", endFrequency: 420 });
        break;
      case "boneCannon":
        this.playTone({ group: "weapons", frequency: 118, duration: 0.16, gain: 0.052, type: "sawtooth", endFrequency: 64 });
        this.playNoise({ group: "weapons", duration: 0.12, gain: 0.04, filterFrequency: 760 });
        break;
      case "frostNova":
        this.playTone({ group: "weapons", frequency: 720, duration: 0.18, gain: 0.035, type: "sine", endFrequency: 360 });
        this.playNoise({ group: "weapons", duration: 0.1, gain: 0.025, filterFrequency: 2400 });
        break;
      case "talisman":
      case "sealRain":
        this.playTone({ group: "weapons", frequency: 260, duration: 0.16, gain: 0.036, type: "sine" });
        this.playTone({ group: "weapons", frequency: 780, duration: 0.2, gain: 0.03, delay: 0.035, type: "triangle" });
        break;
      case "orbitOrb":
        this.playTone({ group: "weapons", frequency: 330, duration: 0.12, gain: 0.035, type: "sine", endFrequency: 495 });
        break;
      case "hit":
        this.playNoise({ group: "monsters", duration: 0.035, gain: 0.028, filterFrequency: 1200 });
        break;
      case "kill":
        this.playTone({ group: "monsters", frequency: 96, duration: 0.13, gain: 0.052, type: "triangle", endFrequency: 54 });
        break;
      case "xpDrop":
        this.playTone({ group: "xp", frequency: 1080, duration: 0.04, gain: 0.012, type: "sine" });
        break;
      case "xp":
        this.playTone({ group: "xp", frequency: 920 + Math.min(360, (options.value || 0) * 18), duration: 0.07, gain: 0.028, type: "sine" });
        break;
      case "levelUp":
        for (const [index, frequency] of [330, 494, 659, 988].entries()) {
          this.playTone({ group: "ui", frequency, duration: 0.16, gain: 0.04, delay: index * 0.055, type: "triangle" });
        }
        break;
      case "upgradeChoice":
        this.playRarityChime(options.rarity || "common", "ui");
        break;
      case "perkDrop":
        this.playRarityChime(options.rarity || "rare", "drops");
        break;
      case "bossChest":
        this.playTone({ group: "drops", frequency: 132, duration: 0.25, gain: 0.065, type: "triangle" });
        this.playTone({ group: "drops", frequency: 528, duration: 0.2, gain: 0.04, delay: 0.07, type: "sine" });
        break;
      case "weaponPickup":
        this.playTone({ group: "drops", frequency: 230, duration: 0.12, gain: 0.04, type: "triangle" });
        this.playTone({ group: "drops", frequency: 460, duration: 0.16, gain: 0.035, delay: 0.04, type: "triangle" });
        break;
      case "weaponEvolve":
        this.playRarityChime("legendary", "drops");
        this.playTone({ group: "drops", frequency: 90, duration: 0.42, gain: 0.06, type: "sawtooth", endFrequency: 180 });
        break;
      case "playerDamage":
        this.playNoise({ group: "player", duration: 0.16, gain: 0.055, filterFrequency: 520 });
        this.playTone({ group: "player", frequency: 118, duration: 0.18, gain: 0.05, type: "sawtooth", endFrequency: 70 });
        break;
      case "bossAttack":
        this.playBossAttack(options.boss || "caster");
        break;
      case "musicPulse":
        this.playTone({
          group: "music",
          frequency: options.boss ? 64 : 74,
          duration: 0.11,
          gain: 0.025 + (options.hordeIntensity || 0) * 0.015,
          type: "triangle",
          endFrequency: 42,
        });
        break;
      default:
        this.playTone({ group: "ui", frequency: 440, duration: 0.12, gain: 0.03, type: "sine" });
        break;
    }

    return true;
  },
  canPlay(type, options = {}) {
    const priority = options.priority ?? 1;
    const maxVoices = usesMobileTuning() ? 14 : 28;
    if (this.activeVoices >= maxVoices && priority < 3) {
      return false;
    }

    const cooldown = getAudioCooldown(type);
    const now = this.context.currentTime;
    const last = this.lastPlayed.get(type) ?? -Infinity;
    if (now - last < cooldown && priority < 3) {
      return false;
    }

    this.lastPlayed.set(type, now);
    return true;
  },
  playRarityChime(rarity, group = "drops") {
    const rank = getRarityRank(rarity);
    const base = rarity === "legendary" ? 330 : rarity === "epic" ? 294 : rarity === "rare" ? 247 : 196;
    const notes = rank >= 3 ? [base, base * 1.5, base * 2, base * 3] : rank >= 2 ? [base, base * 1.25, base * 1.8] : [base, base * 1.5];
    notes.forEach((frequency, index) => {
      this.playTone({
        group,
        frequency,
        duration: rank >= 3 ? 0.22 : 0.14,
        gain: rank >= 3 ? 0.05 : 0.038,
        delay: index * 0.055,
        type: rank >= 2 ? "triangle" : "sine",
      });
    });
    if (rank >= 3) {
      this.playNoise({ group, duration: 0.32, gain: 0.026, filterFrequency: 3600, delay: 0.04 });
    }
  },
  playBossAttack(boss) {
    if (boss === "visor") {
      this.playTone({ group: "bosses", frequency: 880, duration: 0.18, gain: 0.04, type: "sine", endFrequency: 1320 });
      this.playNoise({ group: "bosses", duration: 0.12, gain: 0.025, filterFrequency: 2600 });
      return;
    }

    if (boss === "himetrica") {
      this.playNoise({ group: "bosses", duration: 0.1, gain: 0.05, filterFrequency: 4200 });
      this.playTone({ group: "bosses", frequency: 1280, duration: 0.08, gain: 0.035, type: "square", endFrequency: 620 });
      return;
    }

    if (boss === "dinzo") {
      this.playTone({ group: "bosses", frequency: 84, duration: 0.22, gain: 0.052, type: "sawtooth", endFrequency: 54 });
      this.playNoise({ group: "bosses", duration: 0.08, gain: 0.02, filterFrequency: 680 });
      return;
    }

    if (boss === "sofra") {
      this.playTone({ group: "bosses", frequency: 220, duration: 0.1, gain: 0.045, type: "square" });
      this.playTone({ group: "bosses", frequency: 330, duration: 0.08, gain: 0.03, delay: 0.045, type: "square" });
      return;
    }

    if (boss === "gitcity") {
      this.playTone({ group: "bosses", frequency: 640, duration: 0.22, gain: 0.03, type: "sawtooth", endFrequency: 1120 });
      this.playNoise({ group: "bosses", duration: 0.06, gain: 0.02, filterFrequency: 1800 });
      return;
    }

    this.playTone({ group: "monsters", frequency: 330, duration: 0.12, gain: 0.028, type: "triangle" });
  },
  playTone({ group = "ui", frequency = 440, endFrequency = null, duration = 0.12, gain = 0.04, delay = 0, type = "sine" } = {}) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    }
    const outputGain = gain * this.groups[group] * getAudioMixScale(group);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, outputGain), now + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gainNode);
    gainNode.connect(group === "music" && this.musicGain ? this.musicGain : this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    this.trackVoice(oscillator);
  },
  playNoise({ group = "ui", duration = 0.1, gain = 0.04, filterFrequency = 1200, delay = 0 } = {}) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gainNode = this.context.createGain();
    source.buffer = this.noiseBuffer || this.createNoiseBuffer();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrequency, now);
    filter.Q.value = 0.9;
    const outputGain = gain * this.groups[group] * getAudioMixScale(group);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, outputGain), now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(group === "music" && this.musicGain ? this.musicGain : this.masterGain);
    const maxOffset = Math.max(0, source.buffer.duration - duration - 0.02);
    source.start(now, Math.random() * maxOffset, duration + 0.02);
    source.stop(now + duration + 0.02);
    this.trackVoice(source);
  },
  trackVoice(node) {
    this.activeVoices += 1;
    node.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
  },
  playTestSound(type = "levelUp") {
    this.unlock();
    if (this.context) {
      this.unlocked = true;
    }
    const normalizedType = type === "legendary" ? "perkDrop" : type;
    return this.play(normalizedType, {
      rarity: type === "legendary" ? "legendary" : type === "epic" ? "epic" : type === "rare" ? "rare" : "common",
      boss: ["visor", "himetrica", "dinzo", "sofra", "gitcity"].includes(type) ? type : undefined,
      priority: 4,
    });
  },
  getState() {
    return {
      supported: Boolean(window.AudioContext || window.webkitAudioContext),
      muted: this.muted,
      unlocked: this.unlocked,
      contextState: this.context?.state ?? "none",
      activeVoices: this.activeVoices,
      musicActive: Boolean(this.music),
      masterVolume: this.masterVolume,
      groups: { ...this.groups },
      lastEvent: this.lastEvent,
      samples: this.samples?.getState() ?? null,
    };
  },
};

function loadAudioMuted() {
  try {
    return localStorage.getItem("bipxAudioMuted") === "1";
  } catch {
    return false;
  }
}

function audioClamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function getAudioCooldown(type) {
  const cooldowns = {
    xp: 0.035,
    xpDrop: 0.12,
    hit: 0.045,
    kill: 0.08,
    pistol: 0.055,
    flamethrower: 0.07,
    axe: 0.18,
    katana: 0.12,
    crossbow: 0.18,
    talisman: 0.22,
    thunderstaff: 0.18,
    boneCannon: 0.26,
    frostNova: 0.32,
    autoBlade: 0.11,
    orbitOrb: 0.14,
    sealRain: 0.2,
    bossAttack: 0.18,
    musicPulse: 0.16,
    perkDrop: 0.12,
    bossChest: 0.35,
    weaponPickup: 0.2,
    weaponEvolve: 0.6,
    levelUp: 0.45,
    upgradeChoice: 0.12,
    playerDamage: 0.22,
    gameStart: 0.7,
    gameOver: 0.7,
    uiSelect: 0.06,
  };
  return (cooldowns[type] ?? 0.08) * (usesMobileTuning() ? 1.35 : 1);
}

function getAudioMixScale(group) {
  if (group === "xp") {
    return zombies.length > 90 ? 0.45 : zombies.length > 45 ? 0.7 : 1;
  }

  if (group === "weapons") {
    return zombies.length > 110 ? 0.68 : zombies.length > 70 ? 0.82 : 1;
  }

  if (group === "monsters") {
    return zombies.length > 90 ? 0.62 : zombies.length > 50 ? 0.78 : 1;
  }

  if (group === "drops") {
    return usesMobileTuning() && zombies.length > 100 ? 0.82 : 1;
  }

  return 1;
}

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
  preserveDrawingBuffer: false,
});
renderer.localClippingEnabled = true; // Private corpse materials carry complementary clipping planes.
canvas.textContent = '';
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
const worldLimit = ENVIRONMENT_GROUND.radius;
const collisionWorld = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
const spatialGridCellSize = 8;
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();
const tempMatrix = new THREE.Matrix4();
const tempScale = new THREE.Vector3(1, 1, 1);
const tempColor = new THREE.Color();
const tempColorB = new THREE.Color();
const damageNumberLifetime = 0.82;
const damageNumberMergeWindowMs = 80;
const burnStatusDuration = 3;
const freezeStatusDuration = 2.2;
const bossFreezeStatusDuration = 0.85;
const groundItemLifetime = 20;
const bossHealthPotionAmount = 10;
const playerBaseMaxHealth = 200;
const playerBaseDamageMultiplier = 2;
const playerNetworkMaxHealthCap = 600;

const assetCache = {
  geometries: new Map(),
  materials: new Map(),
};

const spatialGrid = {
  cells: new Map(),
  dirty: true,
  candidates: [],
  bulletCandidates: [],
  closestCandidates: [],
  coneCandidates: [],
  pointCandidates: [],
  pointCandidatesNested: [],
  radiusCandidates: [],
  separationCandidates: [],
  crowdCandidates: [],
  pointQueryActive: false,
};

// Relic labels, durations, colours and boss drops are the shared arsenal rules (src/combat/arsenal.mjs).
const weapons = { pistol: { label: "Pistola", duration: 0 }, ...RELICS };
const weaponDropTypes = RELIC_IDS;
const bossWeaponDrops = BOSS_RELIC_DROPS;

const rarityStyles = {
  common: {
    label: "COMUM",
    color: 0x74d1ff,
    css: "#74d1ff",
    border: "rgba(116, 209, 255, 0.56)",
    glow: "rgba(116, 209, 255, 0.26)",
    accent: "#74d1ff",
    weight: 88,
    animated: false,
  },
  rare: {
    label: "RARO",
    color: 0xffd84a,
    css: "#ffd84a",
    border: "rgba(255, 216, 74, 0.86)",
    glow: "rgba(255, 216, 74, 0.38)",
    accent: "#ffd84a",
    weight: 7,
    animated: false,
  },
  epic: {
    label: "ÉPICO",
    color: 0xff8a2a,
    css: "#ff8a2a",
    border: "rgba(255, 138, 42, 0.9)",
    glow: "rgba(255, 138, 42, 0.46)",
    accent: "#ff8a2a",
    weight: 3.2,
    animated: true,
  },
  legendary: {
    label: "LENDÁRIO",
    color: 0xffd76a,
    css: "#ffd76a",
    border: "rgba(255, 215, 106, 0.96)",
    glow: "rgba(255, 215, 106, 0.62)",
    accent: "#fff2a8",
    weight: 0.35,
    animated: true,
  },
};
const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
const bossRewardRarityWeights = { rare: 86, epic: 13, legendary: 1 };
const bossAiProfiles = {
  visor: { minDistance: 6.4, idealDistance: 11.2, maxDistance: 18, strafeSpeed: 0.46, retargetInterval: 1.35 },
  himetrica: { minDistance: 5.5, idealDistance: 9.2, maxDistance: 15, strafeSpeed: 0.58, retargetInterval: 1.15 },
  dinzo: { minDistance: 5.1, idealDistance: 9.4, maxDistance: 16, strafeSpeed: 0.34, retargetInterval: 1.45 },
  gitcity: { minDistance: 6.9, idealDistance: 13.2, maxDistance: 19, strafeSpeed: 0.28, retargetInterval: 1.65 },
  sofra: { minDistance: 6.2, idealDistance: 11.4, maxDistance: 20, strafeSpeed: 0.52, retargetInterval: 1.25 },
  angelSheep: { minDistance: 7.2, idealDistance: 14.2, maxDistance: 22, strafeSpeed: 0.36, retargetInterval: 1.45 },
  bloodCow: { minDistance: 0, idealDistance: 2.7, maxDistance: 0, strafeSpeed: 0.22, retargetInterval: 1.05 },
  plumaFinance: { minDistance: 8.2, idealDistance: 16.2, maxDistance: 24, strafeSpeed: 0.48, retargetInterval: 1.3 },
};

const hudWeaponIcons = {
  pistol: "🔫",
  flamethrower: "🔥",
  axe: "🪓",
  katana: "⚔",
  crossbow: "🏹",
  talisman: "📜",
  thunderstaff: "⚡",
  boneCannon: "☠",
  frostNova: "❄",
  guardianBlade: "🗡",
  orbitOrb: "🟣",
  sealRain: "☄",
  eclipseBlade: "🌘",
  profaneOrb: "🟠",
  arcaneDeluge: "🌈",
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
  soulMagnet: "🧲",
  ironBlood: "🛡",
  bladeEcho: "🌘",
  hunterEye: "👁",
  sealRitual: "🔯",
  ashenHeart: "🫀",
  prismStorm: "🌈",
  cuttingMoon: "🌙",
  lastBreath: "♻",
  slayerPact: "👹",
};

const monsterProfiles = {
  orcPeon: { label: 'Peão Orc', health: 8, speed: 3, radius: .85, damage: 15, score: 18, minWave: 2 },
  zombie: {
    label: "Zumbi",
    health: 4.2,
    speed: 3.3,
    radius: 0.78,
    damage: 13,
    score: 10,
    minWave: 1,
  },
  runner: {
    label: "Corredor",
    health: 3.2,
    speed: 6.1,
    radius: 0.58,
    damage: 11,
    score: 14,
    minWave: 2,
  },
  brute: {
    label: "Bruto",
    health: 17,
    speed: 2.2,
    radius: 1.18,
    damage: 27,
    score: 26,
    minWave: 3,
  },
  caster: {
    label: "Invocador",
    health: 8.5,
    speed: 2.8,
    radius: 0.82,
    damage: 16,
    score: 18,
    minWave: 4,
    projectileColor: 0xd978ff,
  },
  visor: {
    label: "Visor",
    health: 42,
    speed: 2.7,
    radius: 1.14,
    damage: 18,
    score: 90,
    minWave: 6,
    boss: true,
    projectileColor: 0x7edcff,
  },
  himetrica: {
    label: "Himetrica",
    health: 45,
    speed: 3.6,
    radius: 1.05,
    damage: 20,
    score: 95,
    minWave: 7,
    boss: true,
    projectileColor: 0xfff45c,
  },
  dinzo: {
    label: "Dinzo",
    health: 52,
    speed: 1.55,
    radius: 1.42,
    damage: 17,
    score: 105,
    minWave: 6,
    boss: true,
    projectileColor: 0xc93337,
  },
  gitcity: {
    label: "GitCity",
    health: 78,
    speed: 1.15,
    radius: 1.58,
    damage: 24,
    score: 140,
    minWave: 8,
    boss: true,
    projectileColor: 0xb9dcff,
  },
  sofra: {
    label: "SOFRA",
    health: 86,
    speed: 4.25,
    radius: 1.28,
    damage: 22,
    score: 180,
    minWave: 9,
    boss: true,
    projectileColor: 0x32b8ff,
  },
  cowWalker: {
    label: "Vaca Machado",
    health: 14,
    speed: 3.05,
    radius: 0.86,
    damage: 24,
    score: 20,
    minWave: 10,
  },
  cowCharger: {
    label: "Vaca Investida",
    health: 11,
    speed: 5.75,
    radius: 0.78,
    damage: 21,
    score: 24,
    minWave: 10,
  },
  cowBrute: {
    label: "Touro Carrasco",
    health: 34,
    speed: 2.15,
    radius: 1.24,
    damage: 38,
    score: 38,
    minWave: 10,
  },
  angelSheep: {
    label: "Ovelha Celestial",
    health: 360,
    speed: 2.15,
    radius: 1.48,
    damage: 26,
    score: 360,
    minWave: 999,
    boss: true,
    milestoneBoss: true,
    projectileColor: 0xfff1ba,
  },
  bloodCow: {
    label: "Vaca Sanguinária",
    health: 720,
    speed: 2.55,
    radius: 1.72,
    damage: 36,
    score: 620,
    minWave: 999,
    boss: true,
    milestoneBoss: true,
    projectileColor: 0xff3434,
  },
  plumaFinance: {
    label: "Pluma Finance",
    health: 920,
    speed: 2.85,
    radius: 1.36,
    damage: 32,
    score: 900,
    minWave: 999,
    boss: true,
    milestoneBoss: true,
    projectileColor: 0x8b5cff,
  },
};

const commonMonsterTypes = new Set(["orcPeon", "zombie", "runner", "brute", "caster", "cowWalker", "cowCharger", "cowBrute"]);
const cowMonsterTypes = new Set(["cowWalker", "cowCharger", "cowBrute"]);
const commonMonsterPalettes = {
  orcPeon: { skin: 0x5e7543, cloth: 0x695337, eye: 0xe6bb73 },
  zombie: { skin: 0x76a64f, cloth: 0x5d3b3b, eye: 0xff514d },
  runner: { skin: 0x8ad05d, cloth: 0x273545, eye: 0x87f7ff },
  brute: { skin: 0x8c6c4c, cloth: 0x493028, eye: 0xff9538 },
  caster: { skin: 0x6f58a8, cloth: 0x272039, eye: 0xd978ff },
  cowWalker: { skin: 0xf2efe0, cloth: 0x402019, eye: 0xffd36d },
  cowCharger: { skin: 0xffffff, cloth: 0x251715, eye: 0xff4b4b },
  cowBrute: { skin: 0x9b5a47, cloth: 0x3a1414, eye: 0xff7a28 },
};

const eliteProfiles = {
  furious: {
    label: "Furioso",
    color: 0xff514d,
    healthMultiplier: 1.75,
    speedMultiplier: 1.38,
    damageMultiplier: 1.85,
    scoreMultiplier: 1.35,
    xpMultiplier: 1.25,
    reachBonus: 0.12,
  },
  armored: {
    label: "Blindado",
    color: 0x9fb4c7,
    healthMultiplier: 3.25,
    speedMultiplier: 0.82,
    damageMultiplier: 1.45,
    scoreMultiplier: 1.55,
    xpMultiplier: 1.5,
    reachBonus: 0.05,
  },
  executioner: {
    label: "Carrasco",
    color: 0xffb13b,
    healthMultiplier: 2.25,
    speedMultiplier: 0.95,
    damageMultiplier: 2.05,
    scoreMultiplier: 1.7,
    xpMultiplier: 1.65,
    reachBonus: 0.82,
  },
};

const trapProfiles = {
  graveSpikes: {
    label: "Espinhos de Lápide",
    minWave: 4,
    radius: 2.55,
    telegraph: 1.05,
    duration: 1.5,
    damage: 12,
    color: 0xbfd2df,
  },
  profaneCircle: {
    label: "Círculo Profano",
    minWave: 8,
    radius: 3.4,
    telegraph: 1.25,
    duration: 1.7,
    damage: 17,
    color: 0xd978ff,
  },
  crackedLightning: {
    label: "Raio Rachado",
    minWave: 12,
    radius: 2.9,
    telegraph: 0.82,
    duration: 1.25,
    damage: 22,
    color: 0xfff45c,
  },
};

const waveMilestones = {
  5: {
    bossType: "angelSheep",
    title: "Ovelha Celestial",
    copy: "Uma ovelha gigante angelical desceu sobre o cemitério.",
  },
  10: {
    bossType: "bloodCow",
    title: "Nível Bovino Secreto",
    copy: "As vacas em pé chegaram com machados.",
  },
  20: {
    bossType: "plumaFinance",
    title: "Pluma Finance",
    copy: "Um pombo colorido invoca tornados financeiros.",
  },
};

const autoWeaponProfiles = AUTO_WEAPONS;
const evolvedWeaponProfiles = Object.fromEntries(AUTO_WEAPON_IDS.map((weaponId) => [weaponId, AUTO_WEAPONS[weaponId].evolution]));

const upgradeDefinitions = [
  {
    id: "damage",
    label: "+Dano",
    description: "Aumenta todo o dano causado por seus ataques e habilidades.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 6,
  },
  {
    id: "cadence",
    label: "+Cadência",
    description: "Reduz o tempo entre ataques e encurta um pouco a recarga das habilidades.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 5,
  },
  {
    id: "area",
    label: "+Área",
    description: "Aumenta cones, explosões e áreas de efeito.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 5,
  },
  {
    id: "speed",
    label: "+Velocidade",
    description: "Corre mais rápido para escapar do cerco da horda.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 4,
  },
  {
    id: "pickup",
    label: "+Raio de coleta",
    description: "Puxa cristais de XP de mais longe.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 5,
  },
  {
    id: "maxHealth",
    label: "+Vida máxima",
    description: "Aumenta sua vida máxima e cura uma parte na hora.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 4,
  },
  {
    id: "projectile",
    label: "+Projétil extra",
    description: "Armas de disparo soltam projéteis adicionais em leque.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 3,
  },
  {
    id: "autoWeapon",
    label: "Desbloquear arma automática",
    description: "Adiciona uma arma automática nova à sua build.",
    rarity: "common",
    kind: "stat",
    weight: 72,
    maxStacks: 3,
  },
  {
    id: "soulMagnet",
    label: "Ímã de Almas",
    description: "A cada 18s puxa cristais de XP próximos para você.",
    rarity: "rare",
    kind: "perk",
    minLevel: 2,
    maxStacks: 2,
  },
  {
    id: "ironBlood",
    label: "Sangue de Ferro",
    description: "Reduz o dano recebido em 12% por stack.",
    rarity: "rare",
    kind: "perk",
    minLevel: 2,
    maxStacks: 3,
  },
  {
    id: "bladeEcho",
    label: "Eco da Lâmina",
    description: "Ataques podem gerar um golpe fantasma extra.",
    rarity: "rare",
    kind: "perk",
    minLevel: 2,
    maxStacks: 2,
  },
  {
    id: "hunterEye",
    label: "Olho do Caçador",
    description: "Aumenta chance de crítico e destaca impactos fortes.",
    rarity: "rare",
    kind: "perk",
    minLevel: 2,
    maxStacks: 3,
  },
  {
    id: "sealRitual",
    label: "Ritual de Selos",
    description: "A cada 5 ataques automáticos, explode um selo no alvo.",
    rarity: "epic",
    kind: "perk",
    minLevel: 5,
    maxStacks: 2,
  },
  {
    id: "ashenHeart",
    label: "Coração de Cinzas",
    description: "Cura ao derrotar brutos, invocadores e bosses.",
    rarity: "epic",
    kind: "perk",
    minLevel: 5,
    maxStacks: 2,
  },
  {
    id: "prismStorm",
    label: "Tempestade Prismática",
    description: "Ao subir de nível, ganha área e projétil extra por 8s.",
    rarity: "epic",
    kind: "perk",
    minLevel: 5,
    maxStacks: 1,
  },
  {
    id: "cuttingMoon",
    label: "Lua Cortante",
    description: "Level-up solta uma onda circular de corte dourado.",
    rarity: "legendary",
    kind: "perk",
    minLevel: 10,
    maxStacks: 1,
  },
  {
    id: "lastBreath",
    label: "Último Fôlego",
    description: "Revive uma vez por run com 40% da vida máxima.",
    rarity: "legendary",
    kind: "perk",
    minLevel: 10,
    maxStacks: 1,
  },
  {
    id: "slayerPact",
    label: "Pacto do Exterminador",
    description: "Cada boss morto aumenta seu dano até o fim da run.",
    rarity: "legendary",
    kind: "perk",
    minLevel: 10,
    maxStacks: 1,
  },
];
// Upgrades 2.0: class skill cards (kind "skill") come from the shared module the server also reads.
upgradeDefinitions.push(...SKILL_UPGRADES);

const upgradeById = new Map(upgradeDefinitions.map((upgrade) => [upgrade.id, upgrade]));

const keys = new Set();
const zombies = [];
const bullets = [];
const enemyProjectiles = [];
const powerups = [];
const xpGems = [];
const effects = [];
const traps = [];
const damageNumbers = [];
const graveProps = [];
const remotePlayers = new Map();
const serverMonsterById = new Map();
const serverProjectileById = new Map();
const livingPlayerTargets = [];
const entityPools = {
  zombies: new Map(),
  bullets: [],
  enemyProjectiles: [],
  xpGems: [],
  effects: new Map(),
  traps: [],
  damageNumbers: [],
  prewarmed: false,
};
const monsterRenderer = {
  frame: 0,
  lodInterval: 5,
  instanced: new Map(),
  temporaryObjects: [],
};
const xpGemRenderer = {
  capacity: 240,
  count: 0,
  mesh: null,
};
const enemyProjectileRenderer = {
  capacity: 140,
  count: 0,
  mesh: null,
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
    livePlayers: [],
    recentSessions: [],
    status: "idle",
    generatedAt: null,
    source: null,
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
};

// Transport credentials never enter presentation/debug snapshots or request logs.
let multiplayerResumeToken = null;
let multiplayerAuthorityRunId = null;
let multiplayerAuthorityVersion = -1;
let multiplayerAppliedXpTotal = 0;
let multiplayerWorldEpoch = null;
let offlineCasterEpoch = crypto.randomUUID(), offlineCasterTick = 0;
let casterPresentationInbox = createCasterPresentationInbox(null);
const casterEventHistory = [];
const casterProjectilePresentation = createCasterProjectilePresenter({ sweepVisual: sweepCasterLaunchVisual });
function recordCasterEvent(event, source) {
  casterEventHistory.push({ ...event, source });
  if (casterEventHistory.length > 128) casterEventHistory.shift();
}
let multiplayerClockOffset = null;
let multiplayerReconnectAt = 0;
let pendingMultiplayerStart = null;
let runStartRejectionPresentation = null;
const appliedMultiplayerRewards = new Set();
let multiplayerUpgradeOfferId = null;
let pendingMultiplayerUpgrade = null;
let restoreMultiplayerUpgradeFocus = false;
const pendingMultiplayerPickups = new Map();
const serverPowerupsById = new Map();
const retiredServerDrops = new Set();

const player = {
  character: selectedCharacter,
  name: loadPlayerName(),
  health: heroMaxHealth(selectedCharacter),
  maxHealth: heroMaxHealth(selectedCharacter),
  score: 0,
  kills: 0,
  wave: 0,
  level: 1,
  bestLevel: 1,
  xp: 0,
  xpToNext: 12,
  speed: 6.5,
  shotCooldown: 0,
  weapon: playableCharacters[selectedCharacter].weaponId,
  weaponTimer: 0,
  relic: null,
  axeSpinTimer: 0,
  upgradeStats: createDefaultUpgradeStats(),
  upgradeStacks: {},
  perks: {},
  perkCooldowns: createDefaultPerkCooldowns(),
  evolvedWeapons: {},
  rarityPity: 0,
  damageReduction: 0,
  critChance: 0,
  critMultiplier: 1.8,
  revives: 0,
  bossKills: 0,
  autoAttackCounter: 0,
  pendingUpgradeSource: "level",
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
  trapTimer: 4.8,
  weaponDropCounter: 0,
  weaponDropIndex: 0,
  milestonesTriggered: new Set(),
  survivalTime: 0,
  hudTimer: 0,
  leaderboardSubmitted: false,
  leaderboardRefreshTimer: 0,
  partyHudTimer: 0,
  labelTimer: 0,
  labelFrameReady: true,
  skillHudSignature: "",
  onlineScoreboardSignature: "",
  serverWorldSeq: 0,
  serverWorldActive: false,
  perfStressImmortal: false,
  cameraLookDirection: new THREE.Vector3(0, 0, -1),
  touchVector: new THREE.Vector2(0, 0),
  touchStickPointerId: null,
  touchStickRect: null,
  touchAimActive: false,
  touchAimPointerId: null,
};

runtimeReady = true;
scene.add(player.mesh);
buildWorld();
cinematicPipeline = createCinematicPipeline({ THREE, renderer, adaptDepthMaterial: shareEnvironmentCutawayDepth });
classSkillState = createSkillState(player.character);
combatVfx = createCombatVfx({ THREE, scene, quality: qualityManager.level, reducedMotion: presentationPreferences.reducedMotion });
combatVfx.setSoulSource(player.mesh);
hazardVfx = createHazardVfx({ THREE, scene, vfx: combatVfx, capacity: 8,
  quality: qualityManager.level, reducedMotion: presentationPreferences.reducedMotion });
elementalVfx = createElementalVfx({ THREE, scene,
  quality: qualityManager.level, reducedMotion: presentationPreferences.reducedMotion });
classSkillVfx = createClassSkillVfx({ THREE, scene, combatVfx, elementalVfx, sweepVisual: sweepClassSkillVisual, quality: qualityManager.level, reducedMotion: presentationPreferences.reducedMotion });
arsenalVfx = createArsenalVfx({ THREE, scene, combatVfx, elementalVfx, quality: qualityManager.level, reducedMotion: presentationPreferences.reducedMotion });
window.addEventListener('bipx:skill-request', event => requestClassSkill(event.detail?.slot));
window.addEventListener('bipx:arpg-ready', () => publishArpgState());

window.__bipxCharacters = { getState: getCharacterState, select: selectCharacter };
const gameVisualsReady = loadGameVisuals();
cinematicPipeline.setQuality(qualityManager.level);
cinematicPipeline.setReducedMotion(presentationPreferences.reducedMotion);
window.__bipxPresentation = {
  getSettings: () => ({ ...presentationPreferences, quality: qualityManager.mode, effectiveQuality: qualityManager.level, paused, canPause: !multiplayer.enabled }),
  setQuality(value) {
    qualityManager.mode = sanitizeQuality(value);
    qualityManager.level = qualityManager.mode === 'auto' ? getDefaultQualityLevel() : qualityManager.mode;
    presentationPreferences.quality = qualityManager.mode;
    applyQualitySettings(true);
    savePresentationPreferences(presentationPreferences);
    announcePresentationSettings();
  },
  setReducedMotion(value) {
    presentationPreferences.reducedMotion = Boolean(value);
    combatVfx.setReducedMotion(presentationPreferences.reducedMotion);
    hazardVfx?.setReducedMotion(presentationPreferences.reducedMotion);
    elementalVfx?.setReducedMotion(presentationPreferences.reducedMotion);
    arsenalVfx?.setReducedMotion(presentationPreferences.reducedMotion);
    classSkillVfx?.setReducedMotion(presentationPreferences.reducedMotion);
    cinematicPipeline.setReducedMotion(presentationPreferences.reducedMotion);
    cameraTrauma = 0;
    savePresentationPreferences(presentationPreferences);
    announcePresentationSettings();
  },
  setPaused(value) {
    paused = Boolean(value) && !multiplayer.enabled && game.state === 'playing';
    clearPlayerInput();
    document.body.classList.toggle('game-paused', paused);
    announcePresentationSettings();
    return paused;
  },
  togglePause() { return this.setPaused(!paused); },
};
announcePresentationSettings();
if (playerNameInput) {
  playerNameInput.value = player.name;
}
updateMultiplayerHud();
updateLeaderboardHud();
void loadLeaderboardSnapshot({ clearBeforeFetch: true });
if (multiplayer.enabled) {
  connectMultiplayer();
}
if (playButtonLabel && multiplayer.enabled) {
  playButtonLabel.textContent = "Jogar multiplayer";
}
audioManager.init();
updateHud();
animate();

audioToggleButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  audioManager.toggleMute();
  // Pointer activation hands the keyboard back to the arena; keyboard activation keeps focus.
  if (event.detail > 0 && game.state === 'playing') canvas.focus({ preventScroll: true });
});

for (const eventName of ["pointerdown", "touchstart", "keydown"]) {
  window.addEventListener(eventName, () => audioManager.unlock(), { once: true, passive: true });
}

openLoginButton?.addEventListener("click", () => {
  clearRunStartRejection();
  audioManager.play("uiSelect", { priority: 3 });
  message.classList.remove("message--ranking");
  message.classList.add("message--login");
  playerNameInput?.focus();
});

menuRankingButton?.addEventListener("click", () => {
  clearRunStartRejection();
  audioManager.play("uiSelect", { priority: 3 });
  message.classList.remove("message--login");
  message.classList.remove("message--game-over");
  message.classList.add("message--ranking");
  void loadLeaderboardSnapshot({ clearBeforeFetch: true });
});

rankingBackButton?.addEventListener("click", () => {
  clearRunStartRejection();
  audioManager.play("uiSelect", { priority: 3 });
  message.classList.remove("message--ranking");
});

loginBackButton?.addEventListener("click", () => {
  clearRunStartRejection();
  audioManager.play("uiSelect", { priority: 3 });
  restoreMenuIdentity();
  message.classList.remove("message--game-over");
  message.classList.remove("message--login");
  message.classList.remove("message--ranking");
});

playButton.addEventListener("click", () => {
  if (isDeathInputGuarded()) return;
  audioManager.play("uiSelect", { priority: 3 });
  if (game.state !== "playing") {
    updateLocalPlayerName(playerNameInput?.value);
    startGame();
  }
});

multiplayerButton?.addEventListener("click", () => {
  audioManager.play("uiSelect", { priority: 3 });
  updateLocalPlayerName(playerNameInput?.value);
  window.location.assign(getMultiplayerEntryUrl());
});

playerNameInput?.addEventListener("change", () => {
  updateLocalPlayerName(playerNameInput.value);
});

playerNameInput?.addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    updateLocalPlayerName(playerNameInput.value);
    audioManager.play("uiSelect", { priority: 3 });
    startGame();
  }
});

window.addEventListener("resize", resizeRenderer, { passive: true });
window.addEventListener("orientationchange", resizeRenderer, { passive: true });
window.visualViewport?.addEventListener("resize", resizeRenderer, { passive: true });
window.visualViewport?.addEventListener("scroll", resizeRenderer, { passive: true });
window.addEventListener('blur', () => {
  clearPlayerInput();
  if (!multiplayer.enabled) window.__bipxPresentation.setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearPlayerInput();
    if (!multiplayer.enabled) window.__bipxPresentation.setPaused(true);
  }
});
window.addEventListener("keydown", (event) => {
  if (paused) return;
  // During a run only text entry and dialogs own the keyboard; a focused HUD button
  // (audio, pause, skill) must not swallow movement, aim or attack keys.
  const blockers = game.state === 'playing' ? 'input,textarea,select,dialog,[role="dialog"]' : 'input,textarea,select,button,dialog,[role="dialog"]';
  const interactiveTarget = event.target instanceof Element && event.target.closest(blockers);
  const upgradeTarget = event.target instanceof Element && event.target.closest('#upgrade-options .upgrade-card');
  const upgradeIndex = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].indexOf(event.code);
  if (upgradeIndex >= 0 && player.pendingUpgradeChoices.length > 0 && (!interactiveTarget || upgradeTarget)) {
    event.preventDefault();
    if (event.repeat) return;
    chooseUpgrade(upgradeIndex % 3);
    return;
  }
  if (interactiveTarget) return;
  // Space/Enter on a focused control keep their native activation for keyboard users;
  // they simply do not also fire the weapon.
  if (event.target instanceof Element && event.target.closest('button,summary') && ['Space', 'Enter'].includes(event.code)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();

  keys.add(event.code);
  if (['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(event.code)) {
    keyboardAimActive = true;
    if (!event.repeat) keyboardAimReleaseUntil = 0;
  }

  if (event.code === "Enter" && game.state !== "playing" && !message.classList.contains("message--ranking") && !isDeathInputGuarded()) {
    audioManager.play("uiSelect", { priority: 3 });
    startGame();
  }

  if (event.code === "Space") {
    game.shooting = true;
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  if (['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(event.code)) keyboardAimReleaseUntil = performance.now() + 60;

  if (event.code === "Space") {
    game.shooting = false;
  }
});

window.addEventListener("mousemove", (event) => {
  keyboardAimActive = false;
  keyboardAimReleaseUntil = 0;
  updatePointerFromClient(event.clientX, event.clientY);
});

window.addEventListener("mousedown", (event) => {
  if (paused || game.state !== 'playing' || isInteractiveOverlay(event.target)) {
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
  getVfxStats: () => combatVfx?.getStats(),
  getClassSkillVfxStats: () => classSkillVfx?.getStats(),
  getWorldLabelLayoutStats: () => worldLabelLayout.getStats(),
  getArpgState: () => buildArpgState(),
  getSkillEvents: () => skillPresentationHistory.map(event => ({ ...event })),
  getSkillState: () => skillSnapshot(classSkillState),
  projectWorldPosition: (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(camera), rect = canvas.getBoundingClientRect();
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  },
  getCasterCasts: () => zombies.filter(z => z.type === 'caster').map(z => ({ id: z.id,
    state: z.casterCastState || null, visual: z.casterCastVisual || null,
    position: { x: z.mesh.position.x, z: z.mesh.position.z },
    emitter: animatedEnemies?.getCastEmitter(z, { castId: z.casterCastVisual?.id }) || null })),
  getCasterEvents: () => structuredClone(casterEventHistory),
  getCasterProjectilePresentation: () => [...enemyProjectiles, ...serverProjectileById.values()].filter(p => p.sourceType === 'caster').map(p => ({
    castId: p.castId, age: p.age, logical: { x: p.mesh.position.x, y: p.mesh.position.y, z: p.mesh.position.z },
    visual: p.casterPresentation || null, bridge: p.casterLaunchBridge?.getStats() || null })),
  getSkillTargets: () => zombies.map(z => ({ id: z.id, x: z.mesh.position.x, z: z.mesh.position.z, health: z.health, freeze: z.freezeTimer || 0, stun: z.stunTimer || 0, pull: z.pullTimer || 0 })),
  getHazardVfxStats: () => hazardVfx?.getStats(),
  getArsenalVfxStats: () => arsenalVfx?.getStats(),
  getArsenalState: () => ({ relic: player.weaponTimer > 0 ? player.relic : null, relicName: player.weaponTimer > 0 ? getRelicName(player.relic, player.character) : null,
    remaining: player.weaponTimer, swing: arsenalState.swing, pending: arsenalState.pending.length, projectiles: arsenalState.projectiles.length,
    loadout: structuredClone(getArsenalLoadout()), authority: multiplayer.enabled ? 'server' : 'solo' }),
  getElementalVfxStats: () => elementalVfx?.getStats(),
  getActorMotionState: () => {
    const snapshot = (id, mesh, motion, visual) => ({ id, position: mesh.position.toArray(),
      motion: { ...motion, velocity: { ...motion.velocity } },
      locomotion: visual?.stats.locomotion ? JSON.parse(JSON.stringify(visual.stats.locomotion)) : null });
    return { local: snapshot(multiplayer.id || 'solo', player.mesh, heroVisualMotion, heroVisual),
      remote: [...remotePlayers.values()].map(peer => snapshot(peer.id, peer.mesh, peer.visualMotion, peer.visual)) };
  },
  getPresentationStats: () => ({ ...window.__bipxPresentation.getSettings(), pipeline: cinematicPipeline?.getStats(), resources: { ...renderer.info.memory }, atmosphere: worldAtmosphere?.getStats(), assets: { hero: heroVisual?.stats ?? { loaded: false }, world: worldVisuals?.stats ?? { loaded: false }, enemies: animatedEnemies?.getStats(), errors: [...visualAssetErrors] } }),
  getState() {
    return {
      state: game.state,
      character: player.character,
      characterLoading,
      swordSwingRemaining,
      paused,
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
      progressionAuthority: multiplayer.enabled ? {
        runId: multiplayerAuthorityRunId,
        version: multiplayerAuthorityVersion,
        xpTotal: multiplayerAppliedXpTotal,
        offerId: multiplayerUpgradeOfferId,
        waitingForChoice: Boolean(pendingMultiplayerUpgrade),
        waitingForPickups: pendingMultiplayerPickups.size,
      } : null,
      zombies: zombies.length,
      damageNumbers: damageNumbers.length,
      damageNumberDetails: damageNumbers.slice(0, 8).map((number) => ({
        amount: number.amount,
        crit: number.crit,
        variant: number.variant,
      })),
      traps: traps.length,
      trapDetails: traps.map((trap) => ({
        type: trap.type,
        triggered: trap.triggered,
      })),
      bullets: bullets.length,
      enemyProjectiles: enemyProjectiles.length,
      enemyProjectileDetails: enemyProjectiles.map((projectile) => ({
        kind: projectile.visualKind ?? "orb",
        source: projectile.sourceType ?? "caster",
      })),
      powerups: powerups.length,
      powerupDetails: powerups.map((powerup) => ({
        serverId: powerup.serverDropId || null,
        type: powerup.type,
        kind: powerup.kind ?? "weapon",
        amount: powerup.amount ?? null,
        label: powerup.label ?? getPowerupDropLabel(powerup.type),
        rarity: powerup.rarity ?? "common",
        animated: Boolean(rarityStyles[powerup.rarity]?.animated),
        hasLabel: Boolean(powerup.labelSprite),
        source: powerup.source,
        life: Number((powerup.life ?? 0).toFixed(2)),
        ttl: Number((powerup.ttl ?? groundItemLifetime).toFixed(2)),
      })),
      monsters: zombies.reduce((counts, zombie) => {
        counts[zombie.type] = (counts[zombie.type] ?? 0) + 1;
        return counts;
      }, {}),
      elites: zombies.reduce((counts, zombie) => {
        if (zombie.eliteType) {
          counts[zombie.eliteType] = (counts[zombie.eliteType] ?? 0) + 1;
        }
        return counts;
      }, {}),
      bossLabels: zombies.reduce((counts, zombie) => {
        if (zombie.labelSprite) {
          counts[zombie.type] = (counts[zombie.type] ?? 0) + 1;
        }
        return counts;
      }, {}),
      statuses: {
        burning: zombies.filter((zombie) => zombie.burnTimer > 0).length,
        frozen: zombies.filter((zombie) => zombie.freezeTimer > 0).length,
      },
      pendingZombies: game.zombiesToSpawn,
      spawnInterval: Number(getZombieSpawnInterval().toFixed(3)),
      weapon: player.weapon,
      relic: player.weaponTimer > 0 ? player.relic : null,
      weaponTimer: Number(player.weaponTimer.toFixed(2)),
      build: getPlayerBuildSummary(),
      autoWeapons: Object.fromEntries(
        Object.entries(player.autoWeapons).map(([id, state]) => [id, state.level]),
      ),
      perks: { ...player.perks },
      evolvedWeapons: { ...player.evolvedWeapons },
      pendingUpgradeSource: player.pendingUpgradeSource,
      pendingUpgradeRarities: player.pendingUpgradeChoices.map((choice) => choice.rarity ?? "common"),
      rarityPity: player.rarityPity,
      revives: player.revives,
      upgradeStats: {
        damageMultiplier: Number(player.upgradeStats.damageMultiplier.toFixed(3)),
        cooldownMultiplier: Number(player.upgradeStats.cooldownMultiplier.toFixed(3)),
        areaMultiplier: Number(player.upgradeStats.areaMultiplier.toFixed(3)),
        speedMultiplier: Number(player.upgradeStats.speedMultiplier.toFixed(3)),
        pickupRadius: Number(player.upgradeStats.pickupRadius.toFixed(3)),
        projectileBonus: player.upgradeStats.projectileBonus,
        effectiveAreaMultiplier: Number(getAreaMultiplier().toFixed(3)),
        effectiveProjectileBonus: getProjectileBonus(),
        damageReduction: Number(player.damageReduction.toFixed(3)),
        critChance: Number(player.critChance.toFixed(3)),
      },
      survivalTime: Number(game.survivalTime.toFixed(2)),
      heroPower: { classId: heroCombat.classId, combo: heroCombat.combo, mitigation: heroProfile(player.character).mitigation,
        basicPower: basicPower(player.character, player.level), skillPower: skillPower(player.character, player.level),
        staggered: zombies.filter(zombie => zombie.staggerTimer > 0).length },
      player: {
        name: player.name,
        x: Number(player.position.x.toFixed(3)),
        z: Number(player.position.z.toFixed(3)),
        aimX: Number(player.aimDirection.x.toFixed(3)),
        aimZ: Number(player.aimDirection.z.toFixed(3)),
      },
      serverWorld: {
        active: game.serverWorldActive,
        seq: game.serverWorldSeq,
        monsters: [...serverMonsterById.keys()],
        projectiles: [...serverProjectileById.keys()],
      },
      liveScoreboard: getOnlineScoreboardPlayers().map((scoreboardPlayer) => ({
        rank: scoreboardPlayer.rank,
        name: scoreboardPlayer.name,
        score: scoreboardPlayer.score,
        kills: scoreboardPlayer.kills,
        wave: scoreboardPlayer.wave,
        level: scoreboardPlayer.level,
        isLocal: scoreboardPlayer.isLocal,
      })),
      multiplayer: {
        connected: multiplayer.connected,
        id: multiplayer.id,
        players: getPartyPlayers().map((partyPlayer) => ({
          name: partyPlayer.name,
          health: partyPlayer.health,
          score: partyPlayer.score,
        })),
        leaderboard: {
          source: multiplayer.leaderboard.source || getLeaderboardApiUrl("/api/leaderboard"),
          status: multiplayer.leaderboard.status || "ready",
          totalPlayers: multiplayer.leaderboard.totalPlayers,
          players: multiplayer.leaderboard.players.map((leader) => ({
            rank: leader.rank,
            name: leader.name,
            bestScore: leader.bestScore,
          })),
          livePlayers: multiplayer.leaderboard.livePlayers.map((leader) => ({
            rank: leader.rank,
            name: leader.name,
            score: leader.score,
          })),
        },
        room: multiplayer.room,
        remotePlayers: remotePlayers.size,
        status: multiplayer.status,
      },
    };
  },
  getAudioState() {
    return audioManager.getState();
  },
  toggleMute() {
    return audioManager.toggleMute();
  },
  playTestSound(type = "levelUp") {
    audioManager.playTestSound(type);
    return audioManager.getState();
  },
  getAvatarTierForScore(score = 0) {
    return getLeaderboardAvatar({ totalScore: Math.max(0, Number(score) || 0) });
  },
  getPerfStats: getPerfStats,
  getRenderIntegrity: getMonsterRenderIntegrity,
  start: startGame,
  equipWeapon: activateWeapon,
  unlockAutoWeapon(weaponId = "guardianBlade") {
    if (player.autoWeapons[weaponId]) {
      player.autoWeapons[weaponId].level = 1;
      player.autoWeapons[weaponId].cooldown = 0.05;
      updateHud(true);
    }
    return this.getState();
  },
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
  spawnWeaponDrop(type = "flamethrower") {
    spawnWeaponDrop(player.position.clone().addScaledVector(player.aimDirection, 2.4), type, "debug");
  },
  spawnPerkDrop(perkId = "soulMagnet", rarity = null) {
    const perk = upgradeById.get(perkId) ?? upgradeById.get("soulMagnet");
    spawnPerkDropAt(player.position.clone().addScaledVector(player.aimDirection, 2.8), perk.id, rarity ?? perk.rarity, "debug");
  },
  spawnBossRewardChest(bossType = "visor") {
    spawnBossRewardChestAt(player.position.clone().addScaledVector(player.aimDirection, 2.8), bossType);
  },
  spawnHealthPotion(amount = bossHealthPotionAmount) {
    spawnHealthPotionAt(player.position.clone().addScaledVector(player.aimDirection, 2.2), Math.max(1, Number(amount) || bossHealthPotionAmount), "debug");
    return this.getState();
  },
  openBossReward(bossType = "debug") {
    openBossRewardChoices(bossType);
  },
  grantPerk(perkId = "soulMagnet") {
    const perk = upgradeById.get(perkId);
    if (perk) {
      applyUpgrade(perk);
      updateHud(true);
    }
  },
  setLevel(level = 10) {
    player.level = Math.max(1, Math.floor(Number(level) || 1));
    player.bestLevel = Math.max(player.bestLevel, player.level);
    updateHud(true);
  },
  setWave(wave = 1) {
    player.wave = Math.max(1, Math.floor(Number(wave) || 1));
    waveElement.textContent = player.wave.toString();
    handleWaveMilestone();
    updateHud(true);
  },
  spawnDamageNumber(amount = 42, crit = false) {
    spawnDamageNumber(player.position.clone().addScaledVector(player.aimDirection, 3), Math.max(1, Number(amount) || 1), Boolean(crit), null);
    return this.getState();
  },
  damagePlayer(amount = 10) {
    damageLocalPlayer(Math.max(1, Number(amount) || 1));
    return this.getState();
  },
  spawnTrap(type = "graveSpikes", distance = 3.6) {
    spawnTrap(type, player.position.clone().addScaledVector(player.aimDirection, Math.max(0, Number(distance) || 0)));
    return this.getState();
  },
  spawnMilestoneBoss(type = "angelSheep") {
    spawnMilestoneBoss(type);
    return this.getState();
  },
  clearCombatEntities() {
    clearEntities();
    player.maxHealth = Math.max(player.maxHealth, 1000);
    player.health = player.maxHealth;
    game.state = "playing";
    return this.getState();
  },
  stressLevel6(count = 90) {
    game.perfStressImmortal = true;
    player.level = Math.max(player.level, 6);
    player.bestLevel = Math.max(player.bestLevel, player.level);
    player.wave = Math.max(player.wave, 6);
    player.maxHealth = Math.max(player.maxHealth, 2000);
    player.health = player.maxHealth;
    player.autoWeapons.orbitOrb.level = 1;
    player.autoWeapons.sealRain.level = 1;
    game.survivalTime = Math.max(game.survivalTime, 85);
    const total = Math.max(0, Math.floor(Number(count) || 0));
    for (let index = 0; index < total; index += 1) {
      const angle = (index / Math.max(total, 1)) * Math.PI * 2;
      const distance = 12 + (index % 18) * 1.3;
      const type = ["zombie", "runner", "brute", "caster"][index % 4];
      spawnZombie(player.position.x + Math.cos(angle) * distance, player.position.z + Math.sin(angle) * distance, type);
      fortifyStressZombie(zombies[zombies.length - 1], 2400);
    }
    rebuildSpatialGrid();
    assignMonsterRenderModes();
    syncMonsterRenderer();
    updateHud(true);
  },
  stressLevel16(count = 360) {
    clearEntities();
    game.perfStressImmortal = true;
    player.level = Math.max(player.level, 16);
    player.bestLevel = Math.max(player.bestLevel, player.level);
    player.wave = Math.max(player.wave, 16);
    player.maxHealth = Math.max(player.maxHealth, 4000);
    player.health = player.maxHealth;
    player.xp = Math.min(player.xp, player.xpToNext - 1);
    player.upgradeStats = {
      damageMultiplier: playerBaseDamageMultiplier * 1.72,
      cooldownMultiplier: 0.68,
      areaMultiplier: 1.48,
      speedMultiplier: 1.2,
      pickupRadius: 6.4,
      projectileBonus: 2,
    };
    player.upgradeStacks = {
      damage: 4,
      cadence: 3,
      area: 3,
      speed: 2,
      pickup: 3,
      projectile: 2,
      autoWeapon: 2,
    };
    player.autoWeapons.guardianBlade.level = 1;
    player.autoWeapons.orbitOrb.level = 1;
    player.autoWeapons.sealRain.level = 1;
    player.pendingLevelUps = 0;
    player.pendingUpgradeChoices = [];
    game.survivalTime = Math.max(game.survivalTime, 360);
    game.zombiesToSpawn = 0;
    renderUpgradeChoices();

    const total = Math.max(340, Math.floor(Number(count) || 0));
    const types = ["zombie", "runner", "brute", "caster"];
    for (let index = 0; index < total; index += 1) {
      const angle = (index / Math.max(total, 1)) * Math.PI * 2;
      const distance = 9 + (index % 26) * 1.05;
      const type = types[index % types.length];
      spawnZombie(player.position.x + Math.cos(angle) * distance, player.position.z + Math.sin(angle) * distance, type);
      fortifyStressZombie(zombies[zombies.length - 1]);
    }

    const bossRing = [
      ["visor", 17, -8],
      ["gitcity", -16, 15],
    ];
    for (const [type, x, z] of bossRing) {
      spawnZombie(player.position.x + x, player.position.z + z, type);
      fortifyStressZombie(zombies[zombies.length - 1]);
    }

    for (let index = 0; index < 72; index += 1) {
      const angle = (index / 72) * Math.PI * 2;
      const distance = 4 + (index % 12) * 1.4;
      spawnXpGem(
        tempVectorA.set(player.position.x + Math.cos(angle) * distance, 0, player.position.z + Math.sin(angle) * distance),
        5 + (index % 4),
      );
    }

    rebuildSpatialGrid();
    assignMonsterRenderModes();
    syncMonsterRenderer();
    updateHud(true);
  },
};

function fortifyStressZombie(zombie, health = 9999) {
  if (!zombie) {
    return;
  }

  zombie.health = health;
  zombie.maxHealth = health;
  zombie.speed = 0;
  zombie.attackCooldown = 9999;
  if (zombie.labelSprite) {
    updateBossLabel(zombie.labelSprite, zombie.health);
  }
}

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
  void gameVisualsReady.then(() => {
    if (game.state !== 'menu' || startGame() === false) return;
    if (queryParams.get("bosses") === "1") {
      spawnBossPreview();
    }
  });
}

// The death screen borrows the login panel; the menu gets its own words back afterwards.
let menuIdentity = null;
let deathInputGuardUntil = 0;
function isDeathInputGuarded() { return performance.now() < deathInputGuardUntil; }
function restoreMenuIdentity() {
  if (!menuIdentity) return;
  messageTitle.textContent = menuIdentity.title;
  messageKicker.textContent = menuIdentity.kicker;
  messageCopy.textContent = menuIdentity.copy;
  currentPlayButtonLabel().textContent = menuIdentity.label;
  if (menuIdentity.copyRole === null) messageCopy.removeAttribute('role'); else messageCopy.setAttribute('role', menuIdentity.copyRole);
  if (menuIdentity.describedBy === null) playButton.removeAttribute('aria-describedby'); else playButton.setAttribute('aria-describedby', menuIdentity.describedBy);
  menuIdentity = null;
}

function currentPlayButtonLabel() {
  let label = playButton.querySelector('#play-button-label');
  if (!label) {
    // The game-over button has a direct text node beside its restart icon.
    const textNodes = [...playButton.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    const text = textNodes.map(node => node.textContent).join('').trim();
    label = document.createElement('span');
    label.id = 'play-button-label';
    label.textContent = text;
    for (const node of textNodes) node.remove();
    playButton.append(label);
  }
  return label;
}

function clearRunStartRejection() {
  if (!runStartRejectionPresentation) return;
  const previous = runStartRejectionPresentation;
  runStartRejectionPresentation = null;
  delete message.dataset.runStartRejected;
  messageTitle.textContent = previous.title;
  messageKicker.textContent = previous.kicker;
  messageCopy.textContent = previous.copy;
  currentPlayButtonLabel().textContent = previous.label;
  for (const [element, name, value] of previous.attributes) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}

function showRunStartRejection() {
  const label = currentPlayButtonLabel();
  if (!runStartRejectionPresentation) runStartRejectionPresentation = {
    title: messageTitle.textContent, kicker: messageKicker.textContent,
    copy: messageCopy.textContent, label: label.textContent,
    attributes: [[playButton, 'aria-describedby', playButton.getAttribute('aria-describedby')],
      [messageCopy, 'role', messageCopy.getAttribute('role')]],
  };
  message.dataset.runStartRejected = 'true';
  messageKicker.textContent = 'Noite Zumbi';
  messageTitle.textContent = 'BIPX';
  messageCopy.setAttribute('role', 'status');
  messageCopy.textContent = 'Entrada indisponível. Ainda não há espaço livre para aparecer. Tente novamente em instantes.';
  label.textContent = 'Tentar novamente';
  playButton.setAttribute('aria-describedby', 'message-copy');
  message.classList.add('message--login');
  message.classList.remove('is-hidden');
  playButton.focus();
}

function startGame() {
  if (characterLoading || !heroVisual || !readyCharacters.has(selectedCharacter)) return false;
  if (pendingMultiplayerStart) return false;
  clearRunStartRejection();
  restoreMenuIdentity();
  characterPreview = false;
  paused = false;
  cameraTrauma = 0;
  footstepSerial = heroVisual?.stats.locomotion?.footPlantSerial ?? 0;
  playerMoveBlend = playerSwingTime = 0;
  pendingSwordStrike = null;
  swordSwingRemaining = 0;
  keyboardAimActive = false;
  keyboardAimReleaseUntil = 0;
  clearPlayerInput();
  document.body.classList.remove('game-paused');
  prewarmEntityPools();
  applyQualitySettings(true);
  clearEntities();
  resetProgressionState();
  classSkillState = createSkillState(player.character);
  heroCombat = createHeroCombatState(player.character);
  pendingSkillRequest = null;
  skillPresentationHistory.length = 0;
  onlineSkillMotion = null; remoteSkillSnapshots = []; persistentSkillPresentation.clear();
  skillSoundTravel.clear();
  audioManager.samples?.reset();
  player.health = player.maxHealth;
  player.score = 0;
  player.kills = 0;
  player.wave = 0;
  player.shotCooldown = 0;
  player.weapon = playableCharacters[player.character].weaponId;
  player.weaponTimer = 0;
  player.relic = null;
  arsenalState = createArsenalState(player.character);
  player.axeSpinTimer = 0;
  const requestedSpawn = getMultiplayerStartPosition();
  const freeSpawn = findFreePosition(collisionWorld, { x: requestedSpawn.x, z: requestedSpawn.z, radius: .64 }, { maxDistance: 16 });
  if (!freeSpawn.found) throw new Error("No valid player spawn");
  player.position.set(freeSpawn.x, 0, freeSpawn.z);
  player.aimDirection.set(0, 0, -1);
  player.mesh.position.copy(player.position);
  game.state = "playing";
  heroVisualMotion.initialized = false;
  game.nextWaveDelay = 0;
  game.spawnTimer = 0;
  game.zombiesToSpawn = 0;
  game.trapTimer = 4.8;
  game.weaponDropCounter = 0;
  game.weaponDropIndex = 0;
  game.milestonesTriggered = new Set();
  game.survivalTime = 0;
  game.hudTimer = 0;
  game.soloRunId = crypto.randomUUID();
  game.leaderboardSubmitted = false;
  game.leaderboardRefreshTimer = 0;
  game.partyHudTimer = 0;
  game.labelTimer = 0;
  game.labelFrameReady = true;
  game.skillHudSignature = "";
  game.serverWorldSeq = 0;
  game.serverWorldActive = false;
  game.perfStressImmortal = false;
  game.cameraLookDirection.copy(player.aimDirection);
  game.touchAimActive = false;
  game.touchAimPointerId = null;
  resetStick();
  nextZombieId = 1;
  spatialGrid.dirty = true;
  audioManager.startRun();
  message.classList.remove("message--game-over");
  message.classList.remove("message--login");
  message.classList.remove("message--ranking");
  message.classList.add("is-hidden");
  canvas.focus({ preventScroll: true });
  if (multiplayer.enabled) {
    clearServerSyncedWorld();
    player.wave = 1;
    waveElement.textContent = "1";
    pendingMultiplayerStart = { requestId: crypto.randomUUID(), sent: false };
    sendMultiplayerStart();
  } else {
    startNextWave();
  }
  updateHud(true);
  updateMultiplayerHud();
  combatVfx?.emit('teleport', player.position, { color: 0x91dbe3, radius: 2 });
  announcePresentationSettings();
}

function clearPlayerInput() {
  keys.clear();
  game.shooting = false;
  game.touchAimActive = false;
  game.touchAimPointerId = null;
  resetStick();
}

function isMultiplayerSuspended() {
  return multiplayer.enabled && (!multiplayer.connected || Boolean(pendingMultiplayerStart));
}

function sendMultiplayerStart() {
  if (!multiplayer.connected || !pendingMultiplayerStart || pendingMultiplayerStart.sent) return;
  pendingMultiplayerStart.sent = true;
  sendMultiplayerMessage({ type: 'startRun', requestId: pendingMultiplayerStart.requestId, state: { character: player.character } });
}

function announcePresentationSettings() {
  if (window.__bipxPresentation) {
    window.dispatchEvent(new CustomEvent('bipx:presentation-change', { detail: window.__bipxPresentation.getSettings() }));
  }
}

function createDefaultUpgradeStats() {
  return {
    damageMultiplier: playerBaseDamageMultiplier,
    cooldownMultiplier: 1,
    areaMultiplier: 1,
    speedMultiplier: 1,
    pickupRadius: 2.35,
    projectileBonus: 0,
  };
}

function createDefaultAutoWeapons() {
  return {
    guardianBlade: { level: 0, cooldown: 0, angle: 0 },
    orbitOrb: { level: 0, cooldown: 0, angle: Math.random() * Math.PI * 2 },
    sealRain: { level: 0, cooldown: 0, angle: 0 },
  };
}

function createDefaultPerkCooldowns() {
  return {
    soulMagnet: 4.5,
    prismStorm: 0,
  };
}

function resetProgressionState() {
  multiplayerUpgradeOfferId = null;
  pendingMultiplayerUpgrade = null;
  pendingMultiplayerPickups.clear();
  for (let index = powerups.length - 1; index >= 0; index--) {
    if (powerups[index].serverDropId) removePowerup(index);
  }
  serverPowerupsById.clear();
  retiredServerDrops.clear();
  player.maxHealth = heroMaxHealth(player.character);
  player.level = 1;
  player.bestLevel = 1;
  player.xp = 0;
  player.xpToNext = getXpToNext(1);
  player.upgradeStats = createDefaultUpgradeStats();
  player.upgradeStacks = {};
  player.perks = {};
  player.perkCooldowns = createDefaultPerkCooldowns();
  player.evolvedWeapons = {};
  player.rarityPity = 0;
  player.exhaustedRewards = 0;
  player.damageReduction = 0;
  player.critChance = 0;
  player.critMultiplier = 1.8;
  player.revives = 0;
  player.bossKills = 0;
  player.autoAttackCounter = 0;
  player.pendingUpgradeSource = "level";
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
  perfOverlay.textContent = `FPS ${stats.fpsAverage} · ${stats.quality}/${stats.qualityMode}\nU ${stats.updateMs}ms R ${stats.renderMs}ms · DC ${stats.drawCalls}\nZ ${stats.entities.zombies} D ${stats.visibleDetailedZombies} I ${stats.instancedZombies}\nB ${stats.entities.bullets} XP ${stats.entities.xpGems} FX ${stats.entities.effects}`;
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
  if (isLateGamePerformanceMode()) {
    qualityManager.effectBudget = Math.min(qualityManager.effectBudget, mobileTuned ? 16 : 24);
  }

  if (force || Math.abs(pixelRatio - qualityManager.pixelRatio) > 0.01) {
    qualityManager.pixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  renderer.shadowMap.enabled = qualityManager.level === "high" || (qualityManager.level === "medium" && !mobileTuned);
  combatVfx?.setQuality(qualityManager.level);
  classSkillVfx?.setQuality(qualityManager.level);
  hazardVfx?.setQuality(qualityManager.level);
  elementalVfx?.setQuality(qualityManager.level);
  arsenalVfx?.setQuality(qualityManager.level);
  cinematicPipeline?.setQuality(qualityManager.level);
}

function updateQualityManager(dt) {
  if (qualityManager.mode !== "auto") {
    return;
  }

  const mobileTuned = usesMobileTuning();
  if (mobileTuned && zombies.length > 80 && qualityManager.level === "high") {
    qualityManager.level = "medium";
    qualityManager.fpsLowTimer = 0;
    qualityManager.fpsHighTimer = 0;
    applyQualitySettings();
    return;
  }

  if (mobileTuned && zombies.length > 260 && qualityManager.level !== "low") {
    qualityManager.level = "low";
    qualityManager.fpsLowTimer = 0;
    qualityManager.fpsHighTimer = 0;
    applyQualitySettings();
    return;
  }

  if (!mobileTuned && zombies.length > 360 && qualityManager.level !== "low") {
    qualityManager.level = "low";
    qualityManager.fpsLowTimer = 0;
    qualityManager.fpsHighTimer = 0;
    applyQualitySettings();
    return;
  }

  qualityManager.evaluationTimer -= dt;
  if (qualityManager.evaluationTimer > 0) {
    return;
  }

  qualityManager.evaluationTimer = 0.75;

  const lowFpsThreshold = mobileTuned ? 48 : 40;
  const highFpsThreshold = mobileTuned ? 58 : 55;
  if (perfStats.fpsAverage < lowFpsThreshold) {
    qualityManager.fpsLowTimer += 0.75;
    qualityManager.fpsHighTimer = 0;
  } else if (perfStats.fpsAverage > highFpsThreshold && effects.length < qualityManager.effectBudget * 0.45) {
    qualityManager.fpsHighTimer += 0.75;
    qualityManager.fpsLowTimer = 0;
  } else {
    qualityManager.fpsLowTimer = Math.max(0, qualityManager.fpsLowTimer - 0.75);
    qualityManager.fpsHighTimer = Math.max(0, qualityManager.fpsHighTimer - 0.75);
  }

  const downgradeDelay = mobileTuned ? 0.75 : 1.5;
  if (qualityManager.fpsLowTimer >= downgradeDelay && qualityManager.level === "high") {
    qualityManager.level = "medium";
    qualityManager.fpsLowTimer = 0;
    applyQualitySettings();
  } else if (qualityManager.fpsLowTimer >= downgradeDelay && qualityManager.level === "medium") {
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
    ["zombie", 140],
    ["runner", 120],
    ["brute", 112],
    ["caster", 112],
    ["cowWalker", 90],
    ["cowCharger", 78],
    ["cowBrute", 64],
    ["visor", 2],
    ["himetrica", 1],
    ["dinzo", 1],
    ["gitcity", 2],
    ["sofra", 1],
    ["angelSheep", 1],
    ["bloodCow", 1],
    ["plumaFinance", 1],
  ];

  for (const [type, count] of zombieWarmup) {
    for (let index = 0; index < count; index += 1) {
      releaseZombieMesh(createZombieMesh(type), type);
    }
  }

  for (let index = 0; index < 80; index += 1) {
    releaseProjectileMesh(createPooledProjectileMesh(), entityPools.bullets);
  }

  for (let index = 0; index < 56; index += 1) {
    releaseProjectileMesh(createPooledProjectileMesh(), entityPools.enemyProjectiles);
  }

  for (let index = 0; index < 180; index += 1) {
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

  for (let index = 0; index < 18; index += 1) {
    releaseTrapMesh(createPooledTrapMesh());
  }

  for (let index = 0; index < 54; index += 1) {
    releaseDamageNumberSprite(createDamageNumberSprite());
  }

  entityPools.prewarmed = true;
}

function recordPoolExpansion(poolName) {
  perfStats.poolExpansions[poolName] = (perfStats.poolExpansions[poolName] || 0) + 1;
}

function getCharacterState() {
  return {
    selected: selectedCharacter, loading: characterLoading, error: characterError,
    characters: Object.values(playableCharacters).map(profile => ({ ...profile, ready: readyCharacters.has(profile.id) })),
  };
}

function announceCharacter() {
  window.dispatchEvent(new CustomEvent('bipx:character-change', { detail: getCharacterState() }));
}

async function selectCharacter(id) {
  if (!playableCharacters[id] || game.state === 'playing') return false;
  characterPreview = true;
  if (id === player.character && heroVisual && !characterLoading) return true;
  const version = ++characterLoadVersion;
  const previous = player.character;
  selectedCharacter = id;
  characterLoading = true;
  characterError = null;
  announceCharacter();
  const fallback = player.mesh.children.filter(child => !child.isLight && !child.userData.contactShadow && child !== heroVisual?.root);
  try {
    const visual = await loadPlayableCharacter(id, { THREE, parent: player.mesh });
    if (version !== characterLoadVersion) { visual.dispose(); return false; }
    weaponFireEmitter?.dispose(); weaponFireEmitter = null;
    heroVisual?.dispose(); heroVisual = visual;
    for (const child of fallback) child.visible = false;
    player.character = id;
    player.weapon = playableCharacters[id].weaponId;
    player.weaponTimer = 0;
    player.mesh.userData.swordBlade = id === 'warrior' ? visual.weapon : null;
    combatVfx.setSoulSource(visual.root);
    pendingSwordStrike = null; swordSwingRemaining = 0;
    readyCharacters.add(id);
    try { localStorage.setItem('bipx-character', id); } catch { /* Optional persistence. */ }
    updateHud(true);
    sendMultiplayerState();
    return true;
  } catch (error) {
    if (version !== characterLoadVersion) return false;
    selectedCharacter = previous;
    characterError = error.message;
    console.error(`Character ${id} failed to load`, error);
    return false;
  } finally {
    if (version === characterLoadVersion) { characterLoading = false; announceCharacter(); }
  }
}

async function loadGameVisuals() {
  animatedEnemies = createAnimatedEnemies({ THREE, scene });
  await Promise.allSettled([
    selectCharacter(selectedCharacter),
    loadEnemyLibrary({ THREE }).then(library => animatedEnemies.register('orc', library)).catch(error => {
      visualAssetErrors.push(`orc: ${error.message}`);
      console.error('Orc visuals failed to load', error);
    }),
    loadMonsterLibrary({ THREE }).then(library => animatedEnemies.register('monsters', library)).catch(error => {
      visualAssetErrors.push(`monsters: ${error.message}`);
      console.error('Monster visuals failed to load', error);
    }),
    loadEnemyLodLibrary({ THREE }).then(library => {
      enemyLodLibrary = library;
      // Detach first: animated actors must not retain the procedural children
      // in their fallback snapshots when the native static layer is installed.
      for (const zombie of zombies) {
        if (!enemyLodProfiles[zombie.type]) continue;
        animatedEnemies.remove(zombie);
        upgradeZombieLodMesh(zombie.mesh, zombie.type);
        setZombieLod(zombie.mesh, zombie.renderMode === 'proxy');
      }
      for (const [type, pool] of entityPools.zombies) {
        if (enemyLodProfiles[type]) for (const mesh of pool) upgradeZombieLodMesh(mesh, type);
      }
      for (const [type, bucket] of monsterRenderer.instanced) {
        if (!enemyLodProfiles[type]) continue;
        for (const mesh of [bucket.mesh, bucket.headMesh, bucket.armMesh]) {
          if (mesh) { mesh.removeFromParent(); mesh.dispose(); }
        }
        monsterRenderer.instanced.delete(type);
      }
      window.__zombieNightDebug.getEnemyLodStats = () => ({
        ...library.getStats(),
        entities: zombies.filter(zombie => enemyLodProfiles[zombie.type]).map(zombie => ({
          id: zombie.id, type: zombie.type, mode: zombie.renderMode, visible: zombie.mesh.visible,
          animated: Boolean(zombie.mesh.userData.animatedEnemy), instanced: zombie.renderedAsInstance,
          native: Boolean(zombie.mesh.userData.staticEnemyLod),
          detailVisible: zombie.mesh.userData.staticEnemyLod?.detail.visible,
          proxyVisible: zombie.mesh.userData.staticEnemyLod?.proxy.visible,
          obsoleteChildren: zombie.mesh.children.filter(child => !child.userData.nativeEnemyLod && !child.userData.eliteMarker && child !== zombie.mesh.userData.animatedEnemy?.root).length,
        })),
        buckets: [...monsterRenderer.instanced].map(([type, bucket]) => ({ type, native: Boolean(bucket.nativeLod), count: bucket.count, capacity: bucket.capacity, triangles: bucket.nativeLod?.stats.triangles ?? null })),
      });
    }).catch(error => {
      visualAssetErrors.push(`enemy LODs: ${error.message}`);
      console.error('Static enemy visuals failed to load', error);
    }),
    loadAssetDressing({ THREE, scene, trees: scene.userData.treePositions, lanterns: cemetery.lanternPositions }).then(visuals => {
      worldVisuals = visuals;
      for (const mesh of scene.userData.treePlaceholders) mesh.visible = false;
      for (const mesh of cemetery.lanternPlaceholders) mesh.visible = false;
      worldAtmosphere.patchObject(visuals.group);
    }).catch(error => {
      visualAssetErrors.push(`environment: ${error.message}`);
      console.error('Environment visuals failed to load', error);
    }),
  ]);
}

function buildWorld() {
  cemetery = createCemetery({ THREE, scene });
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
    cemetery.groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x403423, roughness: 0.88 });
  const fence = new THREE.InstancedMesh(
    getSharedGeometry("world-fence-post", () => new THREE.BoxGeometry(0.42, 1.8, 0.42)),
    fenceMaterial,
    72,
  );
  fence.castShadow = true;
  fence.receiveShadow = true;
  let fenceInstance = 0;
  for (let index = 0; index < 18; index += 1) {
    setStaticInstance(fence, fenceInstance, index * 6.5 - 55, 0.9, -58, 0);
    fenceInstance += 1;
    setStaticInstance(fence, fenceInstance, index * 6.5 - 55, 0.9, 58, 0);
    fenceInstance += 1;
    setStaticInstance(fence, fenceInstance, -58, 0.9, index * 6.5 - 55, 0);
    fenceInstance += 1;
    setStaticInstance(fence, fenceInstance, 58, 0.9, index * 6.5 - 55, 0);
    fenceInstance += 1;
  }
  fence.count = fenceInstance;
  fence.instanceMatrix.needsUpdate = true;
  scene.add(fence);

  const graveMaterial = cemetery.graveMaterial;
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x244848, roughness: 0.88 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x394648, roughness: 0.88 });
  const graves = new THREE.InstancedMesh(
    getSharedGeometry("world-grave-arched", () => {
      const arch = new THREE.Shape();
      arch.moveTo(-.58, -.9); arch.lineTo(.58, -.9); arch.lineTo(.58, .37);
      arch.quadraticCurveTo(.58, .9, 0, .95); arch.quadraticCurveTo(-.58, .9, -.58, .37);
      arch.closePath();
      const geometry = new THREE.ExtrudeGeometry(arch, { depth: .24, bevelEnabled: true, bevelThickness: .045, bevelSize: .04, bevelSegments: 2, curveSegments: 10, steps: 1 });
      geometry.translate(0, 0, -.12);
      return geometry;
    }),
    graveMaterial,
    52,
  );
  const trunks = new THREE.InstancedMesh(
    getSharedGeometry("world-tree-trunk", () => new THREE.CylinderGeometry(0.28, 0.38, 2.4, 7)),
    trunkMaterial,
    14,
  );
  const crowns = new THREE.InstancedMesh(
    getSharedGeometry("world-tree-crown", () => new THREE.ConeGeometry(1.55, 3.1, 8)),
    treeMaterial,
    14,
  );
  graves.castShadow = true;
  graves.receiveShadow = true;
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  let graveInstance = 0;
  let treeInstance = 0;
  const treePositions = [];

  for (let index = 0; index < 52; index += 1) {
    const angle = index * 2.38;
    const distance = 11 + (index % 9) * 4.2;
    const x = Math.cos(angle) * distance + ((index % 3) - 1) * 2.1;
    const z = Math.sin(angle) * distance + (((index + 1) % 4) - 1.5) * 1.8;

    if (Math.abs(x) < 7 && Math.abs(z) < 7) {
      continue;
    }

    if (index % 5 === 0) {
      treePositions.push(new THREE.Vector3(x, 0, z));
      setStaticInstance(trunks, treeInstance, x, 1.2, z, angle);
      setStaticInstance(crowns, treeInstance, x, 3.2, z, angle);
      treeInstance += 1;
    } else {
      setStaticInstance(graves, graveInstance, x, 0.9, z, angle + Math.PI * 0.5);
      graves.setColorAt(graveInstance, new THREE.Color().setHSL(.13, .06 + (index % 3) * .025, .62 + (index % 5) * .055));
      graveInstance += 1;
    }
  }
  graves.count = graveInstance;
  trunks.count = treeInstance;
  crowns.count = treeInstance;
  graves.instanceMatrix.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(graves);
  scene.add(trunks);
  scene.add(crowns);
  scene.userData.treePositions = treePositions;
  scene.userData.treePlaceholders = [trunks, crowns];

  const reticle = new THREE.Mesh(
    new THREE.TorusGeometry(0.65, 0.035, 8, 42),
    new THREE.MeshBasicMaterial({ color: 0xa1e6e6, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  reticle.name = "reticle";
  reticle.rotation.x = Math.PI * 0.5;
  reticle.position.set(0, 0.06, -6);
  scene.add(reticle);
  worldAtmosphere = createWorldAtmosphere({ THREE, moon });
  for (const object of scene.children) if (object !== player.mesh) worldAtmosphere.patchObject(object);
}

function setStaticInstance(mesh, index, x, y, z, rotationY) {
  tempQuaternion.setFromAxisAngle(upVector, rotationY);
  tempMatrix.compose(tempVectorA.set(x, y, z), tempQuaternion, tempScale);
  mesh.setMatrixAt(index, tempMatrix);
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
  group.userData.swordBlade = swordBlade;
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

  // Put feet and hands under actual joint pivots so the held weapon moves with
  // its grip, and the boot follows the leg rather than sliding independently.
  const pivot = (x, y, z, parts) => {
    const joint = new THREE.Group(); joint.position.set(x, y, z); group.add(joint);
    for (const part of parts) { part.position.sub(joint.position); joint.add(part); }
    return joint;
  };
  const leftHip = pivot(-.22, .78, .02, [leftLeg, leftBoot]);
  const rightHip = pivot(.22, .78, .02, [rightLeg, rightBoot]);
  // Reposition the grip onto the existing right hand before parenting it.
  const handOffset = rightHand.position.clone();
  for (const part of [hilt, guard, swordBlade, bladeLight]) {
    part.position.x += .6;
    part.position.y -= .13;
    part.position.sub(handOffset);
    rightHand.add(part);
  }
  leftArm.position.set(-.65, 1.18, -.36); leftArm.rotation.x = .8;
  rightArm.position.set(.65, 1.18, -.36); rightArm.rotation.x = .8;
  const leftElbow = pivot(-.65, 1.42, -.08, [leftArm, leftHand]);
  const rightElbow = pivot(.65, 1.42, -.08, [rightArm, rightHand]);
  group.userData.locomotion = { leftHip, rightHip, leftElbow, rightElbow, backPanel };

  const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vUv; void main(){float d=length((vUv-.5)*2.); gl_FragColor=vec4(.015,.024,.027,(1.-smoothstep(.08,1.,d))*.38);}',
  }));
  contact.userData.contactShadow = true;
  contact.rotation.x = -Math.PI / 2; contact.position.y = .035; group.add(contact);

  return group;
}

function createZombieMesh(type = "zombie") {
  if (monsterProfiles[type]?.boss) {
    return createBossMesh(type);
  }

  if (cowMonsterTypes.has(type)) {
    return createCowMonsterMesh(type);
  }

  const group = new THREE.Group();
  group.userData.lodState = "detail";
  const palette = commonMonsterPalettes[type] ?? commonMonsterPalettes.zombie;
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
  group.userData.animatedParts = { leftArm, rightArm, head };

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
  }

  attachEliteMarker(group);
  attachZombieLodProxy(group, type, palette, bodyRadius, bodyHeight);
  return group;
}

function createCowMonsterMesh(type = "cowWalker") {
  const group = new THREE.Group();
  group.userData.lodState = "detail";
  const palette = commonMonsterPalettes[type] ?? commonMonsterPalettes.cowWalker;
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.82 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xf7e8b8, roughness: 0.62 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7c2c9, roughness: 0.42, metalness: 0.35 });
  const eye = new THREE.MeshStandardMaterial({ color: palette.eye, emissive: palette.eye, emissiveIntensity: 1.25 });
  const { bodyRadius, bodyHeight } = getCommonMonsterBodySpec(type);
  const brute = type === "cowBrute";
  const charger = type === "cowCharger";

  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius * 0.78, bodyRadius, bodyHeight, 9), skin);
  body.position.y = brute ? 1.08 : 0.92;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(bodyRadius * 1.25, bodyHeight * 0.42, 0.12), dark);
  belly.position.set(0, body.position.y + 0.06, -bodyRadius * 0.74);
  belly.castShadow = true;
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(brute ? 0.58 : 0.44, 16, 11), skin);
  head.position.set(0, brute ? 2.08 : charger ? 1.72 : 1.82, -0.18);
  head.scale.set(1.05, 0.9, 1.15);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.66 : 0.5, 0.22, 0.34), dark);
  snout.position.set(0, head.position.y - 0.06, -0.55);
  group.add(snout);

  for (const side of [-1, 1]) {
    const hornMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, brute ? 0.72 : 0.48, 8), horn);
    hornMesh.position.set(side * (brute ? 0.36 : 0.28), head.position.y + 0.36, -0.1);
    hornMesh.rotation.z = side * -0.72;
    hornMesh.castShadow = true;
    group.add(hornMesh);

    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
    eyeMesh.position.set(side * 0.16, head.position.y + 0.06, -0.56);
    group.add(eyeMesh);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, brute ? 1.25 : 1.02, 0.26), skin);
    arm.position.set(side * (brute ? 0.86 : 0.66), brute ? 1.14 : 1.0, -0.22);
    arm.rotation.z = side * 0.18;
    arm.rotation.x = -0.42;
    arm.castShadow = true;
    group.add(arm);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.32 : 0.24, 0.78, 0.28), dark);
    leg.position.set(side * (brute ? 0.36 : 0.24), 0.26, 0.08);
    leg.castShadow = true;
    group.add(leg);

    if (side > 0 || brute) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, brute ? 1.7 : 1.25, 8), dark);
      handle.position.set(side * (brute ? 1.18 : 0.88), brute ? 1.08 : 0.94, -0.62);
      handle.rotation.z = side * 0.34;
      handle.rotation.x = Math.PI * 0.5;
      group.add(handle);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.58 : 0.42, brute ? 0.48 : 0.34, 0.11), metal);
      blade.position.set(side * (brute ? 1.38 : 1.02), brute ? 1.5 : 1.22, -1.08);
      blade.rotation.z = side * -0.2;
      group.add(blade);
    }
  }

  group.userData.animatedParts = {
    leftArm: group.children.find((child) => child.position?.x < -0.5 && child.geometry?.type === "BoxGeometry"),
    rightArm: group.children.find((child) => child.position?.x > 0.5 && child.geometry?.type === "BoxGeometry"),
    head,
  };
  attachEliteMarker(group);
  attachZombieLodProxy(group, type, palette, bodyRadius, bodyHeight);
  return group;
}

function getCommonMonsterBodySpec(type) {
  const bodyRadius = type === "runner" || type === "cowCharger" ? 0.44 : type === "brute" || type === "cowBrute" ? 0.9 : 0.62;
  const bodyHeight = type === "brute" || type === "cowBrute" ? 1.72 : type === "runner" || type === "cowCharger" ? 1.32 : 1.45;
  return { bodyRadius, bodyHeight };
}

function attachEliteMarker(group) {
  const marker = new THREE.Mesh(
    getSharedGeometry("elite-marker-ring", () => new THREE.TorusGeometry(0.72, 0.045, 8, 28)),
    new THREE.MeshBasicMaterial({ color: 0xffd36d, transparent: true, opacity: 0.72 }),
  );
  marker.name = "elite-marker";
  marker.rotation.x = Math.PI * 0.5;
  marker.position.y = 0.08;
  marker.visible = false;
  marker.userData.eliteMarker = true;
  marker.userData.eliteActive = false;
  group.add(marker);
}

function attachZombieLodProxy(group, type, palette, bodyRadius, bodyHeight) {
  const detailChildren = [...group.children];
  const proxy = createZombieLodProxy(type, palette, bodyRadius, bodyHeight);
  group.userData.detailChildren = detailChildren;
  group.userData.lodProxy = proxy;
  group.add(proxy);
}

function createZombieLodProxy(type, palette, bodyRadius, bodyHeight) {
  const proxy = new THREE.Mesh(
    getSharedGeometry(`zombie-proxy-merged-${type}`, () => createZombieProxyGeometry(type, palette, bodyRadius, bodyHeight)),
    getZombieProxyMergedMaterial(),
  );
  proxy.name = "zombie-lod-proxy";
  proxy.visible = false;
  proxy.userData.isLodProxy = true;
  return proxy;
}

function createZombieProxyGeometry(type, palette, bodyRadius, bodyHeight) {
  const bodyY = getCommonMonsterProxyYOffset(type);
  const headY = getCommonMonsterHeadYOffset(type);
  const geometries = [
    createColoredProxyPart(
      new THREE.CylinderGeometry(bodyRadius * 0.82, bodyRadius * 0.96, bodyHeight + 0.55, 5),
      tempColor.setHex(palette.cloth).lerp(tempColorB.setHex(palette.skin), 0.42).multiplyScalar(1.48),
      new THREE.Matrix4().makeTranslation(0, bodyY, 0),
    ),
    createColoredProxyPart(
      new THREE.SphereGeometry(bodyRadius * 0.52, 8, 6),
      tempColor.setHex(palette.skin).lerp(tempColorB.setHex(palette.eye), 0.12).multiplyScalar(1.36),
      new THREE.Matrix4().makeTranslation(0, headY, -bodyRadius * 0.18),
    ),
  ];

  const armGeometry = new THREE.CylinderGeometry(bodyRadius * 0.14, bodyRadius * 0.18, bodyHeight * 0.64, 5);
  const armColor = tempColor.setHex(palette.cloth).lerp(tempColorB.setHex(palette.skin), 0.3).multiplyScalar(1.34);
  for (const side of [-1, 1]) {
    geometries.push(
      createColoredProxyPart(
        armGeometry,
        armColor,
        new THREE.Matrix4()
          .makeRotationZ(side * -0.22)
          .premultiply(
            new THREE.Matrix4().makeTranslation(
              side * bodyRadius * 0.78,
              bodyY + bodyHeight * 0.03,
              -bodyRadius * 0.06,
            ),
          ),
      ),
    );
  }

  armGeometry.dispose();
  return mergeColoredProxyGeometries(geometries);
}

function createColoredProxyPart(geometry, color, matrix) {
  const workingGeometry = geometry.toNonIndexed();
  workingGeometry.applyMatrix4(matrix);
  const positions = workingGeometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  workingGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return workingGeometry;
}

function mergeColoredProxyGeometries(geometries) {
  const totalVertices = geometries.reduce((total, geometry) => total + geometry.getAttribute("position").count, 0);
  const positions = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 3);
  let offset = 0;

  for (const geometry of geometries) {
    const geometryPositions = geometry.getAttribute("position").array;
    const geometryColors = geometry.getAttribute("color").array;
    positions.set(geometryPositions, offset * 3);
    colors.set(geometryColors, offset * 3);
    offset += geometry.getAttribute("position").count;
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function getZombieProxyMergedMaterial() {
  if (!assetCache.materials.has("zombie-proxy-merged")) {
    assetCache.materials.set(
      "zombie-proxy-merged",
      new THREE.MeshBasicMaterial({
        fog: true,
        vertexColors: true,
      }),
    );
  }

  return assetCache.materials.get("zombie-proxy-merged");
}

function getZombieProxyMaterial(type, palette) {
  const key = `zombie-proxy-${type}`;
  if (!assetCache.materials.has(key)) {
    const color = tempColor.setHex(palette.cloth).lerp(tempColorB.setHex(palette.skin), 0.42).multiplyScalar(1.48).clone();
    assetCache.materials.set(
      key,
      new THREE.MeshBasicMaterial({
        color,
        fog: true,
      }),
    );
  }

  return assetCache.materials.get(key);
}

function getZombieProxyHeadMaterial(type, palette) {
  const key = `zombie-proxy-head-${type}`;
  if (!assetCache.materials.has(key)) {
    const color = tempColor.setHex(palette.skin).lerp(tempColorB.setHex(palette.eye), 0.12).multiplyScalar(1.36).clone();
    assetCache.materials.set(
      key,
      new THREE.MeshBasicMaterial({
        color,
        fog: true,
      }),
    );
  }

  return assetCache.materials.get(key);
}

function getZombieInstanceMaterial(type, palette) {
  const key = `zombie-instance-${type}`;
  if (!assetCache.materials.has(key)) {
    assetCache.materials.set(
      key,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        fog: true,
        vertexColors: true,
      }),
    );
  }

  return assetCache.materials.get(key);
}

function isCommonMonsterType(type) {
  return commonMonsterTypes.has(type);
}

function getCommonMonsterProxyYOffset(type) {
  return type === "brute" || type === "cowBrute" ? 1.15 : 1;
}

function getCommonMonsterHeadYOffset(type) {
  const { bodyHeight } = getCommonMonsterBodySpec(type);
  return getCommonMonsterProxyYOffset(type) + bodyHeight * 0.56 + 0.42;
}

function getInstancedMonsterBucket(type) {
  if (monsterRenderer.instanced.has(type)) {
    return monsterRenderer.instanced.get(type);
  }

  const nativeProfile = enemyLodProfiles[type];
  if (enemyLodLibrary && nativeProfile) {
    const nativeLod = enemyLodLibrary.get(nativeProfile.id);
    const capacity = 800;
    const mesh = enemyLodLibrary.createInstancedMesh(nativeProfile.id, capacity);
    scene.add(mesh);
    const bucket = { capacity, count: 0, armCount: 0, mesh, nativeLod, height: nativeProfile.height };
    monsterRenderer.instanced.set(type, bucket);
    return bucket;
  }

  const { bodyRadius, bodyHeight } = getCommonMonsterBodySpec(type);
  const palette = commonMonsterPalettes[type] ?? commonMonsterPalettes.zombie;
  const capacity = 420;
  const mesh = new THREE.InstancedMesh(
    getSharedGeometry(`zombie-instance-${type}`, () =>
      new THREE.CylinderGeometry(bodyRadius * 0.82, bodyRadius * 0.96, bodyHeight + 0.55, 5),
    ),
    getZombieInstanceMaterial(type, palette),
    capacity,
  );
  const headMesh = new THREE.InstancedMesh(
    getSharedGeometry(`zombie-instance-head-${type}`, () => new THREE.SphereGeometry(bodyRadius * 0.52, 8, 6)),
    getZombieInstanceMaterial(`${type}-head`, palette),
    capacity,
  );
  const armMesh = new THREE.InstancedMesh(
    getSharedGeometry(`zombie-instance-arm-${type}`, () =>
      new THREE.CylinderGeometry(bodyRadius * 0.14, bodyRadius * 0.18, bodyHeight * 0.64, 5),
    ),
    getZombieInstanceMaterial(`${type}-arm`, palette),
    capacity * 2,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  armMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  headMesh.castShadow = false;
  headMesh.receiveShadow = false;
  armMesh.castShadow = false;
  armMesh.receiveShadow = false;
  mesh.frustumCulled = false;
  headMesh.frustumCulled = false;
  armMesh.frustumCulled = false;
  mesh.count = 0;
  headMesh.count = 0;
  armMesh.count = 0;
  scene.add(mesh);
  scene.add(headMesh);
  scene.add(armMesh);

  const bucket = { capacity, count: 0, armCount: 0, mesh, headMesh, armMesh };
  monsterRenderer.instanced.set(type, bucket);
  return bucket;
}

function resetInstancedMonsterBuckets() {
  for (const bucket of monsterRenderer.instanced.values()) {
    bucket.count = 0;
    bucket.armCount = 0;
    bucket.mesh.count = 0;
    if (bucket.headMesh) bucket.headMesh.count = 0;
    if (bucket.armMesh) bucket.armMesh.count = 0;
  }
}

function syncMonsterRenderer() {
  monsterRenderer.frame += 1;
  const shouldRefreshModes = monsterRenderer.frame % getMonsterLodInterval() === 0;
  perfStats.visibleDetailedZombies = 0;
  perfStats.instancedZombies = 0;
  resetInstancedMonsterBuckets();

  if (shouldRefreshModes) {
    assignMonsterRenderModes();
  }

  for (const zombie of zombies) {
    zombie.renderedAsInstance = false;
    if (enemyLodLibrary && enemyLodProfiles[zombie.type]) {
      upgradeZombieLodMesh(zombie.mesh, zombie.type);
      zombie.mesh.position.y = 0;
    }

    if (!isCommonMonsterType(zombie.type)) {
      zombie.mesh.visible = true;
      if (zombie.mesh.userData.staticEnemyLod) setZombieLod(zombie.mesh, false);
      zombie.renderVisibleFrame = monsterRenderer.frame;
      continue;
    }

    const mode = zombie.renderMode || "detail";
    if (mode === "instanced") {
      zombie.mesh.visible = false;
      if (addInstancedMonster(zombie)) {
        continue;
      }

      zombie.mesh.visible = true;
      zombie.renderMode = "proxy";
      setZombieLod(zombie.mesh, true);
      updateZombieShadow(zombie, "proxy");
      zombie.renderVisibleFrame = monsterRenderer.frame;
      continue;
    }

    zombie.mesh.visible = true;
    setZombieLod(zombie.mesh, mode === "proxy");
    updateZombieShadow(zombie, mode);
    zombie.renderVisibleFrame = monsterRenderer.frame;
    if (mode === "detail") {
      perfStats.visibleDetailedZombies += 1;
    }
  }

  for (const bucket of monsterRenderer.instanced.values()) {
    bucket.mesh.count = bucket.count;
    if (bucket.headMesh) bucket.headMesh.count = bucket.count;
    if (bucket.armMesh) bucket.armMesh.count = bucket.armCount;
    bucket.mesh.instanceMatrix.needsUpdate = true;
    if (bucket.headMesh) bucket.headMesh.instanceMatrix.needsUpdate = true;
    if (bucket.armMesh) bucket.armMesh.instanceMatrix.needsUpdate = true;
    if (bucket.mesh.instanceColor) {
      bucket.mesh.instanceColor.needsUpdate = true;
    }
    if (bucket.headMesh?.instanceColor) {
      bucket.headMesh.instanceColor.needsUpdate = true;
    }
    if (bucket.armMesh?.instanceColor) {
      bucket.armMesh.instanceColor.needsUpdate = true;
    }
  }
}

function getMonsterLodInterval() {
  if (isLateGamePerformanceMode()) {
    return usesMobileTuning() ? 7 : 5;
  }

  return usesMobileTuning() ? 6 : 4;
}

function assignMonsterRenderModes() {
  if (shouldKeepFullMonsterMeshes()) {
    for (const zombie of zombies) {
      if (isCommonMonsterType(zombie.type)) {
        zombie.renderMode = "detail";
      }
    }
    return;
  }

  const budget = getMonsterLodBudget();
  const common = monsterRenderer.temporaryObjects;
  common.length = 0;
  refreshLivingPlayerTargets();

  for (const zombie of zombies) {
    if (!isCommonMonsterType(zombie.type)) {
      continue;
    }

    zombie.lodDistanceSq = distanceXZSquared(player.position, zombie.mesh.position);
    zombie.threatDistanceSq = getClosestLivingTargetDistanceSq(zombie.mesh.position);
    common.push(zombie);
  }

  common.sort((first, second) => first.lodDistanceSq - second.lodDistanceSq);
  let detailed = 0;
  let proxy = 0;

  for (const zombie of common) {
    if (zombie.threatDistanceSq <= budget.closeThreatDistanceSq) {
      if (detailed < budget.detailCount) {
        zombie.renderMode = "detail";
        detailed += 1;
      } else {
        zombie.renderMode = "proxy";
        proxy += 1;
      }
    } else if (zombie.lodDistanceSq <= budget.detailDistanceSq && detailed < budget.detailCount) {
      zombie.renderMode = "detail";
      detailed += 1;
    } else if (zombie.lodDistanceSq <= budget.proxyDistanceSq && proxy < budget.proxyCount) {
      zombie.renderMode = "proxy";
      proxy += 1;
    } else {
      zombie.renderMode = "instanced";
    }
  }
}

function shouldKeepFullMonsterMeshes() {
  // Detailed nearby silhouettes remain intact; large hordes use the existing
  // distance/threat tiers by default, rather than requiring a debug URL flag.
  if (queryParams.get('monsterLod') === '0') return true;
  if (queryParams.get('monsterLod') === '1') return false;
  return zombies.length <= (usesMobileTuning() ? 18 : 32) && qualityManager.level !== 'low';
}

function getMonsterLodBudget() {
  const mobile = usesMobileTuning();

  if (isLateGamePerformanceMode()) {
    const detailDistance = mobile ? 9.5 : 12.5;
    const proxyDistance = mobile ? 34 : 42;
    const closeThreatDistance = mobile ? 7.2 : 8.5;
    return {
      detailCount: mobile ? 10 : 20,
      proxyCount: mobile ? 72 : 120,
      detailDistanceSq: detailDistance * detailDistance,
      proxyDistanceSq: proxyDistance * proxyDistance,
      closeThreatDistanceSq: closeThreatDistance * closeThreatDistance,
    };
  }

  const detailDistance = getZombieDetailDistance();
  const proxyDistance = detailDistance * (zombies.length > 70 ? 2.4 : 2.8);
  const closeThreatDistance = mobile ? 4.4 : 5;
  return {
    detailCount: mobile ? 12 : 24,
    proxyCount: mobile ? 70 : 112,
    detailDistanceSq: detailDistance * detailDistance,
    proxyDistanceSq: proxyDistance * proxyDistance,
    closeThreatDistanceSq: closeThreatDistance * closeThreatDistance,
  };
}

function isLateGamePerformanceMode() {
  if (!runtimeReady) {
    return false;
  }

  return player.level >= 16 || zombies.length > 110;
}

function getMaxActiveZombies() {
  const profile = getMobileLayoutProfile();
  if (qualityManager.level === "low") {
    return profile === "desktop" ? 460 : profile === "mobilePro" ? 360 : 315;
  }

  if (profile === "mobilePro") {
    return 420;
  }

  if (profile === "mobile") {
    return 360;
  }

  if (profile === "tablet") {
    return 470;
  }

  return 560;
}

function addInstancedMonster(zombie) {
  const bucket = getInstancedMonsterBucket(zombie.type);
  if (bucket.count >= bucket.capacity) {
    perfStats.objectAllocWarnings += 1;
    return false;
  }

  if (bucket.nativeLod) {
    tempQuaternion.setFromAxisAngle(upVector, zombie.mesh.rotation.y);
    tempVectorA.set(zombie.mesh.position.x, 0, zombie.mesh.position.z);
    tempScale.copy(zombie.mesh.scale).multiplyScalar(bucket.height);
    tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
    bucket.mesh.setMatrixAt(bucket.count, tempMatrix);
    bucket.mesh.setColorAt(bucket.count, tempColor.setHex(0xffffff));
    bucket.count += 1;
    zombie.renderedAsInstance = true;
    zombie.renderVisibleFrame = monsterRenderer.frame;
    perfStats.instancedZombies += 1;
    return true;
  }

  tempQuaternion.setFromAxisAngle(upVector, zombie.mesh.rotation.y);
  tempVectorA.set(
    zombie.mesh.position.x,
    zombie.mesh.position.y + getCommonMonsterProxyYOffset(zombie.type),
    zombie.mesh.position.z,
  );
  tempScale.set(1, 1, 1);
  tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
  bucket.mesh.setMatrixAt(bucket.count, tempMatrix);
  bucket.mesh.setColorAt(bucket.count, getMonsterInstanceColor(zombie));
  tempVectorA.y = zombie.mesh.position.y + getCommonMonsterHeadYOffset(zombie.type);
  tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
  bucket.headMesh.setMatrixAt(bucket.count, tempMatrix);
  bucket.headMesh.setColorAt(bucket.count, getMonsterInstanceHeadColor(zombie));
  addInstancedMonsterArms(bucket, zombie);
  bucket.count += 1;
  zombie.renderedAsInstance = true;
  zombie.renderVisibleFrame = monsterRenderer.frame;
  perfStats.instancedZombies += 1;
  return true;
}

function addInstancedMonsterArms(bucket, zombie) {
  const { bodyRadius, bodyHeight } = getCommonMonsterBodySpec(zombie.type);
  const armY = zombie.mesh.position.y + getCommonMonsterProxyYOffset(zombie.type) + bodyHeight * 0.03;
  const cos = Math.cos(zombie.mesh.rotation.y);
  const sin = Math.sin(zombie.mesh.rotation.y);

  for (const side of [-1, 1]) {
    const localX = side * bodyRadius * 0.78;
    const localZ = -bodyRadius * 0.06;
    tempVectorA.set(
      zombie.mesh.position.x + cos * localX - sin * localZ,
      armY,
      zombie.mesh.position.z + sin * localX + cos * localZ,
    );
    tempQuaternion.setFromEuler(tempEuler.set(0, zombie.mesh.rotation.y, side * -0.22, "YXZ"));
    tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
    bucket.armMesh.setMatrixAt(bucket.armCount, tempMatrix);
    bucket.armMesh.setColorAt(bucket.armCount, getMonsterInstanceColor(zombie));
    bucket.armCount += 1;
  }
}

function getMonsterInstanceColor(zombie) {
  if (zombie.eliteType) {
    return tempColor.setHex(eliteProfiles[zombie.eliteType]?.color ?? 0xffd36d);
  }

  const palette = commonMonsterPalettes[zombie.type] ?? commonMonsterPalettes.zombie;
  const base = zombie.variantColor ?? palette.cloth;
  return tempColor.setHex(base).lerp(tempColorB.setHex(palette.skin), 0.24).multiplyScalar(1.18);
}

function getMonsterInstanceHeadColor(zombie) {
  const palette = commonMonsterPalettes[zombie.type] ?? commonMonsterPalettes.zombie;
  if (zombie.eliteType) {
    return tempColor.setHex(eliteProfiles[zombie.eliteType]?.color ?? 0xffd36d).lerp(tempColorB.setHex(palette.skin), 0.18);
  }

  return tempColor.setHex(palette.skin).lerp(tempColorB.setHex(palette.eye), 0.14).multiplyScalar(1.16);
}

function updateZombieShadow(zombie, mode) {
  const shadowDistance = qualityManager.level === "high" ? 24 : qualityManager.level === "medium" ? 13 : 0;
  const wantsShadow =
    mode === "detail" && shadowDistance > 0 && distanceXZSquared(player.position, zombie.mesh.position) < shadowDistance * shadowDistance;

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

function getMonsterRenderIntegrity() {
  refreshLivingPlayerTargets();

  let invisibleZombies = 0;
  let invisibleThreats = 0;
  let closeInstancedThreats = 0;
  let renderedAsMesh = 0;
  let renderedAsInstance = 0;

  for (const zombie of zombies) {
    const meshVisible = zombie.mesh.visible === true;
    const instanceVisible = isCommonMonsterType(zombie.type) && zombie.renderedAsInstance === true;
    const threatDistanceSq = getClosestLivingTargetDistanceSq(zombie.mesh.position);
    const closeThreatRadius = Math.max(1.25, (zombie.radius || 0.7) + 1.05);
    const closeThreat = threatDistanceSq <= closeThreatRadius * closeThreatRadius;
    const rangedThreat = canUseRangedAttack(zombie.type, Math.sqrt(threatDistanceSq));

    if (meshVisible) {
      renderedAsMesh += 1;
    }

    if (instanceVisible) {
      renderedAsInstance += 1;
    }

    if (!meshVisible && !instanceVisible) {
      invisibleZombies += 1;
      if (closeThreat || rangedThreat) {
        invisibleThreats += 1;
      }
    }

    if (instanceVisible && closeThreat) {
      closeInstancedThreats += 1;
    }
  }

  return {
    activeZombies: zombies.length,
    renderedAsMesh,
    renderedAsInstance,
    invisibleZombies,
    invisibleThreats,
    closeInstancedThreats,
    objectAllocWarnings: perfStats.objectAllocWarnings,
  };
}

function createBossMesh(type) {
  if (type === "sofra") {
    return createSofraMesh();
  }

  if (type === "angelSheep") {
    return createAngelSheepMesh();
  }

  if (type === "bloodCow") {
    return createBloodCowMesh();
  }

  if (type === "plumaFinance") {
    return createPlumaFinanceMesh();
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

  return group;
}

function createAngelSheepMesh() {
  const group = new THREE.Group();
  const wool = new THREE.MeshStandardMaterial({ color: 0xfff7df, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xc58a22, emissiveIntensity: 0.35, roughness: 0.48 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd7b58a, roughness: 0.72 });
  const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fbff, transparent: true, opacity: 0.82 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f2720, roughness: 0.72 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), wool);
  body.position.y = 2.0;
  body.scale.set(1.38, 0.92, 1.02);
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 11), skin);
  head.position.set(0, 2.25, -1.18);
  head.scale.set(0.95, 0.88, 1.12);
  head.castShadow = true;
  group.add(head);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.045, 8, 42), gold);
  halo.position.set(0, 3.05, -1.1);
  halo.rotation.x = Math.PI * 0.5;
  group.add(halo);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.9, 4, 1, true), wingMaterial);
    wing.position.set(side * 1.45, 2.16, 0.16);
    wing.rotation.z = side * -0.95;
    wing.rotation.y = side * 0.22;
    group.add(wing);

    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.56, 8), gold);
    horn.position.set(side * 0.26, 2.62, -1.24);
    horn.rotation.z = side * -0.54;
    group.add(horn);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dark);
    eye.position.set(side * 0.16, 2.28, -1.62);
    group.add(eye);
  }

  group.userData.flying = true;
  return group;
}

function createBloodCowMesh() {
  const group = createCowMonsterMesh("cowBrute");
  group.scale.setScalar(1.45);
  group.traverse((child) => {
    if (!child.isMesh || child.userData.eliteMarker) {
      return;
    }
    if (child.material?.color) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(0x8e1014), 0.45);
      if (child.material.emissive) {
        child.material.emissive.setHex(0x3d0306);
        child.material.emissiveIntensity = 0.35;
      }
    }
  });

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.76, 5),
    new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff1d1d, emissiveIntensity: 0.28, roughness: 0.5 }),
  );
  crown.position.set(0, 3.0, -0.18);
  crown.rotation.y = Math.PI / 5;
  group.add(crown);
  return group;
}

function createPlumaFinanceMesh() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5a7cff, emissive: 0x272d94, emissiveIntensity: 0.45, roughness: 0.56 });
  const chestMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0x6a2200, emissiveIntensity: 0.38, roughness: 0.62 });
  const wingBlue = new THREE.MeshBasicMaterial({ color: 0x74d1ff, transparent: true, opacity: 0.84 });
  const wingPink = new THREE.MeshBasicMaterial({ color: 0xff69d2, transparent: true, opacity: 0.78 });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xffd84a, roughness: 0.48 });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8ffcff, emissiveIntensity: 0.8 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.86, 18, 12), bodyMaterial);
  body.position.y = 2.05;
  body.scale.set(1.05, 1.22, 0.82);
  body.castShadow = true;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), chestMaterial);
  chest.position.set(0, 1.86, -0.52);
  chest.scale.set(0.9, 0.72, 0.38);
  group.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 10), bodyMaterial);
  head.position.set(0, 2.88, -0.08);
  head.castShadow = true;
  group.add(head);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 10), beakMaterial);
  beak.position.set(0, 2.86, -0.52);
  beak.rotation.x = Math.PI * 0.5;
  group.add(beak);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.8, 4, 1, true), side < 0 ? wingBlue : wingPink);
    wing.position.set(side * 1.0, 2.0, 0.06);
    wing.rotation.z = side * -1.18;
    wing.rotation.y = side * 0.25;
    group.add(wing);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMaterial);
    eye.position.set(side * 0.15, 2.93, -0.43);
    group.add(eye);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 5, 1, true), wingPink);
  tail.position.set(0, 1.9, 0.72);
  tail.rotation.x = -Math.PI * 0.35;
  group.add(tail);
  group.userData.flying = true;
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

  if (type === "thunderstaff") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.55, 10), metal);
    staff.rotation.z = Math.PI * 0.12;
    staff.position.y = 0.78;
    staff.castShadow = true;
    group.add(staff);

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glow);
    crystal.position.set(0.18, 1.55, 0);
    crystal.castShadow = true;
    group.add(crystal);

    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 6, 24, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.78 }),
    );
    arc.position.y = 1.34;
    arc.rotation.x = Math.PI * 0.5;
    arc.rotation.z = -0.4;
    group.add(arc);
  }

  if (type === "boneCannon") {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.18, 12), glow);
    barrel.rotation.z = Math.PI * 0.5;
    barrel.position.y = 0.78;
    barrel.castShadow = true;
    group.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.18), metal);
    grip.position.set(-0.34, 0.54, 0);
    grip.rotation.z = -0.18;
    grip.castShadow = true;
    group.add(grip);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow);
    skull.position.set(0.68, 0.78, 0);
    group.add(skull);
  }

  if (type === "frostNova") {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), glow);
    orb.position.y = 0.9;
    orb.castShadow = true;
    group.add(orb);

    for (const angle of [0, Math.PI * 0.5, Math.PI]) {
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.026, 8, 32),
        new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.66 }),
      );
      ringMesh.position.y = 0.9;
      ringMesh.rotation.x = Math.PI * 0.5;
      ringMesh.rotation.z = angle;
      group.add(ringMesh);
    }
  }

  // Drop identity already comes from emissive meshes and its ground ring.
  // Adding/removing a scene light here changes every lit shader's light count.

  return group;
}

function createPerkDropMesh(rarity = "rare") {
  const style = getRarityStyle(rarity);
  const group = new THREE.Group();
  const color = style.color;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  core.position.y = 0.78;
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.045, 8, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = 0.12;
  group.add(ring);

  if (style.animated) {
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.035, 8, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 }),
    );
    halo.rotation.x = Math.PI * 0.5;
    halo.position.y = 0.78;
    group.add(halo);
  }

  return group;
}

function createBossRewardChestMesh(bossType = "boss") {
  const color = monsterProfiles[bossType]?.projectileColor ?? rarityStyles.rare.color;
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.52, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x322326, roughness: 0.5, metalness: 0.18 }),
  );
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.22, 0.68),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.65, roughness: 0.42 }),
  );
  const lock = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.08),
    new THREE.MeshBasicMaterial({ color: rarityStyles.rare.color }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.045, 8, 40),
    new THREE.MeshBasicMaterial({ color: rarityStyles.rare.color, transparent: true, opacity: 0.74 }),
  );

  base.position.y = 0.42;
  lid.position.y = 0.78;
  lock.position.set(0, 0.55, -0.35);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = 0.1;
  group.add(base, lid, lock, ring);
  return group;
}

function createHealthPotionMesh() {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: 0xff4f68,
    emissive: 0xb6102e,
    emissiveIntensity: 0.72,
    roughness: 0.34,
    transparent: true,
    opacity: 0.92,
  });
  const cork = new THREE.MeshStandardMaterial({ color: 0x8b5a36, roughness: 0.72 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff5f7a, transparent: true, opacity: 0.72 });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 36), ringMaterial);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = 0.08;
  group.add(ring);

  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.7, 14), glass);
  bottle.position.y = 0.66;
  bottle.castShadow = true;
  group.add(bottle);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.34, 12), glass);
  neck.position.y = 1.17;
  neck.castShadow = true;
  group.add(neck);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 10), cork);
  cap.position.y = 1.44;
  cap.castShadow = true;
  group.add(cap);

  const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.035), white);
  crossVertical.position.set(0, 0.68, -0.345);
  group.add(crossVertical);

  const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.035), white);
  crossHorizontal.position.set(0, 0.68, -0.35);
  group.add(crossHorizontal);

  return group;
}

function createPowerupLabelSprite(type) {
  return createDropLabelSprite({
    label: getPowerupDropLabel(type),
    rarity: "common",
    icon: hudWeaponIcons[type] || "⚔",
  });
}

function createDropLabelSprite(drop) {
  const canvas = document.createElement("canvas");
  canvas.width = 448;
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
  sprite.scale.set(4.3, 4.3 * 128 / 448, 1);
  sprite.renderOrder = 24;
  sprite.userData = {
    canvas,
    context: canvas.getContext("2d"),
    drop,
    baseScaleX: 4.3,
    baseScaleY: 4.3 * 128 / 448,
    texture,
  };

  drawDropLabel(sprite, drop);
  return sprite;
}

function drawDropLabel(sprite, drop) {
  const { canvas, context, texture } = sprite.userData;
  const style = getRarityStyle(normalizeRarity(drop?.rarity));
  const parts = String(drop?.label || "Drop").split(" · ");
  const title = `${drop?.icon ? `${drop.icon} ` : ""}${parts.shift()}`;
  const detail = parts.join(" · ");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = style.glow;
  context.shadowBlur = style.animated ? 22 : 12;
  context.fillStyle = "rgba(18, 10, 12, 0.86)";
  context.fillRect(22, 18, 404, 92);
  context.strokeStyle = style.border;
  context.lineWidth = 2;
  context.strokeRect(22, 18, 404, 92);
  context.shadowBlur = 0;
  context.fillStyle = style.css;
  context.fillRect(28, 104, 392, 4);
  context.font = "900 13px Arial, Helvetica, sans-serif";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillText(style.label, 408, 31);
  context.shadowColor = "rgba(0, 0, 0, 0.82)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 2;
  context.fillStyle = "#fff5f3";
  context.textAlign = "center";
  let titleSize = 28;
  do { context.font = `900 ${titleSize}px Georgia, 'Times New Roman', serif`; }
  while (context.measureText(title).width > 376 && --titleSize > 20);
  context.fillText(title, 224, detail ? 58 : 68, 376);
  if (detail) {
    context.font = "700 20px Arial, Helvetica, sans-serif";
    context.fillText(detail, 224, 86, 376);
  }
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  texture.needsUpdate = true;
}

function createDamageNumberSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 80;
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
  sprite.scale.set(1.55, 0.78, 1);
  sprite.renderOrder = 32;
  sprite.visible = false;
  sprite.userData = {
    canvas,
    context: canvas.getContext("2d"),
    texture,
  };
  return sprite;
}

function drawDamageNumber(sprite, amount, crit, variant = "enemy") {
  const { canvas, context, texture } = sprite.userData;
  const isPlayerDamage = variant === "playerDamage";
  const value = Math.max(1, Math.ceil(amount));
  const displayValue = isPlayerDamage ? `-${value}` : value.toString();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = crit || isPlayerDamage ? "1000 42px Inter, Arial, sans-serif" : "950 36px Inter, Arial, sans-serif";
  context.lineWidth = crit || isPlayerDamage ? 8 : 7;
  context.strokeStyle = "rgba(0, 0, 0, 0.86)";
  context.shadowColor = isPlayerDamage ? "rgba(255, 57, 57, 0.74)" : crit ? "rgba(255, 216, 74, 0.72)" : "rgba(255, 255, 255, 0.32)";
  context.shadowBlur = crit || isPlayerDamage ? 14 : 8;
  context.strokeText(displayValue, 80, 40);
  context.fillStyle = isPlayerDamage ? "#ff3b3b" : crit ? "#ffd84a" : "#ffffff";
  context.fillText(displayValue, 80, 40);
  context.shadowBlur = 0;
  texture.needsUpdate = true;
}

function acquireDamageNumberSprite(amount, crit, variant = "enemy") {
  const sprite = entityPools.damageNumbers.pop() ?? createDamageNumberSprite();
  if (!sprite.parent) {
    scene.add(sprite);
  }
  sprite.visible = true;
  sprite.material.opacity = 1;
  drawDamageNumber(sprite, amount, crit, variant);
  return sprite;
}

function releaseDamageNumberSprite(sprite) {
  if (!sprite) {
    return;
  }
  scene.remove(sprite);
  sprite.visible = false;
  sprite.position.set(9999, 9999, 9999);
  sprite.scale.set(1.55, 0.78, 1);
  sprite.material.opacity = 1;
  entityPools.damageNumbers.push(sprite);
}

function spawnDamageNumber(position, amount, crit = false, zombieId = null, variant = "enemy") {
  const now = performance.now();
  const mergeTarget =
    zombieId == null || variant !== "enemy"
      ? null
      : damageNumbers.find((number) => number.zombieId === zombieId && now - number.createdAt < damageNumberMergeWindowMs);

  if (mergeTarget) {
    mergeTarget.amount += amount;
    mergeTarget.crit = mergeTarget.crit || crit;
    drawDamageNumber(mergeTarget.sprite, mergeTarget.amount, mergeTarget.crit, mergeTarget.variant);
    return;
  }

  if (damageNumbers.length >= getDamageNumberBudget()) {
    return;
  }

  const sprite = acquireDamageNumberSprite(amount, crit, variant);
  sprite.position.set(
    position.x + (Math.random() - 0.5) * 0.38,
    position.y + (variant === "playerDamage" ? 2.95 : crit ? 2.55 : 2.25),
    position.z + (Math.random() - 0.5) * 0.38,
  );
  const baseScale = variant === "playerDamage" ? 1.34 : crit ? 1.28 : 1;
  sprite.scale.set(1.55 * baseScale, 0.78 * baseScale, 1);
  damageNumbers.push({
    sprite,
    amount,
    crit,
    variant,
    zombieId,
    age: 0,
    createdAt: now,
    driftX: (Math.random() - 0.5) * 0.26,
    driftZ: (Math.random() - 0.5) * 0.26,
    baseScale,
  });
}

function getDamageNumberBudget() {
  if (isLateGamePerformanceMode()) {
    return usesMobileTuning() ? 28 : 42;
  }

  return usesMobileTuning() ? 38 : 64;
}

function updateDamageNumbers(dt) {
  for (let index = damageNumbers.length - 1; index >= 0; index -= 1) {
    const number = damageNumbers[index];
    number.age += dt;
    const progress = Math.min(1, number.age / damageNumberLifetime);
    const pop = 1 + Math.sin(progress * Math.PI) * (number.crit ? 0.24 : 0.14);
    number.sprite.position.y += dt * (1.18 + progress * 0.9);
    number.sprite.position.x += number.driftX * dt;
    number.sprite.position.z += number.driftZ * dt;
    number.sprite.scale.set(1.55 * number.baseScale * pop, 0.78 * number.baseScale * pop, 1);
    number.sprite.material.opacity = Math.max(0, 1 - Math.max(0, progress - 0.58) / 0.42);

    if (number.age >= damageNumberLifetime) {
      const [expired] = damageNumbers.splice(index, 1);
      releaseDamageNumberSprite(expired.sprite);
    }
  }
}

function getPowerupDropLabel(type) {
  const relicName = getRelicName(type, player.character);
  if (relicName) return `Relíquia · ${relicName}`;
  return player.character === 'warrior' ? 'Lâmina encantada · +40% dano' : 'Munição reforçada · +40% dano';
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

  upgradeZombieLodMesh(mesh, type);
  mesh.visible = true;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  setZombieLod(mesh, false);
  setEliteMarker(mesh, null);
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
  if (pool === entityPools.bullets) {
    mesh.geometry = getSharedGeometry('rifle-tracer', () => new THREE.CylinderGeometry(.025, .04, .75, 6));
    mesh.scale.set(1, 1, 1);
  } else mesh.scale.setScalar(radius / 0.3);
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
  mesh.rotation.set(0, 0, 0);
  pool.push(mesh);
}

function createBoletoProjectileMesh() {
  const group = new THREE.Group();
  const paperMaterial = new THREE.MeshBasicMaterial({ color: 0xd7d2c8 });
  const grayMaterial = new THREE.MeshBasicMaterial({ color: 0x8d9097 });
  const redMaterial = new THREE.MeshBasicMaterial({ color: 0xc72f35 });
  const inkMaterial = new THREE.MeshBasicMaterial({ color: 0x22252a });

  for (let cardIndex = 0; cardIndex < 3; cardIndex += 1) {
    const card = new THREE.Group();
    card.position.set((cardIndex - 1) * 0.16, cardIndex % 2 === 0 ? 0 : 0.07, (cardIndex - 1) * 0.07);
    card.rotation.z = (cardIndex - 1) * 0.16;

    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.035, 0.44),
      cardIndex === 1 ? paperMaterial : grayMaterial,
    );
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.07), redMaterial);
    stripe.position.set(0, 0.03, -0.15);

    card.add(sheet, stripe);

    for (let lineIndex = 0; lineIndex < 5; lineIndex += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.16), inkMaterial);
      bar.position.set(-0.22 + lineIndex * 0.055, 0.035, 0.1);
      card.add(bar);
    }

    group.add(card);
  }

  group.userData.enemyProjectileVisual = "boleto";
  group.scale.setScalar(0.92);
  return group;
}

function createLightningProjectileMesh() {
  const group = new THREE.Group();
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff45c });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.72 });
  const points = [
    [-0.18, -0.48],
    [0.16, -0.18],
    [-0.08, 0.12],
    [0.2, 0.48],
  ];

  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    const [startX, startZ] = points[pointIndex];
    const [endX, endZ] = points[pointIndex + 1];
    const deltaX = endX - startX;
    const deltaZ = endZ - startZ;
    const length = Math.hypot(deltaX, deltaZ);
    const angle = Math.atan2(deltaX, deltaZ);
    const segment = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, length), coreMaterial);
    segment.position.set((startX + endX) * 0.5, 0, (startZ + endZ) * 0.5);
    segment.rotation.y = angle;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, length * 1.08), glowMaterial);
    glow.position.copy(segment.position);
    glow.rotation.copy(segment.rotation);
    group.add(glow, segment);
  }

  group.userData.enemyProjectileVisual = "lightning";
  group.scale.setScalar(1.05);
  return group;
}

function createEvilEyeProjectileMesh() {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0x1457ff }));
  const white = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.065, 32), new THREE.MeshBasicMaterial({ color: 0xf8fbff }));
  const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.075, 32), new THREE.MeshBasicMaterial({ color: 0x42b8ff }));
  const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.085, 24), new THREE.MeshBasicMaterial({ color: 0x06121f }));
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));

  white.position.y = 0.025;
  iris.position.y = 0.055;
  pupil.position.y = 0.085;
  shine.position.set(0.055, 0.13, -0.055);
  group.add(outer, white, iris, pupil, shine);
  group.userData.enemyProjectileVisual = "evilEye";
  return group;
}

function createBriefcaseProjectileMesh() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x3f4754 });
  const lidMaterial = new THREE.MeshBasicMaterial({ color: 0x273140 });
  const metalMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.34), bodyMaterial);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.36), lidMaterial);
  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), metalMaterial);
  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), metalMaterial.clone());
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.045), metalMaterial.clone());
  const claspLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), metalMaterial.clone());
  const claspRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), metalMaterial.clone());

  lid.position.y = 0.24;
  leftPost.position.set(-0.17, 0.36, -0.02);
  rightPost.position.set(0.17, 0.36, -0.02);
  handle.position.set(0, 0.47, -0.02);
  claspLeft.position.set(-0.12, 0.03, -0.2);
  claspRight.position.set(0.12, 0.03, -0.2);
  group.add(body, lid, leftPost, rightPost, handle, claspLeft, claspRight);
  group.userData.enemyProjectileVisual = "briefcase";
  group.scale.setScalar(0.86);
  return group;
}

function createTinyAirplaneProjectileMesh() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xdcecff });
  const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x64b5ff });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x102438 });
  const propellerMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5a8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.74), bodyMaterial);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 10), bodyMaterial);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.18), wingMaterial);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.12), wingMaterial);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), wingMaterial);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.16), windowMaterial);
  const propeller = new THREE.Group();
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.025), propellerMaterial);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.025), propellerMaterial.clone());

  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.47;
  wings.position.z = 0.02;
  tailWing.position.z = -0.34;
  tailFin.position.set(0, 0.13, -0.34);
  cockpit.position.set(0, 0.12, 0.14);
  propeller.position.z = 0.59;
  propeller.add(bladeA, bladeB);
  group.add(body, nose, wings, tailWing, tailFin, cockpit, propeller);
  group.userData.enemyProjectileVisual = "airplane";
  group.userData.propeller = propeller;
  group.scale.setScalar(0.62);
  return group;
}

function createFeatherProjectileMesh() {
  const group = new THREE.Group();
  const featherMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1ba, transparent: true, opacity: 0.9 });
  const spineMaterial = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.86 });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.82), spineMaterial);
  const left = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 4, 1, true), featherMaterial);
  const right = left.clone();
  left.position.set(-0.11, 0, 0);
  left.rotation.z = 0.34;
  right.position.set(0.11, 0, 0);
  right.rotation.z = -0.34;
  group.add(left, right, spine);
  group.scale.setScalar(0.9);
  group.userData.enemyProjectileVisual = "feather";
  return group;
}

function createTornadoProjectileMesh() {
  const group = new THREE.Group();
  for (let index = 0; index < 4; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38 + index * 0.17, 0.035, 8, 36),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xff69d2 : 0x74d1ff, transparent: true, opacity: 0.62 - index * 0.08, wireframe: true }),
    );
    ring.position.y = 0.18 + index * 0.24;
    ring.rotation.x = Math.PI * 0.5;
    ring.rotation.z = index * 0.42;
    ring.userData.baseOpacity = 0.62 - index * 0.08;
    group.add(ring);
  }

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 1.35, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x8b5cff, transparent: true, opacity: 0.22 }),
  );
  core.position.y = 0.58;
  core.userData.baseOpacity = 0.22;
  group.add(core);
  group.userData.enemyProjectileVisual = "tornado";
  group.scale.setScalar(1.1);
  return group;
}

function getEnemyProjectileSpec(type) {
  if (type === "angelSheep") {
    return {
      kind: "feather",
      color: 0xfff1ba,
      speed: 16.5,
      radius: 0.44,
      height: 2.35,
      spawnOffset: 1.25,
      lifespan: 2.35,
      impactRadius: 2.65,
    };
  }

  if (type === "plumaFinance") {
    return {
      kind: "tornado",
      color: 0x8b5cff,
      speed: 7.2,
      radius: 0.86,
      height: 0.74,
      spawnOffset: 1.35,
      lifespan: 4.8,
      impactRadius: 3.8,
      homing: true,
    };
  }

  if (type === "dinzo") {
    return {
      kind: "boleto",
      color: 0xc93337,
      speed: 14.5,
      radius: 0.52,
      height: 1.22,
      spawnOffset: 1.05,
      lifespan: 2.55,
      impactRadius: 2.6,
    };
  }

  if (type === "himetrica") {
    return {
      kind: "lightning",
      color: 0xfff45c,
      speed: 22,
      radius: 0.42,
      height: 1.48,
      spawnOffset: 1.0,
      lifespan: 1.9,
      impactRadius: 2.9,
    };
  }

  if (type === "visor") {
    return {
      kind: "evilEye",
      color: 0x42b8ff,
      speed: 13,
      radius: 0.54,
      height: 1.46,
      spawnOffset: 1.05,
      lifespan: 2.45,
      impactRadius: 2.5,
      homing: true,
    };
  }

  if (type === "sofra") {
    return {
      kind: "briefcase",
      color: 0x32b8ff,
      speed: 23,
      radius: 0.56,
      height: 1.34,
      spawnOffset: 1.1,
      lifespan: 2.25,
      impactRadius: 3.0,
    };
  }

  if (type === "gitcity") {
    return {
      kind: "airplane",
      color: 0xb9dcff,
      speed: 18,
      radius: 0.42,
      height: 1.75,
      spawnOffset: 1.2,
      lifespan: 2.7,
      impactRadius: 3.1,
      homing: true,
    };
  }

  const profile = monsterProfiles[type] ?? monsterProfiles.caster;
  return {
    kind: "orb",
    color: profile.projectileColor ?? 0xd978ff,
    speed: 14,
    radius: 0.42,
    height: 1.38,
    spawnOffset: 0.9,
    lifespan: 2.25,
    impactRadius: 2.4,
  };
}

function createEnemyProjectileVisual(spec) {
  if (spec.kind === "boleto") {
    return { mesh: createBoletoProjectileMesh(), pooled: false };
  }

  if (spec.kind === "lightning") {
    return { mesh: createLightningProjectileMesh(), pooled: false };
  }

  if (spec.kind === "evilEye") {
    return { mesh: createEvilEyeProjectileMesh(), pooled: false };
  }

  if (spec.kind === "briefcase") {
    return { mesh: createBriefcaseProjectileMesh(), pooled: false };
  }

  if (spec.kind === "airplane") {
    return { mesh: createTinyAirplaneProjectileMesh(), pooled: false };
  }

  if (spec.kind === "feather") {
    return { mesh: createFeatherProjectileMesh(), pooled: false };
  }

  if (spec.kind === "tornado") {
    return { mesh: createTornadoProjectileMesh(), pooled: false };
  }

  return {
    mesh: acquireProjectileMesh(entityPools.enemyProjectiles, spec.color, spec.radius),
    pooled: true,
  };
}

function releaseEnemyProjectileVisual(projectile) {
  if (!projectile) {
    return;
  }

  if (projectile.pooled) {
    releaseProjectileMesh(projectile.mesh, entityPools.enemyProjectiles);
    return;
  }

  scene.remove(projectile.mesh);
  disposeObject(projectile.mesh);
}

function animateEnemyProjectileVisual(projectile, dt) {
  const mesh = projectile.mesh;
  const phase = projectile.phase ?? 0;
  const bob = Math.sin(projectile.age * 12 + phase) * 0.06;
  mesh.position.y = projectile.baseY + bob;

  if (projectile.visualKind === "boleto") {
    mesh.rotation.x = Math.sin(projectile.age * 9 + phase) * 0.2;
    mesh.rotation.z = Math.sin(projectile.age * 16 + phase) * 0.32;
    return;
  }

  if (projectile.visualKind === "lightning") {
    const pulse = 1 + Math.sin(projectile.age * 38 + phase) * 0.08;
    mesh.scale.setScalar(projectile.baseScale * pulse);
    mesh.rotation.z = Math.sin(projectile.age * 30 + phase) * 0.18;
    return;
  }

  if (projectile.visualKind === "evilEye") {
    mesh.rotation.y += dt * 4.2;
    mesh.rotation.z += dt * 2.8;
    return;
  }

  if (projectile.visualKind === "briefcase") {
    mesh.rotation.x += dt * 5.6;
    mesh.rotation.z = Math.sin(projectile.age * 10 + phase) * 0.28;
    return;
  }

  if (projectile.visualKind === "airplane") {
    mesh.rotation.x = Math.sin(projectile.age * 8 + phase) * 0.08;
    mesh.rotation.z = Math.sin(projectile.age * 11 + phase) * 0.22;
    mesh.userData.propeller.rotation.z += dt * 34;
    return;
  }

  if (projectile.visualKind === "feather") {
    mesh.rotation.x = Math.sin(projectile.age * 11 + phase) * 0.16;
    mesh.rotation.z += dt * 7.5;
    return;
  }

  if (projectile.visualKind === "tornado") {
    mesh.rotation.y += dt * 5.8;
    const pulse = 1 + Math.sin(projectile.age * 8 + phase) * 0.08;
    mesh.scale.setScalar(projectile.baseScale * pulse);
  }
}

function getEnemyProjectileInstanceMesh() {
  if (enemyProjectileRenderer.mesh) {
    return enemyProjectileRenderer.mesh;
  }

  const mesh = new THREE.InstancedMesh(
    getSharedGeometry("enemy-projectile-instanced", () => new THREE.SphereGeometry(0.16, 8, 6)),
    createPooledMaterial(0xd978ff),
    enemyProjectileRenderer.capacity,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  enemyProjectileRenderer.mesh = mesh;
  return mesh;
}

function syncEnemyProjectileRenderer() {
  const mesh = getEnemyProjectileInstanceMesh();
  enemyProjectileRenderer.count = 0;

  if (!isLateGamePerformanceMode()) {
    mesh.count = 0;
    for (const projectile of enemyProjectiles) {
      projectile.mesh.visible = true;
    }
    return;
  }

  for (const projectile of enemyProjectiles) {
    const canInstance = projectile.pooled && projectile.visualKind === "orb";
    const useInstance = canInstance && enemyProjectileRenderer.count < enemyProjectileRenderer.capacity;
    projectile.mesh.visible = !useInstance;

    if (!useInstance) {
      continue;
    }

    const scale = projectile.mesh.scale.x;
    tempQuaternion.identity();
    tempVectorA.copy(projectile.mesh.position);
    tempScale.set(scale, scale, scale);
    tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
    mesh.setMatrixAt(enemyProjectileRenderer.count, tempMatrix);
    enemyProjectileRenderer.count += 1;
  }

  tempScale.set(1, 1, 1);
  mesh.count = enemyProjectileRenderer.count;
  mesh.instanceMatrix.needsUpdate = true;
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

function getXpGemInstanceMesh() {
  if (xpGemRenderer.mesh) {
    return xpGemRenderer.mesh;
  }

  const mesh = new THREE.InstancedMesh(
    getSharedGeometry("xp-gem-instanced", () => new THREE.OctahedronGeometry(0.24, 0)),
    createPooledMaterial(0x74d1ff),
    xpGemRenderer.capacity,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  xpGemRenderer.mesh = mesh;
  return mesh;
}

function syncXpGemRenderer() {
  const mesh = getXpGemInstanceMesh();
  xpGemRenderer.count = 0;

  if (!isLateGamePerformanceMode()) {
    mesh.count = 0;
    for (const gem of xpGems) {
      gem.mesh.visible = true;
    }
    return;
  }

  for (const gem of xpGems) {
    const useInstance = xpGemRenderer.count < xpGemRenderer.capacity;
    gem.mesh.visible = !useInstance;

    if (!useInstance) {
      continue;
    }

    const scale = gem.mesh.scale.x;
    tempQuaternion.setFromAxisAngle(upVector, gem.mesh.rotation.y);
    tempVectorA.set(gem.mesh.position.x, gem.mesh.position.y, gem.mesh.position.z);
    tempScale.set(scale, scale, scale);
    tempMatrix.compose(tempVectorA, tempQuaternion, tempScale);
    mesh.setMatrixAt(xpGemRenderer.count, tempMatrix);
    xpGemRenderer.count += 1;
  }

  tempScale.set(1, 1, 1);
  mesh.count = xpGemRenderer.count;
  mesh.instanceMatrix.needsUpdate = true;
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

function createPooledSparkleEffect() {
  const group = new THREE.Group();
  const material = createTransparentMaterial(0xffd76a, 0.86);
  for (let index = 0; index < 4; index += 1) {
    const sparkle = new THREE.Mesh(
      getSharedGeometry("effect-sparkle-dot", () => new THREE.SphereGeometry(0.07, 8, 6)),
      material,
    );
    const angle = (index / 4) * Math.PI * 2;
    sparkle.position.set(Math.cos(angle) * 0.32, 0.08 + index * 0.055, Math.sin(angle) * 0.32);
    sparkle.userData.baseOpacity = 0.86;
    group.add(sparkle);
  }
  group.userData.effectPoolType = "sparkle";
  return group;
}

function createPooledTrapMesh() {
  const group = new THREE.Group();
  const telegraph = new THREE.Mesh(
    getSharedGeometry("trap-telegraph-ring", () => new THREE.RingGeometry(0.58, 1, 42)),
    createTransparentMaterial(0xffd36d, 0.48),
  );
  const core = new THREE.Mesh(
    getSharedGeometry("trap-core-disc", () => new THREE.CircleGeometry(0.78, 42)),
    createTransparentMaterial(0xffd36d, 0.18),
  );
  const spikeA = new THREE.Mesh(
    getSharedGeometry("trap-spike-a", () => new THREE.ConeGeometry(0.12, 0.82, 7)),
    createTransparentMaterial(0xffd36d, 0.72),
  );
  const spikeB = spikeA.clone();
  telegraph.rotation.x = -Math.PI * 0.5;
  core.rotation.x = -Math.PI * 0.5;
  telegraph.position.y = 0.07;
  core.position.y = 0.065;
  spikeA.position.set(-0.34, 0.24, 0.12);
  spikeB.position.set(0.34, 0.24, -0.12);
  spikeA.visible = false;
  spikeB.visible = false;
  spikeA.userData.trapSpike = true;
  spikeB.userData.trapSpike = true;
  group.add(core, telegraph, spikeA, spikeB);
  group.userData.trapCore = core;
  group.userData.trapTelegraph = telegraph;
  return group;
}

function releaseTrapMesh(mesh) {
  if (!mesh) {
    return;
  }
  scene.remove(mesh);
  mesh.visible = false;
  mesh.position.set(9999, 9999, 9999);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.traverse((child) => {
    if (child.userData.trapSpike) {
      child.visible = false;
    }
  });
  entityPools.traps.push(mesh);
}

function acquireTrapMesh(color) {
  const mesh = entityPools.traps.pop() ?? createPooledTrapMesh();
  mesh.visible = true;
  mesh.traverse((child) => {
    if (child.material?.color) {
      child.material.color.setHex(color);
      child.material.opacity = child.userData.trapSpike ? 0.72 : child === mesh.userData.trapCore ? 0.18 : 0.48;
      child.material.userData.baseOpacity = child.material.opacity;
    }
  });
  return mesh;
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
  const dt = paused ? 0 : Math.min(rawDt, 0.035);
  const suspended = isMultiplayerSuspended();
  if (suspended) {
    clearPlayerInput();
    pendingSwordStrike = null; swordSwingRemaining = 0;
    playerMoveBlend = playerSwingTime = 0;
  }
  const frameStartedAt = performance.now();
  perfStats.dt = rawDt;
  perfStats.frameMs = rawDt * 1000;
  perfStats.labelUpdates = 0;
  perfStats.gridQueries = 0;
  const instantFps = rawDt > 0 ? 1 / rawDt : 60;
  perfStats.fpsAverage = perfStats.fpsAverage * 0.94 + instantFps * 0.06;
  updateQualityManager(rawDt);
  updateLabelThrottle(dt);
  const updateStartedAt = performance.now();

  if (game.state === "playing" && !paused && !suspended) {
    game.survivalTime += dt;
    if (game.perfStressImmortal) {
      updateAim();
      updateHud();
      updateLiveLeaderboardSync(dt);
    } else {
      updateAim();
      updatePlayer(dt);
      updateClassSkills(dt);
      updatePerks(dt);
      updatePowerups(dt);
      updateXpGems(dt);
      ensureSpatialGrid();
      updateActiveWeapon(dt);
      updateShooting(dt);
      updateAutoWeapons(dt);
      updateUpgradeChoices(dt);
      if (usesServerAuthoritativeWorld()) {
        updateServerWorldInterpolation(dt);
        rebuildSpatialGrid();
      } else {
        updateTraps(dt);
        updateSpawning(dt);
        updateTrapSpawner(dt);
        refreshLivingPlayerTargets();
        updateZombies(dt);
        rebuildSpatialGrid();
        refreshLivingPlayerTargets();
        updateEnemyProjectiles(dt);
        updateWaveFlow(dt);
      }
      updateBullets(dt);
      updateHud();
      updateLiveLeaderboardSync(dt);
    }
  } else {
    updateAim();
  }

  arpgHudTimer -= rawDt;
  const refreshArpgPresentation = arpgHudTimer <= 0;
  if (refreshArpgPresentation) publishArpgState();
  updateMultiplayer(Math.min(rawDt, .25));
  if (!paused) audioManager.update(dt);
  else audioManager.fadeMusicToSilence();
  audioManager.samples?.update({ playing: game.state === 'playing' && !isMultiplayerSuspended(), paused, muted: audioManager.muted });
  updateCamera(dt);
  updateEffects(dt);
  updateDamageNumbers(dt);
  if (!paused) animateProps(game.state === 'playing' ? game.survivalTime : clock.elapsedTime);
  sampleVisualMotion(heroVisualMotion, player.mesh.position, dt,
    game.state === 'playing' && !suspended, Math.max(24, player.speed * player.upgradeStats.speedMultiplier));
  heroVisualMotion.dead = game.state === 'dead' && !characterPreview;
  heroVisual?.update(dt, heroVisualMotion);
  syncPreparingWarCryTransforms(dt);
  syncDashTransforms();
  updateHeroFootsteps(dt);
  worldAtmosphere?.update();
  const skillAreas = syncPersistentSkillPresentation(refreshArpgPresentation);
  worldVisuals?.update(player.position, game.state === 'playing' && !paused, zombies, traps, skillAreas, remotePlayers.values(), camera, dt);
  if (game.state === 'playing') {
    const actors = [{ position: player.mesh.position, height: 3.2, radius: 2 }];
    for (const remote of remotePlayers.values()) if (remote.state === 'playing' && remote.health > 0)
      actors.push({ position: remote.mesh.position, height: 3.2, radius: 2 });
    worldLabelLayout.update({ camera, viewport: { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }, actors, drops: powerups });
  } else {
    worldLabelLayout.hide(powerups);
  }
  if (game.labelFrameReady && game.state === 'playing' && !paused) {
    const target = getClosestZombie(player.position, 20);
    combatVfx?.setTargets(target ? [{ id: target.zombie.id, position: target.zombie.mesh.position, locked: game.shooting }] : []);
  } else if (game.state !== 'playing') combatVfx?.setTargets([]);
  combatVfx?.update(dt, { camera, playerPosition: player.position, time: game.survivalTime });
  elementalVfx?.update(dt);
  classSkillVfx?.update(dt);
  syncArsenalPresentation(dt);
  syncMonsterRenderer();
  animatedEnemies?.update(zombies, { dt, playerPosition: player.position, mobile: usesMobileTuning(), quality: qualityManager.level });
  syncXpGemRenderer();
  withCasterProjectilePresentation([...enemyProjectiles, ...serverProjectileById.values()], () => {
    syncEnemyProjectileRenderer();
    perfStats.updateMs = performance.now() - updateStartedAt;
    perfStats.logicMs = perfStats.updateMs;
    const renderStartedAt = performance.now();
    cinematicPipeline.render(scene, camera, dt, classSkillVfx);
    perfStats.renderMs = performance.now() - renderStartedAt;
  });
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
  if (game.state === 'menu' || characterPreview) {
    tempVectorA.subVectors(camera.position, player.mesh.position); tempVectorA.y = 0;
    if (tempVectorA.lengthSq() > .01) player.mesh.rotation.y = getForwardRotation(tempVectorA);
    return;
  }
  if (player.character === 'warrior' && swordSwingRemaining > 0 && game.state === 'playing') {
    player.aimDirection.copy(swordSwingDirection);
    player.mesh.rotation.y = getForwardRotation(swordSwingDirection);
    return;
  }
  if (keyboardAimActive && !game.touchAimActive) {
    tempVectorC.set(Number(keys.has('KeyL')) - Number(keys.has('KeyJ')), 0, Number(keys.has('KeyK')) - Number(keys.has('KeyI')));
    if (tempVectorC.lengthSq() > 0 && performance.now() >= keyboardAimReleaseUntil) player.aimDirection.copy(tempVectorC.normalize());
  }
  if (keyboardAimActive || game.touchAimActive || game.touchVector.lengthSq() > 0.0025) {
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
  if (multiplayer.enabled && onlineSkillMotion) {
    const alpha = 1 - Math.exp(-dt * 35);
    player.position.x += (onlineSkillMotion.x - player.position.x) * alpha;
    player.position.z += (onlineSkillMotion.z - player.position.z) * alpha;
    player.mesh.position.copy(player.position);
    if (onlineSkillMotion.terminal && (classSkillState.lock <= 0 || onlineSkillMotion.free) && Math.hypot(player.position.x - onlineSkillMotion.x, player.position.z - onlineSkillMotion.z) < .03) onlineSkillMotion = null;
    return;
  }
  if (isSkillMoving(classSkillState)) return;
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
  playerMoveBlend += (Math.min(1, Math.sqrt(moveLengthSq)) - playerMoveBlend) * (1 - Math.exp(-dt * 12));
  if (moveLengthSq > 0) {
    if (moveLengthSq > 1) {
      move.normalize();
    }

  }

  const speed = player.speed * player.upgradeStats.speedMultiplier * getSkillModifiers(classSkillState).speed;
  const moved = stepActor(collisionWorld, { id: "player", x: player.position.x, z: player.position.z, radius: .64 }, { x: move.x * speed, z: move.z * speed }, dt);
  player.position.set(moved.x, 0, moved.z);

  player.mesh.position.copy(player.position);
}

function updateHeroFootsteps(dt) {
  const motion = heroVisual?.stats.locomotion;
  if (!motion) return;
  if (footstepVisual !== heroVisual || motion.footPlantSerial < footstepSerial) {
    footstepVisual = heroVisual;
    footstepSerial = motion.footPlantSerial;
    return;
  }
  if (dt > 0 && game.state === 'playing' && heroVisualMotion.speed > .2 && !heroVisualMotion.teleport) {
    for (const plant of motion.recentFootPlants) {
      if (plant.serial <= footstepSerial) continue;
      tempVectorA.fromArray(plant.position);
      tempVectorA.y = .06;
      combatVfx?.emit('dust', tempVectorA, { intensity: .25, direction: heroVisualMotion.velocity });
    }
  }
  footstepSerial = motion.footPlantSerial;
}

function updatePowerups(dt) {
  for (let index = powerups.length - 1; index >= 0; index -= 1) {
    const powerup = powerups[index];
    powerup.life = (powerup.life ?? 0) + dt;
    powerup.age += dt;
    powerup.mesh.rotation.y += dt * 1.9;
    powerup.mesh.position.y = powerup.baseY + Math.sin(powerup.age * 4.4) * 0.16;
    updatePowerupLabelPosition(powerup);
    animateDropLabel(powerup, dt);

    if (powerup.life >= (powerup.ttl ?? groundItemLifetime)) {
      removePowerup(index);
      continue;
    }

    if (distanceXZSquared(player.position, powerup.mesh.position) < powerup.radius * powerup.radius) {
      if (collectPowerup(powerup)) {
        removePowerup(index);
      }
    }
  }
}

function updatePerks(dt) {
  if (player.perkCooldowns.prismStorm > 0) {
    player.perkCooldowns.prismStorm = Math.max(0, player.perkCooldowns.prismStorm - dt);
  }

  if (!hasPerk("soulMagnet")) {
    return;
  }

  player.perkCooldowns.soulMagnet -= dt;
  if (player.perkCooldowns.soulMagnet > 0 || xpGems.length === 0) {
    return;
  }

  player.perkCooldowns.soulMagnet = Math.max(7.5, 18 - (player.perks.soulMagnet - 1) * 4);
  const pullRadius = 18 + player.perks.soulMagnet * 7;
  const pullRadiusSq = pullRadius * pullRadius;
  let pulled = 0;
  for (const gem of xpGems) {
    if (distanceXZSquared(player.position, gem.mesh.position) <= pullRadiusSq) {
      gem.mesh.position.lerp(player.position, 0.72);
      pulled += 1;
    }
  }

  if (pulled > 0) {
    triggerPerkAnimation("soulMagnet", player.position, "rare");
  }
}

function spawnXpGem(position, value = 3) {
  const gemValue = Math.max(1, Math.floor(value));
  if (xpGems.length >= getMaxVisibleXpGems()) {
    mergeXpIntoExistingGem(position, gemValue);
    audioManager.play("xpDrop", { value: gemValue, priority: 0 });
    return;
  }

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
  audioManager.play("xpDrop", { value: gemValue, priority: 0 });
}

function getMaxVisibleXpGems() {
  return isLateGamePerformanceMode() ? 120 : 180;
}

function mergeXpIntoExistingGem(position, value) {
  let target = xpGems[0];
  let closestDistanceSq = target ? distanceXZSquared(position, target.mesh.position) : Infinity;

  for (const gem of xpGems) {
    const distanceSq = distanceXZSquared(position, gem.mesh.position);
    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      target = gem;
    }
  }

  if (!target) {
    return;
  }

  target.value += value;
  target.radius = Math.min(1.25, target.radius + 0.025);
  const color = target.value >= 25 ? 0xffd36d : target.value >= 7 ? 0xd978ff : 0x74d1ff;
  target.mesh.material.color.setHex(color);
  target.mesh.material.emissive.setHex(color);
  target.mesh.scale.setScalar(Math.min(1.85, 1 + Math.log2(target.value + 1) * 0.12));
}

function updateXpGems(dt) {
  for (let index = xpGems.length - 1; index >= 0; index -= 1) {
    const gem = xpGems[index];
    gem.age += dt;
    const distanceSq = distanceXZSquared(player.position, gem.mesh.position);
    const farGem = isLateGamePerformanceMode() && distanceSq > 196;
    if (!farGem) {
      gem.mesh.rotation.y += dt * 3.1;
      gem.mesh.rotation.x += dt * 1.7;
      gem.mesh.position.y = gem.baseY + Math.sin(gem.age * 4.2) * 0.11;
    }

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
  if (multiplayer.enabled) return;
  const xpGain = Math.max(0, Math.floor(value));
  if (xpGain <= 0) {
    return;
  }

  player.xp += xpGain;
  audioManager.play("xp", { value: xpGain, priority: 1 });
  let leveledUp = false;

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.bestLevel = Math.max(player.bestLevel, player.level);
    player.xpToNext = getXpToNext(player.level);
    player.pendingLevelUps += 1;
    leveledUp = true;
    spawnLevelPulse();
    activateLevelUpPerks();
  }

  if (leveledUp) {
    audioManager.play("levelUp", { priority: 3 });
  }

  if (player.pendingLevelUps > 0 && player.pendingUpgradeChoices.length === 0) {
    openUpgradeChoices();
  }

  updateHud();
}

function getXpToNext(level) {
  return heroXpToNext(level); // Shared with authority.mjs through hero-power.mjs.
}

function activateLevelUpPerks() {
  if (multiplayer.enabled) return;
  if (hasPerk("prismStorm")) {
    player.perkCooldowns.prismStorm = 8;
    triggerPerkAnimation("prismStorm", player.position, "epic");
  }

  if (hasPerk("cuttingMoon")) {
    spawnCuttingMoonWave();
  }
}

function getXpValueForZombie(type, eliteType = null) {
  const profile = monsterProfiles[type] ?? monsterProfiles.zombie;
  const eliteMultiplier = eliteProfiles[eliteType]?.xpMultiplier ?? 1;

  if (profile.boss) {
    return Math.ceil(34 + Math.floor(player.wave * 2.5));
  }

  if (type === "brute" || type === "caster") {
    return Math.ceil((8 + Math.floor(player.wave * 0.35)) * eliteMultiplier);
  }

  if (type === "orcPeon" || type === "runner" || type === "cowCharger") {
    return Math.ceil((5 + Math.floor(player.wave * 0.2)) * eliteMultiplier);
  }

  if (cowMonsterTypes.has(type)) {
    return Math.ceil((7 + Math.floor(player.wave * 0.28)) * eliteMultiplier);
  }

  return Math.ceil((3 + Math.floor(player.wave * 0.12)) * eliteMultiplier);
}

function updateUpgradeChoices() {
  if (multiplayer.enabled) return;
  if (player.pendingLevelUps > 0 && player.pendingUpgradeChoices.length === 0) {
    openUpgradeChoices();
  }
}

function openUpgradeChoices(source = "level") {
  if (multiplayer.enabled) return;
  const choices = rollUpgradeChoices(source);
  if (choices.length === 0) {
    if (source === "level") grantExhaustedReward(player.pendingLevelUps);
    player.pendingLevelUps = 0;
    player.pendingUpgradeChoices = [];
    player.pendingUpgradeSource = "level";
  } else {
    player.pendingUpgradeChoices = choices;
    player.pendingUpgradeSource = source;
  }

  renderUpgradeChoices();
}

function openBossRewardChoices(bossType = "boss") {
  if (multiplayer.enabled) return false;
  if (player.pendingUpgradeChoices.length > 0) {
    return false;
  }

  const choices = rollUpgradeChoices("bossChest");
  if (choices.length === 0) {
    // Mirrors authority.mjs collectDrop: an exhausted chest still pays instead of lying on the ground.
    grantExhaustedReward(1);
    return true;
  }

  player.pendingUpgradeChoices = choices;
  player.pendingUpgradeSource = "bossChest";
  triggerPerkAnimation("bossChest", player.position, "rare", bossType);
  audioManager.play("bossChest", { priority: 3 });
  renderUpgradeChoices();
  return true;
}

// Nothing left to offer (every stack owned): surplus level-ups and boss chests pay a heal plus score, with a toast.
function grantExhaustedReward(count = 1) {
  const total = Math.max(0, Math.floor(count));
  if (total <= 0 || player.health <= 0) return;
  player.health = Math.min(player.maxHealth, player.health + player.maxHealth * EXHAUSTED_REWARD.healFraction * total);
  player.score += EXHAUSTED_REWARD.score * total;
  announceExhaustedReward(total);
}

function announceExhaustedReward(count = 1) {
  const heal = Math.round(EXHAUSTED_REWARD.healFraction * 100 * count), score = EXHAUSTED_REWARD.score * count;
  spawnTemporaryDropLabel(`${EXHAUSTED_REWARD.label.toUpperCase()}: +${heal}% VIDA · +${formatHudNumber(score)} PONTOS`, "legendary", "✦", player.position, 2.4);
  combatVfx?.emit('heal', player.position, { color: 0xf0bd6c, radius: 2.4 });
  audioManager.play("upgradeChoice", { rarity: "legendary", priority: 3 });
  pulseHealth();
  // After the current task: renderUpgradeChoices() clears this live region whenever the hand closes.
  queueMicrotask(() => { const announcement = document.querySelector('#upgrade-announcement');
    if (announcement) announcement.textContent = `${EXHAUSTED_REWARD.label}: todas as evoluções já são suas. Recebeu ${heal}% de vida e ${formatHudNumber(score)} pontos.`; });
  updateHud(true);
}

function rollUpgradeChoices(source = "level") {
  const minimumRarity = source === "bossChest" ? "rare" : "common";
  let available = upgradeDefinitions.filter((upgrade) => isUpgradeAvailable(upgrade, minimumRarity, source));
  if (available.length === 0) {
    return [];
  }

  const choices = [];
  const forceRare = source === "level" && player.rarityPity >= 8;
  while (choices.length < 3 && available.length > 0) {
    let pool = available;
    // Mirrors authority.mjs rollChoices: the first card always belongs to the class while any skill card is left.
    const classPool = choices.length === 0 ? available.filter((upgrade) => upgrade.kind === "skill") : [];
    if (classPool.length > 0) {
      pool = classPool;
    } else if (forceRare && choices.length === 0) {
      const rarePool = available.filter((upgrade) => getRarityRank(upgrade.rarity) >= getRarityRank("rare"));
      if (rarePool.length > 0) {
        pool = rarePool;
      }
    }

    const selected = pickWeightedUpgrade(pool, source, pool === classPool);
    if (!selected) {
      break;
    }

    choices.push(selected);
    available = available.filter((upgrade) => upgrade.id !== selected.id);
  }

  if (source === "level") {
    if (choices.some((upgrade) => getRarityRank(upgrade.rarity) >= getRarityRank("rare"))) {
      player.rarityPity = 0;
    } else {
      player.rarityPity += 1;
    }
  }

  return choices;
}

function pickWeightedUpgrade(upgrades, source = "level", classSlot = false) {
  const weighted = upgrades.map((upgrade) => ({
    upgrade,
    weight: getUpgradeRollWeight(upgrade, source, classSlot),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return upgrades[0] ?? null;
  }

  let roll = Math.random() * totalWeight;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.upgrade;
    }
  }

  return weighted[weighted.length - 1]?.upgrade ?? null;
}

function getUpgradeRollWeight(upgrade, source = "level", classSlot = false) {
  const rarity = normalizeRarity(upgrade.rarity);
  if (source === "bossChest") {
    return bossRewardRarityWeights[rarity] ?? 0;
  }

  if (classSlot) {
    return SKILL_UPGRADE_WEIGHTS[rarity] ?? 0;
  }

  return upgrade.weight ?? getRarityStyle(rarity).weight;
}

function isUpgradeAvailable(upgrade, minimumRarity = "common", source = "level") {
  if (player.character === 'warrior' && ['projectile', 'prismStorm'].includes(upgrade.id)) return false;
  if (!isUpgradeForClass(upgrade, player.character)) return false;
  if (getRarityRank(upgrade.rarity) < getRarityRank(minimumRarity)) {
    return false;
  }

  const ignoresMinLevel = source === "bossChest" && normalizeRarity(upgrade.rarity) !== "legendary";
  if (!ignoresMinLevel && player.level < (upgrade.minLevel ?? 1)) {
    return false;
  }

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

  if (multiplayer.enabled) {
    if (isMultiplayerSuspended() || pendingMultiplayerUpgrade || !multiplayerUpgradeOfferId || game.state !== 'playing') return;
    restoreMultiplayerUpgradeFocus = upgradeOptionsElement?.contains(document.activeElement) || false;
    pendingMultiplayerUpgrade = {
      type: 'chooseUpgrade', runId: multiplayerAuthorityRunId,
      offerId: multiplayerUpgradeOfferId, upgradeId: choice.id,
      requestId: crypto.randomUUID(), lastSentAt: -Infinity,
    };
    sendPendingProgressionCommands();
    renderUpgradeChoices();
    return;
  }

  audioManager.play("upgradeChoice", { rarity: choice.rarity, priority: 3 });
  applyUpgrade(choice);
  if (player.pendingUpgradeSource === "level") {
    player.pendingLevelUps = Math.max(0, player.pendingLevelUps - 1);
  }
  player.pendingUpgradeChoices = [];

  if (player.pendingLevelUps > 0) {
    openUpgradeChoices("level");
  } else {
    player.pendingUpgradeSource = "level";
    renderUpgradeChoices();
  }

  updateHud();
}

function applyUpgrade(upgrade) {
  if (multiplayer.enabled) return false;
  const currentStacks = player.upgradeStacks[upgrade.id] || 0;
  if (currentStacks >= upgrade.maxStacks) {
    return false;
  }

  player.upgradeStacks[upgrade.id] = currentStacks + 1;
  if (upgrade.kind === "skill") {
    // Stacks are the whole state: getPlayerSkillMods() derives the trusted mods for every cast and for the HUD.
    combatVfx?.emit('seal', player.position, { color: getRarityStyle(upgrade.rarity).color, radius: 1.6, intensity: .5 });
  }
  if (upgrade.kind === "perk") {
    player.perks[upgrade.id] = player.upgradeStacks[upgrade.id];
    applyPerkEffect(upgrade);
    triggerPerkAnimation(upgrade.id, player.position, upgrade.rarity);
  }

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

  tryEvolveWeapons();
  return true;
}

function getNextUnlockableAutoWeapon() {
  for (const weaponId of ["guardianBlade", "orbitOrb", "sealRain"]) {
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

  const restoreChoiceFocus = upgradeOptionsElement.contains(document.activeElement) || restoreMultiplayerUpgradeFocus;
  const waitingForServer = multiplayer.enabled && (isMultiplayerSuspended() || Boolean(pendingMultiplayerUpgrade));
  if (restoreChoiceFocus && waitingForServer) restoreMultiplayerUpgradeFocus = true;
  upgradePanel.setAttribute('aria-busy', waitingForServer ? 'true' : 'false');
  const announcement = document.querySelector('#upgrade-announcement');
  if (player.pendingUpgradeChoices.length === 0) {
    upgradePanel.classList.add("is-hidden");
    upgradeOptionsElement.innerHTML = "";
    if (announcement) announcement.textContent = '';
    if (restoreChoiceFocus && game.state === 'playing') canvas.focus({ preventScroll: true });
    restoreMultiplayerUpgradeFocus = false;
    return;
  }

  upgradePanel.classList.remove("is-hidden");
  const handHasSkillCard = player.pendingUpgradeChoices.some((upgrade) => upgrade.kind === "skill");
  upgradeOptionsElement.innerHTML = player.pendingUpgradeChoices
    .map((upgrade, index) => {
      const stacks = player.upgradeStacks[upgrade.id] || 0;
      const skillCard = upgrade.kind === "skill";
      const description = upgrade.id === "autoWeapon" ? getAutoWeaponUnlockDescription() : skillCard ? describeSkillUpgrade(upgrade, player.character) : upgrade.description;
      const rarity = normalizeRarity(upgrade.rarity);
      const rarityLabel = getRarityStyle(rarity).label;
      // Skill cards name the skill they change and reuse its action-bar icon.
      const skillTag = skillCard ? `<span class="upgrade-card__skill"><svg class="upgrade-card__icon" viewBox="0 0 64 64" aria-hidden="true"><use href="./assets/ui/arpg/icons.svg#${escapeHtml(getSkillUpgradeIcon(upgrade, player.character))}"/></svg>${escapeHtml(getSkillUpgradeTag(upgrade, player.character))}</span>`
        : handHasSkillCard ? '<span class="upgrade-card__skill upgrade-card__skill--empty" aria-hidden="true"></span>' : '';
      return `
        <button class="upgrade-card upgrade-card--${rarity}${skillCard ? ' upgrade-card--skill' : ''}" type="button" data-upgrade-index="${index}" data-upgrade-kind="${escapeHtml(upgrade.kind || 'stat')}" aria-keyshortcuts="${index + 1}" ${waitingForServer ? 'disabled' : ''}>
          <span class="upgrade-card__key">${index + 1}</span>
          <span class="upgrade-card__rarity">${escapeHtml(rarityLabel)}</span>
          ${skillTag}<strong>${escapeHtml(upgrade.label)}</strong>
          <span>${escapeHtml(description)}</span>
          <span>Nível ${stacks}/${upgrade.maxStacks}</span>
        </button>
      `;
    })
    .join("");
  if (announcement) announcement.textContent = waitingForServer
    ? (multiplayer.connected ? 'Confirmando evolução.' : 'Reconectando. Suas escolhas serão preservadas.')
    : `Escolha uma evolução: ${player.pendingUpgradeChoices.map((upgrade, index) => `${index + 1}, ${upgrade.label}${upgrade.kind === 'skill' ? ` (${getSkillUpgradeTag(upgrade, player.character).replace(' · ', ', ')})` : ''}`).join('; ')}.`;
  if (restoreChoiceFocus && !waitingForServer) {
    upgradeOptionsElement.querySelector('.upgrade-card')?.focus({ preventScroll: true });
    restoreMultiplayerUpgradeFocus = false;
  }
}

function getAutoWeaponUnlockDescription() {
  const weaponId = getNextUnlockableAutoWeapon();
  const label = weaponId ? autoWeaponProfiles[weaponId].label : "arsenal completo";
  return `Desbloqueia ${label} para atacar sem segurar o tiro.`;
}

function normalizeRarity(rarity) {
  return rarityStyles[rarity] ? rarity : "common";
}

function getRarityStyle(rarity) {
  return rarityStyles[normalizeRarity(rarity)];
}

function getRarityRank(rarity) {
  return rarityOrder[normalizeRarity(rarity)] ?? 0;
}

function hasPerk(perkId, stacks = 1) {
  return (player.perks[perkId] || 0) >= stacks;
}

function applyPerkEffect(upgrade) {
  if (upgrade.id === "ironBlood") {
    player.damageReduction = Math.min(0.48, (player.perks.ironBlood || 0) * 0.12);
  }

  if (upgrade.id === "hunterEye") {
    player.critChance = Math.min(0.42, (player.perks.hunterEye || 0) * 0.08);
    player.critMultiplier = 1.8;
  }

  if (upgrade.id === "lastBreath") {
    player.revives = Math.max(player.revives, 1);
  }
}

function tryEvolveWeapons() {
  for (const [weaponId, evolution] of Object.entries(evolvedWeaponProfiles)) {
    if (player.evolvedWeapons[weaponId] || !player.autoWeapons[weaponId]?.level) {
      continue;
    }

    if (!isAutoWeaponEvolved(weaponId, player.upgradeStacks)) {
      continue;
    }

    player.evolvedWeapons[weaponId] = evolution.id;
    spawnEvolutionBurst(evolution.label, evolution.color);
  }
}

function spawnEvolutionBurst(label, color = rarityStyles.legendary.color) {
  audioManager.play("weaponEvolve", { priority: 4 });
  spawnWeaponPulse(color);
  spawnTemporaryDropLabel(`ARMA EVOLUÍDA: ${label}`, "legendary", "✦", player.position, 1.45);
}

function getAutoWeaponDisplayLabel(weaponId) {
  const evolutionId = player.evolvedWeapons[weaponId];
  const evolution = evolvedWeaponProfiles[weaponId];
  if (evolutionId && evolution?.id === evolutionId) {
    return evolution.label;
  }

  return autoWeaponProfiles[weaponId]?.label || weaponId;
}

function getAutoWeaponDisplayColor(weaponId) {
  const evolutionId = player.evolvedWeapons[weaponId];
  const evolution = evolvedWeaponProfiles[weaponId];
  if (evolutionId && evolution?.id === evolutionId) {
    return evolution.color;
  }

  return autoWeaponProfiles[weaponId]?.color ?? 0x74d1ff;
}

function getAreaMultiplier() {
  const prismBonus = player.perkCooldowns.prismStorm > 0 ? 1.35 : 1;
  return player.upgradeStats.areaMultiplier * prismBonus;
}

function getProjectileBonus() {
  return player.upgradeStats.projectileBonus + (player.perkCooldowns.prismStorm > 0 ? 1 : 0);
}

function getSlayerPactMultiplier() {
  return hasPerk("slayerPact") ? 1 + player.bossKills * 0.07 : 1;
}

function spawnLevelPulse() {
  combatVfx?.emit('levelUp', player.position, { color: 0xf5d594, radius: 3 });
  const ring = acquireEffectMesh("pulse", createPooledPulseEffect);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(player.position);
  ring.position.y = 0.22;
  ring.scale.setScalar(2.8);
  tintEffect(ring, 0x8ef151, 1.05);
  addTimedEffect(ring, 0.55, true, "pulse");
}

// Trusted in solo (own progression). Online it is only a display mirror: the server derives its own for every cast.
function getPlayerSkillMods() {
  return getSkillMods(player.upgradeStacks, player.character);
}
function buildArpgState() {
  if (pendingSkillRequest && performance.now() - pendingSkillRequest.at >= 2500) pendingSkillRequest = null;
  if (classSkillState.classId !== player.character) classSkillState = createSkillState(player.character);
  const relic = player.weaponTimer > 0 && RELICS[player.relic] ? { id: player.relic, label: RELICS[player.relic].short, name: getRelicName(player.relic, player.character), remaining: player.weaponTimer, duration: RELICS[player.relic].duration } : null;
  const hud = getSkillHud(classSkillState, { health: player.health, maxHealth: player.maxHealth,
    weapon: player.character === 'warrior' ? 'Espada' : 'Rifle', dead: game.state === 'dead',
    // Open cards keep the run live: skills stay unavailable, but this is not a pause.
    paused, enabled: game.state === 'playing' && !isMultiplayerSuspended() && !pendingSkillRequest && player.pendingUpgradeChoices.length === 0,
    // Display mirror of trusted progression; the server recomputes its own value for every cast.
    areaMultiplier: getAreaMultiplier(), skillMods: getPlayerSkillMods() });
  for (const skill of hud.skills) skill.upgrades = getOwnedSkillUpgrades(player.upgradeStacks, player.character, skill.id);
  return { relic, ...hud };
}
function publishArpgState() {
  arpgHudTimer = .1;
  window.dispatchEvent(new CustomEvent('bipx:arpg-state', { detail: buildArpgState() }));
}
function playSkillFeedback(slot, phase) {
  const def = getClassSkills(player.character)[slot];
  if (!def) return;
  audioManager.samples?.update({ playing: game.state === 'playing' && !isMultiplayerSuspended(), paused, muted: audioManager.muted });
  audioManager.samples?.playSkillSound?.(def.id, phase, { local: true });
}
function playSkillsReady(previous, next) {
  if (previous.classId !== next.classId) return;
  for (const def of getClassSkills(next.classId)) if (previous.cooldowns[def.slot] > 0 && next.cooldowns[def.slot] <= 0) playSkillFeedback(def.slot, 'ready');
}
function requestClassSkill(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2 || game.state !== 'playing' || paused || player.pendingUpgradeChoices.length || isMultiplayerSuspended()) return false;
  if (pendingSkillRequest && performance.now() - pendingSkillRequest.at < 2500) return false;
  const intent = { slot, aimX: player.aimDirection.x, aimZ: player.aimDirection.z };
  // Keyboard/touch aim uses a bounded forward target; pointer uses its ground intersection.
  const def = getClassSkills(player.character)[slot];
  const target = keyboardAimActive || game.touchAimActive
    ? { x: player.position.x + intent.aimX * def.range, z: player.position.z + intent.aimZ * def.range } : pointerWorld;
  intent.targetX = target.x; intent.targetZ = target.z;
  if (multiplayer.enabled) {
    const id = crypto.randomUUID(); pendingSkillRequest = { id, slot, at: performance.now() };
    sendMultiplayerMessage({ type: 'skill', requestId: id, runId: multiplayerAuthorityRunId, ...intent });
  } else {
    const result = beginSkill(classSkillState, intent, { x: player.position.x, z: player.position.z,
      runId: game.soloRunId, damageMultiplier: getCombatDamageMultiplier() / getSkillModifiers(classSkillState).damage * skillPower(player.character, player.level), areaMultiplier: getAreaMultiplier(), skillMods: getPlayerSkillMods(), playing: true, dead: player.health <= 0 });
    if (result.ok) presentClassSkill(result.event);
    else playSkillFeedback(slot, 'resourcefail');
  }
  publishArpgState();
  return true;
}
function sweepCasterLaunchVisual(from, to, radius, context) {
  let first = Infinity;
  for (const [a, b] of [[from, to], [{ ...from, y: context.authorityY }, { ...to, y: context.authorityY }]]) {
    const hit = sweepStatic(collisionWorld, a, b, radius, { kind: 'projectile' });
    if (hit) first = Math.min(first, hit.t);
  }
  for (const zombie of zombies) {
    if (zombie.health <= 0 || (zombie.serverControlled ? zombie.serverId : zombie.id) === context.actorId) continue;
    first = Math.min(first, segmentCircleContact(from, to, zombie.mesh.position, radius + zombie.radius));
  }
  for (const target of getLivingPlayerTargets())
    first = Math.min(first, segmentCircleContact(from, to, target.position, radius + target.radius));
  return Number.isFinite(first) ? { t: first } : null;
}

function emitEnemyProjectileTrail(projectile, terminal = false) {
  casterProjectilePresentation.sample(projectile, terminal);
  emitProjectileTrail(elementalVfx, projectile.casterTrailProxy || projectile);
}

function clearCasterLaunchPresentation() {
  casterProjectilePresentation.clear();
  for (const projectile of [...enemyProjectiles, ...serverProjectileById.values()]) casterProjectilePresentation.release(projectile);
}

function sweepClassSkillVisual(from, to, radius, context) {
  if (![from.x, from.y, from.z, to.x, to.y, to.z, radius, context.authorityY].every(Number.isFinite))
    throw new TypeError('Visual sweep requires finite coordinates/radius/authorityY');
  let first = Infinity;
  for (const [a, b] of [[from, to], [{ ...from, y: context.authorityY }, { ...to, y: context.authorityY }]]) {
    const hit = sweepStatic(collisionWorld, a, b, radius, { kind: 'projectile' });
    if (hit) first = Math.min(first, hit.t);
  }
  for (const monster of zombies) {
    if (monster.dead || !(monster.health > 0) || monster.ally || monster.eligible === false) continue;
    const center = monster.mesh?.position ?? monster.position ?? monster;
    if (![center.x, center.z, monster.radius].every(Number.isFinite) || monster.radius < 0) throw new TypeError('Invalid eligible monster collider');
    first = Math.min(first, segmentCircleContact(from, to, center, radius + monster.radius));
  }
  return Number.isFinite(first) ? { t: first } : null;
}

function trackPreparingWarCry(event, actorId) {
  if (event.skillId !== 'warrior_war_cry' || typeof event.castId !== 'string') return;
  if (event.phase === 'release' || event.phase === 'end' || event.phase === 'cancel') {
    preparingWarCries.delete(event.castId); retiredWarCries.add(event.castId);
    while (retiredWarCries.size > 128) retiredWarCries.delete(retiredWarCries.values().next().value);
    return;
  }
  if (event.phase !== 'cast' || preparingWarCries.has(event.castId) || retiredWarCries.has(event.castId)) return;
  const age = Math.max(0, Number(event.ageMs) || 0) / 1000;
  const duration = Number(event.duration) || getClassSkill(event.skillId).duration;
  if (age >= duration) return;
  preparingWarCries.set(event.castId, { actorId, remaining: duration - age + .5 });
  while (preparingWarCries.size > 32) preparingWarCries.delete(preparingWarCries.keys().next().value);
}

function clearPreparingWarCries() { preparingWarCries.clear(); retiredWarCries.clear(); }

function syncPreparingWarCryTransforms(dt = 0) {
  if (isMultiplayerSuspended()) { clearPreparingWarCries(); return; }
  for (const [castId, entry] of preparingWarCries) {
    if (!paused) entry.remaining -= Math.max(0, Number(dt) || 0);
    const local = !multiplayer.enabled || entry.actorId === multiplayer.id;
    const remote = local ? null : remotePlayers.get(entry.actorId);
    const alive = local ? game.state === 'playing' && player.health > 0 : remote?.state === 'playing' && remote.health > 0;
    const localCast = !multiplayer.enabled && classSkillState.active.find(c => c.castId === castId && !c.released);
    const snapshot = local ? classSkillState : remoteSkillSnapshots.find(owner => owner.id === entry.actorId)?.skills;
    if (!alive || entry.remaining <= 0 || snapshot?.buff?.castId === castId || (!multiplayer.enabled && !localCast)) { preparingWarCries.delete(castId); continue; }
    const root = local ? player.mesh : remote?.mesh;
    const visual = local ? heroVisual : remote?.visual;
    if (!root) continue;
    root.updateWorldMatrix(true, false);
    const origin = root.getWorldPosition(new THREE.Vector3());
    const socket = visual?.weapon || visual?.muzzle;
    let emitter;
    if (socket) { socket.updateWorldMatrix(true, false); emitter = socket.getWorldPosition(new THREE.Vector3()); }
    classSkillVfx?.updateCastTransform?.(castId, { origin, ...(emitter ? { emitter } : {}) });
  }
}

function retireDashTransform(castId) {
  retiredDashTransforms.add(castId);
  while (retiredDashTransforms.size > 128) retiredDashTransforms.delete(retiredDashTransforms.values().next().value);
}

function trackDashTransform(event, actorId) {
  if (event.skillId !== 'warrior_cleaving_dash' || typeof event.castId !== 'string' || !event.castId) return;
  if (event.phase === 'cancel' || (event.phase === 'end' && event.reason)) {
    activeDashTransforms.delete(event.castId); retireDashTransform(event.castId); return;
  }
  if (event.phase === 'end') {
    // A normal end follows terminal travel in the same simulation step.
    // Block replay while the existing terminal arc follows its original visual tail.
    if (!activeDashTransforms.get(event.castId)?.terminal) activeDashTransforms.delete(event.castId);
    retireDashTransform(event.castId); return;
  }
  if (!['cast', 'release', 'travel'].includes(event.phase) || retiredDashTransforms.has(event.castId)) return;
  const previous = activeDashTransforms.get(event.castId);
  if (previous && (previous.actorId !== actorId || previous.terminal)) return;
  activeDashTransforms.set(event.castId, { actorId, terminal: event.phase === 'travel' && Boolean(event.terminal) });
  while (activeDashTransforms.size > 32) activeDashTransforms.delete(activeDashTransforms.keys().next().value);
}

function clearDashTransforms(actorId) {
  if (actorId === undefined) { activeDashTransforms.clear(); retiredDashTransforms.clear(); return; }
  for (const [castId, entry] of activeDashTransforms) if (entry.actorId === actorId) {
    activeDashTransforms.delete(castId); retireDashTransform(castId);
  }
}

function syncDashTransforms() {
  if (isMultiplayerSuspended()) { clearDashTransforms(); return; }
  for (const [castId, entry] of activeDashTransforms) {
    // Remote roots/mixers also move between packets. Follow only an existing
    // live arc; the pool owns its lifetime, including the normal terminal tail.
    const local = !multiplayer.enabled || entry.actorId === multiplayer.id;
    const remote = local ? null : remotePlayers.get(entry.actorId);
    const alive = local ? game.state === 'playing' && player.health > 0 : remote?.state === 'playing' && remote.health > 0 && !remote.disposed;
    if (!alive) { activeDashTransforms.delete(castId); retireDashTransform(castId); continue; }
    const visual = local ? heroVisual : remote?.visual;
    const socket = visual?.muzzle || visual?.weapon;
    if (!socket) { activeDashTransforms.delete(castId); continue; }
    socket.updateWorldMatrix(true, false);
    const emitter = socket.getWorldPosition(new THREE.Vector3());
    if (![emitter.x, emitter.y, emitter.z].every(Number.isFinite)) { activeDashTransforms.delete(castId); continue; }
    const accepted = classSkillVfx?.updateDashTransform?.(castId, { emitter });
    if (!accepted) activeDashTransforms.delete(castId);
    if (entry.terminal) retireDashTransform(castId);
  }
}

// Events that exist only because of a class skill upgrade carry `mod`. classSkillVfx has a closed phase/status
// contract (a war-cry stun status would move the buff aura), so the shared combat/elemental pools draw these.
function presentSkillUpgradeEvent(event, actorId) {
  const skillUpgradeTint = { warCryShockwave: 0xffc467, chargeShockwave: 0xffd994, dashMultiKill: 0xb9e4ff, frostHop: 0x84e5ff, gravityCollapse: 0xc27bff, cannonNapalm: 0xff872e };
  const local = !multiplayer.enabled || actorId === multiplayer.id;
  if (multiplayer.enabled && event.actorPosition) {
    // `free`: the hop ends before the cast lock does, and Lyra keeps walking while she fires.
    if (local) onlineSkillMotion = { ...event.actorPosition, terminal: Boolean(event.terminal), free: true };
    else remotePlayers.get(actorId)?.targetPosition?.set(event.actorPosition.x, 0, event.actorPosition.z);
  }
  const at = event.target ?? event.origin, color = skillUpgradeTint[event.mod];
  if (!color || !at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return;
  const position = new THREE.Vector3(at.x, .1, at.z), radius = Number.isFinite(event.radius) ? event.radius : 2;
  if (event.mod === 'frostHop') {
    if (!skillSoundTravel.has(`${event.castId}:hop`)) { skillSoundTravel.add(`${event.castId}:hop`); combatVfx?.emit('dust', new THREE.Vector3(event.origin.x, .1, event.origin.z), { intensity: .7, color: 0xb8c7cc }); }
    if (event.terminal) combatVfx?.emit('dust', position, { intensity: .45, color: 0xb8c7cc });
    return;
  }
  if (event.phase !== 'impact') return; // stuns draw from the victims' timers; napalm draws from snapshots
  if (event.mod === 'dashMultiKill') { combatVfx?.emit('seal', position, { color, radius: 1.4, intensity: .5 }); return; }
  combatVfx?.emit('shockwave', position, { color, radius, intensity: presentationPreferences.reducedMotion ? .5 : 1 });
  if (event.mod === 'gravityCollapse') elementalVfx?.emit('arcaneImpact', position, { radius: Math.min(radius, 3), color, groundY: .04, intensity: .9 });
  else combatVfx?.emit('dust', position, { intensity: .8, color: 0xbab1a0 });
  if (local && !presentationPreferences.reducedMotion) cameraTrauma = Math.min(.5, cameraTrauma + .16);
  audioManager.play(event.mod === 'gravityCollapse' ? 'thunderstaff' : 'boneCannon', { priority: 2, ...getSpatialAudioOptions(position) });
  skillPresentationHistory.push({ ...event, actorId, local, time: game.survivalTime });
  if (skillPresentationHistory.length > 128) skillPresentationHistory.shift();
}

function presentClassSkill(event, actorId = multiplayer.id) {
  if (!getClassSkill(event?.skillId)) return;
  if (event.mod) { presentSkillUpgradeEvent(event, actorId); return; }
  trackPreparingWarCry(event, actorId);
  trackDashTransform(event, actorId);
  const local = !multiplayer.enabled || actorId === multiplayer.id;
  const visual = local ? heroVisual : remotePlayers.get(actorId)?.visual;
  if (event.phase === 'cast') {
    if (typeof visual?.cast === 'function') visual.cast({ skillId: event.skillId, castId: event.castId, duration: event.duration, impactAt: event.impactAt, elapsed: (event.ageMs || 0) / 1000 });
    else visual?.attack({ duration: event.duration });
    if (local) { player.shotCooldown = Math.max(player.shotCooldown, event.duration); pendingSwordStrike = null; }
  }
  if (multiplayer.enabled && event.actorPosition) {
    if (local) onlineSkillMotion = { ...event.actorPosition, terminal: Boolean(event.terminal) };
    else {
      const remote = remotePlayers.get(actorId);
      remote?.targetPosition?.set(event.actorPosition.x, 0, event.actorPosition.z);
    }
  }
  if (event.phase === 'cast' || event.phase === 'release' || (event.phase === 'travel' && event.skillId === 'warrior_cleaving_dash')) {
    const socket = visual?.muzzle || visual?.weapon;
    if (socket) { socket.updateWorldMatrix(true, false); const emitter = socket.getWorldPosition(new THREE.Vector3()); event = { ...event, emitter: { x: emitter.x, y: emitter.y, z: emitter.z } }; }
  }
  classSkillVfx?.emit(event);
  audioManager.samples?.update({ playing: game.state === 'playing' && !isMultiplayerSuspended(), paused, muted: audioManager.muted });
  if (event.phase !== 'travel' || !skillSoundTravel.has(event.castId)) {
    const soundAt = event.phase === "cast" ? event.origin : event.target;
    const position = new THREE.Vector3(soundAt.x, soundAt.y || 0, soundAt.z);
    audioManager.samples?.playSkillEvent?.(event, { local, ageMs: event.ageMs || 0, ...getSpatialAudioOptions(position) });
    if (event.phase === 'travel') {
      skillSoundTravel.add(event.castId);
      if (skillSoundTravel.size > 128) skillSoundTravel.delete(skillSoundTravel.values().next().value);
    }
  }
  if (event.phase === 'status') return;
  skillPresentationHistory.push({ ...event, actorId, local, time: game.survivalTime });
  if (skillPresentationHistory.length > 128) skillPresentationHistory.shift();
}

// Napalm Rúnico (Canhão Infernal upgrade): burning ground drawn with the shared fire/ember pool on a fixed cadence.
function presentNapalmFields(fields) {
  // Function-owned state: animate() already runs while this module is still evaluating.
  const napalmPresentation = presentNapalmFields.timers ??= new Map(), now = performance.now();
  for (const field of fields) {
    const last = napalmPresentation.get(field.castId) || 0;
    if (paused || now - last < (presentationPreferences.reducedMotion ? 520 : 170)) continue;
    napalmPresentation.set(field.castId, now);
    const radius = Math.max(.5, Number(field.radius) || 3.4), bursts = presentationPreferences.reducedMotion ? 1 : 3;
    for (let index = 0; index < bursts; index++) {
      const angle = Math.random() * Math.PI * 2, distance = Math.sqrt(Math.random()) * radius * .9;
      tempVectorA.set(field.target.x + Math.cos(angle) * distance, .1, field.target.z + Math.sin(angle) * distance);
      combatVfx?.emit(index ? 'ember' : 'fire', tempVectorA, { color: 0xff872e, radius: 1.1, intensity: .7 });
    }
    if (!last) combatVfx?.emit('target', tempVectorA.set(field.target.x, .06, field.target.z), { color: 0xff872e, radius, life: Math.min(4, field.remaining), intensity: .55 });
  }
  for (const id of napalmPresentation.keys()) if (!fields.some(field => field.castId === id)) napalmPresentation.delete(id);
}

// Reconstruct enduring visuals from authoritative snapshots, including late join.
// No attack/impact sound or damage is replayed here.
function syncPersistentSkillPresentation(syncAudio = false) {
  if (isMultiplayerSuspended()) {
    classSkillVfx?.syncState?.({ buffs: [], fields: [], statuses: [] });
    return [];
  }
  const next = new Map();
  const states = multiplayer.enabled ? remoteSkillSnapshots : [{ id: 'solo', x: player.position.x, z: player.position.z, skills: classSkillState }];
  for (const owner of states) {
    const ownerPosition = !multiplayer.enabled || owner.id === multiplayer.id ? player.position : remotePlayers.get(owner.id)?.mesh?.position || owner;
    for (const value of [owner.skills?.buff, ...(owner.skills?.fields || [])].filter(Boolean)) {
      if (!(value.remaining > 0)) continue;
      const p = value.status === 'buff' ? { x: ownerPosition.x, y: .1, z: ownerPosition.z } : { x: value.x, y: value.y, z: value.z };
      const event = { ...value, phase: 'status', target: p, origin: p, statusDuration: value.duration, groundY: .04 };
      next.set(`${value.castId}:${value.status}`, event);
    }
  }
  for (const zombie of zombies) for (const value of Object.values(zombie.skillStatuses || {})) {
    const remaining = value.status === 'freeze' ? zombie.freezeTimer : zombie.stunTimer;
    if (!(remaining > 0) || zombie.health <= 0) continue;
    const p = { x: zombie.mesh.position.x, y: .8, z: zombie.mesh.position.z };
    const event = { ...value, remaining, phase: 'status', targetId: zombie.id, contactId: String(zombie.id), origin: p, target: p, groundY: .04 };
    next.set(`${value.castId}:${value.status}:${zombie.id}`, event);
  }
  const values = [...next.values()];
  presentNapalmFields(values.filter(e => e.status === 'napalm'));
  classSkillVfx?.syncState?.({
    buffs: values.filter(e => e.status === 'buff').map(e => ({ id: e.castId, position: e.target, remaining: e.remaining, duration: e.statusDuration })),
    fields: values.filter(e => e.status === 'gravity').map(e => ({ id: e.castId, position: e.target, radius: e.radius, remaining: e.remaining, duration: e.statusDuration })),
    statuses: zombies.filter(z => z.health > 0 && (z.freezeTimer > 0 || z.stunTimer > 0)).map(z => ({ id: z.id, position: z.mesh.position,
      freezeRemaining: z.freezeTimer || 0, stunRemaining: z.stunTimer || 0, radius: z.radius + .2, height: (monsterProfiles[z.type]?.height || 2) + .3 })),
  });
  const skillAreas = values.filter(event => event.status === 'buff' || event.status === 'gravity').map(event => ({
    id: event.castId, castId: event.castId, skillId: event.skillId, position: event.target, radius: event.radius, remaining: event.remaining,
  }));
  if (!syncAudio) return skillAreas;
  const soundState = event => {
    if (event.status !== 'buff' && event.status !== 'gravity') return;
    const local = !multiplayer.enabled || event.castId.startsWith(`${multiplayerAuthorityRunId}:`);
    const position = new THREE.Vector3(event.target.x, event.target.y || 0, event.target.z);
    audioManager.samples?.playSkillEvent?.(event, { local, ageMs: 0, ...getSpatialAudioOptions(position) });
  };
  for (const event of values) soundState(event);
  for (const [key, value] of persistentSkillPresentation) if (!next.has(key)) soundState({ ...value, phase: 'end', remaining: 0, reason: 'snapshot-removed' });
  persistentSkillPresentation.clear(); for (const [key, value] of next) persistentSkillPresentation.set(key, value);
  return skillAreas;
}

function updateClassSkills(dt) {
  if (multiplayer.enabled) return; // HUD follows server snapshots; UI never grants regeneration.
  const previous = skillSnapshot(classSkillState);
  advanceSkills(classSkillState, dt, {
    actor: player.position, skillMods: getPlayerSkillMods(),
    sweepStatic: (from, to, radius, kind) => sweepStatic(collisionWorld, from, to, radius, { kind }),
    // Upgrade knockback (Brado Trovejante), collided like the caster.
    moveTarget(target, delta) {
      const moved = moveActor(collisionWorld, { id: target.id, x: target.x, z: target.z, radius: target.radius }, delta);
      target.zombie.mesh.position.set(moved.x, 0, moved.z); return moved;
    },
    moveCaster(delta) {
      const moved = moveActor(collisionWorld, { id: 'player', x: player.position.x, z: player.position.z, radius: .64 }, delta, { stopOnContact: true });
      player.position.set(moved.x, 0, moved.z); player.mesh.position.copy(player.position); return moved;
    },
    pullTargets(targets, field, step) {
      const bodies = targets.map(t => ({ ...t, inverseMass: 1, pullScale: t.boss ? .35 : 1 }));
      bodies.push({id:'player',x:player.position.x,z:player.position.z,radius:.64,inverseMass:0});
      const result = pullActors(collisionWorld, bodies, field, step, {radius:field.radius,speed:4.5,coreRadius:.55,iterations:4});
      const affected = new Set(result.affectedIds), byId = new Map(targets.map(t=>[t.id,t]));
      for (const body of result.bodies) { const target = byId.get(body.id); if (target) { target.x=body.x;target.z=body.z;target.zombie.mesh.position.set(body.x,0,body.z);if(affected.has(body.id))target.zombie.pullTimer=step+1e-4; } }
    },
    targets: classSkillState.active.length || classSkillState.fields.length ? zombies.map(zombie => ({ id: zombie.id, x: zombie.mesh.position.x, z: zombie.mesh.position.z, radius: zombie.radius, health: zombie.health, dead: zombie.health <= 0, boss: Boolean(monsterProfiles[zombie.type]?.boss), freezeTimer: zombie.freezeTimer || 0, zombie })) : [],
    hit(target, effect) {
      const zombie = target.zombie;
      if (zombie.health <= 0) return;
      applySkillControl(zombie, effect);
      const killed = damageZombie(zombie, effect.damage, true, true, effect.skillId, effect);
      target.dead = killed; target.health = zombie.health; return killed;
    },
    emit: event => presentClassSkill(event),
  });
  playSkillsReady(previous, classSkillState);
}

function updateActiveWeapon(dt) {
  if (player.weaponTimer > 0) {
    player.weaponTimer = Math.max(0, player.weaponTimer - dt);
    if (player.weaponTimer === 0) resetWeapon();
  }
  player.weapon = playableCharacters[player.character].weaponId;
}

function updateShooting(dt) {
  player.shotCooldown = Math.max(0, player.shotCooldown - dt);
  swordSwingRemaining = Math.max(0, swordSwingRemaining - dt);
  if (pendingSwordStrike) {
    pendingSwordStrike.remaining -= dt;
    if (pendingSwordStrike.remaining <= 0) {
      const direction = pendingSwordStrike.direction;
      pendingSwordStrike = null;
      performSwordStrike(direction); // hero-power: cleave / combo finisher, knockback, leech
      audioManager.play('katana', { priority: 2 });
      sendMultiplayerAttack('katana', player.position, direction);
      fireArsenalRelic(direction);
    }
  }
  if (!game.shooting || player.shotCooldown > 0 || classSkillState.lock > 0 || !heroVisual) return;
  if (player.character === 'warrior') {
    const duration = swingDuration('warrior', player.upgradeStats.cooldownMultiplier);
    player.shotCooldown = duration;
    swordSwingRemaining = duration;
    swordSwingDirection.copy(player.aimDirection);
    pendingSwordStrike = { remaining: duration * heroProfile('warrior').basic.impactFraction, direction: swordSwingDirection.clone() };
    // The combo advances at impact (same moment the server counts it); the wind-up only previews the heavy clip.
    heroVisual.attack({ duration, heavy: beginBasicAttack({ ...heroCombat }, game.survivalTime + pendingSwordStrike.remaining).finisher });
  } else {
    const duration = swingDuration('dwarf', player.upgradeStats.cooldownMultiplier);
    player.shotCooldown = duration;
    heroVisual.attack({ duration });
    spawnBullet();
    audioManager.play('pistol', { priority: 1 });
    sendMultiplayerAttack('pistol');
    fireArsenalRelic(player.aimDirection);
  }
}

function getCombatDamageMultiplier() {
  return player.upgradeStats.damageMultiplier * (player.weaponTimer > 0 ? 1.4 : 1) * getSkillModifiers(classSkillState).damage;
}

// Hero power (src/combat/hero-power.mjs). Aldric's basic strike: shared cleave / 360° finisher predicate, level power,
// knockback and leech. Online the server resolves the same step; this side only advances and presents the combo.
function getZombieWeight(zombie) {
  return monsterWeight({ type: zombie.type, eliteType: zombie.eliteType, boss: monsterProfiles[zombie.type]?.boss });
}
function performSwordStrike(direction) {
  const step = beginBasicAttack(heroCombat, game.survivalTime);
  const shape = meleeShape('warrior', { areaMultiplier: getAreaMultiplier(), finisher: step.finisher });
  const amount = heroProfile('warrior').basic.damage * getCombatDamageMultiplier() * basicPower('warrior', player.level) * step.damageMultiplier;
  let hits = 0;
  for (const zombie of [...queryZombiesNear(player.position, shape.range + 2.5, spatialGrid.coneCandidates)]) {
    if (zombie.serverControlled || zombie.health <= 0) continue;
    const body = { x: zombie.mesh.position.x, z: zombie.mesh.position.z, radius: zombie.radius };
    if (!insideMeleeShape(shape, player.position, direction, body)) continue;
    if (sweepStatic(collisionWorld, { x: player.position.x, z: player.position.z, y: .9 }, { x: body.x, z: body.z, y: .9 }, 0)) continue;
    applyHeroKnockback(zombie, { x: body.x - player.position.x, z: body.z - player.position.z }, step.knockback, getZombieWeight(zombie));
    damageZombie(zombie, amount, true, true, 'katana');
    hits += 1;
  }
  applyHeroLeech({ hits });
  if (step.finisher) presentSwordFinisher(player.position, shape.range);
}
function applyHeroLeech(counts) {
  if (multiplayer.enabled || game.state !== 'playing') return;
  player.health += resolveLeech(heroCombat, { ...counts, now: game.survivalTime, health: player.health, maxHealth: player.maxHealth });
}
function presentSwordFinisher(position, radius, local = true) {
  combatVfx?.emit('shockwave', position, { color: 0xffd69a, radius, intensity: 1.5 });
  for (let blade = 0; blade < 3; blade += 1) {
    const angle = blade / 3 * Math.PI * 2;
    combatVfx?.emit('slash', { x: position.x + Math.cos(angle) * .35, y: 1.25, z: position.z + Math.sin(angle) * .35 },
      { direction: { x: Math.cos(angle), z: Math.sin(angle) }, radius: radius * .62, tilt: .12, color: 0xffe2ad });
  }
  if (local && !presentationPreferences.reducedMotion) cameraTrauma = Math.max(cameraTrauma, .2);
}

function spawnBullet() {
  const shot = rifleShot('dwarf'); // hero-power: one-shot opening zombies, short pierce with falloff, stopping power
  // Point-blank forgiveness (shared with the server): a body hugging Lyra inside the frontal arc is never missed.
  const bodies = queryZombiesNear(player.position, shot.assistRange + 2.5).map(zombie => ({ x: zombie.mesh.position.x, z: zombie.mesh.position.z, radius: zombie.radius, health: zombie.health }));
  const assisted = assistRifleAim(player.position, player.aimDirection, bodies, shot);
  spawnPlayerProjectiles({
    ...(assisted === player.aimDirection ? {} : { origin: player.position.clone(), direction: new THREE.Vector3(assisted.x, 0, assisted.z) }),
    color: 0xfff2a3,
    damage: shot.damage * basicPower('dwarf', player.level),
    lifespan: shot.lifespan,
    radius: shot.radius,
    speed: shot.speed,
    pierceHits: shot.pierce,
    pierceFalloff: shot.pierceFalloff,
    knockback: heroProfile('dwarf').knockback,
    hitEffect: "pistol",
  });
}

function spawnPlayerProjectiles(config) {
  if (player.character !== 'dwarf') return;
  const count = 1 + getProjectileBonus();
  const spreadStep = count > 1 ? 0.12 : 0;
  const areaMultiplier = getAreaMultiplier();

  for (let index = 0; index < count; index += 1) {
    const angleOffset = (index - (count - 1) / 2) * spreadStep;
    spawnProjectile({
      ...config,
      angleOffset,
      damage: config.damage * getCombatDamageMultiplier(),
      explodeDamage: (config.explodeDamage || 0) * player.upgradeStats.damageMultiplier,
      explodeColor: config.explodeColor || 0,
      explodeRadius: (config.explodeRadius || 0) * areaMultiplier,
      radius: config.radius * Math.sqrt(areaMultiplier),
    });
  }
}

function spawnProjectile({
  color,
  damage,
  explodeDamage = 0,
  explodeColor = 0,
  explodeRadius = 0,
  lifespan,
  pierceHits = 0,
  pierceFalloff = 1,
  knockback = null,
  radius,
  speed,
  hitEffect = null,
  origin = player.position,
  direction = player.aimDirection,
  angleOffset = 0,
}) {
  if (player.character !== 'dwarf') return;
  const projectileDirection = rotateDirectionY(direction, angleOffset);
  const mesh = acquireProjectileMesh(entityPools.bullets, color, radius);
  mesh.quaternion.setFromUnitVectors(upVector, projectileDirection);
  mesh.position.copy(origin);
  mesh.position.y = 1.12;
  if (heroVisual?.muzzle && origin === player.position) heroVisual.muzzle.getWorldPosition(mesh.position);
  else mesh.position.addScaledVector(projectileDirection, 1.25);
  scene.add(mesh);

  bullets.push({
    mesh,
    previousPosition: mesh.position.clone(),
    nextPosition: mesh.position.clone(),
    trailPosition: mesh.position.clone(),
    trailTimer: 0,
    color,
    age: 0,
    damage,
    explodeDamage,
    explodeColor,
    explodeRadius,
    hitZombies: new Set(),
    hitEffect,
    lifespan,
    pierceHits,
    pierceFalloff,
    knockback,
    radius,
    velocity: projectileDirection.multiplyScalar(speed),
  });
}

// Arsenal glue. Rules live in src/combat/arsenal.mjs (shared with the server); drawing lives in src/vfx/arsenal-vfx.js.
// Relics infuse the class basic attack and automatic weapons are companions: neither replaces the sword or the rifle.
function updateAutoWeapons(dt) {
  if (multiplayer.enabled) return; // The server owns relics and automatic weapons; this client only presents its events.
  const context = getArsenalContext(null);
  context.dead = player.health <= 0;
  advanceArsenal(arsenalState, dt, context);
}

function fireArsenalRelic(direction) {
  if (multiplayer.enabled || !(player.weaponTimer > 0) || !player.relic) return;
  relicAttack(arsenalState, getArsenalContext(direction));
}

function getArsenalLoadout() {
  for (let index = 0; index < AUTO_WEAPON_IDS.length; index += 1) {
    const weaponId = AUTO_WEAPON_IDS[index], slot = arsenalLoadout[weaponId];
    slot.level = player.autoWeapons[weaponId]?.level > 0 ? 1 : 0;
    slot.evolved = slot.level > 0 && player.evolvedWeapons[weaponId] === evolvedWeaponProfiles[weaponId].id;
  }
  return arsenalLoadout;
}

function getArsenalContext(aim) {
  arsenalContext ??= {
    ownerId: 'solo', actor: player.position, aim: null, relic: null, dead: false, loadout: arsenalLoadout, perks: null,
    stats: { damageMultiplier: 2, areaMultiplier: 1, cooldownMultiplier: 1, projectileBonus: 0 },
    targets: getArsenalTargets, hit: applyArsenalHit, emit: presentArsenalEvent,
    sweepStatic: (from, to, radius) => sweepStatic(collisionWorld, from, to, radius, arsenalSweepOptions),
  };
  const context = arsenalContext, stats = context.stats;
  context.aim = aim; context.dead = false; context.perks = player.perks;
  context.relic = player.weaponTimer > 0 ? player.relic : null;
  stats.damageMultiplier = getCombatDamageMultiplier(); stats.areaMultiplier = getAreaMultiplier();
  stats.cooldownMultiplier = player.upgradeStats.cooldownMultiplier; stats.projectileBonus = getProjectileBonus();
  getArsenalLoadout();
  return context;
}

// Reused bodies: the shared rules read { id, x, z, radius, health }; nothing is allocated per frame.
function getArsenalTargets() {
  if (arsenalTargetStamp === game.survivalTime) return arsenalTargets;
  arsenalTargetStamp = game.survivalTime;
  let count = 0;
  for (let index = 0; index < zombies.length; index += 1) {
    const zombie = zombies[index];
    if (zombie.health <= 0 || zombie.serverControlled) continue;
    const body = arsenalBodies[count] ??= { id: 0, x: 0, z: 0, radius: 0, health: 0, dead: false, ref: null };
    body.id = zombie.id; body.x = zombie.mesh.position.x; body.z = zombie.mesh.position.z;
    body.radius = zombie.radius; body.health = zombie.health; body.dead = false; body.ref = zombie;
    arsenalTargets[count] = body; count += 1;
  }
  arsenalTargets.length = count;
  return arsenalTargets;
}

function applyArsenalHit(body, effect) {
  const zombie = body.ref;
  if (!zombie || zombie.health <= 0) return true;
  const burning = zombie.burnTimer > 0 ? zombie.burnDps || 0 : 0;
  const killed = damageZombie(zombie, effect.damage, true, true, effect.hitEffect);
  // One burn rule for solo and server (the legacy client/server guesses disagreed).
  if (!killed && effect.burnDps) zombie.burnDps = Math.max(burning, effect.burnDps);
  body.health = zombie.health; body.dead = killed;
  return killed;
}

function presentArsenalEvent(event, ownerId = null) {
  const local = ownerId === null || ownerId === multiplayer.id;
  arsenalVfx?.emit(event, { ownerId: local ? 'local' : ownerId, local });
  const audible = event.kind === 'auto' || (event.kind === 'relic' && !['charge', 'windup', 'mark'].includes(event.phase || event.shape))
    || (event.kind === 'projectile' && (event.phase === 'spawn' || (event.phase === 'impact' && event.radius > 0)));
  if (!audible) return;
  const sound = event.kind === 'auto' ? ({ guardianBlade: 'autoBlade', orbitOrb: 'orbitOrb', sealRain: 'sealRain', sealRitual: 'talisman' })[event.weapon] : event.relic;
  const at = Number.isFinite(event.x) ? event : event.points?.[0];
  if (sound) audioManager.play(sound, { priority: local ? 2 : 1, ...(local || !at ? null : getSpatialAudioOptions(tempVectorC.set(at.x, 0, at.z))) });
  const heavy = event.kind === 'relic' ? (event.shape === 'point' && event.phase === 'impact') || (event.shape === 'radius' && !event.echo) : event.kind === 'projectile' && event.radius > 0;
  if (heavy && local && !presentationPreferences.reducedMotion) cameraTrauma = Math.max(cameraTrauma, event.nova ? .14 : .09);
}

function syncArsenalPresentation(dt) {
  if (!arsenalVfx) return;
  if (game.state === 'playing') {
    arsenalVfx.syncActor('local', player.position, player.weaponTimer > 0 ? player.relic : null, getArsenalLoadout(), getAreaMultiplier());
    for (const remote of remotePlayers.values()) {
      if (remote.state === 'playing' && remote.health > 0) arsenalVfx.syncActor(remote.id, remote.mesh.position, remote.relic, remote.autoWeapons, remote.areaMultiplier);
    }
  }
  arsenalVfx.update(dt);
}

function setPlayerRelic(relic, seconds, announce) {
  player.relic = relic; player.weaponTimer = seconds;
  weaponFireEmitter?.dispose();
  weaponFireEmitter = relic === 'flamethrower' && player.character === 'warrior' && heroVisual?.weapon
    ? combatVfx?.attachWeapon(heroVisual.weapon, { intensity: .6, rate: 12 }) || null : null;
  if (!announce) return;
  audioManager.play('weaponPickup', { priority: 2 });
  if (!relic) { combatVfx?.emit('seal', player.position, { color: 0xe4bf78, radius: 1.3, intensity: .45 }); return; }
  presentArsenalEvent({ kind: 'state', phase: 'gain', relic, x: player.position.x, z: player.position.z });
  spawnTemporaryDropLabel(`RELÍQUIA: ${getRelicName(relic, player.character)}`, 'epic', RELICS[relic].icon, player.position, 1.3);
}

// Multiplayer mirror of server-owned relic and automatic-weapon state; nothing here is sent back.
function applyAuthoritativeArsenal(progression, newRun, previousWeaponTimer) {
  const relic = player.weaponTimer > 0 && Object.hasOwn(RELICS, progression.relic) ? progression.relic : null;
  const gained = !newRun && player.weaponTimer > previousWeaponTimer + .5;
  if (player.relic && !relic && player.weaponTimer <= 0) resetWeapon();
  else if (relic !== player.relic || gained) setPlayerRelic(relic, player.weaponTimer, gained);
  for (const weaponId of AUTO_WEAPON_IDS) {
    const granted = progression.autoWeapons?.[weaponId], slot = player.autoWeapons[weaponId], evolution = evolvedWeaponProfiles[weaponId];
    const level = granted?.level > 0 ? 1 : 0;
    if (level && !slot.level && !newRun) spawnWeaponPulse(autoWeaponProfiles[weaponId].color);
    slot.level = level;
    if (!granted?.evolved) delete player.evolvedWeapons[weaponId];
    else if (player.evolvedWeapons[weaponId] !== evolution.id) {
      player.evolvedWeapons[weaponId] = evolution.id;
      if (!newRun) spawnEvolutionBurst(evolution.label, evolution.color);
    }
  }
}

function getClosestZombie(origin, maxRange = Infinity) {
  let closest = null;
  let closestDistanceSq = maxRange * maxRange;
  const candidates = Number.isFinite(maxRange) ? queryZombiesNear(origin, maxRange, spatialGrid.closestCandidates) : zombies;

  for (const zombie of candidates) {
    const distanceSq = distanceXZSquared(origin, zombie.mesh.position);

    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closest = { zombie, distanceSq };
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

function spawnPowerup(type = getNextWeaponDropType(), x, z, options = {}) {
  if (!weapons[type]) {
    return;
  }

  const position =
    Number.isFinite(x) && Number.isFinite(z) ? new THREE.Vector3(x, 0, z) : getRandomPowerupPosition();
  const mesh = createPowerupMesh(type);
  const rarity = !RELICS[type] ? "common" : monsterProfiles[options.source]?.boss ? "epic" : "rare";
  const labelSprite = createDropLabelSprite({
    label: getPowerupDropLabel(type),
    rarity,
    icon: hudWeaponIcons[type] || "⚔",
  });
  mesh.position.set(position.x, 0.36, position.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);
  scene.add(labelSprite);

  const powerup = {
    kind: "weapon",
    type,
    label: getPowerupDropLabel(type),
    rarity,
    mesh,
    labelSprite,
    source: options.source || "kill",
    age: Math.random() * Math.PI,
    life: 0,
    ttl: groundItemLifetime,
    baseY: 0.36,
    radius: 1.45,
  };
  updatePowerupLabelPosition(powerup);
  powerups.push(powerup);
}

function spawnPerkDropAt(position, perkId, rarity = null, source = "perk") {
  const perk = upgradeById.get(perkId);
  if (!perk) {
    return false;
  }

  const dropRarity = normalizeRarity(rarity || perk.rarity);
  const mesh = createPerkDropMesh(dropRarity);
  const labelSprite = createDropLabelSprite({
    label: perk.label,
    rarity: dropRarity,
    icon: hudUpgradeIcons[perk.id] || "✦",
  });
  mesh.position.copy(position);
  mesh.position.y = 0.36;
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);
  scene.add(labelSprite);

  const powerup = {
    kind: "perk",
    type: `perk:${perk.id}`,
    perkId: perk.id,
    label: perk.label,
    rarity: dropRarity,
    mesh,
    labelSprite,
    source,
    sparkleTimer: 0,
    age: Math.random() * Math.PI,
    life: 0,
    ttl: groundItemLifetime,
    baseY: 0.36,
    radius: 1.45,
  };
  updatePowerupLabelPosition(powerup);
  powerups.push(powerup);
  audioManager.play("perkDrop", { rarity: dropRarity, priority: dropRarity === "legendary" ? 4 : 2 });
  if (dropRarity === "legendary") {
    triggerPerkAnimation("legendaryDrop", position, dropRarity);
  }
  return true;
}

function spawnBossRewardChestAt(position, bossType = "boss") {
  const mesh = createBossRewardChestMesh(bossType);
  const labelSprite = createDropLabelSprite({
    label: "Baú Sinistro",
    rarity: "rare",
    icon: "🎁",
  });
  mesh.position.copy(position);
  mesh.position.y = 0.28;
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);
  scene.add(labelSprite);

  const powerup = {
    kind: "bossChest",
    type: "bossChest",
    bossType,
    label: "Baú Sinistro",
    rarity: "rare",
    mesh,
    labelSprite,
    source: bossType,
    sparkleTimer: 0.2,
    age: Math.random() * Math.PI,
    life: 0,
    ttl: groundItemLifetime,
    baseY: 0.28,
    radius: 1.65,
  };
  updatePowerupLabelPosition(powerup);
  powerups.push(powerup);
  audioManager.play("bossChest", { priority: 3 });
  return true;
}

function spawnHealthPotionAt(position, amount = bossHealthPotionAmount, source = "boss") {
  const mesh = createHealthPotionMesh();
  const labelSprite = createDropLabelSprite({
    label: `+${amount} Vida`,
    rarity: "common",
    icon: "❤",
  });
  mesh.position.copy(position);
  mesh.position.x += (Math.random() - 0.5) * 1.4;
  mesh.position.z += (Math.random() - 0.5) * 1.4;
  mesh.position.y = 0.34;
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);
  scene.add(labelSprite);

  const powerup = {
    kind: "healthPotion",
    type: "healthPotion",
    amount,
    label: `+${amount} Vida`,
    rarity: "common",
    mesh,
    labelSprite,
    source,
    age: Math.random() * Math.PI,
    life: 0,
    ttl: groundItemLifetime,
    baseY: 0.34,
    radius: 1.35,
  };
  updatePowerupLabelPosition(powerup);
  powerups.push(powerup);
  return true;
}

function spawnWeaponDrop(position, type = getNextWeaponDropType(), source = "kill") {
  if (powerups.length >= getMaxActiveWeaponDrops()) {
    return false;
  }

  spawnPowerup(type, position.x, position.z, { source });
  return true;
}

function maybeDropWeaponFromZombie(type, position) {
  const profile = monsterProfiles[type] || {};

  if (profile.boss) {
    // Signature relic of the boss, next to its chest (same rule as the server).
    spawnPowerup(bossWeaponDrops[type] || getNextWeaponDropType(), position.x - 1.6, position.z + 0.8, { source: type });
    return spawnBossRewardChestAt(position, type);
  }

  // Kills charge the next relic only while no relic is infused: spikes alternate with plain combat.
  if (player.weaponTimer > 0) return false;
  game.weaponDropCounter += type === "brute" || type === "caster" ? 2 : 1;
  if (game.weaponDropCounter < getWeaponDropThreshold()) {
    return false;
  }

  game.weaponDropCounter = 0;
  return spawnWeaponDrop(position, getNextWeaponDropType(), type);
}

function maybeDropPerkFromZombie(type, position) {
  const profile = monsterProfiles[type] || {};
  if (profile.boss || countActivePowerupsByKind("perk") >= getMaxActivePerkDrops()) {
    return false;
  }

  const chanceByType = {
    zombie: 0.004,
    runner: 0.007,
    brute: 0.028,
    caster: 0.033,
    cowWalker: 0.009,
    cowCharger: 0.012,
    cowBrute: 0.038,
  };
  const levelBonus = Math.min(0.014, Math.max(0, player.level - 5) * 0.0012);
  const dropChance = (chanceByType[type] ?? 0.015) + levelBonus;
  if (Math.random() > dropChance) {
    return false;
  }

  const perk = rollPerkDrop(type);
  return perk ? spawnPerkDropAt(position, perk.id, perk.rarity, type) : false;
}

function rollPerkDrop(type) {
  const elite = type === "brute" || type === "caster";
  const weights = elite
    ? { rare: 90, epic: 9, legendary: 1 }
    : { rare: 97, epic: 2.8, legendary: 0.2 };
  const available = upgradeDefinitions.filter(
    (upgrade) => upgrade.kind === "perk" && isUpgradeAvailable(upgrade, "rare", "perkDrop"),
  );

  if (available.length === 0) {
    return null;
  }

  let roll = Math.random() * Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let targetRarity = "rare";
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      targetRarity = rarity;
      break;
    }
  }

  const rarityFallbacks = {
    legendary: ["legendary", "epic", "rare"],
    epic: ["epic", "rare"],
    rare: ["rare", "epic", "legendary"],
  };
  for (const rarity of rarityFallbacks[targetRarity] ?? ["rare"]) {
    const pool = available.filter((upgrade) => normalizeRarity(upgrade.rarity) === rarity);
    if (pool.length > 0) {
      return pickWeightedUpgrade(pool, "perkDrop");
    }
  }

  return pickWeightedUpgrade(available, "perkDrop");
}

function countActivePowerupsByKind(kind) {
  return powerups.reduce((count, powerup) => count + (powerup.kind === kind ? 1 : 0), 0);
}

function getNextWeaponDropType() {
  const next = nextRelicDrop(game.weaponDropIndex, player.weaponTimer > 0 ? player.relic : null);
  game.weaponDropIndex = next.index;
  return next.type;
}

function getWeaponDropThreshold() {
  return Math.max(3, 6 - Math.floor(player.wave / 5) - Math.floor(player.level / 8));
}

function getMaxActiveWeaponDrops() {
  return usesMobileTuning() ? 4 : 5;
}

function getMaxActivePerkDrops() {
  return usesMobileTuning() ? 3 : 4;
}

function updatePowerupLabelPosition(powerup) {
  if (!powerup.labelSprite) {
    return;
  }

  powerup.labelSprite.position.set(powerup.mesh.position.x, powerup.mesh.position.y + 1.18, powerup.mesh.position.z);
}

function animateDropLabel(powerup, dt) {
  if (!powerup.labelSprite) {
    return;
  }

  const rarity = normalizeRarity(powerup.rarity);
  const style = getRarityStyle(rarity);
  const baseScaleX = powerup.labelSprite.userData.baseScaleX ?? 4.3;
  const baseScaleY = powerup.labelSprite.userData.baseScaleY ?? 1.08;

  if (rarity === "epic" || rarity === "legendary") {
    const pulse = 1 + Math.sin(powerup.age * (rarity === "legendary" ? 6.5 : 4.6)) * (rarity === "legendary" ? 0.08 : 0.035);
    powerup.labelSprite.scale.set(baseScaleX * pulse, baseScaleY * pulse, 1);
    powerup.labelSprite.material.opacity = rarity === "legendary" ? 0.86 + Math.sin(powerup.age * 8) * 0.14 : 0.94;
  } else {
    powerup.labelSprite.scale.set(baseScaleX, baseScaleY, 1);
    powerup.labelSprite.material.opacity = 1;
  }

  if (style.animated) {
    powerup.sparkleTimer = (powerup.sparkleTimer ?? 0) - dt;
    if (powerup.sparkleTimer <= 0) {
      powerup.sparkleTimer = rarity === "legendary" ? 0.22 : 0.42;
      spawnDropSparkle(powerup);
    }
  }
}

function collectPowerup(powerup) {
  if (multiplayer.enabled) {
    if (!powerup.serverDropId || isMultiplayerSuspended() || game.state !== 'playing') return false;
    if (powerup.kind === 'bossChest' && player.pendingUpgradeChoices.length) return false;
    if (!pendingMultiplayerPickups.has(powerup.serverDropId) && performance.now() >= (powerup.nextPickupAttemptAt || 0)) {
      pendingMultiplayerPickups.set(powerup.serverDropId, {
        type: 'pickup', runId: multiplayerAuthorityRunId, dropId: powerup.serverDropId,
        requestId: crypto.randomUUID(), lastSentAt: -Infinity,
      });
      // Keep movement and the range check ordered on the same transport.
      sendMultiplayerState();
      sendPendingProgressionCommands();
    }
    return false;
  }
  if (powerup.kind === "perk") {
    const perk = upgradeById.get(powerup.perkId);
    if (perk && isUpgradeAvailable(perk)) {
      applyUpgrade(perk);
      audioManager.play("upgradeChoice", { rarity: perk.rarity, priority: 2 });
      updateHud(true);
    }
    return true;
  }

  if (powerup.kind === "bossChest") {
    return openBossRewardChoices(powerup.bossType);
  }

  if (powerup.kind === "healthPotion") {
    const previousHealth = player.health;
    player.health = Math.min(player.maxHealth, player.health + (powerup.amount || bossHealthPotionAmount));
    if (player.health > previousHealth) {
      combatVfx?.emit('heal', player.position, { color: 0xa2e4bc, radius: 2 });
      pulseHealth();
      audioManager.play("xp", { priority: 1 });
      updateHud(true);
    }
    return true;
  }

  activateWeapon(powerup.type);
  return true;
}

// A relic pickup infuses the class basic attack for the relic's duration; the sword/rifle itself never changes.
function activateWeapon(type) {
  if (!weapons[type] || multiplayer.enabled) return false; // Online, only the server grants a relic.
  player.weapon = playableCharacters[player.character].weaponId;
  setPlayerRelic(RELICS[type] ? type : null, RELICS[type]?.duration ?? FALLBACK_INFUSION_SECONDS, true);
  updateHud(true);
  return true;
}

function resetWeapon() {
  const expired = player.relic;
  weaponFireEmitter?.dispose(); weaponFireEmitter = null;
  player.weapon = playableCharacters[player.character].weaponId;
  player.weaponTimer = 0;
  player.relic = null;
  player.axeSpinTimer = 0;
  if (!expired || game.state !== 'playing') return;
  presentArsenalEvent({ kind: 'state', phase: 'expire', relic: expired, x: player.position.x, z: player.position.z });
  audioManager.play('uiSelect', { priority: 1 });
  updateHud(true);
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

function spawnExplosion(position, color, radius) {
  combatVfx?.emit('shockwave', position, { color, radius });
  combatVfx?.emit('smoke', position, { intensity: .5, radius: radius * .45 });
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

function spawnBurnImpact(position) {
  const flame = acquireEffectMesh("cone", createPooledConeEffect);
  flame.position.copy(position);
  flame.position.y = 0.72;
  flame.rotation.set(0, Math.random() * Math.PI * 2, 0);
  flame.quaternion.identity();
  flame.scale.set(0.42, 0.96, 0.42);
  tintEffect(flame, 0xff7a28, 1.15);
  addTimedEffect(flame, 0.34, false, "cone");
}

function spawnIceImpact(position) {
  spawnRemotePulse(position, 0x7edcff, 1.75);
  const ice = acquireEffectMesh("sparkle", createPooledSparkleEffect);
  ice.position.copy(position);
  ice.position.y = 1.25;
  ice.scale.setScalar(1.15);
  tintEffect(ice, 0x9eeaff, 1.05);
  addTimedEffect(ice, 0.46, false, "sparkle");
}

function spawnLightningImpact(position) {
  const direction = tempVectorA.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  if (direction.lengthSq() < 0.01) {
    direction.set(1, 0, 0);
  }
  direction.normalize();
  spawnRemoteBeam(position, direction, weapons.thunderstaff.color, 2.1);
  spawnExplosion(position, weapons.thunderstaff.color, 0.85);
}

function spawnSlashImpact(position, color) {
  const direction = tempVectorA.set(Math.random() - 0.5, 0, Math.random() - 0.5);
  if (direction.lengthSq() < 0.01) {
    direction.copy(player.aimDirection);
  }
  direction.normalize();
  spawnRemoteSlash(position, direction, color);
}

function spawnPierceImpact(position, color) {
  spawnExplosion(position, color, 0.65);
}

function spawnSealImpact(position, color) {
  spawnRemotePulse(position, color, 1.55);
}

function spawnBoneImpact(position) {
  spawnExplosion(position, weapons.boneCannon.color, 1.05);
}

function spawnOrbitHitImpact(position) {
  spawnOrbitOrbEffect(position, autoWeaponProfiles.orbitOrb.color, 0.9);
}

function spawnTemporaryDropLabel(label, rarity = "legendary", icon = "✦", position = player.position, duration = 1.2) {
  const sprite = createDropLabelSprite({ label, rarity, icon });
  sprite.position.copy(position);
  sprite.position.y = 2.7;
  addTimedEffect(sprite, duration, true, null);
}

function spawnDropSparkle(powerup) {
  const sparkle = acquireEffectMesh("sparkle", createPooledSparkleEffect);
  const angle = powerup.age * 2.4 + Math.random() * Math.PI * 2;
  sparkle.position.set(
    powerup.mesh.position.x + Math.cos(angle) * 0.9,
    powerup.mesh.position.y + 1.15 + Math.random() * 0.55,
    powerup.mesh.position.z + Math.sin(angle) * 0.9,
  );
  sparkle.scale.setScalar(powerup.rarity === "legendary" ? 0.72 : 0.52);
  tintEffect(sparkle, getRarityStyle(powerup.rarity).color, 1);
  addTimedEffect(sparkle, 0.48, false, "sparkle");
}

function triggerPerkAnimation(key, origin = player.position, rarity = "rare") {
  const color = getRarityStyle(rarity).color;
  if (key === 'bladeEcho' || key === 'lastBreath') {
    combatVfx?.summonEcho(origin, { direction: player.aimDirection, color, duration: .9 });
    combatVfx?.emit('shadow', origin, { color, radius: 2.5 });
  } else if (key === 'sealRitual' || key === 'bossChest') {
    combatVfx?.emit('seal', origin, { color, radius: 3 });
  } else if (key === 'ashenHeart') {
    combatVfx?.emit('heal', player.position, { color: 0x9fdfad, radius: 1.4 });
  }
  if (key === "soulMagnet") {
    spawnRemotePulse(origin, color, 5.4);
    return;
  }

  if (key === "ironBlood") {
    spawnRemotePulse(origin, color, 2.6);
    return;
  }

  if (key === "bladeEcho") {
    spawnRemoteSlash(origin, player.aimDirection, color);
    return;
  }

  if (key === "hunterEye") {
    spawnExplosion(origin, color, 1.1);
    return;
  }

  if (key === "sealRitual" || key === "bossChest") {
    spawnExplosion(origin, color, key === "bossChest" ? 3.4 : 3.1);
    return;
  }

  if (key === "ashenHeart") {
    spawnRemotePulse(player.position, color, 2.2);
    spawnExplosion(origin, color, 1.4);
    return;
  }

  if (key === "prismStorm") {
    spawnRemotePulse(player.position, color, 4.4);
    spawnTemporaryDropLabel("TEMPESTADE PRISMÁTICA", "epic", "🌈", player.position, 0.9);
    return;
  }

  if (key === "lastBreath" || key === "legendaryDrop") {
    spawnExplosion(origin, color, 4.8);
    spawnRemotePulse(origin, color, 5.8);
    return;
  }

  spawnRemotePulse(origin, color, getRarityRank(rarity) >= getRarityRank("legendary") ? 4.8 : 2.8);
}

function spawnCuttingMoonWave() {
  const radius = 9.5 * getAreaMultiplier();
  const damage = 12 * player.upgradeStats.damageMultiplier;
  damageZombiesInRadiusAt(player.position, radius, damage, true);
  spawnExplosion(player.position, rarityStyles.legendary.color, radius);
  spawnTemporaryDropLabel("LUA CORTANTE", "legendary", "🌙", player.position, 1.1);
}

function startNextWave() {
  player.wave += 1;
  waveElement.textContent = player.wave.toString();
  game.zombiesToSpawn = Math.min(
    waveSpawnBudget(player.wave, game.survivalTime), // Pacing lives in hero-power.mjs, shared with the server.
    Math.max(240, getMaxActiveZombies() - 8),
  );
  game.spawnTimer = 0.2;
  game.trapTimer = Math.min(game.trapTimer, player.wave >= 4 ? 3.4 : 4.8);
  handleWaveMilestone();
}

function handleWaveMilestone() {
  const milestone = waveMilestones[player.wave];
  if (!milestone || game.milestonesTriggered.has(player.wave)) {
    return;
  }

  game.milestonesTriggered.add(player.wave);
  spawnMilestoneBoss(milestone.bossType);
  spawnTemporaryDropLabel(milestone.title, "legendary", "⚠", player.position, 1.8);
  clearRunStartRejection();
  messageKicker.textContent = `Onda ${player.wave}`;
  messageTitle.textContent = milestone.title;
  messageCopy.textContent = milestone.copy;
  audioManager.play("bossAttack", { boss: milestone.bossType, priority: 4 });
}

function spawnMilestoneBoss(type) {
  const angle = Math.random() * Math.PI * 2;
  const distance = type === "plumaFinance" ? 20 : 17;
  spawnZombie(
    player.position.x + Math.cos(angle) * distance,
    player.position.z + Math.sin(angle) * distance,
    type,
  );
  const boss = zombies[zombies.length - 1];
  if (boss?.labelSprite) {
    updateBossLabelPosition(boss, true);
  }
  return boss;
}

function updateSpawning(dt) {
  if (game.zombiesToSpawn <= 0) {
    return;
  }

  if (zombies.length >= getMaxActiveZombies()) {
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

function updateTrapSpawner(dt) {
  if (player.wave < 4 || game.perfStressImmortal) {
    return;
  }

  game.trapTimer -= dt;
  if (game.trapTimer > 0 || traps.length >= getTrapBudget()) {
    return;
  }

  spawnRandomTrap();
  const pressure = Math.min(1, (player.wave - 4) / 14);
  game.trapTimer = Math.max(2.2, 6.8 - pressure * 2.8 - Math.random() * 1.4);
}

function spawnRandomTrap() {
  const available = Object.entries(trapProfiles).filter(([, profile]) => player.wave >= profile.minWave);
  if (available.length === 0) {
    return;
  }

  const [type] = available[Math.floor(Math.random() * available.length)];
  const target = getClosestPlayerTarget(player.position) ?? { position: player.position };
  const angle = Math.random() * Math.PI * 2;
  const distance = 4.8 + Math.random() * 8.5;
  tempVectorA.set(
    clamp(target.position.x + Math.cos(angle) * distance, -worldLimit + 4, worldLimit - 4),
    0,
    clamp(target.position.z + Math.sin(angle) * distance, -worldLimit + 4, worldLimit - 4),
  );
  spawnTrap(type, tempVectorA);
}

function spawnTrap(type = "graveSpikes", position = player.position) {
  const profile = trapProfiles[type] ?? trapProfiles.graveSpikes;
  if (traps.length >= getTrapBudget()) {
    return null;
  }

  const mesh = acquireTrapMesh(profile.color);
  mesh.position.set(position.x, 0.02, position.z);
  mesh.scale.setScalar(profile.radius);
  scene.add(mesh);
  const trap = {
    mesh,
    type,
    age: 0,
    radius: profile.radius,
    telegraph: profile.telegraph,
    duration: profile.duration,
    damage: profile.damage,
    color: profile.color,
    triggered: false,
  };
  trap.visualManaged = syncTrapVisual(trap);
  if (trap.visualManaged) {
    // Keep the existing pooled group as a logical position anchor and grave
    // spike owner; only the fixed-radius instanced warning replaces its discs.
    mesh.userData.trapCore.visible = false;
    mesh.userData.trapTelegraph.visible = false;
  }
  traps.push(trap);
  return trap;
}

function syncTrapVisual(trap) {
  return hazardVfx?.upsert({ id: trap, type: trap.type, position: trap.mesh.position,
    radius: trap.radius, elapsed: trap.age, telegraph: trap.telegraph,
    duration: trap.duration, color: trap.color, triggered: trap.triggered }) === true;
}

function getTrapBudget() {
  if (isLateGamePerformanceMode()) {
    return usesMobileTuning() ? 3 : 5;
  }

  return usesMobileTuning() ? 4 : 7;
}

function updateTraps(dt) {
  for (let index = traps.length - 1; index >= 0; index -= 1) {
    const trap = traps[index];
    trap.age += dt;
    if (trap.visualManaged) {
      syncTrapVisual(trap);
      trap.mesh.scale.setScalar(trap.radius);
    } else {
      const telegraphProgress = Math.min(1, trap.age / trap.telegraph);
      const pulse = 0.88 + Math.sin(trap.age * 12) * 0.08 + telegraphProgress * 0.18;
      trap.mesh.scale.setScalar(trap.radius * pulse);
      trap.mesh.rotation.y += dt * 0.8;
    }

    if (!trap.triggered && trap.age >= trap.telegraph) {
      triggerTrap(trap);
    }

    if (trap.age >= trap.duration) {
      removeTrap(index);
    }
  }
}

function triggerTrap(trap) {
  trap.triggered = true;
  if (!trap.visualManaged || trap.type === 'graveSpikes') {
    trap.mesh.traverse((child) => {
      if (child.userData.trapSpike) child.visible = true;
    });
  }
  // Presentation consumes the existing impact event; damage remains below.
  const impactDrawn = trap.visualManaged && hazardVfx?.impact(trap) === true;
  if (!impactDrawn) spawnExplosion(trap.mesh.position, trap.color, trap.radius);
  refreshLivingPlayerTargets();
  const radiusSq = trap.radius * trap.radius;

  for (const target of livingPlayerTargets) {
    if (distanceXZSquared(trap.mesh.position, target.position) <= radiusSq) {
      damagePlayerTarget(target, trap.damage + Math.floor(player.wave * 0.5));
    }
  }
}

function removeTrap(index) {
  const [trap] = traps.splice(index, 1);
  hazardVfx?.remove(trap);
  trap.mesh.userData.trapCore.visible = true;
  trap.mesh.userData.trapTelegraph.visible = true;
  releaseTrapMesh(trap.mesh);
}

function getZombieSpawnInterval() {
  return heroSpawnInterval(player.wave, game.survivalTime, 0.032);
}

function spawnZombie(x, z, type = pickMonsterType(), options = {}) {
  const profile = monsterProfiles[type] ?? monsterProfiles.zombie;
  const mesh = acquireZombieMesh(type);
  const eliteType = options.eliteType ?? (profile.boss ? null : rollEliteType(type));
  const eliteProfile = eliteType ? eliteProfiles[eliteType] : null;
  mesh.userData.poolType = type;
  if (Number.isFinite(x) && Number.isFinite(z)) {
    mesh.position.set(x, 0, z);
  } else {
    const angle = Math.random() * Math.PI * 2;
    const distance = heroSpawnDistance(game.survivalTime, Math.random());
    mesh.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
  }
  if (!options.serverControlled) {
    const placed = findFreePosition(collisionWorld, { id: 'spawn', x: mesh.position.x, z: mesh.position.z, radius: profile.radius }, { maxDistance: 16, actors: getEnemyCrowdBodies() });
    if (!placed.found) { releaseZombieMesh(mesh, type); return null; }
    mesh.position.x = placed.x; mesh.position.z = placed.z;
  }
  scene.add(mesh);
  if (profile.boss && game.state === 'playing') audioManager.play('bossSpawn', { priority: 4, ...getSpatialAudioOptions(mesh.position) });

  const difficulty = getWaveDifficultyScale();
  const balance = getMonsterBalanceModifiers(type, profile);
  const baseHealth = (profile.health + Math.floor(game.survivalTime / 120)) * difficulty.health * balance.health;
  const maxHealth = Math.max(1, Number(options.maxHealth) || baseHealth * (eliteProfile?.healthMultiplier ?? 1));
  const labelSprite = profile.boss ? createBossLabelSprite(profile.label, maxHealth, type) : null;
  if (labelSprite) {
    scene.add(labelSprite);
  }

  const zombie = {
    id: Number.isFinite(Number(options.id)) ? Number(options.id) : nextZombieId,
    serverControlled: Boolean(options.serverControlled),
    serverId: Number.isFinite(Number(options.id)) ? Number(options.id) : null,
    mesh,
    type,
    eliteType,
    health: Math.max(0, Number.isFinite(Number(options.health)) ? Number(options.health) : maxHealth),
    maxHealth,
    labelSprite,
    speed: (profile.speed + Math.min(player.wave * 0.16 + game.survivalTime * 0.01, 5.8) * difficulty.speed + Math.random() * 0.7) *
      (eliteProfile?.speedMultiplier ?? 1) *
      balance.speed,
    attackCooldown: 0,
    damage: profile.damage * difficulty.damage * (eliteProfile?.damageMultiplier ?? 1) * balance.damage,
    radius: profile.radius,
    reachBonus: eliteProfile?.reachBonus ?? 0,
    renderMode: "detail",
    score: Math.ceil(profile.score * (eliteProfile?.scoreMultiplier ?? 1)),
    shadowEnabled: null,
    summonCooldown: type === "sofra" ? 1.8 : 0,
    burnTimer: 0,
    burnTickTimer: 0,
    burnDps: 0,
    freezeTimer: 0,
    bossAiTimer: 0,
    bossTargetId: null,
    bossStrafeDirection: Math.random() < 0.5 ? -1 : 1,
    bossStrafeTimer: 0.6 + Math.random() * 1.1,
    targetPosition: new THREE.Vector3(mesh.position.x, 0, mesh.position.z),
    targetRotation: mesh.rotation.y,
    variantColor: getMonsterVariantColor(type, eliteType),
    wobble: Math.random() * Math.PI * 2,
  };
  setEliteMarker(mesh, eliteType);
  zombies.push(zombie);
  zombieActorIndex?.update(getZombieCollisionBody(zombie));
  if (labelSprite) {
    updateBossLabelPosition(zombies[zombies.length - 1], true);
  }
  nextZombieId = Math.max(nextZombieId + 1, zombie.id + 1);
  spatialGrid.dirty = true;
  return zombie;
}

function rollEliteType(type) {
  if (player.wave < 6 || cowMonsterTypes.has(type) && player.wave < 10) {
    return null;
  }

  const chance = Math.min(0.42, 0.045 + (player.wave - 6) * 0.017 + game.survivalTime * 0.0005);
  if (Math.random() > chance) {
    return null;
  }

  const eliteTypes = Object.keys(eliteProfiles);
  return eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
}

function getWaveDifficultyScale() {
  const wave = Math.max(1, player.wave);
  const lateWave = Math.max(0, wave - 8);
  const time = Math.max(0, game.survivalTime);
  const bossPressure = wave >= 20 ? 1.2 : wave >= 10 ? 0.55 : 0;

  return {
    health: 1.08 + wave * 0.12 + Math.pow(lateWave, 1.22) * 0.11 + Math.min(1.35, time / 210) + bossPressure,
    damage: 0.98 + wave * 0.075 + Math.max(0, wave - 10) * 0.075 + Math.min(1.0, time / 285) + bossPressure * 0.42,
    speed: 1 + Math.min(0.3, wave * 0.008),
  };
}

function getMonsterBalanceModifiers(type, profile) {
  if (!profile.boss) {
    return { health: 1, damage: 1, speed: 1 };
  }

  if (profile.milestoneBoss) {
    if (type === "angelSheep") {
      return { health: 0.78, damage: 0.62, speed: 0.92 };
    }

    if (type === "bloodCow") {
      return { health: 0.86, damage: 0.74, speed: 0.94 };
    }

    return { health: 0.9, damage: 0.78, speed: 0.96 };
  }

  const wave = Math.max(1, player.wave);
  if (wave <= 6) {
    return { health: 0.68, damage: 0.58, speed: 0.9 };
  }

  if (wave <= 9) {
    return { health: 0.78, damage: 0.68, speed: 0.94 };
  }

  if (wave <= 14) {
    return { health: 0.88, damage: 0.78, speed: 0.97 };
  }

  return { health: 0.98, damage: 0.88, speed: 1 };
}

function getMonsterVariantColor(type, eliteType = null) {
  if (eliteType) {
    return eliteProfiles[eliteType]?.color ?? 0xffd36d;
  }

  const palette = commonMonsterPalettes[type] ?? commonMonsterPalettes.zombie;
  const mix = 0.82 + Math.random() * 0.32;
  return new THREE.Color(palette.cloth).multiplyScalar(mix).getHex();
}

function setEliteMarker(mesh, eliteType) {
  mesh.traverse((child) => {
    if (!child.userData.eliteMarker) {
      return;
    }

    child.userData.eliteActive = Boolean(eliteType);
    child.visible = Boolean(eliteType) && mesh.userData.lodState !== "proxy";
    if (eliteType && child.material?.color) {
      child.material.color.setHex(eliteProfiles[eliteType]?.color ?? 0xffd36d);
    }
  });
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
  const labelInterval = usesMobileTuning() ? 110 : isLateGamePerformanceMode() ? 140 : 0;
  const minHealthDelta = maxHealth * (isLateGamePerformanceMode() ? 0.055 : 0.035);

  if (!force && labelInterval > 0 && now - (sprite.userData.lastLabelUpdate || 0) < labelInterval && healthDelta < minHealthDelta) {
    return;
  }

  const healthRatio = Math.max(0, Math.min(1, health / maxHealth));
  const accent = getBossAccentColor(type);

  paintBossLabel(context, { label, health, maxHealth, healthRatio, accent });

  texture.needsUpdate = true;
  perfStats.labelUpdates += 1;
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
  if (type === "plumaFinance") {
    return 4.65;
  }

  if (type === "angelSheep") {
    return 4.55;
  }

  if (type === "bloodCow") {
    return 4.4;
  }

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
  if (type === "plumaFinance") {
    return "#b987ff";
  }

  if (type === "angelSheep") {
    return "#fff1ba";
  }

  if (type === "bloodCow") {
    return "#ff3434";
  }

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
    ["angelSheep", -14, 0],
    ["bloodCow", 14, 0],
    ["plumaFinance", 0, -14],
  ];

  for (const [type, x, z] of previewBosses) {
    spawnZombie(player.position.x + x, player.position.z + z, type);
  }
}

function pickMonsterType() {
  if (isCowLevelWave()) {
    return pickCowMonsterType();
  }

  const availableTypes = Object.entries(monsterProfiles)
    .filter(([type, profile]) => player.wave >= profile.minWave && !profile.milestoneBoss && !cowMonsterTypes.has(type))
    .map(([type]) => type);

  if (!availableTypes.includes("zombie")) {
    availableTypes.push("zombie");
  }

  const weights = {
    orcPeon: .12,
    zombie: 1,
    runner: Math.min(0.35 + player.wave * 0.08 + game.survivalTime * 0.004, 1.35),
    brute: Math.min(0.2 + player.wave * 0.045 + game.survivalTime * 0.002, 0.85),
    caster: Math.min(0.18 + player.wave * 0.04 + game.survivalTime * 0.002, 0.75),
    visor: Math.min(0.018 + game.survivalTime * 0.00055 + player.wave * 0.0035, 0.085),
    himetrica: Math.min(0.015 + game.survivalTime * 0.0005 + player.wave * 0.003, 0.075),
    dinzo: Math.min(0.017 + game.survivalTime * 0.00055 + player.wave * 0.0032, 0.08),
    gitcity: Math.min(0.011 + game.survivalTime * 0.00042 + player.wave * 0.0026, 0.06),
    sofra: Math.min(0.008 + game.survivalTime * 0.00035 + player.wave * 0.0022, 0.045),
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

function isCowLevelWave() {
  return player.wave >= 10 && player.wave <= 14;
}

function pickCowMonsterType() {
  const weights = {
    cowWalker: 1.15,
    cowCharger: Math.min(0.65 + player.wave * 0.03, 1.15),
    cowBrute: Math.min(0.28 + player.wave * 0.025, 0.7),
  };
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [type, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) {
      return type;
    }
  }

  return "cowWalker";
}

function getOfflineCasterTarget(target) {
  if (!target) return null;
  const state = target.isLocal ? player : target.remotePlayer;
  return { id: target.id, lifeId: target.isLocal ? game.soloRunId || offlineCasterEpoch : state?.runId || target.id,
    present: Boolean(state), alive: Boolean(state && state.health > 0 && (target.isLocal ? game.state : state.state) === 'playing'),
    position: target.position };
}

function updateCasterZombie(zombie, dt, controls) {
  const active = zombie.casterCastState?.cast?.phase && zombie.casterCastState.cast.phase !== 'end';
  const target = active ? livingPlayerTargets.find(t => t.id === zombie.casterCastState.cast.targetId) : getClosestPlayerTarget(zombie.mesh.position);
  const context = getOfflineCasterTarget(target);
  const distance = context ? Math.hypot(context.position.x - zombie.mesh.position.x, context.position.z - zombie.mesh.position.z) : Infinity;
  const step = stepCasterCaller({ state: zombie.casterCastState, worldEpoch: offlineCasterEpoch,
    actor: { id: zombie.id, type: zombie.type, position: zombie.mesh.position, present: zombies.includes(zombie),
      alive: zombie.health > 0, frozen: controls.frozen, stunned: controls.stunned },
    target: context, tick: offlineCasterTick, dt, paused,
    ready: zombie.attackCooldown - dt <= 0,
    inRange: canUseRangedAttack('caster', distance),
    losClear: Boolean(context && clearEnemyMelee(zombie.mesh.position, context.position)),
    cooldownDuration: getRangedCooldown('caster') });
  zombie.casterCastState = step.state; // Persist before emitting anything.
  if (step.consumeActorStep) zombie.attackCooldown = step.assignCooldown ?? Math.max(controls.frozen || controls.stunned ? .12 : 0, zombie.attackCooldown - dt);
  if (step.state.cast) zombie.mesh.rotation.y = Math.atan2(-step.state.cast.direction.x, -step.state.cast.direction.z);
  for (const event of step.events) {
    recordCasterEvent(event, 'offline');
    if (event.phase !== 'release') continue;
    // Sample the actual marker pose before displaying this tick's final age.
    animatedEnemies?.syncCast(zombie, { ...casterVisual(step.state), elapsed: event.elapsed, active: true });
    const emitter = animatedEnemies?.getCastEmitter(zombie, { castId: event.castId });
    spawnEnemyProjectile(zombie, target, new THREE.Vector3(event.direction.x, 0, event.direction.z), null,
      { castId: event.castId, firstStepDt: event.remainderAfterRelease, emitter });
  }
  zombie.casterCastVisual = casterVisual(step.state);
  animatedEnemies?.syncCast(zombie);
  return step.consumeActorStep;
}

function cancelZombieCaster(zombie, reason) {
  if (!zombie?.casterCastState?.cast || zombie.serverControlled) return;
  const result = cancelCasterCast(zombie.casterCastState, { castId: zombie.casterCastState.cast.castId, reason });
  zombie.casterCastState = result.state;
  zombie.casterCastVisual = casterVisual(result.state);
  for (const event of result.events) recordCasterEvent(event, 'offline');
  // Do not force Idle here: the death-cut pool must capture the presented pose.
}

function updateZombies(dt) {
  offlineCasterTick++;
  // Construct after skills/pull/spawn; discard after final crowd corrections.
  zombieActorIndex = createActorIndex(getEnemyCrowdBodies());
  try {
    zombieNavigationBudget = 4;
    const offset = (++zombieNavigationTick * 4) % Math.max(1, zombies.length);
    const ordered = zombies.slice(offset).concat(zombies.slice(0, offset)).reverse();
    for (const zombie of ordered) {
      const casterControls = { frozen: zombie.freezeTimer > 0, stunned: zombie.stunTimer > 0 };
      if (!updateZombieStatusEffects(zombie, dt)) {
        continue;
      }

      // Hero knockback (hero-power.mjs): a short slide against static colliders, then a stagger that cancels the wind-up.
      const pushed = advanceHeroKnockback(zombie, dt);
      if (pushed.dx || pushed.dz) {
        const moved = moveActor(collisionWorld, getZombieCollisionBody(zombie), { x: pushed.dx, z: pushed.dz });
        zombie.mesh.position.x = moved.x; zombie.mesh.position.z = moved.z;
        zombieActorIndex?.update({ ...getZombieCollisionBody(zombie), x: moved.x, z: moved.z });
      }
      if (zombie.type === 'caster' && updateCasterZombie(zombie, dt, casterControls)) {
        updateBossLabelPosition(zombie); continue;
      }
      if (zombie.freezeTimer > 0 || zombie.stunTimer > 0 || pushed.staggered) {
        if (zombie.meleeAttack) zombie.meleeAttack.active = false;
        zombie.attackCooldown = Math.max(zombie.attackCooldown - dt, 0.12);
        updateBossLabelPosition(zombie);
        continue;
      }

      const isBoss = Boolean(monsterProfiles[zombie.type]?.boss);
      const target = isBoss ? getBossPlayerTarget(zombie, dt) : getClosestPlayerTarget(zombie.mesh.position);
      if (!target) {
        continue;
      }

      const toTarget = tempVectorA.subVectors(target.position, zombie.mesh.position);
      toTarget.y = 0;
      const distance = toTarget.length();
      zombie.attackCooldown -= dt;
      updateSofraSummons(zombie, dt);

      const meleeTiming = getMeleeTiming(zombie.type);
      if (zombie.meleeAttack?.active) {
        const strike = zombie.meleeAttack;
        const lockedTarget = livingPlayerTargets.find(candidate => candidate.id === strike.targetId);
        if (!lockedTarget) strike.active = false;
        else {
          const phase = advanceMeleeAttack(strike, dt);
          if (phase.impact && isWithinMeleeArc(zombie.mesh.position, lockedTarget.position, strike) && clearEnemyMelee(zombie.mesh.position, lockedTarget.position)) {
            damagePlayerTarget(lockedTarget, zombie.damage + Math.floor(player.wave * .55), zombie);
          }
        }
        updateBossLabelPosition(zombie);
        continue;
      }

      zombie.pursuitTarget = target.position;
      if (meleeTiming && distance <= meleeTiming.reach + (zombie.reachBonus || 0) && clearEnemyMelee(zombie.mesh.position, target.position)) {
        if (distance > .05) zombie.mesh.rotation.y = getForwardRotation(toTarget.normalize());
        if (zombie.attackCooldown <= 0) {
          zombie.meleeSequence = (zombie.meleeSequence || 0) + 1;
          zombie.meleeAttack = beginMeleeAttack(zombie.mesh.position, target.position, {
            ...meleeTiming, id: zombie.meleeSequence, targetId: target.id,
            reach: meleeTiming.reach + (zombie.reachBonus || 0),
          });
          zombie.attackCooldown = meleeTiming.cooldown;
        }
        updateBossLabelPosition(zombie);
        continue;
      }

      if (isBoss) {
        updateBossBehavior(zombie, target, toTarget, distance, dt);
        updateBossLabelPosition(zombie);
        continue;
      }

      if (canUseRangedAttack(zombie.type, distance) && clearEnemyMelee(zombie.mesh.position, target.position)) {
        if (distance > 0.05) {
          toTarget.normalize();
          zombie.mesh.rotation.y = getForwardRotation(toTarget);
        }

        if (zombie.type !== 'caster' && zombie.attackCooldown <= 0) {
          zombie.attackCooldown = getRangedCooldown(zombie.type);
          spawnEnemyProjectile(zombie, target);
        }

        updateBossLabelPosition(zombie);
        continue;
      }

      if (distance > 0.05) {
        toTarget.normalize();
        const moveDirection = getZombieCrowdAwareMoveDirection(zombie, toTarget, distance);
        moveZombieWithPhysics(zombie, moveDirection, zombie.speed, dt);
        zombie.mesh.rotation.y = getForwardRotation(moveDirection);
      }

      if (distance < zombie.radius + 0.72 + (zombie.reachBonus || 0) && zombie.attackCooldown <= 0 && clearEnemyMelee(zombie.mesh.position, target.position)) {
        zombie.attackCooldown = zombie.type === 'orcPeon' ? .9 : .62;
        animatedEnemies?.attack(zombie, zombie.type === 'orcPeon' ? .8 : .55);
        damagePlayerTarget(target, zombie.damage + Math.floor(player.wave * 0.55), zombie);
      }

      updateBossLabelPosition(zombie);
    }

    spatialGrid.dirty = true;
    resolveEnemyCrowding(dt);
    spatialGrid.dirty = true;
  } finally {
    zombieActorIndex = null;
  }
}

function getZombieCrowdAwareMoveDirection(zombie, targetDirection, targetDistance) {
  const moveDirection = tempVectorC.copy(targetDirection);
  if (zombies.length < 8 || targetDistance < zombie.radius + 0.95) {
    return moveDirection;
  }

  addZombieLaneOffset(zombie, targetDirection, moveDirection, 0.14);
  if (!shouldQueryZombieSeparation(zombie, targetDistance)) {
    return moveDirection.normalize();
  }

  const separationRadius = Math.min(3.2, Math.max(1.75, zombie.radius + 1.55));
  const candidates = queryZombiesNear(zombie.mesh.position, separationRadius, spatialGrid.separationCandidates);
  let neighborCount = 0;

  for (const neighbor of candidates) {
    if (neighbor === zombie || monsterProfiles[neighbor.type]?.boss) {
      continue;
    }

    const offsetX = zombie.mesh.position.x - neighbor.mesh.position.x;
    const offsetZ = zombie.mesh.position.z - neighbor.mesh.position.z;
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
    if (distanceSq <= 0.0001) {
      continue;
    }

    const minDistance = zombie.radius + neighbor.radius + 0.72;
    const minDistanceSq = minDistance * minDistance;
    if (distanceSq >= minDistanceSq) {
      continue;
    }

    const distance = Math.sqrt(distanceSq);
    const force = ((minDistanceSq - distanceSq) / minDistanceSq) * 1.35;
    moveDirection.x += (offsetX / distance) * force;
    moveDirection.z += (offsetZ / distance) * force;
    neighborCount += 1;

    if (neighborCount >= 7) {
      break;
    }
  }

  if (neighborCount >= 3) {
    addZombieLaneOffset(zombie, targetDirection, moveDirection, 0.34);
  }

  if (moveDirection.lengthSq() <= 0.01) {
    return targetDirection;
  }

  return moveDirection.normalize();
}

function shouldQueryZombieSeparation(zombie, targetDistance) {
  if (targetDistance > 20) {
    return false;
  }

  const frame = monsterRenderer.frame || 0;
  if (zombies.length > 260) {
    return zombie.id % 12 === frame % 12;
  }

  if (zombies.length > 150) {
    return zombie.id % 4 === frame % 4;
  }

  return true;
}

function addZombieLaneOffset(zombie, targetDirection, moveDirection, amount) {
  const laneIndex = zombie.id % 7 - 3;
  const laneSide = laneIndex === 0 ? (zombie.id % 2 === 0 ? 1 : -1) : Math.sign(laneIndex);
  const laneStrength = amount * (0.35 + Math.abs(laneIndex) * 0.28);
  moveDirection.x += targetDirection.z * laneSide * laneStrength;
  moveDirection.z -= targetDirection.x * laneSide * laneStrength;
}

function clearEnemyMelee(from, to) {
  return !sweepStatic(collisionWorld, {x:from.x,y:.9,z:from.z}, {x:to.x,y:.9,z:to.z}, 0);
}
function moveZombieWithPhysics(zombie, direction, speed, dt, attackRegion) {
  if (zombie.pullTimer > 0) return; // Field owns translation; attack state remains independent.
  const body = getZombieCollisionBody(zombie);
  const target = zombie.pursuitTarget;
  let dx=direction.x,dz=direction.z;
  if (target && dx*(target.x-body.x)+dz*(target.z-body.z)>0) {
    const result = getPursuitDirection(collisionWorld, body, target, zombie.navigation, dt, {speed,arrivalRadius:zombie.radius+.72,attackRegion,allowPlanning:zombieNavigationBudget>0});
    zombie.navigation=result.state;if(result.state.planned)zombieNavigationBudget--;
    if (result.mode !== 'direct') {dx=result.direction.x;dz=result.direction.z;}
  }
  const moved = stepActor(collisionWorld, body, { x: dx * speed, z: dz * speed }, dt, { bodies: zombieActorIndex });
  zombie.mesh.position.x = moved.x; zombie.mesh.position.z = moved.z;
  zombieActorIndex?.update({ ...body, x: moved.x, z: moved.z });
  if (Math.hypot(dx, dz) > .01) zombie.mesh.rotation.y = Math.atan2(-dx, -dz);
}
function getZombieCollisionBody(zombie) {
  return { id: `monster:${zombie.id}`, x: zombie.mesh.position.x, z: zombie.mesh.position.z,
    radius: zombie.radius, freezeTimer: zombie.freezeTimer, stunTimer: zombie.stunTimer };
}
function getEnemyCrowdBodies() {
  const bodies = zombies.filter(zombie => zombie.health > 0).map(getZombieCollisionBody);
  for (const target of getLivingPlayerTargets()) bodies.push({
    id: `player:${target.id}`, x: target.position.x, z: target.position.z, radius: target.radius, inverseMass: 0,
  });
  return bodies;
}
function resolveEnemyCrowding(dt) {
  const separated = separateControlledActors(collisionWorld, getEnemyCrowdBodies(), dt);
  const byId = new Map(zombies.map(zombie => [`monster:${zombie.id}`, zombie]));
  for (const body of separated.bodies) {
    const zombie = byId.get(body.id);
    if (zombie) { zombie.mesh.position.x = body.x; zombie.mesh.position.z = body.z; }
  }
}

function shouldResolveEnemyCrowding(zombie, frame) {
  const isBoss = Boolean(monsterProfiles[zombie.type]?.boss);
  if (isBoss) {
    return true;
  }

  if (zombies.length > 320) {
    return zombie.id % 5 === frame % 5;
  }

  if (zombies.length > 180) {
    return zombie.id % 3 === frame % 3;
  }

  return true;
}

function getEnemyCrowdDistance(zombie, neighbor, isBoss, neighborIsBoss) {
  const baseDistance = zombie.radius + neighbor.radius + 0.55;
  if (isBoss && neighborIsBoss) {
    return baseDistance + 3.2;
  }

  if (isBoss || neighborIsBoss) {
    return baseDistance + 1.9;
  }

  return baseDistance;
}

function getBossPlayerTarget(zombie, dt) {
  const aiProfile = bossAiProfiles[zombie.type] ?? { retargetInterval: 1.2 };
  zombie.bossAiTimer = Math.max(0, (zombie.bossAiTimer || 0) - dt);

  if (zombie.bossAiTimer > 0) {
    const currentTarget = getLivingTargetById(zombie.bossTargetId);
    if (currentTarget) {
      return currentTarget;
    }
  }

  refreshLivingPlayerTargets();
  let bestTarget = null;
  let bestScore = Infinity;

  for (const target of livingPlayerTargets) {
    const healthRatio = clamp((target.health ?? 1) / Math.max(target.maxHealth ?? 1, 1), 0.05, 1);
    const distanceScore = Math.max(1, distanceXZSquared(zombie.mesh.position, target.position));
    const weakTargetBias = 0.74 + healthRatio * 0.42;
    const stickyBias = target.id === zombie.bossTargetId ? 0.92 : 1;
    const bloodCowBias = zombie.type === "bloodCow" ? 0.88 : 1;
    const score = distanceScore * weakTargetBias * stickyBias * bloodCowBias;

    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  }

  if (bestTarget) {
    zombie.bossTargetId = bestTarget.id;
    zombie.bossAiTimer = aiProfile.retargetInterval + Math.random() * 0.45;
  }

  return bestTarget ?? getClosestPlayerTarget(zombie.mesh.position);
}

function updateBossBehavior(zombie, target, toTarget, distance, dt) {
  const aiProfile = bossAiProfiles[zombie.type] ?? { minDistance: 4.5, idealDistance: 9, maxDistance: 18, strafeSpeed: 0.5 };
  const direction = distance > 0.05 ? tempVectorB.copy(toTarget).normalize() : tempVectorB.set(0, 0, 1);
  zombie.mesh.rotation.y = getForwardRotation(direction);
  const meleeRange = zombie.radius + target.radius + 0.74 + (zombie.reachBonus || 0);
  const attackRegion = zombie.type === "bloodCow" ? { range: meleeRange, minDistance: zombie.radius + target.radius, losY: .9 } : undefined;
  updateBossMovement(zombie, direction, distance, aiProfile, dt, attackRegion);
  if (distance <= meleeRange && zombie.attackCooldown <= 0 && clearEnemyMelee(zombie.mesh.position, target.position)) {
    zombie.attackCooldown = getBossMeleeCooldown(zombie);
    damagePlayerTarget(target, zombie.damage + Math.floor(player.wave * 0.65), zombie);
    return;
  }

  if (canUseRangedAttack(zombie.type, distance) && zombie.attackCooldown <= 0) {
    zombie.attackCooldown = getBossAttackCooldown(zombie);
    executeBossRangedAttack(zombie, target);
  }
}

function updateBossMovement(zombie, direction, distance, aiProfile, dt, attackRegion) {
  zombie.bossStrafeTimer = Math.max(0, (zombie.bossStrafeTimer || 0) - dt);
  if (zombie.bossStrafeTimer <= 0) {
    zombie.bossStrafeDirection *= Math.random() < 0.7 ? -1 : 1;
    zombie.bossStrafeTimer = 0.75 + Math.random() * 1.35;
  }

  const move = tempVectorC.set(0, 0, 0);
  if (zombie.type === "bloodCow") {
    move.copy(direction);
  } else if (aiProfile.maxDistance > 0 && distance > aiProfile.maxDistance) {
    move.copy(direction);
  } else if (aiProfile.minDistance > 0 && distance < aiProfile.minDistance) {
    move.addScaledVector(direction, -1);
  } else {
    move.set(direction.z * zombie.bossStrafeDirection, 0, -direction.x * zombie.bossStrafeDirection).multiplyScalar(aiProfile.strafeSpeed);
    if (distance < aiProfile.idealDistance - 1.2) {
      move.addScaledVector(direction, -0.42);
    } else if (distance > aiProfile.idealDistance + 1.2) {
      move.addScaledVector(direction, 0.42);
    }
  }

  if (move.lengthSq() <= 0.01) {
    return;
  }

  const enrageSpeed = getBossHealthRatio(zombie) < 0.35 ? 1.08 : 1;
  move.normalize();
  moveZombieWithPhysics(zombie, move, zombie.speed * enrageSpeed, dt, attackRegion);
}

function executeBossRangedAttack(zombie, target) {
  const healthRatio = getBossHealthRatio(zombie);

  if (zombie.type === "angelSheep") {
    spawnEnemyProjectileSpread(zombie, target, healthRatio < 0.32 ? 4 : 3, healthRatio < 0.32 ? 0.22 : 0.26);
    return;
  }

  if (zombie.type === "himetrica" && healthRatio < 0.42) {
    spawnEnemyProjectileSpread(zombie, target, 2, 0.12);
    return;
  }

  if (zombie.type === "gitcity" && healthRatio < 0.45) {
    spawnEnemyProjectileSpread(zombie, target, 2, 0.18);
    return;
  }

  if (zombie.type === "dinzo" && healthRatio < 0.38) {
    spawnEnemyProjectileSpread(zombie, target, 2, 0.18);
    return;
  }

  if (zombie.type === "visor" && healthRatio < 0.34) {
    spawnEnemyProjectileSpread(zombie, target, 2, 0.15);
    return;
  }

  if (zombie.type === "plumaFinance" && healthRatio < 0.38) {
    spawnEnemyProjectileSpread(zombie, target, 2, 0.22);
    return;
  }

  spawnEnemyProjectile(zombie, target);
}

function getBossAttackCooldown(zombie) {
  const healthRatio = getBossHealthRatio(zombie);
  const enrageMultiplier = healthRatio < 0.32 ? 0.84 : healthRatio < 0.6 ? 0.94 : 1;
  return getRangedCooldown(zombie.type) * enrageMultiplier;
}

function getBossMeleeCooldown(zombie) {
  const healthRatio = getBossHealthRatio(zombie);
  return healthRatio < 0.35 ? 0.72 : 0.86;
}

function getBossHealthRatio(zombie) {
  return clamp(zombie.health / Math.max(zombie.maxHealth || 1, 1), 0, 1);
}

function updateSofraSummons(zombie, dt) {
  if (zombie.type !== "sofra" || zombies.length >= getMaxActiveZombies() - 3) {
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

function upgradeZombieLodMesh(mesh, type) {
  const profile = enemyLodProfiles[type];
  if (!enemyLodLibrary || !profile || mesh.userData.staticEnemyLod) return;
  // Callers detach an animated owner before upgrading. Detached/pool groups
  // never have an actor, so no fallback snapshot can resurrect the old parts.
  if (mesh.userData.animatedEnemy) return;
  const cachedGeometry = new Set(assetCache.geometries.values());
  const cachedMaterials = new Set(assetCache.materials.values());
  const retiredGeometry = new Set(), retiredMaterials = new Set();
  const markers = mesh.children.filter(child => child.userData.eliteMarker);
  for (const child of [...mesh.children]) {
    if (child.userData.eliteMarker) continue;
    child.removeFromParent();
    child.traverse(part => {
      if (part.geometry && !cachedGeometry.has(part.geometry)) retiredGeometry.add(part.geometry);
      for (const material of part.material ? (Array.isArray(part.material) ? part.material : [part.material]) : []) {
        if (!cachedMaterials.has(material)) retiredMaterials.add(material);
      }
    });
  }
  for (const geometry of retiredGeometry) geometry.dispose();
  for (const material of retiredMaterials) material.dispose();
  const entry = enemyLodLibrary.get(profile.id);
  const detail = new THREE.Mesh(entry.geometry, entry.material);
  const proxy = new THREE.Mesh(entry.geometry, entry.material);
  detail.name = `enemy-static-detail:${type}`;
  proxy.name = `enemy-static-proxy:${type}`;
  for (const visual of [detail, proxy]) {
    visual.scale.setScalar(profile.height);
    visual.userData.nativeEnemyLod = true;
    visual.castShadow = false;
    visual.receiveShadow = false;
  }
  proxy.userData.isLodProxy = true;
  proxy.visible = false;
  mesh.add(detail, proxy);
  mesh.userData.staticEnemyLod = { id: profile.id, height: profile.height, detail, proxy };
  mesh.userData.detailChildren = [detail, ...markers];
  mesh.userData.lodProxy = proxy;
  mesh.userData.lodState = null;
  delete mesh.userData.animatedParts;
}

function setZombieLod(mesh, useProxy) {
  const detailChildren = mesh.userData.detailChildren;
  const proxy = mesh.userData.lodProxy;
  if (!detailChildren || !proxy) {
    return;
  }

  if (mesh.userData.staticEnemyLod) {
    const animated = Boolean(mesh.userData.animatedEnemy);
    for (const child of detailChildren) {
      child.visible = child.userData.eliteMarker ? !useProxy && Boolean(child.userData.eliteActive) : !animated && !useProxy;
    }
    proxy.visible = !animated && useProxy;
    mesh.userData.lodState = useProxy ? 'proxy' : 'detail';
    return;
  }

  const nextState = useProxy ? "proxy" : "detail";
  if (mesh.userData.lodState === nextState) {
    return;
  }

  for (const child of detailChildren) {
    child.visible = !useProxy && (!child.userData.eliteMarker || child.userData.eliteActive);
  }
  proxy.visible = useProxy;
  mesh.userData.lodState = nextState;
}

function getClosestPlayerTarget(position) {
  let closestTarget = null;
  let closestDistanceSq = Infinity;

  if (livingPlayerTargets.length === 0) {
    refreshLivingPlayerTargets();
  }

  for (const target of livingPlayerTargets) {
    const distanceSq = distanceXZSquared(position, target.position);

    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closestTarget = target;
    }
  }

  return closestTarget;
}

function getClosestLivingTargetDistanceSq(position) {
  let closestDistanceSq = Infinity;

  if (livingPlayerTargets.length === 0) {
    refreshLivingPlayerTargets();
  }

  for (const target of livingPlayerTargets) {
    closestDistanceSq = Math.min(closestDistanceSq, distanceXZSquared(position, target.position));
  }

  if (closestDistanceSq === Infinity) {
    return distanceXZSquared(position, player.position);
  }

  return closestDistanceSq;
}

function refreshLivingPlayerTargets() {
  livingPlayerTargets.length = 0;

  if (game.state === "playing" && player.health > 0) {
    livingPlayerTargets.push({
      id: multiplayer.id || "local",
      isLocal: true,
      position: player.position,
      radius: 0.64,
      health: player.health,
      maxHealth: player.maxHealth,
    });
  }

  for (const remotePlayer of remotePlayers.values()) {
    if (remotePlayer.state === "playing" && remotePlayer.health > 0) {
      livingPlayerTargets.push({
        id: remotePlayer.id,
        isLocal: false,
        position: remotePlayer.mesh.position,
        radius: 0.64,
        health: remotePlayer.health,
        maxHealth: remotePlayer.maxHealth,
        remotePlayer,
      });
    }
  }

  return livingPlayerTargets;
}

function getLivingPlayerTargets() {
  return refreshLivingPlayerTargets();
}

function getProjectileHitTarget(projectile) {
  let firstContact = Infinity, hitTarget = null;
  for (const target of livingPlayerTargets) {
    const contact = segmentCircleContact(projectile.previousPosition, projectile.mesh.position, target.position, projectile.radius + target.radius);
    if (contact < firstContact) { firstContact = contact; hitTarget = target; }
  }
  projectile.contactFraction = firstContact;
  return hitTarget;
}

function damagePlayerTarget(target, amount, source = null) {
  if (target.isLocal) {
    damageLocalPlayer(amount, source);
    return;
  }

  damageRemotePlayer(target.id, amount);
}

function getSpatialAudioOptions(position) {
  const dx = position.x - player.position.x;
  const dz = position.z - player.position.z;
  const right = camera.matrixWorld.elements;
  return { pan: THREE.MathUtils.clamp((dx * right[0] + dz * right[2]) / 18, -.85, .85), distance: Math.hypot(dx, dz) };
}

// `source` is the attacking monster for melee hits. Swarm melee respects the shared hit-grace (hero-power.mjs);
// brutes, elites, bosses, projectiles, traps and fixtures always land. Class armor applies before Sangue de Ferro.
function damageLocalPlayer(amount, source = null) {
  if (game.perfStressImmortal) {
    player.health = player.maxHealth;
    return;
  }

  amount *= getSkillDamageTaken(classSkillState); // Bastião (Investida de Escudo upgrade)
  const incoming = resolveIncomingDamage(heroCombat, amount, { now: game.survivalTime, swarm: Boolean(source) && getZombieWeight(source) === 'swarm' });
  if (incoming.graced) return;
  const reducedAmount = incoming.damage * (1 - player.damageReduction);
  cinematicPipeline?.impact(Math.min(.5, reducedAmount / 60));
  if (!presentationPreferences.reducedMotion) cameraTrauma = Math.min(.55, cameraTrauma + .18);
  audioManager.play("playerDamage", { priority: 3 });
  heroVisual?.hit();
  if (player.damageReduction > 0) {
    triggerPerkAnimation("ironBlood", player.position, "rare");
  }

  player.health = Math.max(0, player.health - reducedAmount);
  spawnPlayerDamageNumber(reducedAmount, player.position);
  pulseHealth();

  if (player.health <= 0) {
    if (player.revives > 0) {
      player.revives -= 1;
      player.health = Math.max(1, Math.floor(player.maxHealth * 0.4));
      triggerPerkAnimation("lastBreath", player.position, "legendary");
      updateHud(true);
      return;
    }
    endGame();
  }
}

function spawnPlayerDamageNumber(amount, position) {
  if (amount <= 0) {
    return;
  }

  spawnDamageNumber(position, amount, false, null, "playerDamage");
}

function damageRemotePlayer(playerId, amount) {
  const remotePlayer = remotePlayers.get(playerId);

  if (!remotePlayer || remotePlayer.health <= 0) {
    return;
  }

  remotePlayer.health = Math.max(0, remotePlayer.health - amount);
  if (remotePlayer.health <= 0) zombieActorIndex?.remove(`player:${playerId}`);
  spawnPlayerDamageNumber(amount, remotePlayer.mesh.position);
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
    (type === "dinzo" && distance < 16 && distance > 3.5) ||
    (type === "gitcity" && distance < 19 && distance > 4.4) ||
    (type === "sofra" && distance < 20 && distance > 3.8) ||
    (type === "angelSheep" && distance < 22 && distance > 4.2) ||
    (type === "plumaFinance" && distance < 24 && distance > 5.2)
  );
}

function getRangedCooldown(type) {
  if (type === "angelSheep") {
    return 1.45;
  }

  if (type === "plumaFinance") {
    return 1.95;
  }

  if (type === "sofra") {
    return 1.25;
  }

  if (type === "visor") {
    return 1.55;
  }

  if (type === "himetrica") {
    return 1.25;
  }

  if (type === "dinzo") {
    return 1.7;
  }

  if (type === "gitcity") {
    return 1.9;
  }

  return 1.45;
}

function spawnEnemyProjectile(zombie, target = getClosestPlayerTarget(zombie.mesh.position), directionOverride = null, projectileSpecOverride = null, preparedCast = null) {
  if (!target) {
    return;
  }
  if (!preparedCast) animatedEnemies?.attack(zombie, .65);

  if (!directionOverride && zombie.type === "angelSheep") {
    spawnEnemyProjectileSpread(zombie, target, 3, 0.24);
    return;
  }

  const direction = directionOverride ? directionOverride.clone() : target.position.clone().sub(zombie.mesh.position);
  direction.y = 0;

  if (direction.lengthSq() <= 0.01) {
    return;
  }

  direction.normalize();
  const projectileSpec = projectileSpecOverride ?? getEnemyProjectileSpec(zombie.type);
  const projectileVisual = createEnemyProjectileVisual(projectileSpec);
  const mesh = projectileVisual.mesh;
  const forwardRotation = Math.atan2(direction.x, direction.z);
  mesh.position.copy(zombie.mesh.position);
  mesh.position.y = projectileSpec.height;
  mesh.position.addScaledVector(direction, projectileSpec.spawnOffset);
  mesh.rotation.y = forwardRotation;
  scene.add(mesh);

  const projectile = {
    mesh,
    pooled: projectileVisual.pooled,
    visualKind: projectileSpec.kind,
    sourceType: zombie.type,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    baseY: projectileSpec.height,
    baseScale: mesh.scale.x,
    damage: zombie.damage + Math.floor(player.wave * 0.35),
    lifespan: projectileSpec.lifespan,
    radius: projectileSpec.radius,
    color: projectileSpec.color,
    impactRadius: projectileSpec.impactRadius,
    homing: Boolean(projectileSpec.homing),
    speed: projectileSpec.speed,
    targetId: target.id,
    velocity: direction.clone().multiplyScalar(projectileSpec.speed),
  };
  if (preparedCast) Object.assign(projectile, { castId: preparedCast.castId, firstStepDt: preparedCast.firstStepDt });
  enemyProjectiles.push(projectile);
  const castPosition = preparedCast?.emitter?.position;
  const safeLaunch = !castPosition || casterProjectilePresentation.remember({ castId: preparedCast.castId, actorId: zombie.id,
    origin: { x: mesh.position.x, y: enemyProjectileCollisionHeight(zombie.type), z: mesh.position.z },
    emitter: castPosition, radius: projectile.radius });
  casterProjectilePresentation.attach(projectile);
  if (safeLaunch) emitProjectileCast(elementalVfx, castPosition ? { ...projectile, mesh: { position: new THREE.Vector3(castPosition.x, castPosition.y, castPosition.z) } } : projectile);
  audioManager.play("bossAttack", { boss: zombie.type, priority: monsterProfiles[zombie.type]?.boss ? 3 : 1 });
  return projectile;
}

function spawnEnemyProjectileSpread(zombie, target, count, spreadRadians) {
  const baseDirection = target.position.clone().sub(zombie.mesh.position);
  baseDirection.y = 0;
  if (baseDirection.lengthSq() <= 0.01) {
    return;
  }
  baseDirection.normalize();
  const projectileSpec = getEnemyProjectileSpec(zombie.type);
  const middle = (count - 1) * 0.5;

  for (let index = 0; index < count; index += 1) {
    const angle = (index - middle) * spreadRadians;
    const direction = baseDirection.clone().applyAxisAngle(upVector, angle);
    spawnEnemyProjectile(zombie, target, direction, projectileSpec);
  }
}

function updateEnemyProjectiles(dt) {
  for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = enemyProjectiles[index];
    const remaining = Math.max(0, projectile.lifespan - projectile.age);
    if (remaining <= 0) { removeEnemyProjectile(index); continue; }
    const firstStepDt = projectile.firstStepDt;
    delete projectile.firstStepDt;
    const travelDt = Math.min(Math.max(0, firstStepDt ?? dt), remaining);
    if (travelDt <= 0) continue;
    projectile.previousPosition ??= new THREE.Vector3();
    projectile.previousPosition.copy(projectile.mesh.position);
    projectile.age += travelDt;
    updateProjectileHoming(projectile, travelDt);
    projectile.mesh.position.addScaledVector(projectile.velocity, travelDt);
    animateEnemyProjectileVisual(projectile, travelDt);
    const hitTarget = getProjectileHitTarget(projectile);
    const wall = sweepStatic(collisionWorld, {x:projectile.previousPosition.x,y:enemyProjectileCollisionHeight(projectile.sourceType),z:projectile.previousPosition.z}, {x:projectile.mesh.position.x,y:enemyProjectileCollisionHeight(projectile.sourceType),z:projectile.mesh.position.z}, projectile.radius);
    if (wall && (!hitTarget || wall.t <= projectile.contactFraction)) {
      projectile.mesh.position.lerpVectors(projectile.previousPosition, projectile.mesh.position, wall.t);
      emitEnemyProjectileTrail(projectile, true);
      emitProjectileImpact(elementalVfx, projectile);
      removeEnemyProjectile(index);
      continue;
    }
    if (hitTarget) {
      projectile.mesh.position.lerpVectors(projectile.previousPosition, projectile.mesh.position, projectile.contactFraction);
      emitEnemyProjectileTrail(projectile, true);
      const elementalImpact = emitProjectileImpact(elementalVfx, projectile);
      damagePlayerTarget(hitTarget, projectile.damage);
      if (!elementalImpact) spawnExplosion(projectile.mesh.position, projectile.color, projectile.impactRadius ?? 2.4);
      removeEnemyProjectile(index);
      continue;
    }
    emitEnemyProjectileTrail(projectile);
    if (projectile.age >= projectile.lifespan || Math.abs(projectile.mesh.position.x) > 70 || Math.abs(projectile.mesh.position.z) > 70) removeEnemyProjectile(index);
  }
}

function updateProjectileHoming(projectile, dt) {
  if (!projectile.homing) {
    return;
  }

  const target = getLivingTargetById(projectile.targetId) ?? getClosestPlayerTarget(projectile.mesh.position);
  if (!target) {
    return;
  }

  tempVectorB.subVectors(target.position, projectile.mesh.position);
  tempVectorB.y = 0;
  if (tempVectorB.lengthSq() <= 0.01) {
    return;
  }

  tempVectorB.normalize().multiplyScalar(projectile.speed);
  projectile.velocity.lerp(tempVectorB, Math.min(1, dt * 1.8));
}

function getLivingTargetById(id) {
  if (!id) {
    return null;
  }

  if (livingPlayerTargets.length === 0) {
    refreshLivingPlayerTargets();
  }

  return livingPlayerTargets.find((target) => target.id === id) ?? null;
}

function updateBullets(dt) {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = bullets[bulletIndex];
    const travelDt = Math.min(dt, Math.max(0, bullet.lifespan - bullet.age));
    bullet.age += travelDt;
    bullet.previousPosition.copy(bullet.mesh.position);
    bullet.nextPosition.copy(bullet.mesh.position).addScaledVector(bullet.velocity, travelDt);

    const wall = sweepStatic(collisionWorld, {x:bullet.previousPosition.x,y:RIFLE_COLLISION_HEIGHT,z:bullet.previousPosition.z}, {x:bullet.nextPosition.x,y:RIFLE_COLLISION_HEIGHT,z:bullet.nextPosition.z}, bullet.radius);
    let hit = false;
    // Broad phase covers the whole traveled segment, including its end caps.
    tempVectorA.lerpVectors(bullet.previousPosition, bullet.nextPosition, .5);
    const halfTravel = Math.sqrt(distanceXZSquared(bullet.previousPosition, bullet.nextPosition)) * .5;
    const candidates = queryZombiesNear(tempVectorA, halfTravel + bullet.radius + 2.1, spatialGrid.bulletCandidates);
    while (true) {
      let firstContact = wall?.t ?? Infinity;
      let target = null;
      for (const zombie of candidates) {
        if (zombie.health <= 0 || bullet.hitZombies.has(zombie.id)) continue;
        const contact = segmentCircleContact(bullet.previousPosition, bullet.nextPosition, zombie.mesh.position, bullet.radius + zombie.radius);
        if (contact < firstContact) { firstContact = contact; target = zombie; }
      }
      if (!target) break;

      // Grid iteration order cannot let a farther enemy intercept the shot.
      bullet.mesh.position.lerpVectors(bullet.previousPosition, bullet.nextPosition, firstContact);
      hit = true;
      bullet.hitZombies.add(target.id);
      if (bullet.knockback && !target.serverControlled) applyHeroKnockback(target, bullet.velocity, bullet.knockback, getZombieWeight(target)); // hero-power: rifle stopping power
      damageZombie(target, bullet.damage, true, true, bullet.hitEffect);
      if (bullet.explodeRadius > 0) {
        damageZombiesAtPoint(bullet.mesh.position, bullet.explodeRadius, bullet.explodeDamage || bullet.damage, false, true, bullet.hitEffect);
        spawnExplosion(bullet.mesh.position, bullet.explodeColor || weapons.talisman.color, bullet.explodeRadius);
        break;
      }
      if (bullet.pierceHits <= 0) break;
      bullet.pierceHits -= 1;
      bullet.damage *= bullet.pierceFalloff ?? 1;
      hit = false;
    }
    if (!hit && wall) {
      bullet.mesh.position.lerpVectors(bullet.previousPosition, bullet.nextPosition, wall.t);
      hit = true;
    }
    if (!hit) bullet.mesh.position.copy(bullet.nextPosition);
    bullet.trailTimer -= travelDt;
    if (bullet.trailTimer <= 0 && !presentationPreferences.reducedMotion) {
      bullet.trailTimer = qualityManager.level === 'low' ? .09 : .045;
      combatVfx?.emitTrail(bullet.trailPosition, bullet.mesh.position, 'ember', { color: bullet.color });
      bullet.trailPosition.copy(bullet.mesh.position);
    }

    if (
      hit ||
      bullet.age >= bullet.lifespan ||
      Math.abs(bullet.mesh.position.x) > 70 ||
      Math.abs(bullet.mesh.position.z) > 70
    ) {
      removeBullet(bulletIndex);
    }
  }
}

function damageZombiesInCone(range, minDot, amount, shouldFlash, hitEffectType = null) {
  damageZombiesInConeFrom(
    player.position,
    player.aimDirection,
    range * getAreaMultiplier(),
    minDot,
    amount * player.upgradeStats.damageMultiplier,
    shouldFlash,
    true,
    hitEffectType,
  );
}

function damageZombiesInConeFrom(origin, direction, range, minDot, amount, shouldFlash, awardRewards = true, hitEffectType = null) {
  const candidates = queryZombiesNear(origin, range, spatialGrid.coneCandidates);
  const rangeSq = range * range;

  for (const zombie of candidates) {
    tempVectorA.subVectors(zombie.mesh.position, origin);
    tempVectorA.y = 0;
    const distanceSq = tempVectorA.lengthSq();

    if (distanceSq > rangeSq) {
      continue;
    }

    const dot = distanceSq <= .0025 ? 1 : tempVectorA.normalize().dot(direction);
    if (dot >= minDot && !sweepStatic(collisionWorld, { x: origin.x, z: origin.z, y: .9 }, { x: zombie.mesh.position.x, z: zombie.mesh.position.z, y: .9 }, 0)) {
      damageZombie(zombie, amount, shouldFlash, awardRewards, hitEffectType);
    }
  }
}

function damageZombiesInRadius(radius, amount, shouldFlash, hitEffectType = null) {
  damageZombiesInRadiusAt(
    player.position,
    radius * getAreaMultiplier(),
    amount * player.upgradeStats.damageMultiplier,
    shouldFlash,
    true,
    hitEffectType,
  );
}

function damageZombiesInRadiusAt(origin, radius, amount, shouldFlash, awardRewards = true, hitEffectType = null) {
  const candidates = queryZombiesNear(origin, radius, spatialGrid.radiusCandidates);
  const radiusSq = radius * radius;

  for (const zombie of candidates) {
    if (distanceXZSquared(origin, zombie.mesh.position) <= radiusSq) {
      damageZombie(zombie, amount, shouldFlash, awardRewards, hitEffectType);
    }
  }
}

function applyDamagePerks(zombie, amount) {
  let finalDamage = amount * getSlayerPactMultiplier();
  let crit = false;

  if (player.critChance > 0 && Math.random() < player.critChance) {
    finalDamage *= player.critMultiplier;
    crit = true;
    triggerPerkAnimation("hunterEye", zombie.mesh.position, "rare");
  }

  if (hasPerk("bladeEcho") && Math.random() < 0.18 * player.perks.bladeEcho) {
    finalDamage += amount * 0.55;
    triggerPerkAnimation("bladeEcho", zombie.mesh.position, "rare");
  }

  return { damage: finalDamage, crit };
}

function maybeTriggerKillPerks(type, position) {
  if (!hasPerk("ashenHeart")) {
    return;
  }

  const profile = monsterProfiles[type] ?? {};
  const isElite = profile.boss || type === "brute" || type === "caster";
  if (!isElite) {
    return;
  }

  const healAmount = profile.boss ? 18 : 8;
  player.health = Math.min(player.maxHealth, player.health + healAmount * player.perks.ashenHeart);
  triggerPerkAnimation("ashenHeart", position, "epic");
}

function damageZombiesAtPoint(position, radius, amount, shouldFlash, awardRewards = true, hitEffectType = null) {
  const candidates = queryZombiesNear(
    position,
    radius,
    spatialGrid.pointQueryActive ? spatialGrid.pointCandidatesNested : spatialGrid.pointCandidates,
  );
  const radiusSq = radius * radius;
  const wasPointQueryActive = spatialGrid.pointQueryActive;
  spatialGrid.pointQueryActive = true;

  for (const zombie of candidates) {
    if (distanceXZSquared(position, zombie.mesh.position) <= radiusSq) {
      damageZombie(zombie, amount, shouldFlash, awardRewards, hitEffectType);
    }
  }

  spatialGrid.pointQueryActive = wasPointQueryActive;
}

function damageZombie(target, amount, shouldFlash, awardRewards = true, hitEffectType = null, skillEffect = null) {
  const zombie = typeof target === "number" ? zombies[target] : target;

  if (!zombie) {
    return false;
  }

  if (zombie.serverControlled) {
    return false;
  }

  const profile = monsterProfiles[zombie.type] ?? {};
  const damageResult = applyDamagePerks(zombie, amount);
  const finalDamage = damageResult.damage;
  zombie.health -= finalDamage;
  spawnDamageNumber(zombie.mesh.position, finalDamage, damageResult.crit, zombie.id);
  applyWeaponHitEffect(zombie, hitEffectType, finalDamage);

  if (shouldFlash) {
    if (zombie.mesh.userData.animatedEnemy) animatedEnemies.hit(zombie);
    else flashZombie(zombie.mesh);
  }

  if (zombie.labelSprite) {
    updateBossLabel(zombie.labelSprite, zombie.health);
  }

  if (zombie.health <= 0) {
    combatVfx?.emit('blood', zombie.mesh.position, { color: 0x644448, intensity: .35 });
    combatVfx?.emit('death', zombie.mesh.position, { intensity: profile.boss ? 2 : .65, color: profile.boss ? 0xecc891 : 0x71bbb4 });
  if (profile.boss && !presentationPreferences.reducedMotion) cameraTrauma = .45;
    audioManager.play("kill", { priority: profile.boss ? 3 : 1, ...getSpatialAudioOptions(zombie.mesh.position) });
    const xpPosition = zombie.mesh.position.clone();
    const xpValue = getXpValueForZombie(zombie.type, zombie.eliteType);
    const shouldBurst = zombie.type === "sofra";
    cancelZombieCaster(zombie, 'death');
    animatedEnemies?.remove(zombie, { death: true, deathStyle: skillEffect?.deathStyle, killedBySkillId: skillEffect?.skillId, direction: skillEffect?.direction });
    removeZombieByRef(zombie);
    if (shouldBurst) {
      spawnSofraDeathBurst(xpPosition);
    }
    if (awardRewards) {
      spawnXpGem(xpPosition, xpValue);
      player.kills += 1;
      player.score += zombie.score;
      if (profile.boss) {
        player.bossKills += 1;
        spawnHealthPotionAt(xpPosition, bossHealthPotionAmount, zombie.type);
      }
      applyHeroLeech({ kills: 1 }); // hero-power: Aldric sustain, every kill source, shared per-second cap
      creditSoloSkillKill(Boolean(profile.boss));
      maybeTriggerKillPerks(zombie.type, xpPosition);
      maybeDropPerkFromZombie(zombie.type, xpPosition);
      maybeDropWeaponFromZombie(zombie.type, xpPosition);
    }
    return true;
  }

  if (shouldFlash) {
    audioManager.play("hit", { priority: 0, ...getSpatialAudioOptions(zombie.mesh.position) });
  }

  return false;
}

// Sede de Sangue (Grito de Guerra upgrade). Online the server heals in rewardServerKill.
function creditSoloSkillKill(boss) {
  const heal = creditSkillKill(classSkillState, { boss }).heal;
  if (!(heal > 0) || player.health <= 0 || player.health >= player.maxHealth) return;
  player.health = Math.min(player.maxHealth, player.health + heal);
  combatVfx?.emit('heal', player.position, { color: 0xffc467, radius: 1.6, intensity: .6 });
  pulseHealth();
}

function applyWeaponHitEffect(zombie, hitEffectType, amount) {
  if (!hitEffectType) {
    return;
  }

  const now = performance.now();
  const effectKey = hitEffectType === "burnTick" ? "burnTick" : hitEffectType;
  const cooldownMs = hitEffectType === "flamethrower" || hitEffectType === "burnTick" ? 170 : 90;
  const shouldShowEffect = !zombie.lastHitEffectAt || zombie.lastHitEffectKey !== effectKey || now - zombie.lastHitEffectAt > cooldownMs;

  if (shouldShowEffect) {
    zombie.lastHitEffectAt = now;
    zombie.lastHitEffectKey = effectKey;
    spawnWeaponHitEffect(zombie.mesh.position, hitEffectType);
  }

  if (hitEffectType === "flamethrower") {
    applyBurnStatus(zombie, amount);
  }

  if (hitEffectType === "frostNova") {
    applyFreezeStatus(zombie);
  }
}

function applyBurnStatus(zombie, amount) {
  const profile = monsterProfiles[zombie.type] ?? {};
  zombie.burnTimer = Math.max(zombie.burnTimer || 0, burnStatusDuration);
  zombie.burnTickTimer = Math.min(zombie.burnTickTimer ?? 0.42, 0.42);
  zombie.burnDps = Math.max(zombie.burnDps || 0, Math.max(1.4, amount * (profile.boss ? 0.28 : 0.44)));
}

function applyFreezeStatus(zombie) {
  const profile = monsterProfiles[zombie.type] ?? {};
  zombie.freezeTimer = Math.max(zombie.freezeTimer || 0, profile.boss ? bossFreezeStatusDuration : freezeStatusDuration);
  zombie.attackCooldown = Math.max(zombie.attackCooldown || 0, profile.boss ? 0.42 : 0.72);
}

function updateZombieStatusEffects(zombie, dt) {
  if (zombie.burnTimer > 0) {
    zombie.burnTimer = Math.max(0, zombie.burnTimer - dt);
    zombie.burnTickTimer = (zombie.burnTickTimer ?? 0.42) - dt;
    if (zombie.burnTickTimer <= 0) {
      zombie.burnTickTimer = 0.48;
      damageZombie(zombie, (zombie.burnDps || 1.4) * 0.48, false, true, "burnTick");
      if (zombie.health <= 0) {
        return false;
      }
    }
  }

  tickSkillControl(zombie, dt, event => presentClassSkill(event), zombie.mesh.position);
  zombie.pullTimer = Math.max(0, (zombie.pullTimer || 0) - dt);

  return zombie.health > 0;
}

function spawnWeaponHitEffect(position, hitEffectType) {
  const vfxType = { flamethrower: 'fire', burnTick: 'fire', frostNova: 'frost', thunderstaff: 'lightning', talisman: 'shockwave', sealRain: 'shockwave', boneCannon: 'impact' }[hitEffectType] || 'impact';
  combatVfx?.emit(vfxType, position, { color: getWeaponColorValue(hitEffectType, 0xffda95), intensity: .55, radius: 1.1 });
  const effectPosition = tempVectorB.copy(position);
  effectPosition.y = 0.28;

  switch (hitEffectType) {
    case "flamethrower":
    case "burnTick":
      spawnBurnImpact(effectPosition);
      return;
    case "frostNova":
      spawnIceImpact(effectPosition);
      return;
    case "thunderstaff":
      spawnLightningImpact(effectPosition);
      return;
    case "axe":
    case "katana":
    case "guardianBlade":
      spawnSlashImpact(effectPosition, hitEffectType === "axe" ? weapons.axe.color : getWeaponColorValue(hitEffectType, weapons.katana.color));
      return;
    case "crossbow":
      spawnPierceImpact(effectPosition, weapons.crossbow.color);
      return;
    case "talisman":
    case "sealRain":
      spawnSealImpact(effectPosition, hitEffectType === "sealRain" ? autoWeaponProfiles.sealRain.color : weapons.talisman.color);
      return;
    case "boneCannon":
      spawnBoneImpact(effectPosition);
      return;
    case "orbitOrb":
      spawnOrbitHitImpact(effectPosition);
      return;
    case "pistol":
      spawnPierceImpact(effectPosition, 0xfff2a3);
      return;
    default:
      return;
  }
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
  effects.push({
    mesh,
    duration,
    age: 0,
    followPlayer,
    poolType,
    baseScaleX: mesh.scale.x,
    baseScaleY: mesh.scale.y,
    baseScaleZ: mesh.scale.z,
  });
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
      effect.baseScaleX * scaleBoost,
      effect.baseScaleY * scaleBoost,
      effect.baseScaleZ * scaleBoost,
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
  if (game.state === 'menu' || characterPreview) {
    if (message.classList.contains('message--login')) {
      const desired = tempVectorC.copy(player.position).add(tempVectorA.set(5, 4.1, 8));
      camera.position.lerp(desired, 1 - Math.exp(-dt * 3));
      camera.lookAt(player.position.x + 1.8, 1.45, player.position.z);
      return;
    }
    const drift = presentationPreferences.reducedMotion ? 0 : Math.sin(clock.elapsedTime * .07) * 1.5;
    camera.position.lerp(tempVectorC.set(12 + drift, 12.5, 20), 1 - Math.exp(-dt * 2));
    camera.lookAt(-3, 1, -6);
    return;
  }
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
  cameraTrauma *= Math.exp(-dt * 9);
  if (!presentationPreferences.reducedMotion && cameraTrauma > .005) {
    const t = game.survivalTime;
    camera.position.x += Math.sin(t * 67) * cameraTrauma * .24;
    camera.position.y += Math.cos(t * 79) * cameraTrauma * .17;
  }
  camera.lookAt(cameraTarget);
}

function getCameraZoomScale() {
  const scale = getGameConfig("camera.zoomScale");
  const layout = getMobileLayoutStats();
  if (layout.profile !== 'mobile' && layout.profile !== 'mobilePro') return scale;
  // A short landscape viewport otherwise halves the actor's screen height.
  // Ease the framing by aspect ratio while retaining a bounded threat view.
  return scale * clamp(layout.height / layout.width * 1.3, .64, 1);
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
  player.mesh.position.y = heroVisual ? 0 : Math.sin(time * 16) * .025 * playerMoveBlend;
  playerSwingTime = Math.max(0, playerSwingTime - Math.min(perfStats.dt || .016, .035));
  const pose = player.mesh.userData.locomotion;
  const gait = Math.sin(time * 13) * playerMoveBlend;
  pose.leftHip.rotation.x = gait * .6;
  pose.rightHip.rotation.x = -gait * .6;
  pose.leftElbow.rotation.x = -gait * .28;
  pose.rightElbow.rotation.x = gait * .1;
  pose.rightElbow.rotation.y = -Math.sin(playerSwingTime / .28 * Math.PI) * .95;
  pose.backPanel.rotation.x = .04 + Math.sin(time * 9) * .06 * playerMoveBlend;

  for (const zombie of zombies) {
    if (zombie.mesh.userData.animatedEnemy) { zombie.mesh.position.y = 0; continue; }
    const flyingBase = zombie.mesh.userData.flying ? 0.85 : 0;
    zombie.mesh.position.y = flyingBase + Math.sin(time * (zombie.mesh.userData.flying ? 3.2 : 6) + zombie.wobble) * (zombie.mesh.userData.flying ? 0.18 : 0.05);
    animateZombieParts(zombie, time);
  }

  for (const prop of graveProps) {
    prop.rotation.x = Math.sin(time * 0.7 + prop.position.x) * 0.015;
  }
}

function animateZombieParts(zombie, time) {
  if (zombie.renderMode === "instanced") {
    return;
  }

  const parts = zombie.mesh.userData.animatedParts;
  if (!parts) {
    return;
  }

  const swing = Math.sin(time * (zombie.type === "cowCharger" ? 11 : 7.5) + zombie.wobble);
  if (parts.leftArm) {
    parts.leftArm.rotation.x = -0.42 + swing * 0.26;
  }
  if (parts.rightArm) {
    parts.rightArm.rotation.x = -0.42 - swing * 0.26;
  }
  if (parts.head) {
    parts.head.rotation.y = swing * 0.08;
  }
}

function removeZombie(index) {
  cancelZombieCaster(zombies[index], zombies[index]?.health <= 0 ? 'death' : 'removed');
  const [zombie] = zombies.splice(index, 1);
  zombieActorIndex?.remove(`monster:${zombie.id}`);
  animatedEnemies?.remove(zombie);
  if (zombie.labelSprite) {
    scene.remove(zombie.labelSprite);
    zombie.labelSprite.material.map.dispose();
    zombie.labelSprite.material.dispose();
  }
  releaseZombieMesh(zombie.mesh, zombie.type);
  spatialGrid.dirty = true;
}

function removeZombieByRef(zombie) {
  const index = zombies.indexOf(zombie);
  if (index >= 0) {
    removeZombie(index);
  }
}

function removeBullet(index) {
  const [bullet] = bullets.splice(index, 1);
  releaseProjectileMesh(bullet.mesh, entityPools.bullets);
}

function removeEnemyProjectile(index) {
  const [projectile] = enemyProjectiles.splice(index, 1);
  casterProjectilePresentation.release(projectile);
  releaseEnemyProjectileVisual(projectile);
}

function removePowerup(index) {
  const [powerup] = powerups.splice(index, 1);
  if (powerup.serverDropId) {
    serverPowerupsById.delete(powerup.serverDropId);
    pendingMultiplayerPickups.delete(powerup.serverDropId);
    retiredServerDrops.add(powerup.serverDropId);
    while (retiredServerDrops.size > 1024) retiredServerDrops.delete(retiredServerDrops.values().next().value);
  }
  scene.remove(powerup.mesh);
  if (powerup.labelSprite) {
    scene.remove(powerup.labelSprite);
    powerup.labelSprite.material.map?.dispose();
    powerup.labelSprite.material.dispose();
  }
  disposeObject(powerup.mesh);
}

function removeXpGem(index) {
  const [gem] = xpGems.splice(index, 1);
  releaseXpGemMesh(gem.mesh);
}

function clearEntities() {
  clearDashTransforms();
  clearPreparingWarCries();
  clearCasterLaunchPresentation();
  for (const zombie of zombies) cancelZombieCaster(zombie, 'world-reset');
  offlineCasterEpoch = crypto.randomUUID(); offlineCasterTick = 0; casterEventHistory.length = 0;
  animatedEnemies?.clear();
  weaponFireEmitter?.dispose();
  weaponFireEmitter = null;
  combatVfx?.reset();
  classSkillVfx?.reset();
  hazardVfx?.reset();
  elementalVfx?.reset();
  cancelArsenal(arsenalState);
  arsenalVfx?.reset();
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

  while (traps.length > 0) {
    removeTrap(traps.length - 1);
  }

  while (damageNumbers.length > 0) {
    const [number] = damageNumbers.splice(damageNumbers.length - 1, 1);
    releaseDamageNumberSprite(number.sprite);
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

  resetInstancedMonsterBuckets();
  if (xpGemRenderer.mesh) {
    xpGemRenderer.count = 0;
    xpGemRenderer.mesh.count = 0;
  }
  if (enemyProjectileRenderer.mesh) {
    enemyProjectileRenderer.count = 0;
    enemyProjectileRenderer.mesh.count = 0;
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          material.map?.dispose();
          material.dispose();
        });
      } else {
        child.material.map?.dispose();
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
  clearDashTransforms();
  clearPreparingWarCries();
  for (const zombie of zombies) cancelZombieCaster(zombie, 'run-ended');
  clearRunStartRejection();
  zombieActorIndex?.remove(`player:${multiplayer.id || 'local'}`);
  pendingSkillRequest = null;
  cancelSkills(classSkillState, event => classSkillVfx?.emit(event), 'end');
  classSkillVfx?.reset();
  cancelArsenal(arsenalState, presentArsenalEvent, 'death');
  onlineSkillMotion = null; remoteSkillSnapshots = []; persistentSkillPresentation.clear();
  audioManager.samples?.reset();
  characterPreview = false;
  paused = false;
  document.body.classList.remove('game-paused');
  clearPlayerInput();
  combatVfx?.emit('death', player.position, { color: 0xd76955, intensity: 2 });
  game.state = "dead";
  pendingSwordStrike = null; swordSwingRemaining = 0;
  game.shooting = false;
  audioManager.endRun();
  player.pendingUpgradeChoices = [];
  player.pendingLevelUps = 0;
  renderUpgradeChoices();
  sendMultiplayerState();
  void submitSoloLeaderboardSession();
  menuIdentity ??= { title: messageTitle.textContent, kicker: messageKicker.textContent, copy: messageCopy.textContent,
    label: currentPlayButtonLabel().textContent, copyRole: messageCopy.getAttribute('role'), describedBy: playButton.getAttribute('aria-describedby') };
  const build = getPlayerBuildSummary();
  messageKicker.textContent = `Onda ${player.wave}`;
  messageTitle.textContent = "Fim da noite";
  messageCopy.textContent = `${formatSurvivalTime(game.survivalTime)} de sobrevivência · ${formatHudNumber(player.kills)} abates · ${formatHudNumber(player.score)} pontos · Nível ${player.bestLevel}. `
    + (build.length ? `Poderes: ${build.join(', ')}.` : 'Nenhum poder escolhido.');
  messageCopy.setAttribute('role', 'status');
  currentPlayButtonLabel().textContent = 'Tentar de novo';
  playButton.setAttribute('aria-describedby', 'message-copy');
  message.classList.add("message--game-over");
  message.classList.add("message--login");
  message.classList.remove("is-hidden");
  // The player often dies holding attack; ignore restart input briefly, then make the next step explicit.
  deathInputGuardUntil = performance.now() + 600;
  if (!playButton.disabled) playButton.focus({ preventScroll: true });
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
  const relicName = player.weaponTimer > 0 ? getRelicName(player.relic, player.character) : null;
  weaponNameElement.textContent = relicName || playableCharacters[player.character].weapon;
  weaponTimerElement.textContent = player.weaponTimer > 0 ? `${relicName ? 'Relíquia' : '+40%'} · ${Math.ceil(player.weaponTimer)}s` : 'PRONTA';
  weaponNameElement.parentElement.dataset.relic = relicName ? player.relic : '';
  renderSkillHud();
  renderPerfOverlay();
  updateOnlineScoreboardHud();
}

function formatSurvivalTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function formatHudNumber(value) {
  return Math.floor(Number(value) || 0).toLocaleString("pt-BR");
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
          <span aria-hidden="true">${skill.sprite ? `<svg class="ui-icon" viewBox="0 0 64 64"><use href="./assets/ui/arpg/icons.svg#${escapeHtml(skill.sprite)}"/></svg>` : skill.symbol ? `<svg class="ui-icon"><use href="#icon-${skill.symbol}"/></svg>` : skill.icon}</span>
          <small>Nv. ${skill.level}</small>
        </span>
      `,
    )
    .join("");
}

function getHudSkills() {
  const skills = [
    {
      icon: hudWeaponIcons[player.weapon] || "⚔",
      symbol: player.character === 'warrior' ? 'blade' : 'rifle',
      title: playableCharacters[player.character].weapon,
      level: 1 + (player.upgradeStacks.damage || 0),
    },
  ];

  for (const [weaponId, state] of Object.entries(player.autoWeapons)) {
    if (state.level > 0) {
      const evolutionId = player.evolvedWeapons[weaponId];
      skills.push({
        icon: hudWeaponIcons[evolutionId] || hudWeaponIcons[weaponId] || "✦",
        title: getAutoWeaponDisplayLabel(weaponId),
        level: state.level,
      });
    }
  }

  for (const [upgradeId, stacks] of Object.entries(player.upgradeStacks)) {
    if (stacks > 0) {
      const definition = upgradeDefinitions.find((upgrade) => upgrade.id === upgradeId);
      skills.push({
        icon: hudUpgradeIcons[upgradeId] || "◆",
        sprite: definition?.kind === "skill" ? getSkillUpgradeIcon(definition, player.character) : null,
        title: definition?.kind === "skill" ? `${definition.label} · ${getSkillUpgradeTag(definition, player.character)}` : definition?.label || upgradeId,
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

function usesServerAuthoritativeWorld() {
  return multiplayer.enabled;
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
      websocketUrl.searchParams.set("character", player.character);
      if (multiplayerResumeToken) websocketUrl.searchParams.set('resumeToken', multiplayerResumeToken);
      else websocketUrl.searchParams.delete('resumeToken');
      return websocketUrl.toString();
    } catch {
      return null;
    }
  }

  if (!window.location.host) {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const websocketUrl = new URL(`${protocol}//${window.location.host}/ws`);
  websocketUrl.searchParams.set('room', multiplayer.room);
  websocketUrl.searchParams.set('name', player.name);
  websocketUrl.searchParams.set('character', player.character);
  if (multiplayerResumeToken) websocketUrl.searchParams.set('resumeToken', multiplayerResumeToken);
  return websocketUrl.toString();
}

function connectMultiplayer() {
  const websocketUrl = getMultiplayerUrl();

  if (!websocketUrl) {
    multiplayer.status = "Solo";
    updateMultiplayerHud();
    return;
  }

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
    if (multiplayer.socket !== socket) return;
    handleMultiplayerMessage(event.data);
  });

  socket.addEventListener("close", () => {
    if (multiplayer.socket !== socket) {
      return;
    }

    multiplayer.socket = null;
    multiplayer.connected = false;
    clearDashTransforms();
    clearPreparingWarCries();
    casterPresentationInbox.clear();
    clearCasterLaunchPresentation();
    for (const zombie of zombies) if (zombie.type === 'caster' && zombie.casterCastVisual) {
      zombie.casterCastVisual = { ...zombie.casterCastVisual, paused: true };
      animatedEnemies?.syncCast(zombie);
    }
    // Presentation has no authority to extend the last disconnected snapshot.
    remoteSkillSnapshots = [];
    persistentSkillPresentation.clear();
    skillSoundTravel.clear();
    onlineSkillMotion = null;
    audioManager.samples?.reset();
    classSkillVfx?.reset();
    if (pendingMultiplayerStart) pendingMultiplayerStart.sent = false;
    if (pendingMultiplayerUpgrade) pendingMultiplayerUpgrade.lastSentAt = -Infinity;
    for (const command of pendingMultiplayerPickups.values()) command.lastSentAt = -Infinity;
    clearPlayerInput();
    pendingSwordStrike = null; swordSwingRemaining = 0;
    keyboardAimActive = false; keyboardAimReleaseUntil = 0;
    clearRemotePlayers();

    if (!multiplayer.full) {
      multiplayer.status = multiplayer.enabled ? "Reconectando" : "Solo";
      multiplayer.reconnectTimer = Math.min(8, 2 + multiplayer.reconnectAttempts * 1.5);
      multiplayerReconnectAt = performance.now() + multiplayer.reconnectTimer * 1000;
      multiplayer.reconnectAttempts += 1;
    }

    updateMultiplayerHud();
    renderUpgradeChoices();
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

  if (messageData.type === 'positionCorrection') {
    if (messageData.runId === multiplayerAuthorityRunId && Number.isFinite(messageData.x) && Number.isFinite(messageData.z)) {
      if (onlineSkillMotion) Object.assign(onlineSkillMotion, { x: messageData.x, z: messageData.z });
      else { player.position.set(messageData.x, 0, messageData.z); player.mesh.position.copy(player.position); heroVisualMotion.initialized = false; }
    }
    return;
  }
  if (messageData.type === 'skillEvent') {
    if (!messageData.runId || messageData.id !== multiplayer.id || messageData.runId === multiplayerAuthorityRunId) {
      const ageMs = Number.isFinite(messageData.serverTime) && multiplayerClockOffset !== null ? Math.max(0, Date.now() - messageData.serverTime - multiplayerClockOffset) : 0;
      presentClassSkill({ ...messageData.event, ageMs }, messageData.id);
    }
    return;
  }
  if (messageData.type === 'arsenalEvent') {
    if (messageData.id !== multiplayer.id || messageData.runId === multiplayerAuthorityRunId) presentArsenalEvent(messageData.event, messageData.id);
    return;
  }
  if (messageData.type === 'skillState' || messageData.type === 'skillResult') {
    if (messageData.runId !== multiplayerAuthorityRunId) return;
    const previous = classSkillState;
    classSkillState = restoreSkillSnapshot(messageData.skills);
    playSkillsReady(previous, classSkillState);
    if (messageData.type === 'skillResult') {
      if (pendingSkillRequest?.id === messageData.requestId) {
        if (!messageData.result?.ok) playSkillFeedback(pendingSkillRequest.slot, 'resourcefail');
        pendingSkillRequest = null;
      }
    }
    publishArpgState();
    return;
  }

  if (messageData.type === "roomFull") {
    multiplayer.full = true;
    multiplayer.status = "Sala cheia";
    updateMultiplayerHud();
    return;
  }

  if (Number.isFinite(messageData.world?.serverTime)) {
    const observedOffset = Date.now() - messageData.world.serverTime;
    multiplayerClockOffset = multiplayerClockOffset === null ? observedOffset : Math.min(multiplayerClockOffset, observedOffset);
  }

  if (messageData.type === "welcome") {
    const hadResumeToken = Boolean(multiplayerResumeToken);
    multiplayerResumeToken = typeof messageData.resumeToken === 'string' ? messageData.resumeToken : null;
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

    clearPlayerInput();
    if (pendingMultiplayerStart) {
      // An explicit start may have reached the server before its reply was lost.
      // Re-send its same requestId only after welcome; the server deduplicates it.
      pendingMultiplayerStart.sent = false;
    } else if (!messageData.resumed && hadResumeToken && game.state === 'playing') {
      // Grace expired: the new server identity has no prior authoritative run.
      startGame();
    } else {
      applyAuthoritativeSelfState(messageData.selfState ?? selfSnapshot?.state);
      const resumePosition = messageData.selfState ?? selfSnapshot?.state;
      if (messageData.resumed && Number.isFinite(resumePosition?.x) && Number.isFinite(resumePosition?.z)) {
        player.position.set(resumePosition.x, 0, resumePosition.z); player.mesh.position.copy(player.position); heroVisualMotion.initialized = false;
      }
    }

    clearRemotePlayers();
    for (const remotePlayer of messageData.players ?? []) {
      if (remotePlayer.id !== multiplayer.id) {
        upsertRemotePlayer(remotePlayer);
      }
    }

    if (messageData.world) {
      syncServerWorld(messageData.world);
    }

    if (!pendingMultiplayerStart) {
      for (const reward of messageData.pendingRewards ?? []) applyServerPlayerReward(reward);
    }

    updateMultiplayerHud();
    if (pendingMultiplayerStart) sendMultiplayerStart();
    else sendMultiplayerState();
    renderUpgradeChoices();
    updateLocalPlayerName(playerNameInput?.value || player.name);
    return;
  }

  if (messageData.type === 'runStarted') {
    if (pendingMultiplayerStart && messageData.requestId !== pendingMultiplayerStart.requestId) return;
    clearRunStartRejection();
    pendingMultiplayerStart = null;
    clearPlayerInput();
    if (Number.isFinite(messageData.state?.x) && Number.isFinite(messageData.state?.z)) {
      player.position.set(messageData.state.x, 0, messageData.state.z);
      player.mesh.position.copy(player.position); multiplayer.spawn.copy(player.position);
      heroVisualMotion.initialized = false;
    }
    applyAuthoritativeSelfState(messageData.state);
    if (messageData.world) syncServerWorld(messageData.world);
    sendMultiplayerState();
    return;
  }

  if (messageData.type === 'runStartRejected') {
    if (!pendingMultiplayerStart || messageData.requestId !== pendingMultiplayerStart.requestId) return;
    pendingMultiplayerStart = null;
    clearPlayerInput();
    if (Number.isFinite(messageData.state?.x) && Number.isFinite(messageData.state?.z)) {
      player.position.set(messageData.state.x, 0, messageData.state.z);
      player.mesh.position.copy(player.position); heroVisualMotion.initialized = false;
    }
    applyAuthoritativeSelfState(messageData.state);
    multiplayer.status = 'Sem espaço para entrar';
    if (messageData.state?.state !== 'playing') {
      game.state = messageData.state?.state === 'dead' ? 'dead' : 'menu';
      audioManager.samples?.reset(); audioManager.endRun(); classSkillVfx?.reset();
      showRunStartRejection();
    }
    updateMultiplayerHud(); publishArpgState();
    return;
  }

  if (messageData.type === 'progressionResult') {
    handleProgressionResult(messageData);
    return;
  }

  if (messageData.type === 'progressionEffect') {
    if (messageData.effect?.kind === 'cuttingMoon') {
      const origin = new THREE.Vector3(Number(messageData.x) || 0, 0, Number(messageData.z) || 0);
      spawnExplosion(origin, rarityStyles.legendary.color, Number(messageData.effect.radius) || 9.5);
      spawnTemporaryDropLabel('LUA CORTANTE', 'legendary', '🌙', origin, 1.1);
    }
    return;
  }

  if (messageData.type === "playerJoined") {
    upsertRemotePlayer(messageData.player);
    updateMultiplayerHud();
    return;
  }

  if (messageData.type === "playerState") {
    if (messageData.id === multiplayer.id) {
      if (!pendingMultiplayerStart) applyAuthoritativeSelfState(messageData.state);
      return;
    }
    const remotePlayer = remotePlayers.get(messageData.id);
    if (remotePlayer) {
      updateRemotePlayerState(remotePlayer, messageData.state);
      updateOnlineScoreboardHud();
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

  if (messageData.type === "worldState") {
    syncServerWorld(messageData.world);
    return;
  }

  if (messageData.type === 'monsterCast' && messageData.worldEpoch === multiplayerWorldEpoch && multiplayer.connected) {
    const zombie = serverMonsterById.get(messageData.snapshot?.actorId);
    if (!zombie || zombie.type !== 'caster') return;
    syncNetworkCasterCast(zombie, messageData.snapshot, messageData.event);
    return;
  }

  if (messageData.type === 'monsterMelee'  && messageData.monster) {
    syncServerMonster(Number(messageData.monster.id), messageData.monster);
    return;
  }

  if (messageData.type === "roomWave") {
    syncRoomWave(messageData);
    return;
  }

  if (messageData.type === "roomWipe") {
    handleServerRoomWipe(messageData);
    return;
  }

  if (messageData.type === "monsterHit") {
    handleServerMonsterHit(messageData);
    return;
  }

  if (messageData.type === "monsterKilled") {
    handleServerMonsterKilled(messageData);
    return;
  }

  if (messageData.type === "playerReward") {
    applyServerPlayerReward(messageData);
    return;
  }

  if (messageData.type === "playerAttack") {
    handleRemoteAttack(messageData.id, messageData.attack);
    return;
  }

  // Authoritative combo step for the local Aldric: the prediction in performSwordStrike re-synchronises here.
  if (messageData.type === "attackResult" && messageData.runId === multiplayerAuthorityRunId) {
    heroCombat.combo = Math.max(0, Math.floor(Number(messageData.combo) || 0));
    return;
  }

  if (messageData.type === "playerLeft") {
    removeRemotePlayer(messageData.id);
    updateMultiplayerHud();
  }
}

function updateMultiplayer(dt) {
  if (multiplayer.reconnectTimer > 0) {
    multiplayer.reconnectTimer = Math.max(0, (multiplayerReconnectAt - performance.now()) / 1000);

    if (multiplayer.reconnectTimer <= 0 && multiplayer.enabled && !multiplayer.socket && !multiplayer.full) {
      connectMultiplayer();
    }
  }

  if (multiplayer.connected) {
    sendPendingProgressionCommands();
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

function syncServerWorld(world) {
  if (!world || !multiplayer.connected) {
    return;
  }

  if (world.epoch && world.epoch !== multiplayerWorldEpoch) {
    clearServerSyncedWorld();
    multiplayerWorldEpoch = world.epoch;
    casterPresentationInbox = createCasterPresentationInbox(world.epoch);
  }

  game.serverWorldActive = true;
  remoteSkillSnapshots = world.skillStates || [];
  const skillSnapshotAgeMs = Number.isFinite(world.serverTime) && multiplayerClockOffset !== null
    ? Math.max(0, Date.now() - world.serverTime - multiplayerClockOffset) : 0;
  classSkillVfx?.syncProjectiles?.({ epoch: world.epoch, sequence: world.seq, serverTime: world.serverTime, ageMs: skillSnapshotAgeMs, owners: remoteSkillSnapshots });
  game.serverWorldSeq = Math.max(game.serverWorldSeq, Number(world.seq) || 0);
  player.wave = Math.max(1, Math.floor(Number(world.wave) || 1));
  game.zombiesToSpawn = Math.max(0, Math.floor(Number(world.zombiesToSpawn) || 0));
  waveElement.textContent = player.wave.toString();

  const activeMonsterIds = new Set();
  for (const monsterState of world.monsters ?? []) {
    const monsterId = Number(monsterState.id);
    if (!Number.isFinite(monsterId)) {
      continue;
    }

    activeMonsterIds.add(monsterId);
    syncServerMonster(monsterId, monsterState);
  }

  for (const zombie of [...zombies]) {
    if (!zombie.serverControlled || !activeMonsterIds.has(zombie.serverId)) {
      removeZombieByRef(zombie);
    }
  }

  for (const [monsterId, zombie] of [...serverMonsterById.entries()]) {
    if (!activeMonsterIds.has(monsterId) || !zombies.includes(zombie)) {
      serverMonsterById.delete(monsterId);
    }
  }

  const activeProjectileIds = new Set();
  for (const projectileState of world.projectiles ?? []) {
    const projectileId = Number(projectileState.id);
    if (!Number.isFinite(projectileId)) {
      continue;
    }
    activeProjectileIds.add(projectileId);
    syncServerProjectile(projectileId, projectileState);
  }

  for (const [projectileId, projectile] of [...serverProjectileById.entries()]) {
    if (!activeProjectileIds.has(projectileId)) {
      removeServerProjectile(projectile);
      serverProjectileById.delete(projectileId);
    }
  }

  spatialGrid.dirty = true;
  updateHud(true);
}

function syncNetworkCasterCast(zombie, snapshot, event = null) {
  const result = casterPresentationInbox.receive(snapshot, event);
  if (!result.accepted) return false;
  const preserveDeathPose = ['death', 'removed'].includes(result.visual?.cancelReason);
  const finalVisual = preserveDeathPose && zombie.casterCastVisual
    ? { ...zombie.casterCastVisual, paused: true } : result.visual;
  for (const phase of result.events) {
    recordCasterEvent(phase, 'network');
    if (phase.phase !== 'release') continue;
    animatedEnemies?.syncCast(zombie, { ...result.visual, elapsed: phase.elapsed, active: true, paused: false });
    const sampled = animatedEnemies?.getCastEmitter(zombie, { castId: phase.castId });
    const emitter = sampled && Math.abs(sampled.elapsed - phase.elapsed) < 1e-6 ? sampled : null;
    const spec = getEnemyProjectileSpec('caster');
    const position = emitter?.position || { x: phase.origin.x, y: enemyProjectileCollisionHeight('caster'), z: phase.origin.z };
    // This is only the hand flash. Projectile replicas come exclusively from
    // the authoritative world's projectile list, never from a phase event.
    const safeLaunch = !emitter || casterProjectilePresentation.remember({ castId: phase.castId, actorId: phase.actorId,
      origin: { x: phase.origin.x, y: enemyProjectileCollisionHeight('caster'), z: phase.origin.z }, emitter: emitter.position,
      radius: spec.radius, ageMs: Math.max(0, (snapshot.cast.elapsed - phase.elapsed) * 1000) });
    if (safeLaunch) emitProjectileCast(elementalVfx, { sourceType: 'caster', mesh: { position: new THREE.Vector3(position.x, position.y, position.z) },
      velocity: new THREE.Vector3(phase.direction.x, 0, phase.direction.z), radius: spec.radius, color: spec.color });
  }
  zombie.casterCastVisual = finalVisual;
  animatedEnemies?.syncCast(zombie);
  return true;
}

function syncServerMonster(monsterId, monsterState) {
  let zombie = serverMonsterById.get(monsterId);
  const type = monsterProfiles[monsterState.type] ? monsterState.type : "zombie";

  if (!zombie) {
    zombie = spawnZombie(Number(monsterState.x) || 0, Number(monsterState.z) || 0, type, {
      id: monsterId,
      serverControlled: true,
      eliteType: monsterState.eliteType || null,
      health: Number(monsterState.health),
      maxHealth: Number(monsterState.maxHealth),
    });
    serverMonsterById.set(monsterId, zombie);
  }

  zombie.type = type;
  zombie.serverControlled = true;
  zombie.serverId = monsterId;
  zombie.eliteType = monsterState.eliteType || null;
  zombie.health = Math.max(0, Number(monsterState.health) || 0);
  zombie.maxHealth = Math.max(1, Number(monsterState.maxHealth) || zombie.maxHealth || 1);
  zombie.targetPosition.set(Number(monsterState.x) || 0, 0, Number(monsterState.z) || 0);
  zombie.targetRotation = Number(monsterState.rotation) || 0;
  zombie.freezeTimer = Math.max(0, Number(monsterState.freezeTimer) || 0);
  zombie.stunTimer = Math.max(0, Number(monsterState.stunTimer) || 0);
  zombie.pullTimer = Math.max(0, Number(monsterState.pullTimer) || 0);
  zombie.skillStatuses = monsterState.skillStatuses || {};
  zombie.controlResistance = monsterState.controlResistance || null;
  if (type === 'caster' && monsterState.casterCast) {
    syncNetworkCasterCast(zombie, monsterState.casterCast);
  }
  if (monsterState.meleeAttack && (!zombie.meleeAttack || monsterState.meleeAttack.id >= zombie.meleeAttack.id)) {
    const incoming = monsterState.meleeAttack;
    if (zombie.meleeAttack?.id === incoming.id) {
      const elapsed = Math.max(zombie.meleeAttack.elapsed, incoming.elapsed);
      Object.assign(zombie.meleeAttack, incoming, { elapsed: Math.min(incoming.duration, elapsed) });
    } else zombie.meleeAttack = { ...incoming };
  }

  if (zombie.labelSprite) {
    zombie.labelSprite.userData.maxHealth = zombie.maxHealth;
    updateBossLabel(zombie.labelSprite, zombie.health);
  }
}

function updateServerWorldInterpolation(dt) {
  const moveAlpha = 1 - Math.pow(0.0004, dt);
  const turnAlpha = 1 - Math.pow(0.0006, dt);

  for (const zombie of zombies) {
    if (!zombie.serverControlled || !zombie.targetPosition) {
      continue;
    }
    zombie.mesh.position.x += (zombie.targetPosition.x - zombie.mesh.position.x) * moveAlpha;
    zombie.mesh.position.z += (zombie.targetPosition.z - zombie.mesh.position.z) * moveAlpha;
    zombie.mesh.rotation.y = lerpAngle(zombie.mesh.rotation.y, zombie.targetRotation || 0, turnAlpha);
    if (zombie.type === 'caster' && multiplayer.connected) zombie.casterCastVisual = casterPresentationInbox.advance(zombie.serverId, dt);
    if (zombie.meleeAttack?.active) {
      // Visual extrapolation only; the server owns the impact and damage.
      zombie.meleeAttack.elapsed = Math.min(zombie.meleeAttack.duration, zombie.meleeAttack.elapsed + dt);
    }
    updateBossLabelPosition(zombie);
  }

  for (const projectile of serverProjectileById.values()) {
    projectile.previousPosition ??= new THREE.Vector3();
    projectile.previousPosition.copy(projectile.mesh.position);
    projectile.mesh.position.x += (projectile.targetPosition.x - projectile.mesh.position.x) * moveAlpha;
    projectile.mesh.position.y += (projectile.targetPosition.y - projectile.mesh.position.y) * moveAlpha;
    projectile.mesh.position.z += (projectile.targetPosition.z - projectile.mesh.position.z) * moveAlpha;
    projectile.mesh.rotation.y = lerpAngle(projectile.mesh.rotation.y, projectile.targetRotation || 0, turnAlpha);
    animateEnemyProjectileVisual(projectile, dt);
    emitEnemyProjectileTrail(projectile);
  }
}

function syncServerProjectile(projectileId, projectileState) {
  let projectile = serverProjectileById.get(projectileId);
  const sourceType = monsterProfiles[projectileState.sourceType] ? projectileState.sourceType : "caster";

  if (!projectile) {
    const spec = getEnemyProjectileSpec(sourceType);
    const visual = createEnemyProjectileVisual(spec);
    const mesh = visual.mesh;
    mesh.position.set(Number(projectileState.x) || 0, Number(projectileState.y) || spec.height, Number(projectileState.z) || 0);
    mesh.rotation.y = Number(projectileState.rotation) || 0;
    scene.add(mesh);
    projectile = {
      id: projectileId,
      mesh,
      pooled: visual.pooled,
      visualKind: spec.kind,
      sourceType,
      age: 0,
      phase: Math.random() * Math.PI * 2,
      baseY: spec.height,
      baseScale: mesh.scale.x,
      damage: 0,
      lifespan: spec.lifespan,
      radius: spec.radius,
      color: spec.color,
      impactRadius: spec.impactRadius,
      homing: Boolean(spec.homing),
      speed: spec.speed,
      targetId: null,
      velocity: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      targetRotation: mesh.rotation.y,
      serverControlled: true,
    };
    serverProjectileById.set(projectileId, projectile);
  }

  projectile.castId = projectileState.castId || null;
  casterProjectilePresentation.attach(projectile);
  projectile.age += perfStats.dt || 0.016;
  projectile.targetPosition.set(
    Number(projectileState.x) || 0,
    Number(projectileState.y) || projectile.baseY,
    Number(projectileState.z) || 0,
  );
  projectile.targetRotation = Number(projectileState.rotation) || 0;
}

function removeServerProjectile(projectile) {
  if (!projectile?.mesh) {
    return;
  }
  casterProjectilePresentation.release(projectile);
  scene.remove(projectile.mesh);
  releaseEnemyProjectileVisual(projectile);
}

function clearServerSyncedWorld() {
  clearDashTransforms();
  clearCasterLaunchPresentation();
  for (const zombie of [...zombies]) {
    removeZombieByRef(zombie);
  }
  while (enemyProjectiles.length > 0) {
    removeEnemyProjectile(enemyProjectiles.length - 1);
  }
  while (traps.length > 0) {
    removeTrap(traps.length - 1);
  }
  for (const projectile of [...serverProjectileById.values()]) {
    removeServerProjectile(projectile);
  }
  serverMonsterById.clear();
  serverProjectileById.clear();
  game.serverWorldActive = false;
  game.serverWorldSeq = 0;
  casterPresentationInbox.clear();
}

function syncRoomWave(messageData) {
  player.wave = Math.max(1, Math.floor(Number(messageData.wave) || 1));
  game.zombiesToSpawn = Math.max(0, Math.floor(Number(messageData.zombiesToSpawn) || 0));
  waveElement.textContent = player.wave.toString();
}

function handleServerRoomWipe() {
  clearServerSyncedWorld();
  game.zombiesToSpawn = 0;
  player.wave = 1;
  waveElement.textContent = "1";
  updateHud(true);
}

function handleServerMonsterHit(messageData) {
  const zombie = serverMonsterById.get(Number(messageData.id));
  if (!zombie) {
    return;
  }

  const amount = Math.max(0, Number(messageData.amount) || 0);
  zombie.health = Math.max(0, Number(messageData.health) || zombie.health - amount);
  spawnDamageNumber(zombie.mesh.position, amount, false, zombie.id);
  applyWeaponHitEffect(zombie, messageData.hitEffect, amount);
  if (zombie.mesh.userData.animatedEnemy) animatedEnemies.hit(zombie);
  else flashZombie(zombie.mesh);
  if (zombie.labelSprite) {
    updateBossLabel(zombie.labelSprite, zombie.health, true);
  }
}

function handleServerMonsterKilled(messageData) {
  const monsterState = messageData.monster || {};
  casterPresentationInbox.remove(Number(monsterState.id));
  const zombie = serverMonsterById.get(Number(monsterState.id));
  const position = zombie
    ? zombie.mesh.position.clone()
    : new THREE.Vector3(Number(monsterState.x) || player.position.x, 0, Number(monsterState.z) || player.position.z);
  const type = monsterProfiles[monsterState.type] ? monsterState.type : "zombie";
  const profile = monsterProfiles[type] ?? {};
  combatVfx?.emit('death', position, { color: profile.boss ? 0xecc891 : 0x71bbb4, intensity: profile.boss ? 2 : .65 });

  if (zombie) {
    audioManager.play("kill", { priority: profile.boss ? 3 : 1, ...getSpatialAudioOptions(position) });
    animatedEnemies?.remove(zombie, { death: true, deathStyle: messageData.deathStyle, killedBySkillId: messageData.killedBySkillId, direction: messageData.direction });
    removeZombieByRef(zombie);
    serverMonsterById.delete(Number(monsterState.id));
  }

  if (type === "sofra") {
    spawnSofraDeathBurst(position);
  }
}

function applyServerPlayerReward(messageData) {
  if (pendingMultiplayerStart) return;
  const rewardId = String(messageData.rewardId || `${messageData.runId}:${messageData.monster?.id}`);
  if (messageData.runId && multiplayerAuthorityRunId && messageData.runId !== multiplayerAuthorityRunId) {
    sendMultiplayerMessage({ type: 'rewardAck', rewardId });
    return;
  }
  if (messageData.state) applyAuthoritativeSelfState(messageData.state);
  if (appliedMultiplayerRewards.has(rewardId)) {
    sendMultiplayerMessage({ type: 'rewardAck', rewardId });
    return;
  }
  appliedMultiplayerRewards.add(rewardId);
  while (appliedMultiplayerRewards.size > 512) appliedMultiplayerRewards.delete(appliedMultiplayerRewards.values().next().value);

  // XP, boss count and loot are already included in the authoritative snapshot.
  updateHud(true);
  sendMultiplayerMessage({ type: 'rewardAck', rewardId });
}

function sendPendingProgressionCommands() {
  if (isMultiplayerSuspended() || game.state !== 'playing') return;
  const now = performance.now();
  const commands = [pendingMultiplayerUpgrade, ...pendingMultiplayerPickups.values()];
  for (const command of commands) {
    if (!command || command.runId !== multiplayerAuthorityRunId || now - command.lastSentAt < 1000) continue;
    const { lastSentAt, ...payload } = command;
    command.lastSentAt = now;
    sendMultiplayerMessage(payload);
  }
}

function handleProgressionResult(messageData) {
  if (pendingMultiplayerStart || messageData.runId !== multiplayerAuthorityRunId) return;
  const choice = pendingMultiplayerUpgrade?.requestId === messageData.requestId ? pendingMultiplayerUpgrade : null;
  const pickup = [...pendingMultiplayerPickups.values()].find(command => command.requestId === messageData.requestId);
  if (choice) pendingMultiplayerUpgrade = null;
  if (pickup) {
    pendingMultiplayerPickups.delete(pickup.dropId);
    const powerup = serverPowerupsById.get(pickup.dropId);
    if (powerup && !messageData.result?.ok) powerup.nextPickupAttemptAt = performance.now() + 500;
  }
  applyAuthoritativeSelfState(messageData.state);
  if (choice) renderUpgradeChoices();
}

function syncAuthoritativeDrops(descriptors = []) {
  const active = new Set();
  for (const descriptor of descriptors) {
    if (typeof descriptor.id !== 'string' || !(Number(descriptor.ttl) > 0) || retiredServerDrops.has(descriptor.id)) continue;
    active.add(descriptor.id);
    let powerup = serverPowerupsById.get(descriptor.id);
    if (!powerup) {
      const before = powerups.length;
      const position = new THREE.Vector3(Number(descriptor.x) || 0, 0, Number(descriptor.z) || 0);
      if (descriptor.kind === 'healthPotion') spawnHealthPotionAt(position, descriptor.amount, descriptor.source);
      else if (descriptor.kind === 'bossChest') spawnBossRewardChestAt(position, descriptor.bossType);
      else if (descriptor.kind === 'perk') spawnPerkDropAt(position, descriptor.perkId, descriptor.rarity, descriptor.source);
      else if (descriptor.kind === 'weapon') spawnPowerup(descriptor.type, position.x, position.z, { source: descriptor.source });
      if (powerups.length === before) continue;
      powerup = powerups[powerups.length - 1];
      powerup.serverDropId = descriptor.id;
      powerup.life = 0;
      powerup.ttl = Number(descriptor.ttl);
      serverPowerupsById.set(descriptor.id, powerup);
    } else {
      // A reward replay with the same stateVersion cannot extend an item's life.
      powerup.ttl = powerup.life + Math.min(Math.max(0, powerup.ttl - powerup.life), Number(descriptor.ttl));
    }
    powerup.mesh.position.x = Number(descriptor.x) || 0;
    powerup.mesh.position.z = Number(descriptor.z) || 0;
    powerup.radius = Number(descriptor.radius) || powerup.radius;
    updatePowerupLabelPosition(powerup);
  }
  for (let index = powerups.length - 1; index >= 0; index--) {
    const id = powerups[index].serverDropId;
    if (!id || !active.has(id)) removePowerup(index);
  }
  for (const [id] of pendingMultiplayerPickups) if (!active.has(id)) pendingMultiplayerPickups.delete(id);
}

function applyAuthoritativeProgression(progression, { newRun = false, newerVersion = false } = {}) {
  if (!progression) return;
  const previousStacks = player.upgradeStacks;
  const previousOfferId = multiplayerUpgradeOfferId;
  const previousChoice = pendingMultiplayerUpgrade;
  const previousWeaponTimer = player.weaponTimer;
  const previousRevives = player.revives;
  player.xp = Math.max(0, Number(progression.xp) || 0);
  player.xpToNext = Math.max(1, Number(progression.xpToNext) || getXpToNext(player.level));
  player.upgradeStacks = { ...progression.upgradeStacks };
  player.upgradeStats = { ...createDefaultUpgradeStats(), ...progression.upgradeStats };
  player.perks = { ...progression.perks };
  player.pendingLevelUps = Math.max(0, Number(progression.pendingLevelUps) || 0);
  player.pendingUpgradeSource = progression.offer?.source || 'level';
  player.pendingUpgradeChoices = (progression.offer?.upgradeIds || []).map(id => upgradeById.get(id)).filter(Boolean);
  multiplayerUpgradeOfferId = progression.offer?.id || null;
  player.rarityPity = Math.max(0, Number(progression.rarityPity) || 0);
  const exhaustedRewards = Math.max(0, Math.floor(Number(progression.exhaustedRewards) || 0));
  if (!newRun && exhaustedRewards > (player.exhaustedRewards || 0)) announceExhaustedReward(exhaustedRewards - (player.exhaustedRewards || 0));
  player.exhaustedRewards = exhaustedRewards;
  player.damageReduction = Math.max(0, Number(progression.damageReduction) || 0);
  player.critChance = Math.max(0, Number(progression.critChance) || 0);
  player.critMultiplier = Number(progression.critMultiplier) || 1.8;
  player.bossKills = Math.max(0, Number(progression.bossKills) || 0);
  player.revives = Math.max(0, Number(progression.revives) || 0);
  const weaponTimer = Math.max(0, Number(progression.weaponTimer) || 0);
  const prismTimer = Math.max(0, Number(progression.prismStormRemaining) || 0);
  player.weaponTimer = newerVersion ? weaponTimer : Math.min(player.weaponTimer, weaponTimer);
  player.perkCooldowns.prismStorm = newerVersion ? prismTimer : Math.min(player.perkCooldowns.prismStorm, prismTimer);
  applyAuthoritativeArsenal(progression, newRun, previousWeaponTimer);
  if (!newRun && player.revives < previousRevives) triggerPerkAnimation('lastBreath', player.position, 'legendary');
  if (pendingMultiplayerUpgrade && pendingMultiplayerUpgrade.offerId !== multiplayerUpgradeOfferId) pendingMultiplayerUpgrade = null;
  let stacksChanged = false;
  for (const [id, stacks] of Object.entries(player.upgradeStacks)) {
    if (stacks <= (previousStacks[id] || 0)) continue;
    stacksChanged = true;
    const definition = upgradeById.get(id);
    if (!newRun && definition) {
      audioManager.play('upgradeChoice', { rarity: definition.rarity, priority: 3 });
      if (definition.kind === 'perk') triggerPerkAnimation(id, player.position, definition.rarity);
    }
  }
  syncAuthoritativeDrops(progression.drops);
  if (newRun || stacksChanged || previousOfferId !== multiplayerUpgradeOfferId || previousChoice !== pendingMultiplayerUpgrade) renderUpgradeChoices();
}

function applyAuthoritativeSelfState(state) {
  if (!state || typeof state.runId !== 'string') return false;
  const version = Number(state.stateVersion) || 0;
  const newRun = state.runId !== multiplayerAuthorityRunId;
  if (!newRun && version < multiplayerAuthorityVersion) return false;
  const newerVersion = newRun || version > multiplayerAuthorityVersion;
  const previousHealth = player.health;
  const previousLevel = player.level;
  if (newRun) {
    multiplayerAuthorityRunId = state.runId;
    multiplayerAppliedXpTotal = 0;
    appliedMultiplayerRewards.clear();
    resetProgressionState();
  }
  multiplayerAuthorityVersion = version;
  player.maxHealth = Math.max(1, Math.min(playerNetworkMaxHealthCap, Number(state.maxHealth) || playerBaseMaxHealth));
  player.health = Math.max(0, Math.min(player.maxHealth, Number(state.health) || 0));
  player.score = Math.max(0, Math.floor(Number(state.score) || 0));
  player.kills = Math.max(0, Math.floor(Number(state.kills) || 0));
  player.level = Math.max(1, Math.floor(Number(state.level) || 1));
  player.bestLevel = Math.max(player.level, Number(state.bestLevel) || 1);
  const xpTotal = Math.max(0, Math.floor(Number(state.xpTotal) || 0));
  const xpDelta = Math.max(0, xpTotal - multiplayerAppliedXpTotal);
  multiplayerAppliedXpTotal = Math.max(multiplayerAppliedXpTotal, xpTotal);
  applyAuthoritativeProgression(state.progression, { newRun, newerVersion });
  if (state.skills) classSkillState = restoreSkillSnapshot(state.skills);
  if (state.state !== 'playing') {
    pendingMultiplayerUpgrade = null;
    pendingMultiplayerPickups.clear();
    player.pendingUpgradeChoices = [];
    renderUpgradeChoices();
  }
  if (!newRun && xpDelta > 0) audioManager.play('xp', { value: xpDelta, priority: 1 });
  if (!newRun && player.level > previousLevel) {
    spawnLevelPulse();
    audioManager.play('levelUp', { priority: 3 });
    if (player.perkCooldowns.prismStorm > 0) triggerPerkAnimation('prismStorm', player.position, 'epic');
  }
  // Aldric's leech arrives as many small authoritative heals; only potion-sized gains get the burst.
  if (!newRun && player.health > previousHealth + 6) {
    combatVfx?.emit('heal', player.position, { color: 0xa2e4bc, radius: 2 });
    pulseHealth();
  }
  if (state.state === 'playing') clearRunStartRejection();
  if (state.state === 'dead' && game.state === 'playing') endGame();
  else if (state.state === 'playing' && game.state !== 'playing') {
    game.state = 'playing';
    message.classList.add('is-hidden');
  }
  updateHud(true);
  return true;
}

function getPlayerBuildSummary() {
  const unlockedWeapons = Object.entries(player.autoWeapons)
    .filter(([, state]) => state.level > 0)
    .map(([weaponId]) => getAutoWeaponDisplayLabel(weaponId))
    .filter(Boolean);

  // Rarest first (stable), like authority.syncProgression: the eight slots keep the cards that define the build.
  const upgrades = Object.entries(player.upgradeStacks)
    .filter(([, stacks]) => stacks > 0)
    .sort(([first], [second]) => getRarityRank(upgradeById.get(second)?.rarity) - getRarityRank(upgradeById.get(first)?.rarity))
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
    traps: entityPools.traps.length,
    damageNumbers: entityPools.damageNumbers.length,
  };

  return {
    fpsAverage: Number(perfStats.fpsAverage.toFixed(1)),
    quality: qualityManager.level,
    qualityMode: qualityManager.mode,
    mobileLayout: getMobileLayoutStats(),
    pixelRatio: Number(qualityManager.pixelRatio.toFixed(2)),
    updateMs: Number(perfStats.updateMs.toFixed(2)),
    logicMs: Number(perfStats.logicMs.toFixed(2)),
    renderMs: Number(perfStats.renderMs.toFixed(2)),
    frameMs: Number(perfStats.totalFrameMs?.toFixed(2) || 0),
    drawCalls: renderer.info.render.calls,
    visibleDetailedZombies: perfStats.visibleDetailedZombies,
    instancedZombies: perfStats.instancedZombies,
    labelUpdates: perfStats.labelUpdates,
    gridQueries: perfStats.gridQueries,
    objectAllocWarnings: perfStats.objectAllocWarnings,
    skippedEffects: perfStats.skippedEffects,
    renderIntegrity: getMonsterRenderIntegrity(),
    entities: {
      zombies: zombies.length,
      bullets: bullets.length,
      enemyProjectiles: enemyProjectiles.length,
      xpGems: xpGems.length,
      effects: effects.length,
      traps: traps.length,
      damageNumbers: damageNumbers.length,
      remotePlayers: remotePlayers.size,
    },
    poolUsage,
    poolExpansions: { ...perfStats.poolExpansions },
  };
}

function sendMultiplayerState() {
  if (pendingMultiplayerStart) return;
  sendMultiplayerMessage({
    type: "state",
    state: {
      stateVersion: multiplayerAuthorityVersion,
      x: player.position.x,
      z: player.position.z,
      rotation: player.mesh.rotation.y,
      aimX: player.aimDirection.x,
      aimZ: player.aimDirection.z,
      character: player.character,
      weapon: player.weapon,
      shooting: game.shooting,
      state: game.state,
    },
  });
}

function emitAttackVfx(kind, origin, direction) {
  if (kind === 'katana' && origin === player.position) playerSwingTime = .28;
  const type = {
    pistol: 'muzzle', crossbow: 'muzzle', flamethrower: 'fire', katana: 'slash', axe: 'slash',
    guardianBlade: 'slash', talisman: 'teleport', thunderstaff: 'lightning', boneCannon: 'muzzle',
    frostNova: 'frost', orbitOrb: 'ambient', sealRain: 'shockwave',
  }[kind] || 'impact';
  const radius = { axe: 4.4, katana: 2.1, guardianBlade: 2.4, frostNova: 7.2, sealRain: 3.5 }[kind] || 1.2;
  let visualOrigin = kind === 'pistol' && origin === player.position && heroVisual?.muzzle
    ? heroVisual.muzzle.getWorldPosition(new THREE.Vector3()) : origin;
  if (kind === 'katana') {
    visualOrigin = new THREE.Vector3().copy(origin).addScaledVector(direction, .35);
    visualOrigin.y += (origin === player.position ? heroVisual?.stats.runtimeHeight || 2.7 : 2.7) * .48;
  }
  combatVfx?.emit(type, visualOrigin, {
    direction, radius, tilt: kind === 'katana' ? .35 : undefined, color: getWeaponColorValue(kind, 0xffd69a),
    target: kind === 'thunderstaff' ? { x: origin.x + direction.x * 14, y: 1, z: origin.z + direction.z * 14 } : undefined,
  });
  if (kind === 'guardianBlade' && player.evolvedWeapons.guardianBlade) {
    combatVfx?.emit('bladeStorm', origin, { color: 0xbdebf2, radius: 3.2, direction });
  }
  if (kind === 'sealRain') {
    combatVfx?.emit('judgement', origin, { color: 0xe4c9fc, radius: 3.5 });
  }
  if (kind === 'talisman' && origin === player.position) {
    combatVfx?.summonEcho(origin, { direction, color: 0x98b8e1, duration: .85 });
  }
  if (['axe', 'katana', 'boneCannon', 'frostNova'].includes(kind) && !presentationPreferences.reducedMotion) {
    cameraTrauma = Math.max(cameraTrauma, .08);
  }
}

function sendMultiplayerAttack(kind, origin = player.position, direction = player.aimDirection) {
  if (kind !== playableCharacters[player.character].weaponId) return;
  emitAttackVfx(kind, origin, direction);
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
  // Remote avatars use the arena lighting and their existing marker/emissive
  // materials. Keep the local player's lights; peer joins must not change the
  // scene light-count shader variants (including a light nested under a hand).
  const remoteLights = [];
  mesh.traverse(object => { if (object.isLight) remoteLights.push(object); });
  for (const light of remoteLights) { light.removeFromParent(); light.dispose?.(); }
  const color = new THREE.Color(playerData.color || "#74d1ff");
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(1.02, 0.045, 8, 42),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86 }),
  );
  marker.rotation.x = Math.PI * 0.5;
  marker.position.y = 0.08;
  mesh.add(marker);

  const remotePlayer = {
    id: playerData.id,
    character: playableCharacters[playerData.state?.character || playerData.character] ? (playerData.state?.character || playerData.character) : 'dwarf',
    visualVersion: 0,
    name: playerData.name || "P?",
    color: playerData.color || "#74d1ff",
    health: playerBaseMaxHealth,
    maxHealth: playerBaseMaxHealth,
    score: 0,
    kills: 0,
    wave: 1,
    level: 1,
    bestLevel: 1,
    build: [],
    weapon: "pistol",
    shooting: false,
    state: "menu",
    visual: null,
    visualMotion: createVisualMotion(),
    disposed: false,
    combatTimer: 0,
    phase: Math.random() * Math.PI * 2,
    mesh,
    labelSprite: createPlayerLabelSprite(playerData.name || "P?", playerData.color || "#74d1ff"),
    aimDirection: new THREE.Vector3(0, 0, -1),
    targetPosition: new THREE.Vector3(0, 0, 0),
  };
  remotePlayer.fallback = mesh.children.filter(child => child !== marker && !child.isLight && !child.userData.contactShadow);
  void loadRemoteCharacter(remotePlayer);
  return remotePlayer;
}

async function loadRemoteCharacter(remotePlayer) {
  const version = ++remotePlayer.visualVersion;
  try {
    const visual = await loadPlayableCharacter(remotePlayer.character, { THREE, parent: remotePlayer.mesh });
    if (remotePlayer.disposed || remotePlayer.visualVersion !== version) { visual.dispose(); return; }
    remotePlayer.visual?.dispose();
    remotePlayer.visual = visual;
    for (const child of remotePlayer.fallback) child.visible = false;
  } catch (error) {
    if (!remotePlayer.disposed) console.error('Remote character failed to load', error);
  }
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

  remotePlayer.maxHealth = Math.max(1, Math.min(playerNetworkMaxHealthCap, Number(state.maxHealth) || remotePlayer.maxHealth || playerBaseMaxHealth));
  remotePlayer.health = Math.max(0, Math.min(remotePlayer.maxHealth, Number(state.health) || 0));
  remotePlayer.score = Math.max(0, Number(state.score) || 0);
  remotePlayer.kills = Math.max(0, Number(state.kills) || 0);
  remotePlayer.wave = Math.max(1, Number(state.wave) || 1);
  remotePlayer.level = Math.max(1, Number(state.level) || 1);
  remotePlayer.bestLevel = Math.max(remotePlayer.level, Number(state.bestLevel) || remotePlayer.level);
  remotePlayer.build = Array.isArray(state.build) ? state.build.slice(0, 8) : [];
  const character = playableCharacters[state.character] ? state.character : 'dwarf';
  if (remotePlayer.character !== character) {
    remotePlayer.character = character;
    void loadRemoteCharacter(remotePlayer);
  }
  remotePlayer.weapon = playableCharacters[character].weaponId;
  remotePlayer.relic = state.progression?.relic || null;
  remotePlayer.autoWeapons = state.progression?.autoWeapons || null;
  remotePlayer.areaMultiplier = Number(state.progression?.upgradeStats?.areaMultiplier) || 1;
  remotePlayer.shooting = Boolean(state.shooting);
  remotePlayer.state = state.state || "menu";
  updatePlayerLabel(remotePlayer.labelSprite, remotePlayer.name, remotePlayer.color, remotePlayer.health, remotePlayer.maxHealth);
}

function applyNetworkPlayerState(playerId, state, amount = 0) {
  if (!state) {
    return;
  }

  if (playerId === multiplayer.id) {
    if (pendingMultiplayerStart) return;
    const previousHealth = player.health;
    if (!applyAuthoritativeSelfState(state)) return;

    if (player.health < previousHealth || amount > 0) {
      heroVisual?.hit();
      cinematicPipeline?.impact(Math.min(.5, Math.max(amount, previousHealth - player.health) / 60));
      spawnPlayerDamageNumber(amount > 0 ? amount : previousHealth - player.health, player.position);
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
    remotePlayer.mesh.position.y = remotePlayer.visual ? 0 : Math.sin(clock.elapsedTime * 8 + remotePlayer.phase) * 0.035;
    remotePlayer.mesh.rotation.y = lerpAngle(
      remotePlayer.mesh.rotation.y,
      getForwardRotation(remotePlayer.aimDirection),
      turnAlpha,
    );
    sampleVisualMotion(remotePlayer.visualMotion, remotePlayer.mesh.position, dt, remotePlayer.state === 'playing');
    remotePlayer.visualMotion.dead = remotePlayer.state === 'dead';
    remotePlayer.visual?.update(dt, remotePlayer.visualMotion);

    if (game.labelFrameReady) {
      remotePlayer.labelSprite.position.copy(remotePlayer.mesh.position);
      remotePlayer.labelSprite.position.y = 3.1;
    }
    remotePlayer.combatTimer = Math.max(0, remotePlayer.combatTimer - dt);

    if (remotePlayer.shooting && remotePlayer.state === "playing" && remotePlayer.combatTimer <= 0) {
      remotePlayer.combatTimer = getRemoteAttackInterval(remotePlayer.weapon);
      remotePlayer.visual?.attack({ duration: remotePlayer.combatTimer });
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
  if (remotePlayer && remotePlayer.combatTimer < .1) remotePlayer.visual?.attack({ duration: getRemoteAttackInterval(weapon) });
  spawnRemoteAttackVisual(origin, direction, weapon, remotePlayer?.color || "#74d1ff");
  if (attack?.finisher === true && weapon === 'katana') presentSwordFinisher(origin, meleeShape('warrior', { finisher: true }).range, false);
  applyRemoteAttackDamage(origin, direction, weapon);
}

function applyRemoteAttackDamage(origin, direction, weapon) {
  if (game.state !== "playing" || usesServerAuthoritativeWorld()) {
    return;
  }

  if (weapon === "flamethrower") {
    damageZombiesInConeFrom(origin, direction, 10.5, Math.cos(0.58), getRemoteAttackDamage(1.1), false, false, "flamethrower");
    return;
  }

  if (weapon === "axe") {
    damageZombiesInRadiusAt(origin, 4.4, getRemoteAttackDamage(5), false, false, "axe");
    return;
  }

  if (weapon === "katana") {
    damageZombiesInConeFrom(origin, direction, 5.8, Math.cos(0.92), getRemoteAttackDamage(5), true, false, "katana");
    return;
  }

  if (weapon === "crossbow") {
    damageZombiesInConeFrom(origin, direction, 28, Math.cos(0.08), getRemoteAttackDamage(4), true, false, "crossbow");
    return;
  }

  if (weapon === "talisman") {
    const explosionPoint = origin.clone().addScaledVector(direction, 8.5);
    damageZombiesAtPoint(explosionPoint, 4.8, getRemoteAttackDamage(4), false, false, "talisman");
    spawnExplosion(explosionPoint, weapons.talisman.color, 4.8);
    return;
  }

  if (weapon === "thunderstaff") {
    damageZombiesInConeFrom(origin, direction, 18.5, Math.cos(0.12), getRemoteAttackDamage(5.2), true, false, "thunderstaff");
    return;
  }

  if (weapon === "boneCannon") {
    const explosionPoint = origin.clone().addScaledVector(direction, 9.5);
    damageZombiesAtPoint(explosionPoint, 5.8, getRemoteAttackDamage(7.2), false, false, "boneCannon");
    spawnExplosion(explosionPoint, weapons.boneCannon.color, 5.8);
    return;
  }

  if (weapon === "frostNova") {
    damageZombiesInRadiusAt(origin, 7.2, getRemoteAttackDamage(6.2), true, false, "frostNova");
    return;
  }

  if (weapon === "guardianBlade") {
    damageZombiesInConeFrom(origin, direction, 24, Math.cos(0.04), getRemoteAttackDamage(1.6), true, false, "guardianBlade");
    return;
  }

  if (weapon === "orbitOrb") {
    damageZombiesAtPoint(origin, 1.45, getRemoteAttackDamage(1.4), false, false, "orbitOrb");
    return;
  }

  if (weapon === "sealRain") {
    damageZombiesAtPoint(origin, 3.5, getRemoteAttackDamage(4.8), false, false, "sealRain");
    spawnExplosion(origin, autoWeaponProfiles.sealRain.color, 3.5);
    return;
  }

  damageZombiesInConeFrom(origin, direction, 24, Math.cos(0.06), getRemoteAttackDamage(1), true, false, "pistol");
}

function getRemoteAttackDamage(amount) {
  return amount * playerBaseDamageMultiplier;
}

function spawnRemoteAttackVisual(origin, direction, weapon, fallbackColor) {
  emitAttackVfx(weapon, origin, direction);
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

  if (weapon === "frostNova") {
    spawnRemotePulse(origin, color, 6.4);
    return;
  }

  spawnRemoteBeam(
    origin,
    direction,
    color,
    weapon === "crossbow" ? 8.5 : weapon === "talisman" ? 6 : weapon === "thunderstaff" ? 14 : weapon === "boneCannon" ? 7.5 : 5.5,
  );
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
  if (weapon === "pistol") return .32;
  if (weapon === "flamethrower") {
    return 0.14;
  }

  if (weapon === "axe") {
    return 0.48;
  }

  if (weapon === "katana") {
    return 0.55;
  }

  if (weapon === "crossbow") {
    return 0.36;
  }

  if (weapon === "talisman") {
    return 0.72;
  }

  if (weapon === "thunderstaff") {
    return 0.34;
  }

  if (weapon === "boneCannon") {
    return 0.58;
  }

  if (weapon === "frostNova") {
    return 0.82;
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
  clearDashTransforms(playerId);
  const remotePlayer = remotePlayers.get(playerId);

  if (!remotePlayer) {
    return;
  }

  remotePlayer.disposed = true;
  remotePlayer.visual?.dispose();
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
    updateOnlineScoreboardHud();
    return;
  }

  onlineCountElement.textContent = multiplayer.full ? "Cheia" : multiplayer.enabled ? "Online" : "Solo";
  onlineStatusElement.textContent = multiplayer.enabled ? multiplayer.status : "Local";
  updatePartyHud();
  updateOnlineScoreboardHud();
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
      kills: player.kills,
      wave: Math.max(player.wave, 1),
      level: player.level,
      state: game.state,
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
      kills: remotePlayer.kills,
      wave: remotePlayer.wave,
      level: remotePlayer.level,
      state: remotePlayer.state,
      color: remotePlayer.color,
      isLocal: false,
    });
  }

  return partyPlayers.sort(
    (first, second) =>
      second.score - first.score ||
      second.kills - first.kills ||
      second.level - first.level ||
      second.wave - first.wave ||
      second.health - first.health,
  );
}

function updateLeaderboard(leaderboard, status = "ready") {
  const snapshot = leaderboard || {};
  multiplayer.leaderboard = {
    totalPlayers: Number(snapshot.totalPlayers) || 0,
    players: Array.isArray(snapshot.players) ? snapshot.players.slice(0, 10) : [],
    livePlayers: Array.isArray(snapshot.livePlayers) ? snapshot.livePlayers.slice(0, 40) : [],
    recentSessions: Array.isArray(snapshot.recentSessions) ? snapshot.recentSessions.slice(0, 10) : [],
    status,
    generatedAt: snapshot.generatedAt || null,
    source: snapshot.scope === "device" ? "browser" : getLeaderboardApiUrl("/api/leaderboard"),
    scope: snapshot.scope || "rooms",
    persistence: snapshot.persistence !== false,
  };
  const scopeLabel = document.querySelector("#leaderboard-scope");
  if (scopeLabel) scopeLabel.textContent = snapshot.scope === "device"
    ? snapshot.persistence === false ? "Recordes solo desta sessão" : "Recordes solo neste navegador"
    : "Histórico das salas";
  updateLeaderboardHud();
}

async function loadLeaderboardSnapshot({ clearBeforeFetch = false } = {}) {
  if (!multiplayer.enabled) {
    updateLeaderboard(soloLeaderboard.snapshot());
    return;
  }
  if (clearBeforeFetch) {
    updateLeaderboard(null, "loading");
  }

  try {
    const response = await fetch(getLeaderboardApiUrl("/api/leaderboard"), { cache: "no-store" });
    if (!response.ok) {
      if (clearBeforeFetch) {
        updateLeaderboard(null, "error");
      }
      return;
    }

    updateLeaderboard(await response.json());
  } catch {
    if (clearBeforeFetch) {
      updateLeaderboard(null, "error");
    }
  }
}

async function submitSoloLeaderboardSession() {
  if (game.leaderboardSubmitted || multiplayer.enabled) return;
  game.leaderboardSubmitted = true;
  const result = soloLeaderboard.record({
    runId: game.soloRunId,
    name: player.name, score: player.score, kills: player.kills,
    wave: Math.max(player.wave, 1), level: player.level, bestLevel: player.bestLevel,
    build: getPlayerBuildSummary(), durationMs: Math.floor(game.survivalTime * 1000),
  });
  updateLeaderboard(result.snapshot);
}





function updateLiveLeaderboardSync(dt) {
  if (game.state !== 'playing' || !multiplayer.enabled || !multiplayer.connected) return;
  game.leaderboardRefreshTimer -= dt;
  if (game.leaderboardRefreshTimer <= 0) {
    game.leaderboardRefreshTimer = 4;
    void loadLeaderboardSnapshot({ clearBeforeFetch: false });
  }
}



function getMultiplayerEntryUrl() {
  const entry = new URL(window.location.href);
  const serverOrigin = window.location.hostname === 'bipx.vercel.app' ? multiplayerServerOrigin : window.location.origin;
  const socket = new URL('/ws', serverOrigin);
  socket.protocol = socket.protocol === 'https:' ? 'wss:' : 'ws:';
  entry.searchParams.delete('offline');
  entry.searchParams.delete('autoplay');
  entry.searchParams.set('ws', socket.toString());
  entry.searchParams.set('room', sanitizeRoomName(queryParams.get('room') || 'cemiterio'));
  return entry.toString();
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
  const historicalLeaders = multiplayer.leaderboard.players;
  const historicalTotalPlayers = multiplayer.leaderboard.totalPlayers;
  const status = multiplayer.leaderboard.status || "ready";

  updateOnlineScoreboardHud(true);

  if (menuLeaderboardCountElement) {
    menuLeaderboardCountElement.textContent = status === "loading" ? "atualizando" : `${historicalTotalPlayers} jogadores`;
  }

  if (menuLeaderboardListElement) {
    renderMenuLeaderboard(historicalLeaders, status);
  }
}

function updateOnlineScoreboardHud(force = false) {
  if (!leaderboardCountElement || !leaderboardListElement) {
    return;
  }

  const scoreboard = getProjectedOnlineLeaderboard();
  const scoreboardPlayers = scoreboard.entries;
  const modeLabel = scoreboard.liveCount > 0
    ? `${scoreboard.liveCount} ao vivo`
    : `${scoreboard.totalPlayers} players`;
  const signature = `${modeLabel}|${scoreboardPlayers
    .map(
      (scoreboardPlayer) =>
        `${scoreboardPlayer.key}:${scoreboardPlayer.rank}:${Math.floor(scoreboardPlayer.score)}:${Math.floor(scoreboardPlayer.kills)}:${scoreboardPlayer.level}:${scoreboardPlayer.wave}:${scoreboardPlayer.isLive}:${scoreboardPlayer.isLocal}:${Math.floor(scoreboardPlayer.liveScore || 0)}`,
    )
    .join("|")}`;

  if (!force && game.onlineScoreboardSignature === signature) {
    return;
  }

  game.onlineScoreboardSignature = signature;
  leaderboardCountElement.textContent = modeLabel;
  renderOnlineScoreboard(scoreboardPlayers);
}

function getOnlineScoreboardPlayers() {
  return getProjectedOnlineLeaderboard().entries;
}

function getProjectedOnlineLeaderboard() {
  const projectedEntries = new Map();
  const historicalKeys = new Set();
  const liveKeys = new Set();

  for (const leader of multiplayer.leaderboard.players) {
    const entry = createHistoricalLeaderboardEntry(leader);
    historicalKeys.add(entry.key);
    mergeProjectedLeaderboardEntry(projectedEntries, entry);
  }

  for (const liveLeader of multiplayer.leaderboard.livePlayers) {
    const entry = createLiveLeaderboardEntry(liveLeader);
    liveKeys.add(entry.key);
    mergeProjectedLeaderboardEntry(projectedEntries, entry);
  }

  if (game.state === "playing" || player.score > 0) {
    const localEntry = createLiveLeaderboardEntry({
      name: player.name,
      score: player.score,
      kills: player.kills,
      wave: Math.max(player.wave, 1),
      level: player.level,
      bestLevel: player.bestLevel,
      build: getPlayerBuildSummary(),
      durationMs: Math.floor(game.survivalTime * 1000),
    }, {
      color: multiplayer.color,
      isLocal: true,
      source: "local",
    });
    liveKeys.add(localEntry.key);
    mergeProjectedLeaderboardEntry(projectedEntries, localEntry);
  }

  for (const remotePlayer of remotePlayers.values()) {
    if (remotePlayer.state !== "playing" && remotePlayer.score <= 0) {
      continue;
    }

    const remoteEntry = createLiveLeaderboardEntry({
      name: remotePlayer.name,
      score: remotePlayer.score,
      kills: remotePlayer.kills,
      wave: remotePlayer.wave,
      level: remotePlayer.level,
      bestLevel: remotePlayer.bestLevel,
      build: remotePlayer.build,
      durationMs: 0,
    }, {
      color: remotePlayer.color,
      source: "room",
    });
    liveKeys.add(remoteEntry.key);
    mergeProjectedLeaderboardEntry(projectedEntries, remoteEntry);
  }

  const rankedEntries = [...projectedEntries.values()]
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.kills - first.kills ||
        second.level - first.level ||
        second.wave - first.wave ||
        first.name.localeCompare(second.name),
    )
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  const maxVisible = usesMobileTuning() ? 3 : 5;
  const visibleEntries = rankedEntries.slice(0, maxVisible);
  const localEntry = rankedEntries.find((entry) => entry.isLocal);

  if (localEntry && !visibleEntries.some((entry) => entry.key === localEntry.key)) {
    visibleEntries.splice(Math.max(0, maxVisible - 1), 1, localEntry);
  }

  const liveOnlyCount = [...liveKeys].filter((key) => !historicalKeys.has(key)).length;

  return {
    entries: visibleEntries,
    liveCount: liveKeys.size,
    totalPlayers: Math.max(multiplayer.leaderboard.totalPlayers, historicalKeys.size) + liveOnlyCount,
  };
}

function createHistoricalLeaderboardEntry(leader) {
  const name = sanitizePlayerName(leader.name || "Cacador");
  const bestScore = Math.max(0, Math.floor(Number(leader.bestScore) || 0));
  const totalScore = Math.max(0, Math.floor(Number(leader.totalScore) || 0));
  const lastScore = Math.max(0, Math.floor(Number(leader.lastScore) || 0));

  return {
    key: getLeaderboardEntryKey(name),
    name,
    score: Math.max(bestScore, totalScore, lastScore),
    kills: Math.max(
      0,
      Math.floor(Number(leader.totalKills) || 0),
      Math.floor(Number(leader.bestKills) || 0),
      Math.floor(Number(leader.lastKills) || 0),
    ),
    wave: Math.max(1, Math.floor(Number(leader.bestWave ?? leader.lastWave) || 1)),
    level: Math.max(1, Math.floor(Number(leader.bestLevel ?? leader.lastLevel) || 1)),
    build: Array.isArray(leader.bestBuild)
      ? leader.bestBuild.slice(0, 6)
      : Array.isArray(leader.lastBuild)
        ? leader.lastBuild.slice(0, 6)
        : [],
    durationMs: Math.max(0, Math.floor(Number(leader.totalPlayMs) || 0)),
    source: "histórico",
    color: "#8ef151",
    isLive: false,
    isLocal: getLeaderboardEntryKey(name) === getLeaderboardEntryKey(player.name),
    liveScore: 0,
  };
}

function createLiveLeaderboardEntry(leader, options = {}) {
  const name = sanitizePlayerName(leader.name || "Cacador");

  return {
    key: getLeaderboardEntryKey(name),
    name,
    score: Math.max(0, Math.floor(Number(leader.score) || 0)),
    kills: Math.max(0, Math.floor(Number(leader.kills) || 0)),
    wave: Math.max(1, Math.floor(Number(leader.wave) || 1)),
    level: Math.max(1, Math.floor(Number(leader.level ?? leader.bestLevel) || 1)),
    build: Array.isArray(leader.build) ? leader.build.slice(0, 6) : [],
    durationMs: Math.max(0, Math.floor(Number(leader.durationMs) || 0)),
    source: options.source || "ao vivo",
    color: options.color || "#ffd36d",
    isLive: true,
    isLocal: Boolean(options.isLocal) || getLeaderboardEntryKey(name) === getLeaderboardEntryKey(player.name),
    liveScore: Math.max(0, Math.floor(Number(leader.score) || 0)),
  };
}

function mergeProjectedLeaderboardEntry(entries, entry) {
  const existing = entries.get(entry.key);

  if (!existing) {
    entries.set(entry.key, entry);
    return;
  }

  const mergedFlags = {
    isLive: existing.isLive || entry.isLive,
    isLocal: existing.isLocal || entry.isLocal,
    liveScore: Math.max(existing.liveScore || 0, entry.liveScore || (entry.isLive ? entry.score : 0)),
    color: entry.isLocal ? entry.color : existing.color || entry.color,
  };

  if (entry.score > existing.score || (entry.score === existing.score && entry.isLive && !existing.isLive)) {
    entries.set(entry.key, {
      ...entry,
      ...mergedFlags,
    });
    return;
  }

  entries.set(entry.key, {
    ...existing,
    ...mergedFlags,
  });
}

function getLeaderboardEntryKey(name) {
  return sanitizePlayerName(name).toLowerCase();
}

function renderOnlineScoreboard(scoreboardPlayers) {
  if (scoreboardPlayers.length === 0) {
    leaderboardListElement.innerHTML = `
      <li>
        <span class="leaderboard-list__rank">–</span>
        <span class="leaderboard-list__player">
          <strong>Ranking vazio</strong>
          <small>jogue para aparecer aqui</small>
        </span>
        <span class="leaderboard-list__meta">ao vivo</span>
      </li>
    `;
    return;
  }

  leaderboardListElement.innerHTML = scoreboardPlayers
    .map((scoreboardPlayer) => {
      const displayName = truncateHudName(scoreboardPlayer.name, usesMobileTuning() ? 8 : 14);
      const statusText = [
        scoreboardPlayer.isLocal ? "você" : scoreboardPlayer.isLive ? "ao vivo" : "histórico",
        `O${scoreboardPlayer.wave}`,
        `Nv${scoreboardPlayer.level}`,
      ].join(" · ");
      const liveScoreText =
        scoreboardPlayer.liveScore > 0 && scoreboardPlayer.liveScore < scoreboardPlayer.score
          ? ` · agora ${formatHudNumber(scoreboardPlayer.liveScore)}`
          : "";
      return `
        <li class="${scoreboardPlayer.isLocal ? "leaderboard-list__item--local" : ""}${scoreboardPlayer.isLive ? " leaderboard-list__item--live" : ""}" style="--party-color: ${scoreboardPlayer.color}">
          <span class="leaderboard-list__rank">#${scoreboardPlayer.rank}</span>
          <span class="leaderboard-list__player">
            <strong>${escapeHtml(displayName)}</strong>
            <small>${statusText}${liveScoreText}</small>
          </span>
          <span class="leaderboard-list__meta">${formatHudNumber(scoreboardPlayer.score)} pts · ${formatHudNumber(scoreboardPlayer.kills)} K · O${scoreboardPlayer.wave} · Nv${scoreboardPlayer.level}</span>
        </li>
      `;
    })
    .join("");
}

function renderMenuLeaderboard(leaders, status = "ready") {
  if (leaders.length === 0) {
    const copy =
      status === "loading"
        ? {
            title: "Atualizando ranking",
            subtitle: "buscando dados atuais no servidor",
            perk: "sincronizando",
          }
        : status === "error"
          ? {
              title: "Ranking indisponível",
              subtitle: "não consegui carregar agora",
              perk: "offline",
            }
          : {
              title: "Ranking zerado",
              subtitle: "novas partidas desta versão aparecerão aqui",
              perk: "sem registros",
            };
    menuLeaderboardListElement.innerHTML = `
      <li class="main-menu__ranking-empty">
        <span class="menu-rank">–</span>
        <span class="menu-player">
          <span class="menu-player__avatar" data-tier="bronze" title="Bronze">
            <span class="menu-player__avatar-icon">◆</span>
            <span class="menu-player__avatar-rank">BR</span>
          </span>
          <span class="menu-player__name">
            <strong>${copy.title}</strong>
            <small>${copy.subtitle}</small>
          </span>
        </span>
        <span class="menu-stat">—<small>zumbis</small></span>
        <span class="menu-stat">—<small>level</small></span>
        <span class="menu-stat">—<small>pontuação</small></span>
        <span class="menu-stat">—<small>tempo</small></span>
        <span class="menu-perks"><span class="menu-perk menu-perk--empty">${copy.perk}</span></span>
      </li>
    `;
    return;
  }

  menuLeaderboardListElement.innerHTML = leaders
    .slice(0, 10)
    .map((leader) => {
      const avatar = getLeaderboardAvatar(leader);
      const bestScore = Math.floor(Number(leader.bestScore) || 0);
      const totalScore = Math.max(bestScore, Math.floor(Number(leader.totalScore) || 0));
      const recordedKills = Math.max(
        Math.floor(Number(leader.totalKills) || 0),
        Math.floor(Number(leader.bestKills) || 0),
        Math.floor(Number(leader.lastKills) || 0),
      );
      const kills = recordedKills > 0 ? recordedKills : Math.floor(bestScore / 12);
      const totalPlayMs = Math.max(0, Math.floor(Number(leader.totalPlayMs) || 0));
      const gamesPlayed = Math.max(0, Math.floor(Number(leader.gamesPlayed) || 0));
      const bestLevel = Math.floor(Number(leader.bestLevel) || 1);
      const bestWave = Math.floor(Number(leader.bestWave) || 1);
      const build = Array.isArray(leader.bestBuild) && leader.bestBuild.length > 0 ? leader.bestBuild : leader.lastBuild;

      return `
        <li>
          <span class="menu-rank">#${leader.rank}</span>
          <span class="menu-player">
            <span class="menu-player__avatar" data-tier="${avatar.tier}" title="${escapeHtml(avatar.label)} · ${formatHudNumber(totalScore)} pontos acumulados">
              <span class="menu-player__avatar-icon">${avatar.glyph}</span>
              <span class="menu-player__avatar-rank">${avatar.short}</span>
            </span>
            <span class="menu-player__name">
              <strong>${escapeHtml(leader.name)}</strong>
              <small>${gamesPlayed} ${gamesPlayed === 1 ? "partida" : "partidas"} · ${avatar.label} · O${bestWave}</small>
            </span>
          </span>
          <span class="menu-stat">${formatHudNumber(kills)}<small>zumbis</small></span>
          <span class="menu-stat">Nv ${bestLevel}<small>level</small></span>
          <span class="menu-stat">${formatHudNumber(totalScore)}<small>pontuação</small></span>
          <span class="menu-stat">${formatSurvivalTime(totalPlayMs / 1000)}<small>tempo jogado</small></span>
          <span class="menu-perks">${renderLeaderboardPerks(build)}</span>
        </li>
      `;
    })
    .join("");
}

const leaderboardAvatarTiers = [
  { minScore: 100000, tier: "legend", label: "Lenda", short: "LD", glyph: "♛" },
  { minScore: 50000, tier: "master", label: "Mestre", short: "MS", glyph: "♜" },
  { minScore: 20000, tier: "diamond", label: "Diamante", short: "DM", glyph: "◆" },
  { minScore: 8000, tier: "platinum", label: "Platina", short: "PL", glyph: "✦" },
  { minScore: 2000, tier: "gold", label: "Ouro", short: "OU", glyph: "✹" },
  { minScore: 500, tier: "silver", label: "Prata", short: "PR", glyph: "✧" },
  { minScore: 0, tier: "bronze", label: "Bronze", short: "BR", glyph: "◆" },
];

function getLeaderboardAvatar(leader) {
  const bestScore = Math.max(0, Math.floor(Number(leader.bestScore) || 0));
  const totalScore = Math.max(bestScore, Math.floor(Number(leader.totalScore) || 0));
  return leaderboardAvatarTiers.find((tier) => totalScore >= tier.minScore) ?? leaderboardAvatarTiers.at(-1);
}

function renderLeaderboardPerks(build = []) {
  const perks = Array.isArray(build) ? build.filter(Boolean).slice(0, 6) : [];

  if (perks.length === 0) {
    return `<span class="menu-perk menu-perk--empty">sem perks</span>`;
  }

  return perks
    .map(
      (perk) => {
        const rarity = getBuildEntryRarity(perk);
        return `<span class="menu-perk menu-perk--${rarity}" title="${escapeHtml(perk)}">${escapeHtml(getLeaderboardPerkIcon(perk))}</span>`;
      },
    )
    .join("");
}

function getBuildEntryRarity(entry) {
  const text = String(entry || "").toLowerCase();
  if (text.includes("eclipse") || text.includes("profano") || text.includes("dilúvio") || text.includes("diluvio")) {
    return "legendary";
  }

  for (const upgrade of upgradeDefinitions) {
    if (text.includes(upgrade.label.toLowerCase().replace(/^\+/, "").trim())) {
      return normalizeRarity(upgrade.rarity);
    }
  }

  return "common";
}

function getLeaderboardPerkIcon(perk) {
  const text = String(perk || "").toLowerCase();

  if (text.includes("eclipse")) return "🌘";
  if (text.includes("profano")) return "🟠";
  if (text.includes("dilúvio") || text.includes("diluvio")) return "🌈";
  if (text.includes("ímã") || text.includes("ima")) return "🧲";
  if (text.includes("ferro")) return "🛡";
  if (text.includes("eco")) return "🌘";
  if (text.includes("olho")) return "👁";
  if (text.includes("ritual")) return "🔯";
  if (text.includes("cinzas")) return "🫀";
  if (text.includes("prism")) return "🌈";
  if (text.includes("lua")) return "🌙";
  if (text.includes("fôlego") || text.includes("folego")) return "♻";
  if (text.includes("pacto")) return "👹";
  if (text.includes("gelo")) return "❄";
  if (text.includes("lâmina") || text.includes("lamina")) return "🗡";
  if (text.includes("orbe")) return "🟣";
  if (text.includes("chuva")) return "☄";
  if (text.includes("dano")) return "◆";
  if (text.includes("attack speed") || text.includes("cadência") || text.includes("cadencia")) return "⚡";
  if (text.includes("área") || text.includes("area")) return "◎";
  if (text.includes("velocidade")) return "➤";
  if (text.includes("coleta")) return "✦";
  if (text.includes("vida")) return "♥";
  if (text.includes("projétil") || text.includes("projetil")) return "✚";
  if (text.includes("lança") || text.includes("lanca")) return "🔥";
  if (text.includes("machado")) return "🪓";
  if (text.includes("katana")) return "⚔";
  if (text.includes("besta")) return "🏹";
  if (text.includes("selo")) return "📜";
  if (text.includes("cajado") || text.includes("raio")) return "⚡";
  if (text.includes("canhão") || text.includes("canhao") || text.includes("ossos")) return "☠";
  return "✦";
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
  return target instanceof Element && Boolean(target.closest("button, input, select, dialog, .touch-controls, .message, .upgrade-panel"));
}

function handleFirePointerDown(event) {
  if (paused || game.state !== 'playing') return;
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
  if (paused || game.state !== 'playing') return;
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

function queryZombiesNear(position, radius, candidates = spatialGrid.candidates) {
  ensureSpatialGrid();
  perfStats.gridQueries += 1;
  candidates.length = 0;
  const minX = Math.floor((position.x - radius) / spatialGridCellSize);
  const maxX = Math.floor((position.x + radius) / spatialGridCellSize);
  const minZ = Math.floor((position.z - radius) / spatialGridCellSize);
  const maxZ = Math.floor((position.z + radius) / spatialGridCellSize);

  for (let cellX = minX; cellX <= maxX; cellX += 1) {
    for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
      const cell = spatialGrid.cells.get(`${cellX},${cellZ}`);
      if (cell) {
        for (const zombie of cell) {
          candidates.push(zombie);
        }
      }
    }
  }

  return candidates;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getForwardRotation(direction) {
  return Math.atan2(-direction.x, -direction.z);
}
