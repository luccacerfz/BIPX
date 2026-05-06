import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const canvas = document.querySelector("#game-canvas");
const healthFill = document.querySelector("#health-fill");
const scoreElement = document.querySelector("#score");
const waveElement = document.querySelector("#wave");
const weaponNameElement = document.querySelector("#weapon-name");
const weaponTimerElement = document.querySelector("#weapon-timer");
const onlineCountElement = document.querySelector("#online-count");
const onlineStatusElement = document.querySelector("#online-status");
const message = document.querySelector("#message");
const messageKicker = document.querySelector("#message-kicker");
const messageTitle = document.querySelector("#message-title");
const messageCopy = document.querySelector("#message-copy");
const playButton = document.querySelector("#play-button");
const touchStick = document.querySelector("#touch-stick");
const touchKnob = document.querySelector("#touch-knob");
const touchFire = document.querySelector("#touch-fire");
const queryParams = new URLSearchParams(window.location.search);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07100d);
scene.fog = new THREE.FogExp2(0x07100d, 0.027);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 17, 20);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointer = new THREE.Vector2(0, 0);
const pointerWorld = new THREE.Vector3(0, 0, -1);
const worldLimit = 55;
const maxActiveZombies = 90;

const weapons = {
  pistol: { label: "Pistola", duration: 0 },
  flamethrower: { label: "Lanca", duration: 10, color: 0xff7a28 },
  axe: { label: "Machado", duration: 8, color: 0x7fd7ff },
  katana: { label: "Katana", duration: 10, color: 0x8ffcff },
  crossbow: { label: "Besta", duration: 11, color: 0xffd36d },
  talisman: { label: "Selo", duration: 9, color: 0xd978ff },
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
};

const keys = new Set();
const zombies = [];
const bullets = [];
const enemyProjectiles = [];
const powerups = [];
const effects = [];
const graveProps = [];
const remotePlayers = new Map();
let nextZombieId = 1;

const multiplayer = {
  enabled: shouldUseMultiplayer(),
  connected: false,
  full: false,
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
  health: 100,
  score: 0,
  wave: 0,
  speed: 11,
  shotCooldown: 0,
  weapon: "pistol",
  weaponTimer: 0,
  axeSpinTimer: 0,
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
  touchVector: new THREE.Vector2(0, 0),
};

scene.add(player.mesh);
buildWorld();
updateMultiplayerHud();
if (multiplayer.enabled) {
  connectMultiplayer();
}
updateHud();
animate();

playButton.addEventListener("click", () => {
  if (game.state !== "playing") {
    startGame();
  }
});

window.addEventListener("resize", resizeRenderer);
window.addEventListener("keydown", (event) => {
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

window.addEventListener("mousemove", (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("mousedown", () => {
  game.shooting = true;
});

window.addEventListener("mouseup", () => {
  game.shooting = false;
});

touchFire.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  game.shooting = true;
});

touchFire.addEventListener("pointerup", () => {
  game.shooting = false;
});

touchFire.addEventListener("pointercancel", () => {
  game.shooting = false;
});

touchStick.addEventListener("pointerdown", handleStickMove);
touchStick.addEventListener("pointermove", handleStickMove);
touchStick.addEventListener("pointerup", resetStick);
touchStick.addEventListener("pointercancel", resetStick);

window.__zombieNightDebug = {
  getState() {
    return {
      state: game.state,
      health: player.health,
      score: player.score,
      wave: player.wave,
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
      survivalTime: Number(game.survivalTime.toFixed(2)),
      player: {
        x: Number(player.position.x.toFixed(3)),
        z: Number(player.position.z.toFixed(3)),
      },
      multiplayer: {
        connected: multiplayer.connected,
        id: multiplayer.id,
        room: multiplayer.room,
        remotePlayers: remotePlayers.size,
        status: multiplayer.status,
      },
    };
  },
  start: startGame,
  equipWeapon: activateWeapon,
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
};

if (queryParams.get("autoplay") === "1") {
  requestAnimationFrame(() => {
    startGame();

    if (queryParams.get("bosses") === "1") {
      spawnBossPreview();
    }
  });
}

function startGame() {
  clearEntities();
  player.health = 100;
  player.score = 0;
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
  nextZombieId = 1;
  message.classList.add("is-hidden");
  startNextWave();
  updateHud();
}

function buildWorld() {
  const hemiLight = new THREE.HemisphereLight(0xbde6ff, 0x1d2717, 1.45);
  scene.add(hemiLight);

  const moon = new THREE.DirectionalLight(0xdceeff, 2.25);
  moon.position.set(-20, 36, 18);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 95;
  moon.shadow.camera.left = -55;
  moon.shadow.camera.right = 55;
  moon.shadow.camera.top = 55;
  moon.shadow.camera.bottom = -55;
  scene.add(moon);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({ color: 0x151a13, roughness: 0.96, metalness: 0.02 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(140, 56, 0x365940, 0x1d2a21);
  grid.material.transparent = true;
  grid.material.opacity = 0.34;
  scene.add(grid);

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x2b241c, roughness: 0.88 });
  for (let index = 0; index < 18; index += 1) {
    addFencePost(index * 6.5 - 55, -58, fenceMaterial);
    addFencePost(index * 6.5 - 55, 58, fenceMaterial);
    addFencePost(-58, index * 6.5 - 55, fenceMaterial);
    addFencePost(58, index * 6.5 - 55, fenceMaterial);
  }

  const graveMaterial = new THREE.MeshStandardMaterial({ color: 0x7f887b, roughness: 0.86 });
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x314d2e, roughness: 0.9 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4b3425, roughness: 0.9 });

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

  return group;
}

function createZombieMesh(type = "zombie") {
  if (monsterProfiles[type]?.boss) {
    return createBossMesh(type);
  }

  const group = new THREE.Group();
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
    emissiveIntensity: 0.8,
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

  return group;
}

function createBossMesh(type) {
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

function animate() {
  const dt = Math.min(clock.getDelta(), 0.035);

  if (game.state === "playing") {
    game.survivalTime += dt;
    updateAim();
    updatePlayer(dt);
    updatePowerups(dt);
    updateActiveWeapon(dt);
    updateShooting(dt);
    updateSpawning(dt);
    updateZombies(dt);
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
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateAim() {
  if (game.touchVector.lengthSq() > 0.08) {
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

  const direction = pointerWorld.clone().sub(player.position);
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
  const move = new THREE.Vector3(0, 0, 0);

  if (keys.has("KeyW") || keys.has("ArrowUp")) move.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) move.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) move.x += 1;

  move.x += game.touchVector.x;
  move.z += game.touchVector.y;

  if (move.lengthSq() > 0) {
    move.normalize();
    player.position.addScaledVector(move, player.speed * dt);
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

    if (distanceXZ(player.position, powerup.mesh.position) < powerup.radius) {
      activateWeapon(powerup.type);
      removePowerup(index);
    }
  }
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

  player.shotCooldown = Math.max(0.1, 0.2 - player.wave * 0.006);
  spawnBullet();
  sendMultiplayerAttack("pistol");
}

function updateFlamethrower(dt) {
  if (!game.shooting) {
    return;
  }

  damageZombiesInCone(10.5, Math.cos(0.58), 12 * dt, false);

  if (player.shotCooldown <= 0) {
    player.shotCooldown = 0.065;
    spawnFlameBurst();
    sendMultiplayerAttack("flamethrower");
  }
}

function updateAxeAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = 0.48;
  startAxeSpin();
  sendMultiplayerAttack("axe");
}

function updateKatanaAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = 0.28;
  damageZombiesInCone(5.8, Math.cos(0.92), 7, true);
  spawnKatanaSlash();
  sendMultiplayerAttack("katana");
}

function updateCrossbowAttack() {
  if (!game.shooting || player.shotCooldown > 0) {
    return;
  }

  player.shotCooldown = 0.36;
  spawnProjectile({
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

  player.shotCooldown = 0.72;
  spawnProjectile({
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
  spawnProjectile({
    color: 0xfff2a3,
    damage: 1,
    lifespan: 1.25,
    radius: 0.3,
    speed: 33,
  });
}

function spawnProjectile({ color, damage, explodeDamage = 0, explodeRadius = 0, lifespan, pierceHits = 0, radius, speed }) {
  const geometry = new THREE.SphereGeometry(0.16, 10, 8);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(radius / 0.3);
  mesh.castShadow = true;
  mesh.position.copy(player.position);
  mesh.position.y = 1.12;
  mesh.add(new THREE.PointLight(color, 1.4, 4));
  mesh.position.addScaledVector(player.aimDirection, 1.25);
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
    velocity: player.aimDirection.clone().multiplyScalar(speed),
  });
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
  const direction = player.aimDirection.clone().normalize();
  const flame = new THREE.Group();
  flame.position.copy(player.position).addScaledVector(direction, 3.05);
  flame.position.y = 1.02;
  flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 4.6, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff7a28,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    }),
  );
  flame.add(cone);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.54, 3.4, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffdc78,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
  core.position.y = 0.35;
  flame.add(core);

  const light = new THREE.PointLight(0xff8a24, 2.2, 8);
  light.position.y = -0.9;
  flame.add(light);

  addTimedEffect(flame, 0.16);
}

function startAxeSpin() {
  player.axeSpinTimer = 0.36;
  spawnWeaponPulse(0x7fd7ff);
}

function spawnKatanaSlash() {
  const slash = new THREE.Group();
  slash.position.copy(player.position);
  slash.position.y = 0.28;
  slash.rotation.y = getForwardRotation(player.aimDirection) - Math.PI * 0.5;

  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(2.75, 0.045, 8, 56, Math.PI * 0.92),
    new THREE.MeshBasicMaterial({
      color: weapons.katana.color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  arc.rotation.x = Math.PI * 0.5;
  arc.position.z = -1.2;
  slash.add(arc);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.045, 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  edge.position.set(0, 0, -1.74);
  edge.rotation.y = -0.28;
  slash.add(edge);

  addTimedEffect(slash, 0.2, true);
}

function spawnExplosion(position, color, radius) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.position.y = 0.24;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.055, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  ring.rotation.x = Math.PI * 0.5;
  group.add(ring);

  const flare = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 18, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  flare.position.y = 0.64;
  group.add(flare);

  const light = new THREE.PointLight(color, 2.2, radius * 2.2);
  light.position.y = 1.2;
  group.add(light);

  addTimedEffect(group, 0.32);
}

function spawnWeaponPulse(color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.9, 0.055, 8, 72),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(player.position);
  ring.position.y = 0.18;
  addTimedEffect(ring, 0.36, true);
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
  const mesh = createZombieMesh(type);
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
    wobble: Math.random() * Math.PI * 2,
  });
  if (labelSprite) {
    updateBossLabelPosition(zombies[zombies.length - 1]);
  }
  nextZombieId += 1;
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
    texture,
    type,
  };

  updateBossLabel(sprite, maxHealth);
  return sprite;
}

function updateBossLabel(sprite, health) {
  const { canvas, context, label, maxHealth, texture, type } = sprite.userData;
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
}

function updateBossLabelPosition(zombie) {
  if (!zombie.labelSprite) {
    return;
  }

  zombie.labelSprite.position.copy(zombie.mesh.position);
  zombie.labelSprite.position.y = getBossLabelHeight(zombie.type);
}

function getBossLabelHeight(type) {
  if (type === "gitcity") {
    return 5.15;
  }

  if (type === "dinzo") {
    return 2.95;
  }

  return 3.65;
}

function getBossAccentColor(type) {
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
    const toPlayer = player.position.clone().sub(zombie.mesh.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    zombie.attackCooldown -= dt;

    if (canUseRangedAttack(zombie.type, distance)) {
      if (distance > 0.05) {
        toPlayer.normalize();
        zombie.mesh.rotation.y = getForwardRotation(toPlayer);
      }

      if (zombie.attackCooldown <= 0) {
        zombie.attackCooldown = getRangedCooldown(zombie.type);
        spawnEnemyProjectile(zombie);
      }

      updateBossLabelPosition(zombie);
      continue;
    }

    if (distance > 0.05) {
      toPlayer.normalize();
      zombie.mesh.position.addScaledVector(toPlayer, zombie.speed * dt);
      zombie.mesh.rotation.y = getForwardRotation(toPlayer);
    }

    if (distance < zombie.radius + 0.72 && zombie.attackCooldown <= 0) {
      zombie.attackCooldown = 0.62;
      player.health = Math.max(0, player.health - (zombie.damage + Math.floor(player.wave * 0.55)));
      pulseHealth();

      if (player.health <= 0) {
        endGame();
      }
    }

    updateBossLabelPosition(zombie);
  }
}

function canUseRangedAttack(type, distance) {
  return (
    (type === "caster" && distance < 16 && distance > 4.2) ||
    (type === "visor" && distance < 18 && distance > 4.4) ||
    (type === "himetrica" && distance < 15 && distance > 3.6)
  );
}

function getRangedCooldown(type) {
  if (type === "visor") {
    return 1.1;
  }

  if (type === "himetrica") {
    return 0.85;
  }

  return 1.45;
}

function spawnEnemyProjectile(zombie) {
  const direction = player.position.clone().sub(zombie.mesh.position);
  direction.y = 0;

  if (direction.lengthSq() <= 0.01) {
    return;
  }

  direction.normalize();
  const profile = monsterProfiles[zombie.type] ?? monsterProfiles.caster;
  const projectileColor = profile.projectileColor ?? 0xd978ff;
  const projectileSpeed = zombie.type === "himetrica" ? 19 : zombie.type === "visor" ? 13 : 14;
  const projectileSize = zombie.type === "visor" ? 0.3 : zombie.type === "himetrica" ? 0.2 : 0.24;
  const material = new THREE.MeshStandardMaterial({
    color: projectileColor,
    emissive: projectileColor,
    emissiveIntensity: 1.25,
    roughness: 0.42,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(projectileSize, 14, 10), material);
  mesh.position.copy(zombie.mesh.position);
  mesh.position.y = 1.38;
  mesh.position.addScaledVector(direction, 0.9);
  mesh.add(new THREE.PointLight(projectileColor, 1.7, 5));
  scene.add(mesh);

  enemyProjectiles.push({
    mesh,
    age: 0,
    damage: zombie.damage + Math.floor(player.wave * 0.35),
    lifespan: 2.25,
    radius: projectileSize + 0.18,
    color: projectileColor,
    velocity: direction.multiplyScalar(projectileSpeed),
  });
}

function updateEnemyProjectiles(dt) {
  for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = enemyProjectiles[index];
    projectile.age += dt;
    projectile.mesh.position.addScaledVector(projectile.velocity, dt);

    if (distanceXZ(projectile.mesh.position, player.position) < projectile.radius + 0.64) {
      player.health = Math.max(0, player.health - projectile.damage);
      pulseHealth();
      spawnExplosion(projectile.mesh.position, projectile.color, 2.4);
      removeEnemyProjectile(index);

      if (player.health <= 0) {
        endGame();
      }

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
    for (let zombieIndex = zombies.length - 1; zombieIndex >= 0; zombieIndex -= 1) {
      const zombie = zombies[zombieIndex];
      if (bullet.hitZombies.has(zombie.id)) {
        continue;
      }

      const distance = distanceXZ(bullet.mesh.position, zombie.mesh.position);

      if (distance < bullet.radius + zombie.radius) {
        hit = true;
        bullet.hitZombies.add(zombie.id);
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
  damageZombiesInConeFrom(player.position, player.aimDirection, range, minDot, amount, shouldFlash);
}

function damageZombiesInConeFrom(origin, direction, range, minDot, amount, shouldFlash) {
  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    const zombie = zombies[index];
    const offset = zombie.mesh.position.clone().sub(origin);
    offset.y = 0;
    const distance = offset.length();

    if (distance <= 0.05 || distance > range) {
      continue;
    }

    const dot = offset.normalize().dot(direction);
    if (dot >= minDot) {
      damageZombie(index, amount, shouldFlash);
    }
  }
}

function damageZombiesInRadius(radius, amount, shouldFlash) {
  damageZombiesInRadiusAt(player.position, radius, amount, shouldFlash);
}

function damageZombiesInRadiusAt(origin, radius, amount, shouldFlash) {
  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    if (distanceXZ(origin, zombies[index].mesh.position) <= radius) {
      damageZombie(index, amount, shouldFlash);
    }
  }
}

function damageZombiesAtPoint(position, radius, amount, shouldFlash) {
  for (let index = zombies.length - 1; index >= 0; index -= 1) {
    if (distanceXZ(position, zombies[index].mesh.position) <= radius) {
      damageZombie(index, amount, shouldFlash);
    }
  }
}

function damageZombie(index, amount, shouldFlash) {
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
    removeZombie(index);
    player.score += zombie.score;
    return true;
  }

  return false;
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

function addTimedEffect(mesh, duration, followPlayer = false) {
  scene.add(mesh);
  mesh.traverse((child) => {
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];

    for (const material of materials) {
      material.userData.baseOpacity = material.opacity ?? 1;
    }
  });
  effects.push({ mesh, duration, age: 0, followPlayer });
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

    effect.mesh.scale.setScalar(1 + (1 - fade) * 0.32);
    effect.mesh.traverse((child) => {
      const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];

      for (const material of materials) {
        material.opacity = (material.userData.baseOpacity ?? 1) * fade;
      }
    });

    if (effect.age >= effect.duration) {
      const [expired] = effects.splice(index, 1);
      scene.remove(expired.mesh);
      disposeObject(expired.mesh);
    }
  }
}

function updateCamera(dt) {
  const cameraTarget = player.position.clone().addScaledVector(player.aimDirection, 2.6);
  cameraTarget.y = 1.2;

  const desiredPosition = player.position.clone().add(new THREE.Vector3(0, 17, 20));
  camera.position.lerp(desiredPosition, 1 - Math.pow(0.001, dt));
  camera.lookAt(cameraTarget);
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
  scene.remove(zombie.mesh);
  disposeObject(zombie.mesh);
}

function removeBullet(index) {
  const [bullet] = bullets.splice(index, 1);
  scene.remove(bullet.mesh);
  disposeObject(bullet.mesh);
}

function removeEnemyProjectile(index) {
  const [projectile] = enemyProjectiles.splice(index, 1);
  scene.remove(projectile.mesh);
  disposeObject(projectile.mesh);
}

function removePowerup(index) {
  const [powerup] = powerups.splice(index, 1);
  scene.remove(powerup.mesh);
  disposeObject(powerup.mesh);
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

  while (effects.length > 0) {
    const [effect] = effects.splice(effects.length - 1, 1);
    scene.remove(effect.mesh);
    disposeObject(effect.mesh);
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
  messageKicker.textContent = `Onda ${player.wave}`;
  messageTitle.textContent = "Fim da noite";
  messageCopy.textContent = `${player.score} pontos`;
  playButton.innerHTML = "<span aria-hidden=\"true\">↻</span>Reiniciar";
  message.classList.remove("is-hidden");
}

function updateHud() {
  healthFill.style.transform = `scaleX(${Math.max(player.health, 0) / 100})`;
  scoreElement.textContent = player.score.toString();
  waveElement.textContent = Math.max(player.wave, 1).toString();
  weaponNameElement.textContent = weapons[player.weapon].label;
  weaponTimerElement.textContent = player.weapon === "pistol" ? "Arma" : `${Math.ceil(player.weaponTimer)}s`;
}

function shouldUseMultiplayer() {
  if (!("WebSocket" in window) || queryParams.get("offline") === "1") {
    return false;
  }

  if (queryParams.has("ws")) {
    return true;
  }

  if (window.location.protocol === "file:" || window.location.hostname.endsWith("vercel.app")) {
    return false;
  }

  return true;
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
      return websocketUrl.toString();
    } catch {
      return null;
    }
  }

  if (!window.location.host) {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(multiplayer.room)}`;
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
    multiplayer.spawn.set(Number(messageData.spawn?.x) || 0, 0, Number(messageData.spawn?.z) || 0);

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
  updateMultiplayerHud();
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
      score: player.score,
      wave: Math.max(player.wave, 1),
      weapon: player.weapon,
      shooting: game.shooting,
      state: game.state,
    },
  });
}

function sendMultiplayerAttack(kind) {
  sendMultiplayerMessage({
    type: "attack",
    attack: {
      kind,
      weapon: player.weapon,
      x: player.position.x,
      z: player.position.z,
      aimX: player.aimDirection.x,
      aimZ: player.aimDirection.z,
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
    score: 0,
    wave: 1,
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

  remotePlayer.health = Math.max(0, Math.min(100, Number(state.health) || 0));
  remotePlayer.score = Math.max(0, Number(state.score) || 0);
  remotePlayer.wave = Math.max(1, Number(state.wave) || 1);
  remotePlayer.weapon = weapons[state.weapon] ? state.weapon : "pistol";
  remotePlayer.shooting = Boolean(state.shooting);
  remotePlayer.state = state.state || "menu";
  updatePlayerLabel(remotePlayer.labelSprite, remotePlayer.name, remotePlayer.color, remotePlayer.health);
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

    remotePlayer.labelSprite.position.copy(remotePlayer.mesh.position);
    remotePlayer.labelSprite.position.y = 3.1;
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

  const weapon = weapons[attack?.weapon] ? attack.weapon : attack?.kind || "pistol";
  spawnRemoteAttackVisual(origin, direction, weapon, remotePlayer?.color || "#74d1ff");
  applyRemoteAttackDamage(origin, direction, weapon);
}

function applyRemoteAttackDamage(origin, direction, weapon) {
  if (game.state !== "playing") {
    return;
  }

  if (weapon === "flamethrower") {
    damageZombiesInConeFrom(origin, direction, 10.5, Math.cos(0.58), 1.1, false);
    return;
  }

  if (weapon === "axe") {
    damageZombiesInRadiusAt(origin, 4.4, 5, false);
    return;
  }

  if (weapon === "katana") {
    damageZombiesInConeFrom(origin, direction, 5.8, Math.cos(0.92), 5, true);
    return;
  }

  if (weapon === "crossbow") {
    damageZombiesInConeFrom(origin, direction, 28, Math.cos(0.08), 4, true);
    return;
  }

  if (weapon === "talisman") {
    const explosionPoint = origin.clone().addScaledVector(direction, 8.5);
    damageZombiesAtPoint(explosionPoint, 4.8, 4, false);
    spawnExplosion(explosionPoint, weapons.talisman.color, 4.8);
    return;
  }

  damageZombiesInConeFrom(origin, direction, 24, Math.cos(0.06), 1, true);
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

  spawnRemoteBeam(origin, direction, color, weapon === "crossbow" ? 8.5 : weapon === "talisman" ? 6 : 5.5);
}

function spawnDirectionalConeEffect(origin, direction, color) {
  const normalizedDirection = direction.clone().normalize();
  const flame = new THREE.Group();
  flame.position.copy(origin).addScaledVector(normalizedDirection, 3.05);
  flame.position.y = 1.02;
  flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDirection);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 4.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  flame.add(cone);

  const light = new THREE.PointLight(color, 1.8, 7);
  light.position.y = -0.9;
  flame.add(light);

  addTimedEffect(flame, 0.16);
}

function spawnRemoteBeam(origin, direction, color, length) {
  const normalizedDirection = direction.clone().normalize();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, length, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthWrite: false }),
  );
  beam.position.copy(origin);
  beam.position.y = 1.12;
  beam.position.addScaledVector(normalizedDirection, length * 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDirection);
  addTimedEffect(beam, 0.14);
}

function spawnRemotePulse(origin, color, radius) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.055, 8, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76, depthWrite: false }),
  );
  ring.rotation.x = Math.PI * 0.5;
  ring.position.copy(origin);
  ring.position.y = 0.18;
  addTimedEffect(ring, 0.28, false);
}

function spawnRemoteSlash(origin, direction, color) {
  const slash = new THREE.Group();
  slash.position.copy(origin);
  slash.position.y = 0.28;
  slash.rotation.y = getForwardRotation(direction) - Math.PI * 0.5;

  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.045, 8, 48, Math.PI * 0.92),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  arc.rotation.x = Math.PI * 0.5;
  arc.position.z = -1.1;
  slash.add(arc);

  addTimedEffect(slash, 0.2);
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

function updatePlayerLabel(sprite, label, color, health) {
  const { canvas, context, texture } = sprite.userData;
  const healthRatio = Math.max(0, Math.min(1, health / 100));

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
    return;
  }

  onlineCountElement.textContent = multiplayer.full ? "Cheia" : "Solo";
  onlineStatusElement.textContent = multiplayer.status;
}

function lerpAngle(from, to, alpha) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function handleStickMove(event) {
  event.preventDefault();
  touchStick.setPointerCapture(event.pointerId);

  const rect = touchStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offsetX = event.clientX - centerX;
  const offsetY = event.clientY - centerY;
  const maxDistance = rect.width * 0.34;
  const distance = Math.min(Math.hypot(offsetX, offsetY), maxDistance);
  const angle = Math.atan2(offsetY, offsetX);
  const knobX = Math.cos(angle) * distance;
  const knobY = Math.sin(angle) * distance;

  touchKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  game.touchVector.set(knobX / maxDistance, knobY / maxDistance);

  if (game.touchVector.lengthSq() > 0.08) {
    player.aimDirection.set(game.touchVector.x, 0, game.touchVector.y).normalize();
  }
}

function resetStick() {
  touchKnob.style.transform = "translate(-50%, -50%)";
  game.touchVector.set(0, 0);
}

function resizeRenderer() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function distanceXZ(first, second) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function getForwardRotation(direction) {
  return Math.atan2(-direction.x, -direction.z);
}
