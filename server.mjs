import { stepCasterCaller } from "./src/combat/caster-caller-boundary.mjs";
import { cancelCasterCast, casterCastSnapshot } from "./src/combat/caster-cast.mjs";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RIFLE_COLLISION_HEIGHT, enemyProjectileCollisionHeight } from "./src/combat/collision-heights.mjs";
import { segmentCircleContact } from "./src/combat/projectile-sweep.mjs";
import { createCollisionWorld, createActorIndex, moveActor, stepActor, sweepStatic, pullActors, findFreePosition } from "./src/physics/contacts.mjs";
import { separateControlledActors } from "./src/combat/crowd-control.mjs";
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from "./src/render/environment-layout.js";
import { getPursuitDirection } from "./src/physics/navigation.mjs";
import { createSkillState, skillSnapshot, beginSkill, advanceSkills, getSkillModifiers, isSkillMoving, applySkillControl, tickSkillControl, cancelSkills } from "./src/combat/class-skills.mjs";
import { locomotionSpeed, creditMoveBudget, consumeMoveBudget } from "./src/combat/network-move.mjs";
import { getMeleeTiming, beginMeleeAttack, advanceMeleeAttack, isWithinMeleeArc } from "./src/combat/melee-timing.mjs";

import { createProgression, syncProgression, chooseUpgrade, collectDrop, attackStats, stats, resolveDamage, rewardKill, receiveDamage, tickProgression } from "./src/progression/authority.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
await loadLocalEnv();

const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? "0.0.0.0";
const maxPlayersPerRoom = 4;
const playerBaseMaxHealth = 200;
const playerNetworkMaxHealthCap = 600;
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const leaderboardPath = process.env.LEADERBOARD_FILE || path.join(root, ".data", "leaderboard.json");
const leaderboardLimit = 10;
const historyLimit = 120;
const liveLeaderboardLimit = 40;
const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const leaderboardBackend = supabaseUrl && supabaseServiceRoleKey ? "supabase" : "file";
const leaderboardBuildMetaPrefix = "__bipx:";
const rooms = new Map();
const resumableClients = new Map();
const reconnectGraceMs = 30_000;
const leaderboardStore = {
  players: Object.create(null),
  sessions: [],
};
let saveLeaderboardTimer = null;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
};

const serverWorldTickMs = 50;
const serverWorldBroadcastMs = 120;
const serverWorldResetMs = 8_000;
const serverWorldLimit = ENVIRONMENT_GROUND.radius;
const collisionWorld = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
const serverMonsterCap = 220;
const serverMonsterProfiles = {
  zombie: { health: 4.2, speed: 3.3, radius: 0.78, damage: 13, score: 10, xp: 3, minWave: 1 },
  orcPeon: { health: 8, speed: 3, radius: 0.85, damage: 15, score: 18, xp: 5, minWave: 2, meleeRange: 1.55, meleeCooldown: 0.9 },
  runner: { health: 3.2, speed: 6.1, radius: 0.58, damage: 11, score: 14, xp: 4, minWave: 2 },
  brute: { health: 17, speed: 2.2, radius: 1.18, damage: 27, score: 26, xp: 8, minWave: 3 },
  caster: { health: 8.5, speed: 2.8, radius: 0.82, damage: 16, score: 18, xp: 7, minWave: 4, ranged: true },
  visor: { health: 42, speed: 2.7, radius: 1.14, damage: 18, score: 90, xp: 28, minWave: 6, boss: true, ranged: true },
  himetrica: { health: 45, speed: 3.6, radius: 1.05, damage: 20, score: 95, xp: 30, minWave: 7, boss: true, ranged: true },
  dinzo: { health: 52, speed: 1.55, radius: 1.42, damage: 17, score: 105, xp: 34, minWave: 6, boss: true, ranged: true },
  gitcity: { health: 78, speed: 1.15, radius: 1.58, damage: 24, score: 140, xp: 42, minWave: 8, boss: true, ranged: true },
  sofra: { health: 86, speed: 4.25, radius: 1.28, damage: 22, score: 180, xp: 48, minWave: 9, boss: true, ranged: true },
  cowWalker: { health: 14, speed: 3.05, radius: 0.86, damage: 24, score: 20, xp: 6, minWave: 10 },
  cowCharger: { health: 11, speed: 5.75, radius: 0.78, damage: 21, score: 24, xp: 7, minWave: 10 },
  cowBrute: { health: 34, speed: 2.15, radius: 1.24, damage: 38, score: 38, xp: 12, minWave: 10 },
  angelSheep: { health: 360, speed: 2.15, radius: 1.48, damage: 26, score: 360, xp: 90, minWave: 999, boss: true, milestoneBoss: true, ranged: true },
  bloodCow: { health: 720, speed: 2.55, radius: 1.72, damage: 36, score: 620, xp: 130, minWave: 999, boss: true, milestoneBoss: true, ranged: true },
  plumaFinance: { health: 920, speed: 2.85, radius: 1.36, damage: 32, score: 900, xp: 180, minWave: 999, boss: true, milestoneBoss: true, ranged: true },
};
const serverCowMonsterTypes = new Set(["cowWalker", "cowCharger", "cowBrute"]);
const serverEliteProfiles = {
  furious: { healthMultiplier: 1.75, speedMultiplier: 1.38, damageMultiplier: 1.85, scoreMultiplier: 1.35, xpMultiplier: 1.25, reachBonus: 0.12 },
  armored: { healthMultiplier: 3.25, speedMultiplier: 0.82, damageMultiplier: 1.45, scoreMultiplier: 1.55, xpMultiplier: 1.5, reachBonus: 0.05 },
  executioner: { healthMultiplier: 2.25, speedMultiplier: 0.95, damageMultiplier: 2.05, scoreMultiplier: 1.7, xpMultiplier: 1.65, reachBonus: 0.82 },
};
const serverWaveMilestones = new Map([
  [5, "angelSheep"],
  [10, "bloodCow"],
  [20, "plumaFinance"],
]);
const serverCharacterProfiles = {
  warrior: { weapon: "katana", shape: "cone", range: 4.2, minDot: Math.cos(0.92), damage: 7, cooldown: 500 },
  dwarf: { weapon: "pistol", shape: "ray", range: 26, radius: 0.12, damage: 2, cooldown: 300 },
};

await loadLeaderboard();

const server = http.createServer(async (request, response) => {
  let requestUrl;
  let pathname;
  try {
    requestUrl = new URL(request.url, `http://${request.headers.host}`);
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400);
    response.end('Invalid request URL');
    return;
  }

  if (pathname === "/api/leaderboard") {
    writeCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end("Method not allowed");
      return;
    }

    await refreshLeaderboardForRead();
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(getLeaderboardSnapshot()));
    return;
  }

  if (pathname === "/api/leaderboard/session" || pathname === "/api/leaderboard/live") {
    writeCorsHeaders(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    // Shared results come only from server-observed rooms. Solo records stay local.
    request.resume();
    response.writeHead(410, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ error: "client_scores_not_accepted" }));
    return;
  }

  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.normalize(path.join(root, requestedFile));
  const publicEntry = ['index.html', 'styles.css', 'favicon.svg', 'favicon.ico'].includes(requestedFile);
  const publicDirectory = /^(src|vendor|assets|public|models|textures|audio)\//.test(requestedFile);
  const privateSegment = requestedFile.split(/[\\/]/).some(segment => segment.startsWith('.'));
  if ((!publicEntry && !publicDirectory) || privateSegment) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Content-Length": file.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.on("upgrade", (request, socket) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const websocketKey = request.headers["sec-websocket-key"];
  if (!websocketKey) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(`${websocketKey}${websocketGuid}`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n"),
  );

  joinMultiplayerRoom(requestUrl, socket);
});

server.listen(port, host, () => {
  const listeningPort = server.address().port;
  console.log(`http://${host}:${listeningPort}`);
  console.log(`Multiplayer WebSocket: ws://${host}:${listeningPort}/ws?room=cemiterio`);
});

function joinMultiplayerRoom(requestUrl, socket) {
  const roomId = sanitizeRoomId(requestUrl.searchParams.get("room"));
  const token = requestUrl.searchParams.get("resumeToken");
  const retained = token ? resumableClients.get(token) : null;
  if (retained && retained.roomId === roomId && (!retained.disconnectedAt || Date.now() - retained.disconnectedAt < reconnectGraceMs)) {
    const room = rooms.get(roomId);
    if (room?.clients.get(retained.id) === retained) {
      const previousSocket = retained.socket;
      attachClientSocket(retained, socket);
      // A half-open previous transport can close later; its callbacks are guarded.
      if (previousSocket && previousSocket !== socket) previousSocket.destroy();
      sendWelcome(retained, room, true);
      broadcast(room, { type: "playerJoined", player: createPlayerSnapshot(retained) }, retained.id);
      return;
    }
  }
  if (retained?.disconnectedAt && Date.now() - retained.disconnectedAt >= reconnectGraceMs) expireClient(retained);
  const room = getRoom(roomId);
  if (room.clients.size >= maxPlayersPerRoom) {
    sendFrame(socket, 0x1, Buffer.from(JSON.stringify({ type: "roomFull", maxPlayers: maxPlayersPerRoom })));
    setTimeout(() => socket.end(), 120);
    return;
  }
  const slot = getFreeSlot(room);
  const character = normalizeCharacter(requestUrl.searchParams.get("character"));
  const client = {
    id: crypto.randomUUID(),
    resumeToken: crypto.randomBytes(32).toString("base64url"),
    name: sanitizePlayerName(requestUrl.searchParams.get("name"), slot), roomId, slot,
    sessionBestScore: 0, sessionBestKills: 0, sessionBestWave: 1,
    sessionBestLevel: 1, sessionBestBuild: [], sessionStartedAt: null,
    attackCooldowns: new Map(), pendingRewards: new Map(), lastStartRequestId: null,
    state: createInitialPlayerState(slot, character),
  };
  client.progression = createProgression(client.state);
  client.skills = createSkillState(client.state.character);
  client.skillReceipts = new Map();
  client.moveClock = Date.now();
  client.moveBudget = 0;
  client.state.skills = skillSnapshot(client.skills);
  room.clients.set(client.id, client);
  resumableClients.set(client.resumeToken, client);
  attachClientSocket(client, socket);
  sendWelcome(client, room, false);
  broadcast(room, { type: "playerJoined", player: createPlayerSnapshot(client) }, client.id);
}

function createInitialPlayerState(slot, character, stateVersion = 0, room = null, excludeClientId = null) {
  const occupants = room ? getServerCrowdBodies(room, [...room.clients.values()].filter(client =>
    client.id !== excludeClientId && client.state.state === 'playing' && client.state.health > 0)) : [];
  const spawn = getSpawnPoint(slot, occupants);
  return {
    x: spawn.x, z: spawn.z, rotation: 0, aimX: 0, aimZ: -1,
    health: playerBaseMaxHealth, maxHealth: playerBaseMaxHealth,
    score: 0, kills: 0, xpTotal: 0, wave: 1, level: 1, bestLevel: 1, build: [],
    runId: crypto.randomUUID(), stateVersion,
    character, weapon: serverCharacterProfiles[character].weapon,
    shooting: false, state: "menu",
  };
}

function attachClientSocket(client, socket) {
  client.socket = socket; client.connected = true; client.disconnectedAt = 0;
  client.lastSeen = Date.now(); client.buffer = Buffer.alloc(0);
  socket.on("data", chunk => { if (client.socket === socket) handleSocketData(client, chunk); });
  socket.on("close", () => removeClient(client, socket));
  socket.on("error", () => removeClient(client, socket));
}

function sendWelcome(client, room, resumed) {
  client.state.skills = skillSnapshot(client.skills);
  syncProgression(client.state, client.progression);
  sendJson(client, {
    type: "welcome", id: client.id, room: client.roomId, maxPlayers: maxPlayersPerRoom,
    spawn: { x: client.state.x, z: client.state.z }, resumeToken: client.resumeToken, resumed,
    resumeGraceMs: reconnectGraceMs, selfState: client.state,
    pendingRewards: [...client.pendingRewards.values()],
    players: [...room.clients.values()].filter(other => other.connected).map(createPlayerSnapshot),
    leaderboard: getLeaderboardSnapshot(), world: getWorldSnapshot(room),
  });
}

function startClientRun(room, client, requestedState = {}, requestId = null) {
  const startId = typeof requestId === 'string' ? requestId.slice(0, 96) : null;
  if (startId && startId === client.lastStartRequestId) {
    sendJson(client, { type: 'runStarted', requestId: startId, state: client.state, world: getWorldSnapshot(room) });
    return;
  }
  const character = normalizeCharacter(requestedState.character, client.state.character);
  let nextState;
  try {
    nextState = createInitialPlayerState(client.slot, character, client.state.stateVersion + 1, room, client.id);
  } catch (error) {
    if (error.code !== 'NO_FREE_SPAWN') throw error;
    sendJson(client, { type: 'runStartRejected', requestId: startId, reason: 'no-free-spawn', state: client.state });
    return;
  }
  client.lastStartRequestId = startId;
  finishPlayerSession(client);
  client.state = nextState;
  client.state.state = "playing";
  client.state.wave = Math.max(1, room.world.wave);
  client.progression = createProgression(client.state);
  client.skills = createSkillState(client.state.character);
  client.skillReceipts = new Map();
  client.state.skills = skillSnapshot(client.skills);
  client.moveClock = Date.now();
  client.moveBudget = 0;
  client.attackCooldowns.clear();
  client.pendingRewards.clear();
  ensureRoomWorldActive(room);
  updatePlayerHistory(client, "menu");
  sendJson(client, { type: "runStarted", requestId: startId, state: client.state, world: getWorldSnapshot(room) });
  broadcast(room, { type: "playerState", id: client.id, state: client.state }, client.id);
  broadcastLeaderboard(room);
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, clients: new Map(), world: createRoomWorld() });
  }

  return rooms.get(roomId);
}

function createRoomWorld() {
  return {
    epoch: crypto.randomUUID(),
    casterTick: 0,
    active: false,
    seq: 0,
    wave: 0,
    survivalTime: 0,
    spawnTimer: 0,
    zombiesToSpawn: 0,
    nextWaveDelay: 0.3,
    nextMonsterId: 1,
    nextProjectileId: 1,
    monsters: new Map(),
    projectiles: new Map(),
    milestonesTriggered: new Set(),
    lastBroadcastAt: 0,
    idleStartedAt: 0,
  };
}

function resetRoomWorld(room) {
  for (const monster of room.world.monsters.values()) cancelServerCaster(room, monster, 'world-reset');
  room.world = createRoomWorld();
}

function getFreeSlot(room) {
  const usedSlots = new Set([...room.clients.values()].map((client) => client.slot));

  for (let slot = 0; slot < maxPlayersPerRoom; slot += 1) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  return 0;
}

function getSpawnPoint(slot, actors = []) {
  const point = [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: -4, z: 0 },
    { x: 0, z: 4 },
  ][slot] ?? { x: 0, z: 0 };
  const free = findFreePosition(collisionWorld, { ...point, radius: .64 }, { maxDistance: 16, actors });
  if (!free.found) throw Object.assign(new Error("No valid player spawn in environment"), { code: 'NO_FREE_SPAWN' });
  return { x: free.x, z: free.z };
}

function sanitizeRoomId(roomId) {
  return String(roomId || "cemiterio")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 28) || "cemiterio";
}

function sanitizePlayerName(name, slot = 0) {
  const cleaned = String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, 16);

  return cleaned || `Player ${slot + 1}`;
}

function handleSocketData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);

  while (client.buffer.length >= 2) {
    const firstByte = client.buffer[0];
    const secondByte = client.buffer[1];
    const isFinal = Boolean(firstByte & 0x80);
    const opcode = firstByte & 0x0f;
    const isMasked = Boolean(secondByte & 0x80);
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (!isFinal || !isMasked) {
      closeSocket(client.socket);
      return;
    }

    if (payloadLength === 126) {
      if (client.buffer.length < offset + 2) return;
      payloadLength = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (client.buffer.length < offset + 8) return;
      const largeLength = client.buffer.readBigUInt64BE(offset);
      if (largeLength > 65_536n) {
        closeSocket(client.socket);
        return;
      }
      payloadLength = Number(largeLength);
      offset += 8;
    }

    if (payloadLength > 65_536) {
      closeSocket(client.socket);
      return;
    }

    const frameLength = offset + 4 + payloadLength;
    if (client.buffer.length < frameLength) {
      return;
    }

    const mask = client.buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLength);

    for (let index = 0; index < payloadLength; index += 1) {
      payload[index] = client.buffer[offset + index] ^ mask[index % 4];
    }

    client.buffer = client.buffer.subarray(frameLength);
    client.lastSeen = Date.now();

    if (opcode === 0x8) {
      closeSocket(client.socket);
      return;
    }

    if (opcode === 0x9) {
      sendFrame(client.socket, 0xA, payload);
      continue;
    }

    if (opcode === 0xA) {
      continue;
    }

    if (opcode === 0x1) {
      handleClientMessage(client, payload.toString("utf8"));
    }
  }
}

function handleClientMessage(client, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (!message || typeof message !== "object" || Array.isArray(message) || typeof message.type !== "string") {
    return;
  }

  const room = rooms.get(client.roomId);
  if (!room) {
    return;
  }

  if (message.type === "startRun") {
    startClientRun(room, client, message.state, message.requestId);
    return;
  }

  if (message.type === 'rewardAck') {
    client.pendingRewards.delete(String(message.rewardId || ''));
    return;
  }

  if (message.type === 'chooseUpgrade' || message.type === 'pickup') {
    const result = message.type === 'chooseUpgrade'
      ? chooseUpgrade(client.state, client.progression, message)
      : collectDrop(client.state, client.progression, message);
    sendJson(client, {type: 'progressionResult', command: message.type,
      requestId: typeof message.requestId === 'string' ? message.requestId.slice(0,96) : null,
      runId: client.state.runId, result, state: client.state});
    if (result.ok && !result.duplicate) {
      const leaderboardChanged = updatePlayerHistory(client, client.state.state);
      broadcast(room, {type:'playerState', id:client.id, state:client.state}, client.id);
      if (leaderboardChanged) broadcastLeaderboard(room);
    }
    return;
  }

  if (message.type === "state") {
    const previousVersion = client.state.stateVersion;
    const previousState = client.state.state;
    const now = Date.now();
    const dashing = isSkillMoving(client.skills) || now < (client.skillMovementUntil || 0);
    const incomingState = dashing ? { ...message.state, x: client.state.x, z: client.state.z } : message.state;
    if (dashing) {
      client.moveClock = now;
      client.moveBudget = 0;
      // Skill mover already collided; never copy client x/z into normalizePlayerState.
      client.state = normalizePlayerState(incomingState, client.state, { position: { x: client.state.x, z: client.state.z } });
    } else {
      const credited = creditMoveBudget({
        now, moveClock: client.moveClock, moveBudget: client.moveBudget,
        speed: locomotionSpeed(client.progression, client.skills, { stats, getSkillModifiers }),
      });
      const requestedX = clampNumber(incomingState?.x, -serverWorldLimit, serverWorldLimit, client.state.x) - client.state.x;
      const requestedZ = clampNumber(incomingState?.z, -serverWorldLimit, serverWorldLimit, client.state.z) - client.state.z;
      const spent = consumeMoveBudget(requestedX, requestedZ, credited.moveBudget);
      const moved = moveActor(collisionWorld, { id: client.id, x: client.state.x, z: client.state.z, radius: .64 }, { x: spent.dx, z: spent.dz });
      client.moveClock = credited.moveClock;
      client.moveBudget = spent.leftover;
      client.lastMoveDiscarded = { meters: spent.discarded, dt: credited.discardedDt, blocked: moved.blocked, consumed: spent.consume, travelled: Math.hypot(moved.x - client.state.x, moved.z - client.state.z) };
      client.state = normalizePlayerState(incomingState, client.state, { position: moved });
    }
    if ((Number.isFinite(message.state?.x) && Math.abs(message.state.x - client.state.x) > .02) ||
        (Number.isFinite(message.state?.z) && Math.abs(message.state.z - client.state.z) > .02)) {
      sendJson(client, { type: 'positionCorrection', runId: client.state.runId, x: client.state.x, z: client.state.z });
    }
    client.progression.character = client.state.character;
    if (client.skills.classId !== client.state.character) client.skills = createSkillState(client.state.character);
    client.state.skills = skillSnapshot(client.skills);
    syncProgression(client.state, client.progression);
    if (client.state.state === "playing" && previousState !== "playing") {
      ensureRoomWorldActive(room);
    }
    const leaderboardChanged = updatePlayerHistory(client, previousState);
    if (client.state.stateVersion !== previousVersion || client.state.state !== previousState) {
      sendJson(client, { type: "playerState", id: client.id, state: client.state });
    }
    broadcast(room, {
      type: "playerState",
      id: client.id,
      state: client.state,
    }, client.id);
    if (leaderboardChanged) {
      broadcastLeaderboard(room);
    }
    return;
  }

  if (message.type === "profile") {
    client.name = sanitizePlayerName(message.name, client.slot);
    broadcast(room, {
      type: "playerProfile",
      player: createPlayerSnapshot(client),
    });
    broadcastLeaderboard(room);
    return;
  }

  if (message.type === "skill") {
    handleServerSkill(room, client, message);
    return;
  }

  if (message.type === "attack") {
    const attack = normalizeAttack(message.attack, client.state, client.progression);
    if (!applyServerAttackDamage(room, client, attack)) return;
    broadcast(room, {
      type: "playerAttack",
      id: client.id,
      attack,
    }, client.id);
  }
}

function normalizeCharacter(value, fallback = "dwarf") {
  return value === "warrior" || value === "dwarf" ? value : fallback;
}

function normalizePlayerState(state, fallback, options = {}) {
  const currentCharacter = normalizeCharacter(fallback.character);
  const character = fallback.state === "menu" ? normalizeCharacter(state?.character, currentCharacter) : currentCharacter;
  const nextState = fallback.state === "menu" && state?.state === "playing" ? "playing" : fallback.state;
  // x/z come only from an already-collided `position` (moveActor or skill mover).
  const x = options.position ? clampNumber(options.position.x, -serverWorldLimit, serverWorldLimit, fallback.x) : fallback.x;
  const z = options.position ? clampNumber(options.position.z, -serverWorldLimit, serverWorldLimit, fallback.z) : fallback.z;
  // Intent only: HP, XP, level, builds, perks and all combat modifiers remain authoritative.
  return {
    ...fallback,
    x, z,
    rotation: clampNumber(state?.rotation, -Math.PI * 2, Math.PI * 2, fallback.rotation),
    aimX: clampNumber(state?.aimX, -1, 1, fallback.aimX), aimZ: clampNumber(state?.aimZ, -1, 1, fallback.aimZ),
    character, weapon: serverCharacterProfiles[character].weapon,
    shooting: nextState === "playing" && Boolean(state?.shooting), state: nextState,
  };
}

function normalizeBuildSummary(build) {
  if (!Array.isArray(build)) {
    return [];
  }

  return build
    .map((item) =>
      String(item || "")
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 40),
    )
    .filter(Boolean)
    .slice(0, 8);
}

function encodeBuildForStorage(build, metadata = {}) {
  const cleanBuild = normalizeBuildSummary(build).filter((item) => !item.startsWith(leaderboardBuildMetaPrefix));
  const metadataParts = [];
  const kills = Math.max(0, Math.floor(Number(metadata.kills) || 0));
  const totalKills = Math.max(0, Math.floor(Number(metadata.totalKills) || 0));

  if (kills > 0) {
    metadataParts.push(`k=${kills}`);
  }

  if (totalKills > 0) {
    metadataParts.push(`t=${totalKills}`);
  }

  const metadataItems = metadataParts.length > 0 ? [`${leaderboardBuildMetaPrefix}${metadataParts.join(",")}`] : [];
  return [...cleanBuild.slice(0, 8 - metadataItems.length), ...metadataItems];
}

function decodeStoredBuild(build) {
  const cleanBuild = [];
  const metadata = {};

  for (const item of normalizeBuildSummary(build)) {
    if (!item.startsWith(leaderboardBuildMetaPrefix)) {
      cleanBuild.push(item);
      continue;
    }

    const payload = item.slice(leaderboardBuildMetaPrefix.length);
    for (const pair of payload.split(",")) {
      const [key, rawValue] = pair.split("=");
      const value = Math.max(0, Math.floor(Number(rawValue) || 0));
      if (key === "k") {
        metadata.kills = Math.max(metadata.kills || 0, value);
      }
      if (key === "t") {
        metadata.totalKills = Math.max(metadata.totalKills || 0, value);
      }
    }
  }

  return { build: cleanBuild.slice(0, 8), metadata };
}

function normalizeAttack(attack, fallbackState, progression) {
  return {
    kind: typeof attack?.kind === "string" ? attack.kind.slice(0, 24) : fallbackState.weapon,
    weapon: typeof attack?.weapon === "string" ? attack.weapon.slice(0, 24) : fallbackState.weapon,
    x: fallbackState.x, z: fallbackState.z,
    aimX: clampNumber(attack?.aimX, -1, 1, fallbackState.aimX),
    aimZ: clampNumber(attack?.aimZ, -1, 1, fallbackState.aimZ),
    ...attackStats(progression),
    damageMultiplier: attackStats(progression).damageMultiplier * getSkillModifiers({ buff: fallbackState.skills?.buff }).damage,
  };
}

function updateRoomWorlds() {
  const dt = serverWorldTickMs / 1000;
  for (const room of rooms.values()) {
    expireDisconnectedClients(room);
    if (!rooms.has(room.id)) continue;
    updateRoomWorld(room, dt);
  }
}

function ensureRoomWorldActive(room) {
  const world = room.world;
  world.active = true;
  world.idleStartedAt = 0;
  if (world.wave <= 0) {
    startServerNextWave(room);
  }
}

function updateRoomWorld(room, dt) {
  const world = room.world;
  const playingClients = getPlayingClients(room);
  const skillClients = getSkillClients(room);

  if (playingClients.length === 0) {
    if (skillClients.length) {
      // Keep buff/projectile/field clocks running during reconnect grace. Do not spawn or wipe.
      for (const client of skillClients) {
        tickProgression(client.state, client.progression, dt);
        updateServerSkills(room, client, dt);
      }
      if (Date.now() - world.lastBroadcastAt >= serverWorldBroadcastMs) broadcastWorldState(room);
      return;
    }
    if (world.active) {
      handleRoomWipe(room);
    }
    return;
  }

  ensureRoomWorldActive(room);
  world.survivalTime += dt;
  for (const client of skillClients) {
    if (tickProgression(client.state, client.progression, dt)) {
      sendJson(client, {type:'playerState', id:client.id, state:client.state});
    }
  }
  for (const client of skillClients) updateServerSkills(room, client, dt);
  updateServerSpawning(room, playingClients, dt);
  updateServerMonsters(room, playingClients, dt);
  updateServerProjectiles(room, playingClients, dt);

  if (world.monsters.size === 0 && world.zombiesToSpawn <= 0) {
    world.nextWaveDelay -= dt;
    if (world.nextWaveDelay <= 0) {
      startServerNextWave(room);
    }
  }

  if (Date.now() - world.lastBroadcastAt >= serverWorldBroadcastMs) {
    broadcastWorldState(room);
  }
}

function getPlayingClients(room) {
  return [...room.clients.values()].filter((client) => client.connected && client.state.state === "playing" && client.state.health > 0);
}

function getSkillClients(room) {
  return [...room.clients.values()].filter((client) => client.state.state === "playing" && client.state.health > 0);
}

function handleRoomWipe(room) {
  const previousWave = Math.max(1, Math.floor(Number(room.world.wave) || 1));
  resetRoomWorld(room);
  broadcast(room, { type: "roomWipe", previousWave, wave: 1 });
  broadcastWorldState(room);
}

function startServerNextWave(room) {
  const world = room.world;
  world.wave += 1;
  for (const client of room.clients.values()) if (client.state.state === "playing") client.state.wave = world.wave;
  world.nextWaveDelay = 1.2;
  const wavePressure = Math.floor(Math.pow(Math.max(0, world.wave - 1), 1.32) * 7.8);
  const survivalPressure = Math.floor(world.survivalTime / 6);
  world.zombiesToSpawn = Math.min(24 + world.wave * 11 + wavePressure + survivalPressure, Math.max(120, serverMonsterCap - 8));
  world.spawnTimer = 0.15;

  const milestoneBoss = serverWaveMilestones.get(world.wave);
  if (milestoneBoss && !world.milestonesTriggered.has(world.wave)) {
    world.milestonesTriggered.add(world.wave);
    spawnServerMonsterNearClient(room, getPlayingClients(room)[0], milestoneBoss, milestoneBoss === "plumaFinance" ? 20 : 17);
  }

  broadcast(room, { type: "roomWave", wave: world.wave, zombiesToSpawn: world.zombiesToSpawn });
}

function updateServerSpawning(room, playingClients, dt) {
  const world = room.world;
  if (world.zombiesToSpawn <= 0 || world.monsters.size >= serverMonsterCap) {
    return;
  }

  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) {
    return;
  }

  const target = playingClients[Math.floor(Math.random() * playingClients.length)];
  spawnServerMonsterNearClient(room, target, pickServerMonsterType(world));
  world.zombiesToSpawn -= 1;
  world.spawnTimer = getServerSpawnInterval(world);
}

function spawnServerMonsterNearClient(room, client, type = pickServerMonsterType(room.world), distanceOverride = null) {
  const base = client?.state ?? getSpawnPoint(0);
  const angle = Math.random() * Math.PI * 2;
  const distance = distanceOverride ?? 28 + Math.random() * 22;
  const x = clampNumber(base.x + Math.cos(angle) * distance, -serverWorldLimit + 2, serverWorldLimit - 2, 0);
  const z = clampNumber(base.z + Math.sin(angle) * distance, -serverWorldLimit + 2, serverWorldLimit - 2, 0);
  return spawnServerMonster(room, x, z, type);
}

function spawnServerMonster(room, x, z, type = "zombie") {
  const world = room.world;
  const profile = serverMonsterProfiles[type] ?? serverMonsterProfiles.zombie;
  const eliteType = profile.boss ? null : rollServerEliteType(world, type);
  const eliteProfile = eliteType ? serverEliteProfiles[eliteType] : null;
  const difficulty = getServerDifficultyScale(world);
  const balance = getServerMonsterBalanceModifiers(type, profile, world);
  const maxHealth = Math.max(1, (profile.health + Math.floor(world.survivalTime / 120)) * difficulty.health * balance.health * (eliteProfile?.healthMultiplier ?? 1));
  const monster = {
    id: world.nextMonsterId,
    type,
    eliteType,
    x,
    z,
    rotation: 0,
    health: maxHealth,
    maxHealth,
    speed: (profile.speed + Math.min(world.wave * 0.16 + world.survivalTime * 0.01, 5.8) * difficulty.speed + Math.random() * 0.7) * (eliteProfile?.speedMultiplier ?? 1) * balance.speed,
    damage: profile.damage * difficulty.damage * (eliteProfile?.damageMultiplier ?? 1) * balance.damage,
    radius: profile.radius,
    score: Math.ceil(profile.score * (eliteProfile?.scoreMultiplier ?? 1)),
    xp: Math.ceil(profile.xp * (eliteProfile?.xpMultiplier ?? 1)),
    attackCooldown: 0.25 + Math.random() * 0.35,
    reachBonus: eliteProfile?.reachBonus ?? 0,
    freezeTimer: 0,
    burnTimer: 0,
    burnDps: 0,
    burnSourceId: null,
    bossTargetId: null,
    bossRetargetTimer: 0,
  };
  const spawn = findFreePosition(collisionWorld, monster, { maxDistance: 16, actors: getServerCrowdBodies(room) });
  if (!spawn.found) return null;
  monster.x = spawn.x; monster.z = spawn.z;
  world.monsters.set(monster.id, monster);
  world.actorIndex?.update({ ...monster, id: `monster:${monster.id}` });
  world.nextMonsterId += 1;
  world.seq += 1;
  return monster;
}

function getServerCrowdBodies(room, playingClients = getPlayingClients(room)) {
  const bodies = [...room.world.monsters.values()].filter(monster => monster.health > 0)
    .map(monster => ({ id: `monster:${monster.id}`, x: monster.x, z: monster.z, radius: monster.radius,
      freezeTimer: monster.freezeTimer, stunTimer: monster.stunTimer }));
  for (const client of playingClients) if (client.state.health > 0) bodies.push({
    id: `player:${client.id}`, x: client.state.x, z: client.state.z, radius: .64, inverseMass: 0,
  });
  return bodies;
}

function publishServerCaster(room, monster, result) {
  monster.casterCastState = result.state;
  // All phases in this step carry the same final snapshot; receivers dedup by
  // eventId even when release/end share a revision in a long simulation tick.
  const snapshot = casterCastSnapshot(result.state);
  for (const event of result.events) broadcast(room, { type: 'monsterCast', worldEpoch: room.world.epoch, snapshot, event });
}

function cancelServerCaster(room, monster, reason) {
  if (!monster.casterCastState?.cast) return;
  publishServerCaster(room, monster, cancelCasterCast(monster.casterCastState, { castId: monster.casterCastState.cast.castId, reason }));
}

function updateServerCaster(room, monster, playingClients, dt, controls) {
  const active = monster.casterCastState?.cast?.phase && monster.casterCastState.cast.phase !== 'end';
  const living = playingClients.filter(client => client.connected && client.state.state === 'playing' && client.state.health > 0);
  const target = active ? living.find(client => client.id === monster.casterCastState.cast.targetId) : getServerMonsterTarget(monster, living);
  const distance = target ? Math.hypot(target.state.x - monster.x, target.state.z - monster.z) : Infinity;
  const profile = serverMonsterProfiles[monster.type];
  const meleeRange = (profile.meleeRange ?? monster.radius + .72) + (monster.reachBonus || 0);
  const step = stepCasterCaller({ state: monster.casterCastState, worldEpoch: room.world.epoch,
    actor: { id: monster.id, type: monster.type, position: monster, present: room.world.monsters.has(monster.id),
      alive: monster.health > 0, frozen: controls.frozen, stunned: controls.stunned },
    target: target ? { id: target.id, lifeId: target.state.runId, present: true, alive: true, position: target.state } : null,
    tick: room.world.casterTick, dt, ready: monster.attackCooldown <= 0,
    inRange: distance < 22 && distance > meleeRange + 1.2,
    losClear: Boolean(target && !sweepStatic(collisionWorld, { x: monster.x, y: .9, z: monster.z }, { x: target.state.x, y: .9, z: target.state.z }, 0)),
    cooldownDuration: getServerRangedCooldown('caster') });
  if (step.assignCooldown !== null) monster.attackCooldown = step.assignCooldown;
  publishServerCaster(room, monster, step);
  if (step.state.cast) monster.rotation = Math.atan2(-step.state.cast.direction.x, -step.state.cast.direction.z);
  for (const event of step.events) if (event.phase === 'release') {
    spawnServerProjectile(room, monster, target, event.direction.x, event.direction.z,
      { castId: event.castId, actorId: monster.id, firstStepDt: event.remainderAfterRelease });
  }
  return step.consumeActorStep;
}

function updateServerMonsters(room, playingClients, dt) {
  const world = room.world;
  world.casterTick++;
  // Skills/pull and spawning already ran. This index lives only until crowd correction.
  world.actorIndex = createActorIndex(getServerCrowdBodies(room, playingClients));
  try {
    let navigationBudget = 4;
    const ordered = [...world.monsters.values()];
    const offset = ((world.navigationTick = (world.navigationTick || 0) + 1) * 4) % Math.max(1, ordered.length);
    for (const monster of ordered.slice(offset).concat(ordered.slice(0, offset))) {
      const casterControls = { frozen: monster.freezeTimer > 0, stunned: monster.stunTimer > 0 };
      updateServerMonsterStatus(room, monster, dt);
      if (!world.monsters.has(monster.id)) {
        world.actorIndex.remove(`monster:${monster.id}`);
        continue;
      }

      monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
      if (monster.type === 'caster' && updateServerCaster(room, monster, playingClients, dt, casterControls)) continue;
      if (monster.freezeTimer > 0 || monster.stunTimer > 0) {
        if (monster.meleeAttack) monster.meleeAttack.active = false;
        continue;
      }

      if (monster.meleeAttack?.active) {
        const strike = monster.meleeAttack;
        const lockedTarget = playingClients.find(client => client.id === strike.targetId && client.state.health > 0);
        if (!lockedTarget) strike.active = false;
        else {
          const phase = advanceMeleeAttack(strike, dt);
          if (phase.impact && isWithinMeleeArc(monster, lockedTarget.state, strike) && !sweepStatic(collisionWorld, { x: monster.x, y: .9, z: monster.z }, { x: lockedTarget.state.x, y: .9, z: lockedTarget.state.z }, 0)) {
            damageServerPlayer(room, lockedTarget, monster.damage + Math.floor(world.wave * .55));
          }
        }
        continue;
      }

      const target = getServerMonsterTarget(monster, playingClients);
      if (!target) {
        continue;
      }

      const dx = target.state.x - monster.x;
      const dz = target.state.z - monster.z;
      const distance = Math.hypot(dx, dz);
      const directionX = distance > 0.001 ? dx / distance : 0;
      const directionZ = distance > 0.001 ? dz / distance : 1;
      monster.rotation = Math.atan2(-directionX, -directionZ);
      const profile = serverMonsterProfiles[monster.type] ?? serverMonsterProfiles.zombie;
      const meleeRange = (profile.meleeRange ?? monster.radius + 0.72) + (monster.reachBonus || 0);
      const meleeTiming = getMeleeTiming(monster.type);
      const fallbackMeleeRange = meleeTiming ? meleeRange * 0.84 : meleeRange;
      const clearMelee = !sweepStatic(collisionWorld, { x: monster.x, y: .9, z: monster.z }, { x: target.state.x, y: .9, z: target.state.z }, 0);
      if (meleeTiming && distance <= meleeTiming.reach + (monster.reachBonus || 0) && clearMelee) {
        if (monster.attackCooldown <= 0) {
          monster.meleeSequence = (monster.meleeSequence || 0) + 1;
          monster.meleeAttack = beginMeleeAttack(monster, target.state, {
            ...meleeTiming, id: monster.meleeSequence, targetId: target.id,
            reach: meleeTiming.reach + (monster.reachBonus || 0),
          });
          monster.attackCooldown = meleeTiming.cooldown;
          broadcast(room, { type: 'monsterMelee', monster: serializeMonster(monster) });
        }
        continue;
      }

      if (monster.type !== 'caster' && profile.ranged && distance < 22 && distance > meleeRange + 1.2 && monster.attackCooldown <= 0 && clearMelee) {
        monster.attackCooldown = getServerRangedCooldown(monster.type);
        spawnServerProjectile(room, monster, target, directionX, directionZ);
        continue;
      }

      if (distance > fallbackMeleeRange || !clearMelee) {
        if (monster.pullTimer > 0) continue; // External field owns translation, not attacks.
        const speed = monster.speed * (profile.boss && monster.health / monster.maxHealth < 0.35 ? 1.08 : 1);
        const pursuit = getPursuitDirection(collisionWorld, monster, target.state, monster.navigation, dt, { speed, arrivalRadius: fallbackMeleeRange, allowPlanning: navigationBudget > 0 });
        monster.navigation = pursuit.state; if (pursuit.state.planned) navigationBudget--;
        const body = { id: `monster:${monster.id}`, x: monster.x, z: monster.z, radius: monster.radius };
        const moved = stepActor(collisionWorld, body, { x: pursuit.direction.x * speed, z: pursuit.direction.z * speed }, dt, { bodies: world.actorIndex });
        if (Math.hypot(pursuit.direction.x, pursuit.direction.z) > .01) monster.rotation = Math.atan2(-pursuit.direction.x, -pursuit.direction.z);
        monster.x = moved.x; monster.z = moved.z;
        world.actorIndex.update({ ...body, x: moved.x, z: moved.z });
      } else if (monster.attackCooldown <= 0 && clearMelee) {
        monster.attackCooldown = profile.meleeCooldown ?? (profile.boss ? 0.86 : 0.62);
        damageServerPlayer(room, target, monster.damage + Math.floor(world.wave * (profile.boss ? 0.65 : 0.55)));
      }
    }
    const separated = separateControlledActors(collisionWorld, getServerCrowdBodies(room, playingClients), dt);
    for (const body of separated.bodies) if (String(body.id).startsWith('monster:')) {
      const monster = world.monsters.get(Number(body.id.slice(8)));
      if (monster) { monster.x = body.x; monster.z = body.z; }
    }
  } finally {
    world.actorIndex = null;
  }
}

function updateServerMonsterStatus(room, monster, dt) {
  tickSkillControl(monster, dt, event => broadcast(room, { type: 'skillEvent', serverTime: Date.now(), id: monster.controlSourceId, event }));
  monster.pullTimer = Math.max(0, (monster.pullTimer || 0) - dt);
  if (monster.burnTimer > 0) {
    monster.burnTimer = Math.max(0, monster.burnTimer - dt);
    damageServerMonster(room, monster, (monster.burnDps || 0) * dt, monster.burnSourceId, "burnTick");
  }
}

function spawnServerProjectile(room, monster, target, directionX, directionZ, preparedCast = null) {
  const world = room.world;
  const spec = getServerProjectileSpec(monster.type);
  const projectile = {
    id: world.nextProjectileId,
    sourceType: monster.type,
    x: monster.x + directionX * (monster.radius + 0.4),
    z: monster.z + directionZ * (monster.radius + 0.4),
    y: enemyProjectileCollisionHeight(monster.type),
    rotation: Math.atan2(directionX, directionZ),
    vx: directionX * spec.speed,
    vz: directionZ * spec.speed,
    damage: monster.damage + Math.floor(world.wave * 0.35),
    radius: spec.radius,
    impactRadius: spec.impactRadius,
    lifespan: spec.lifespan,
    age: 0,
    targetId: target.id,
    homing: spec.homing,
  };
  if (preparedCast) Object.assign(projectile, preparedCast);
  world.projectiles.set(projectile.id, projectile);
  world.nextProjectileId += 1;
  return projectile;
}

function updateServerProjectiles(room, playingClients, dt) {
  const world = room.world;
  for (const projectile of [...world.projectiles.values()]) {
    const remaining = Math.max(0, projectile.lifespan - projectile.age);
    if (remaining <= 0) { world.projectiles.delete(projectile.id); continue; }
    const firstStepDt = projectile.firstStepDt;
    delete projectile.firstStepDt;
    const travelDt = Math.min(Math.max(0, firstStepDt ?? dt), remaining);
    if (travelDt <= 0) continue;
    const previous = projectile.previousPosition ??= { x: projectile.x, z: projectile.z };
    previous.x = projectile.x; previous.z = projectile.z;
    if (projectile.homing) {
      const target = playingClients.find(client => client.id === projectile.targetId && client.state.health > 0 && client.state.state === 'playing');
      if (target) {
        const dx = target.state.x - projectile.x, dz = target.state.z - projectile.z;
        const distance = Math.hypot(dx, dz);
        if (distance > .01) {
          const turn = Math.min(1, travelDt * 1.8);
          const speed = getProjectileSpeed(projectile);
          projectile.vx = projectile.vx * (1 - turn) + dx / distance * speed * turn;
          projectile.vz = projectile.vz * (1 - turn) + dz / distance * speed * turn;
        }
      }
    }
    projectile.age += travelDt;
    projectile.x += projectile.vx * travelDt;
    projectile.z += projectile.vz * travelDt;
    const wall = sweepStatic(collisionWorld, { ...previous, y: projectile.y ?? 1.05 }, { ...projectile, y: projectile.y ?? 1.05 }, projectile.radius);
    let firstContact = wall?.t ?? Infinity, hitTarget = null;
    for (const client of playingClients) {
      if (client.state.health <= 0 || client.state.state !== 'playing') continue;
      const contact = segmentCircleContact(previous, projectile, client.state, projectile.radius + .64);
      if (contact < firstContact) { firstContact = contact; hitTarget = client; }
    }
    if (hitTarget) {
      projectile.x = previous.x + (projectile.x - previous.x) * firstContact;
      projectile.z = previous.z + (projectile.z - previous.z) * firstContact;
      damageServerPlayer(room, hitTarget, projectile.damage);
      world.projectiles.delete(projectile.id);
      continue;
    }
    if (wall) { world.projectiles.delete(projectile.id); continue; }
    if (projectile.age >= projectile.lifespan || Math.abs(projectile.x) > serverWorldLimit + 5 || Math.abs(projectile.z) > serverWorldLimit + 5) world.projectiles.delete(projectile.id);
  }
}

function handleServerSkill(room, client, message) {
  const requestId = typeof message.requestId === 'string' ? message.requestId.slice(0, 96) : '';
  let result;
  if (!requestId || message.runId !== client.state.runId) result = { ok: false, reason: 'wrong-run' };
  else if (client.skillReceipts.has(requestId)) result = { ...client.skillReceipts.get(requestId), duplicate: true };
  else {
    result = beginSkill(client.skills, message, {
      ...client.state, playing: client.state.state === 'playing', dead: client.state.health <= 0,
      damageMultiplier: attackStats(client.progression).damageMultiplier,
      // Placed after the state spread so nothing a client reported can shadow server progression.
      areaMultiplier: attackStats(client.progression).areaMultiplier,
    });
    if (result.ok) {
      if (message.slot > 0 && client.state.character === 'warrior') client.skillMovementUntil = Date.now() + result.event.duration * 1000;
      broadcast(room, { type: 'skillEvent', serverTime: Date.now(), id: client.id, runId: client.state.runId, event: result.event });
    }
    result = { ok: result.ok, reason: result.reason, castId: result.castId };
    client.skillReceipts.set(requestId, result);
    while (client.skillReceipts.size > 64) client.skillReceipts.delete(client.skillReceipts.keys().next().value);
  }
  client.state.skills = skillSnapshot(client.skills);
  sendJson(client, { type: 'skillResult', requestId, runId: client.state.runId, result, skills: client.state.skills });
}

function updateServerSkills(room, client, dt) {
  advanceSkills(client.skills, dt, {
    actor: client.state,
    targets: [...room.world.monsters.values()].map(monster => Object.assign(monster, { boss: Boolean(serverMonsterProfiles[monster.type]?.boss) })),
    sweepStatic: (from, to, radius, kind) => sweepStatic(collisionWorld, from, to, radius, { kind }),
    moveCaster(delta) {
      const moved = moveActor(collisionWorld, { id: client.id, x: client.state.x, z: client.state.z, radius: .64 }, delta, { stopOnContact: true });
      client.state.x = moved.x; client.state.z = moved.z; return moved;
    },
    pullTargets(targets, field, step) {
      const bodies = targets.map(t => ({ ...t, inverseMass: 1, pullScale: t.boss ? .35 : 1 }));
      for (const player of getPlayingClients(room)) bodies.push({id: `player:${player.id}`, x:player.state.x,z:player.state.z,radius:.64,inverseMass:0});
      const result = pullActors(collisionWorld, bodies, field, step, { radius: field.radius, speed: 4.5, coreRadius: .55, iterations: 4 });
      const affected = new Set(result.affectedIds);
      for (const body of result.bodies) { const monster = room.world.monsters.get(body.id); if (monster) { monster.x = body.x; monster.z = body.z; if (affected.has(body.id)) monster.pullTimer = step + 1e-4; } }
    },
    hit(monster, effect) {
      if (!room.world.monsters.has(monster.id)) return;
      const resolved = resolveDamage(client.progression, effect.damage);
      applySkillControl(monster, effect); monster.controlSourceId = client.id;
      damageServerMonster(room, monster, resolved.damage, client.id, effect.skillId, effect);
      return !room.world.monsters.has(monster.id);
    },
    emit(event) { broadcast(room, { type: 'skillEvent', serverTime: Date.now(), id: client.id, runId: client.state.runId, event }); },
  });
  client.state.skills = skillSnapshot(client.skills);
  client.skillSyncTimer = (client.skillSyncTimer || 0) - dt;
  if (client.skillSyncTimer <= 0) {
    client.skillSyncTimer = .2;
    sendJson(client, { type: 'skillState', runId: client.state.runId, skills: client.state.skills });
  }
}

function applyServerAttackDamage(room, client, attack) {
  if (client.state.state !== "playing" || client.state.health <= 0) {
    return false;
  }

  if (client.skills.lock > 0) return false;
  const spec = serverCharacterProfiles[normalizeCharacter(client.state.character)];
  const weapon = spec.weapon;
  if (attack.kind !== weapon || attack.weapon !== weapon) return false;
  const now = Date.now();
  const lastAttackAt = client.attackCooldowns.get(weapon) || 0;
  if (now - lastAttackAt < spec.cooldown * attack.cooldownMultiplier) {
    return false;
  }
  client.attackCooldowns.set(weapon, now);

  const direction = normalize2(attack.aimX, attack.aimZ);
  const origin = { x: attack.x, z: attack.z };
  const baseDamage = spec.damage * attack.damageMultiplier;
  const rayCount = weapon === 'pistol' ? 1 + attack.projectileBonus : 1;
  for (let ray=0; ray<rayCount; ray++) {
    const angle = (ray-(rayCount-1)/2)*.12;
    const aim = {x:direction.x*Math.cos(angle)-direction.z*Math.sin(angle), z:direction.x*Math.sin(angle)+direction.z*Math.cos(angle)};
    let hits = getServerAttackHits(room, origin, aim, spec, attack.areaMultiplier);
    // Rifle projectiles have no pierce; each granted projectile uses its own ray.
    if (weapon === 'pistol') hits = hits.sort((a,b) => distanceSq(origin.x,origin.z,a.x,a.z)-distanceSq(origin.x,origin.z,b.x,b.z)).slice(0,1);
    for (const monster of hits) {
      const hit = resolveDamage(client.progression, baseDamage);
      damageServerMonster(room, monster, hit.damage, client.id, spec.effect || weapon);
    }
  }
  return true;
}

function getServerAttackHits(room, origin, direction, spec, areaMultiplier = 1) {
  const hits = [];
  const area = Math.sqrt(Math.max(0.4, areaMultiplier));

  if (spec.shape === "ray") {
    const endpoint = { x: origin.x + direction.x * spec.range, z: origin.z + direction.z * spec.range };
    const wall = sweepStatic(collisionWorld, { ...origin, y: RIFLE_COLLISION_HEIGHT }, { ...endpoint, y: RIFLE_COLLISION_HEIGHT }, spec.radius * area);
    let firstContact = wall?.t ?? Infinity, firstMonster = null;
    for (const monster of room.world.monsters.values()) {
      const contact = segmentCircleContact(origin, endpoint, monster, spec.radius * area + monster.radius);
      if (contact < firstContact) { firstContact = contact; firstMonster = monster; }
    }
    return firstMonster ? [firstMonster] : [];
  }

  for (const monster of room.world.monsters.values()) {
    if (spec.shape === "point") {
      const centerX = origin.x + direction.x * spec.distance;
      const centerZ = origin.z + direction.z * spec.distance;
      const radius = spec.radius * area + monster.radius;
      if (distanceSq(centerX, centerZ, monster.x, monster.z) <= radius * radius) {
        hits.push(monster);
      }
      continue;
    }

    if (spec.shape === "radius") {
      const radius = spec.radius * area + monster.radius;
      if (distanceSq(origin.x, origin.z, monster.x, monster.z) <= radius * radius) {
        hits.push(monster);
      }
      continue;
    }

    const dx = monster.x - origin.x;
    const dz = monster.z - origin.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.001 || distance > spec.range * area + monster.radius) {
      continue;
    }

    const dot = (dx / distance) * direction.x + (dz / distance) * direction.z;
    if (dot >= spec.minDot && !sweepStatic(collisionWorld, { ...origin, y: .9 }, { x: monster.x, z: monster.z, y: .9 }, 0)) {
      hits.push(monster);
    }
  }

  return hits;
}

function damageServerMonster(room, monster, amount, sourceClientId, hitEffect = "pistol", skillEffect = null) {
  if (!monster || amount <= 0 || !room.world.monsters.has(monster.id)) {
    return false;
  }

  monster.health -= amount;
  if (hitEffect === "frostNova") {
    monster.freezeTimer = serverMonsterProfiles[monster.type]?.boss ? 0.85 : 2.2;
  }
  if (hitEffect === "flamethrower") {
    monster.burnTimer = 3;
    monster.burnDps = Math.max(monster.burnDps || 0, amount * 1.15);
    monster.burnSourceId = sourceClientId;
  }

  broadcast(room, {
    type: "monsterHit",
    id: monster.id,
    amount: Number(amount.toFixed(2)),
    health: Math.max(0, Number(monster.health.toFixed(2))),
    hitEffect,
    sourceId: sourceClientId,
  });

  if (monster.health <= 0) {
    killServerMonster(room, monster, sourceClientId, skillEffect);
  }

  room.world.seq += 1;
  return true;
}

function killServerMonster(room, monster, sourceClientId, skillEffect = null) {
  cancelServerCaster(room, monster, 'death');
  if (!room.world.monsters.delete(monster.id)) {
    return;
  }
  room.world.actorIndex?.remove(`monster:${monster.id}`);

  const killer = room.clients.get(sourceClientId);
  broadcast(room, {
    type: "monsterKilled",
    deathStyle: skillEffect?.deathStyle || null, killedBySkillId: skillEffect?.skillId || null, direction: skillEffect?.direction || null,
    monster: serializeMonster(monster),
    sourceId: sourceClientId,
  });

  if (killer) {
    rewardServerKill(room, killer, monster);
  }
}

function rewardServerKill(room, client, monster) {
  const profile = serverMonsterProfiles[monster.type] ?? serverMonsterProfiles.zombie;
  client.state.score = Math.max(0, Math.floor(client.state.score + monster.score));
  client.state.kills = Math.max(0, Math.floor(client.state.kills + 1));
  const progressionEffects = rewardKill(client.state, client.progression, monster, {boss:Boolean(profile.boss)});
  const leaderboardChanged = updatePlayerHistory(client, "playing");
  const reward = {
    type: "playerReward",
    rewardId: `${client.state.runId}:${monster.id}`,
    monster: serializeMonster(monster),
    scoreDelta: monster.score,
    killsDelta: 1,
    xp: monster.xp,
    xpTotal: client.state.xpTotal,
    stateVersion: client.state.stateVersion,
    runId: client.state.runId,
    state: structuredClone(client.state),
    totalScore: client.state.score,
    totalKills: client.state.kills,
    boss: Boolean(profile.boss),
  };
  client.pendingRewards.set(reward.rewardId, reward);
  // Cumulative XP/score persist independently; bound unacknowledged effect events.
  while (client.pendingRewards.size > 256) client.pendingRewards.delete(client.pendingRewards.keys().next().value);
  sendJson(client, reward);
  broadcast(room, { type: "playerState", id: client.id, state: client.state });
  if (leaderboardChanged) {
    broadcastLeaderboard(room);
  }
  for (const effect of progressionEffects) {
    broadcast(room, {type:'progressionEffect', id:client.id, runId:client.state.runId, effect, x:client.state.x, z:client.state.z});
    for (const target of [...room.world.monsters.values()]) {
      if (distanceSq(client.state.x,client.state.z,target.x,target.z) <= effect.radius**2) {
        const hit = resolveDamage(client.progression,effect.damage);
        damageServerMonster(room,target,hit.damage,client.id,'katana');
      }
    }
  }
}

function damageServerPlayer(room, client, amount) {
  const previousState = client.state.state;
  const damage = Math.ceil(clampNumber(amount, 0, 120, 0));
  if (damage <= 0 || client.state.state !== "playing" || client.state.health <= 0) {
    return;
  }

  const resolved = receiveDamage(client.state, client.progression, damage);
  if (client.state.health <= 0) {
    room.world.actorIndex?.remove(`player:${client.id}`);
    cancelSkills(client.skills, event => broadcast(room, { type: 'skillEvent', serverTime: Date.now(), id: client.id, runId: client.state.runId, event }), 'death');
    client.state.skills = skillSnapshot(client.skills);
  }
  const leaderboardChanged = updatePlayerHistory(client, previousState);

  broadcast(room, {
    type: "playerDamaged",
    id: client.id,
    amount: resolved.damage,
    revived: resolved.revived,
    sourceId: "world",
    state: client.state,
  });

  if (leaderboardChanged) {
    broadcastLeaderboard(room);
  }
}

function broadcastWorldState(room) {
  room.world.lastBroadcastAt = Date.now();
  broadcast(room, { type: "worldState", world: getWorldSnapshot(room) });
}

function getWorldSnapshot(room) {
  const world = room.world;
  return {
    epoch: world.epoch,
    seq: world.seq,
    serverTime: Date.now(),
    wave: world.wave,
    zombiesToSpawn: world.zombiesToSpawn,
    monsters: [...world.monsters.values()].map(serializeMonster),
    projectiles: [...world.projectiles.values()].map(serializeProjectile),
    skillStates: [...room.clients.values()].map(client => ({ id: client.id, x: client.state.x, z: client.state.z, skills: skillSnapshot(client.skills) })),
  };
}

function serializeMonster(monster) {
  return {
    id: monster.id,
    type: monster.type,
    eliteType: monster.eliteType,
    x: Number(monster.x.toFixed(3)),
    z: Number(monster.z.toFixed(3)),
    rotation: Number(monster.rotation.toFixed(4)),
    health: Math.max(0, Number(monster.health.toFixed(2))),
    maxHealth: Number(monster.maxHealth.toFixed(2)),
    freezeTimer: monster.freezeTimer || 0, stunTimer: monster.stunTimer || 0, pullTimer: monster.pullTimer || 0,
    controlResistance: serverMonsterProfiles[monster.type]?.boss ? { freezeMax: .8, stunMax: .65, pullMultiplier: .35 } : null,
    skillStatuses: monster.skillStatuses || {},
    casterCast: monster.type === 'caster' && monster.casterCastState ? casterCastSnapshot(monster.casterCastState) : null,
    meleeAttack: monster.meleeAttack ? {
      id: monster.meleeAttack.id, elapsed: Number(monster.meleeAttack.elapsed.toFixed(3)),
      duration: monster.meleeAttack.duration, impactPhase: monster.meleeAttack.impactPhase,
      active: monster.meleeAttack.active,
    } : null,
  };
}

function serializeProjectile(projectile) {
  return {
    id: projectile.id,
    sourceType: projectile.sourceType,
    castId: projectile.castId || null, actorId: projectile.actorId ?? null,
    x: Number(projectile.x.toFixed(3)),
    z: Number(projectile.z.toFixed(3)),
    y: Number(projectile.y.toFixed(3)),
    rotation: Number(projectile.rotation.toFixed(4)),
  };
}

function getServerMonsterTarget(monster, clients) {
  let bestClient = null;
  let bestScore = Infinity;
  for (const client of clients) {
    const score = distanceSq(monster.x, monster.z, client.state.x, client.state.z) * (client.id === monster.bossTargetId ? 0.84 : 1);
    if (score < bestScore) {
      bestScore = score;
      bestClient = client;
    }
  }
  monster.bossTargetId = bestClient?.id ?? null;
  return bestClient;
}

function getServerDifficultyScale(world) {
  const wave = Math.max(1, world.wave);
  const lateWave = Math.max(0, wave - 8);
  const bossPressure = wave >= 20 ? 1.2 : wave >= 10 ? 0.55 : 0;
  return {
    health: 1.08 + wave * 0.12 + Math.pow(lateWave, 1.22) * 0.11 + Math.min(1.35, world.survivalTime / 210) + bossPressure,
    damage: 0.98 + wave * 0.075 + Math.max(0, wave - 10) * 0.075 + Math.min(1, world.survivalTime / 285) + bossPressure * 0.42,
    speed: 1 + Math.min(0.3, wave * 0.008),
  };
}

function getServerMonsterBalanceModifiers(type, profile, world) {
  if (!profile.boss) {
    return { health: 1, damage: 1, speed: 1 };
  }
  if (profile.milestoneBoss) {
    if (type === "angelSheep") return { health: 0.78, damage: 0.62, speed: 0.92 };
    if (type === "bloodCow") return { health: 0.86, damage: 0.74, speed: 0.94 };
    return { health: 0.9, damage: 0.78, speed: 0.96 };
  }
  if (world.wave <= 6) return { health: 0.68, damage: 0.58, speed: 0.9 };
  if (world.wave <= 9) return { health: 0.78, damage: 0.68, speed: 0.94 };
  if (world.wave <= 14) return { health: 0.88, damage: 0.78, speed: 0.97 };
  return { health: 0.98, damage: 0.88, speed: 1 };
}

function rollServerEliteType(world, type) {
  if (world.wave < 6 || serverCowMonsterTypes.has(type) && world.wave < 10) {
    return null;
  }
  const chance = Math.min(0.42, 0.045 + (world.wave - 6) * 0.017 + world.survivalTime * 0.0005);
  if (Math.random() > chance) {
    return null;
  }
  const eliteTypes = Object.keys(serverEliteProfiles);
  return eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
}

function pickServerMonsterType(world) {
  if (world.wave >= 10 && world.wave <= 14) {
    return pickWeighted({ cowWalker: 1.15, cowCharger: Math.min(0.65 + world.wave * 0.03, 1.15), cowBrute: Math.min(0.28 + world.wave * 0.025, 0.7) });
  }

  const weights = { zombie: 1 };
  for (const [type, profile] of Object.entries(serverMonsterProfiles)) {
    if (profile.milestoneBoss || serverCowMonsterTypes.has(type) || world.wave < profile.minWave) {
      continue;
    }
    weights[type] = {
      zombie: 1,
      orcPeon: 0.12,
      runner: Math.min(0.35 + world.wave * 0.08 + world.survivalTime * 0.004, 1.35),
      brute: Math.min(0.2 + world.wave * 0.045 + world.survivalTime * 0.002, 0.85),
      caster: Math.min(0.18 + world.wave * 0.04 + world.survivalTime * 0.002, 0.75),
      visor: Math.min(0.018 + world.survivalTime * 0.00055 + world.wave * 0.0035, 0.085),
      himetrica: Math.min(0.015 + world.survivalTime * 0.0005 + world.wave * 0.003, 0.075),
      dinzo: Math.min(0.017 + world.survivalTime * 0.00055 + world.wave * 0.0032, 0.08),
      gitcity: Math.min(0.011 + world.survivalTime * 0.00042 + world.wave * 0.0026, 0.06),
      sofra: Math.min(0.008 + world.survivalTime * 0.00035 + world.wave * 0.0022, 0.045),
    }[type] ?? 0.02;
  }
  return pickWeighted(weights);
}

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return entries[0]?.[0] ?? "zombie";
}

function getServerSpawnInterval(world) {
  const wavePressure = Math.min(0.66, world.wave * 0.043 + Math.max(0, world.wave - 10) * 0.017);
  const timePressure = Math.min(0.22, world.survivalTime * 0.0045);
  return Math.max(0.05, 0.7 - wavePressure - timePressure);
}

function getServerRangedCooldown(type) {
  if (serverMonsterProfiles[type]?.boss) {
    return type === "plumaFinance" ? 1.25 : type === "gitcity" ? 1.45 : 1.1;
  }
  return 1.65;
}

function getServerProjectileSpec(type) {
  if (type === "plumaFinance") return { speed: 7.5, radius: 0.55, height: 1.05, impactRadius: 2.8, lifespan: 5.2, homing: true };
  if (type === "gitcity") return { speed: 17, radius: 0.28, height: 1.45, impactRadius: 1.8, lifespan: 4, homing: false };
  if (type === "angelSheep") return { speed: 14, radius: 0.3, height: 1.4, impactRadius: 1.5, lifespan: 3.8, homing: false };
  return { speed: serverMonsterProfiles[type]?.boss ? 13 : 11, radius: 0.36, height: 1.05, impactRadius: 2.2, lifespan: 4.2, homing: type === "visor" || type === "plumaFinance" };
}

function getProjectileSpeed(projectile) {
  return Math.max(1, Math.hypot(projectile.vx, projectile.vz));
}

function normalize2(x, z) {
  const length = Math.hypot(Number(x) || 0, Number(z) || 0);
  if (length <= 0.001) {
    return { x: 0, z: -1 };
  }
  return { x: x / length, z: z / length };
}

function distanceSq(firstX, firstZ, secondX, secondZ) {
  const dx = firstX - secondX;
  const dz = firstZ - secondZ;
  return dx * dx + dz * dz;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function createPlayerSnapshot(client) {
  return {
    id: client.id,
    name: client.name,
    character: normalizeCharacter(client.state.character),
    color: ["#74d1ff", "#ffd36d", "#d978ff", "#8ef151"][client.slot] ?? "#f6fbff",
    state: client.state,
  };
}

async function loadLeaderboard() {
  if (leaderboardBackend === "supabase") {
    await loadLeaderboardFromSupabase();
    return;
  }

  try {
    const rawData = await fs.readFile(leaderboardPath, "utf8");
    const data = JSON.parse(rawData);
    leaderboardStore.players = Object.assign(Object.create(null), typeof data.players === "object" && data.players ? data.players : {});
    leaderboardStore.sessions = Array.isArray(data.sessions) ? data.sessions.slice(-historyLimit) : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not load leaderboard: ${error.message}`);
    }
  }
}

async function loadLeaderboardFromSupabase() {
  try {
    const [players, sessions] = await Promise.all([
      supabaseRequest(
        "/leaderboard_players?select=*&order=total_score.desc,best_score.desc,best_level.desc,best_wave.desc,games_played.desc",
      ),
      supabaseRequest(`/leaderboard_sessions?select=*&order=ended_at.desc&limit=${historyLimit}`),
    ]);

    leaderboardStore.players = Object.fromEntries(
      players.map((row) => [row.player_key, mapLeaderboardPlayerFromRow(row)]),
    );
    leaderboardStore.sessions = sessions.reverse().map(mapLeaderboardSessionFromRow);
    hydrateLeaderboardKillsFromSessions();
  } catch (error) {
    console.warn(`Could not load Supabase leaderboard: ${error.message}`);
  }
}

function hydrateLeaderboardKillsFromSessions() {
  const statsByPlayer = new Map();

  for (const session of leaderboardStore.sessions) {
    const key = getPlayerRecordKey(session.name);
    const stats = statsByPlayer.get(key) || { totalKills: 0, bestKills: 0, lastKills: 0, lastEndedAt: "" };
    stats.totalKills += Math.max(0, Math.floor(Number(session.kills) || 0));
    stats.bestKills = Math.max(stats.bestKills, Math.max(0, Math.floor(Number(session.kills) || 0)));
    if (!stats.lastEndedAt || String(session.endedAt || "") > stats.lastEndedAt) {
      stats.lastEndedAt = String(session.endedAt || "");
      stats.lastKills = Math.max(0, Math.floor(Number(session.kills) || 0));
    }
    statsByPlayer.set(key, stats);
  }

  for (const [key, stats] of statsByPlayer.entries()) {
    const record = leaderboardStore.players[key];
    if (!record) {
      continue;
    }

    record.totalKills = Math.max(record.totalKills || 0, stats.totalKills);
    record.bestKills = Math.max(record.bestKills || 0, stats.bestKills);
    record.lastKills = Math.max(record.lastKills || 0, stats.lastKills);
  }
}

function recordPlayerSeen(client, force = false) {
  const record = getOrCreatePlayerRecord(client.name);
  const nowMs = Date.now();

  if (!force && client.lastHistorySeenAt && nowMs - client.lastHistorySeenAt < 10_000) {
    return record;
  }

  const now = new Date().toISOString();

  record.name = client.name;
  record.lastSeenAt = now;
  client.lastHistorySeenAt = nowMs;
  markLeaderboardChanged();
  return record;
}

function updatePlayerHistory(client, previousState) {
  const state = client.state;
  const shouldTrackPlayer = state.state === "playing" || previousState === "playing";

  if (!shouldTrackPlayer) {
    return false;
  }

  const record = recordPlayerSeen(client);
  let changed = false;

  if (state.state === "playing" && previousState !== "playing") {
    client.sessionStartedAt = Date.now();
    client.sessionBestScore = state.score;
    client.sessionBestKills = state.kills;
    client.sessionBestWave = state.wave;
    client.sessionBestLevel = state.level;
    client.sessionBestBuild = normalizeBuildSummary(state.build);
    record.gamesPlayed += 1;
    changed = true;
  }

  if (state.state === "playing") {
    client.sessionBestScore = Math.max(client.sessionBestScore, state.score);
    client.sessionBestKills = Math.max(client.sessionBestKills, state.kills);
    client.sessionBestWave = Math.max(client.sessionBestWave, state.wave);
    if (state.level >= client.sessionBestLevel) {
      client.sessionBestLevel = state.level;
      client.sessionBestBuild = normalizeBuildSummary(state.build);
    }
  }

  if (state.score > record.bestScore) {
    record.bestScore = state.score;
    changed = true;
  }

  if (state.kills > (record.bestKills || 0)) {
    record.bestKills = state.kills;
    changed = true;
  }

  if (state.wave > record.bestWave) {
    record.bestWave = state.wave;
    changed = true;
  }

  if (state.bestLevel > record.bestLevel || state.level > record.bestLevel) {
    record.bestLevel = Math.max(state.bestLevel, state.level);
    record.bestBuild = normalizeBuildSummary(state.build);
    changed = true;
  }

  if (
    record.lastScore !== state.score ||
    record.lastKills !== state.kills ||
    record.lastWave !== state.wave ||
    record.lastLevel !== state.level
  ) {
    record.lastScore = state.score;
    record.lastKills = state.kills;
    record.lastWave = state.wave;
    record.lastLevel = state.level;
    record.lastBuild = normalizeBuildSummary(state.build);
    changed = true;
  }

  if (previousState === "playing" && state.state !== "playing") {
    finishPlayerSession(client);
    changed = true;
  }

  if (changed) {
    markLeaderboardChanged();
  }

  return changed;
}

function finishPlayerSession(client) {
  if (!client.sessionStartedAt) {
    return false;
  }

  const record = getOrCreatePlayerRecord(client.name);
  const endedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.now() - client.sessionStartedAt);
  const score = Math.max(client.sessionBestScore, client.state.score);
  const kills = Math.max(client.sessionBestKills, client.state.kills || 0);
  const wave = Math.max(client.sessionBestWave, client.state.wave);
  const level = Math.max(client.sessionBestLevel, client.state.level);
  const build =
    client.sessionBestLevel >= client.state.level
      ? normalizeBuildSummary(client.sessionBestBuild)
      : normalizeBuildSummary(client.state.build);

  record.totalScore += score;
  record.totalKills += kills;
  record.totalPlayMs += durationMs;
  record.lastScore = score;
  record.lastKills = kills;
  record.lastWave = wave;
  record.lastLevel = level;
  record.lastBuild = build;
  record.lastSeenAt = endedAt;
  record.bestScore = Math.max(record.bestScore, score);
  record.bestKills = Math.max(record.bestKills || 0, kills);
  record.bestWave = Math.max(record.bestWave, wave);
  if (level >= record.bestLevel) {
    record.bestLevel = level;
    record.bestBuild = build;
  }

  leaderboardStore.sessions.push({
    id: crypto.randomUUID(),
    name: client.name,
    score,
    kills,
    wave,
    level,
    build,
    durationMs,
    endedAt,
  });

  leaderboardStore.sessions = leaderboardStore.sessions.slice(-historyLimit);
  client.sessionStartedAt = null;
  client.sessionBestScore = 0;
  client.sessionBestKills = 0;
  client.sessionBestWave = 1;
  client.sessionBestLevel = 1;
  client.sessionBestBuild = [];
  markLeaderboardChanged();
  return true;
}







function getOrCreatePlayerRecord(name) {
  const safeName = sanitizePlayerName(name);
  const key = getPlayerRecordKey(safeName);

  if (!Object.hasOwn(leaderboardStore.players, key)) {
    const now = new Date().toISOString();
    leaderboardStore.players[key] = {
      name: safeName,
      bestScore: 0,
      bestKills: 0,
      bestWave: 1,
      bestLevel: 1,
      bestBuild: [],
      gamesPlayed: 0,
      totalScore: 0,
      totalKills: 0,
      totalPlayMs: 0,
      lastScore: 0,
      lastKills: 0,
      lastWave: 1,
      lastLevel: 1,
      lastBuild: [],
      firstSeenAt: now,
      lastSeenAt: now,
    };
  }

  const record = leaderboardStore.players[key];
  record.bestKills = Math.max(0, Math.floor(Number(record.bestKills) || 0));
  record.totalKills = Math.max(0, Math.floor(Number(record.totalKills) || 0));
  record.lastKills = Math.max(0, Math.floor(Number(record.lastKills) || 0));
  record.bestLevel = Math.max(1, Math.floor(Number(record.bestLevel) || 1));
  record.bestBuild = normalizeBuildSummary(record.bestBuild);
  record.lastLevel = Math.max(1, Math.floor(Number(record.lastLevel) || 1));
  record.lastBuild = normalizeBuildSummary(record.lastBuild);
  return record;
}



function writeCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getPlayerRecordKey(name) {
  return sanitizePlayerName(name).toLowerCase();
}

function getLeaderboardSnapshot() {

  const visibleRecords = Object.values(leaderboardStore.players).filter(isLeaderboardRecordVisible);
  const players = visibleRecords
    .sort(
      (first, second) =>
        second.totalScore - first.totalScore ||
        second.bestScore - first.bestScore ||
        (Number(second.bestLevel) || 1) - (Number(first.bestLevel) || 1) ||
        second.bestWave - first.bestWave ||
        second.gamesPlayed - first.gamesPlayed,
    )
    .slice(0, leaderboardLimit)
    .map((record, index) => ({
      rank: index + 1,
      name: record.name,
      bestScore: record.bestScore,
      bestKills: Math.max(0, Math.floor(Number(record.bestKills) || 0)),
      bestWave: record.bestWave,
      bestLevel: Math.max(1, Math.floor(Number(record.bestLevel) || 1)),
      bestBuild: normalizeBuildSummary(record.bestBuild),
      gamesPlayed: record.gamesPlayed,
      totalScore: record.totalScore,
      totalKills: Math.max(0, Math.floor(Number(record.totalKills) || 0)),
      lastScore: record.lastScore,
      lastKills: Math.max(0, Math.floor(Number(record.lastKills) || 0)),
      lastWave: record.lastWave,
      lastLevel: Math.max(1, Math.floor(Number(record.lastLevel) || 1)),
      lastBuild: normalizeBuildSummary(record.lastBuild),
      totalPlayMs: record.totalPlayMs,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
    }));

  const recentSessions = leaderboardStore.sessions
    .slice(-10)
    .reverse()
    .map((session) => ({
      name: session.name,
      score: session.score,
      kills: Math.max(0, Math.floor(Number(session.kills) || 0)),
      wave: session.wave,
      level: Math.max(1, Math.floor(Number(session.level) || 1)),
      build: normalizeBuildSummary(session.build),
      durationMs: session.durationMs,
      endedAt: session.endedAt,
    }));
  const now = Date.now();
  const activeRuns = [...rooms.values()].flatMap(room => [...room.clients.values()])
    .filter(client => client.connected && client.state.state === "playing" && client.state.health > 0)
    .map(client => ({
      name: client.name, score: client.state.score, kills: client.state.kills,
      wave: client.state.wave, level: client.state.level, bestLevel: client.state.bestLevel,
      build: client.state.build, durationMs: client.sessionStartedAt ? now - client.sessionStartedAt : 0,
      updatedAt: client.lastSeen || now,
    }));
  const livePlayers = activeRuns
    .sort(
      (first, second) =>
        second.score - first.score ||
        second.kills - first.kills ||
        second.level - first.level ||
        second.wave - first.wave ||
        first.updatedAt - second.updatedAt,
    )
    .slice(0, liveLeaderboardLimit)
    .map((run, index) => ({
      rank: index + 1,
      name: run.name,
      score: run.score,
      kills: Math.max(0, Math.floor(Number(run.kills) || 0)),
      wave: run.wave,
      level: Math.max(1, Math.floor(Number(run.level) || 1)),
      bestLevel: Math.max(1, Math.floor(Number(run.bestLevel) || 1)),
      build: normalizeBuildSummary(run.build),
      durationMs: Math.max(0, Math.floor(Number(run.durationMs) || 0)),
      updatedAt: new Date(run.updatedAt).toISOString(),
    }));

  return {
    generatedAt: new Date().toISOString(),
    scope: "rooms",
    totalPlayers: visibleRecords.length,
    players,
    recentSessions,
    livePlayers,
  };
}

function isLeaderboardRecordVisible(record) {
  return (
    Math.max(0, Math.floor(Number(record.gamesPlayed) || 0)) > 0 ||
    Math.max(0, Math.floor(Number(record.totalPlayMs) || 0)) > 0
  );
}

async function refreshLeaderboardForRead() {

  if (leaderboardBackend !== "supabase") {
    return;
  }

  if (saveLeaderboardTimer) {
    await flushLeaderboardSave();
  }

  await loadLeaderboardFromSupabase();
}

async function flushLeaderboardSave() {
  if (saveLeaderboardTimer) {
    clearTimeout(saveLeaderboardTimer);
    saveLeaderboardTimer = null;
  }

  await saveLeaderboard();
}

function broadcastLeaderboard(room) {
  broadcast(room, {
    type: "leaderboard",
    leaderboard: getLeaderboardSnapshot(),
  });
}

function markLeaderboardChanged() {
  if (saveLeaderboardTimer) {
    clearTimeout(saveLeaderboardTimer);
  }

  saveLeaderboardTimer = setTimeout(() => {
    saveLeaderboardTimer = null;
    void saveLeaderboard();
  }, 750);
  saveLeaderboardTimer.unref?.();
}

async function saveLeaderboard() {
  if (leaderboardBackend === "supabase") {
    await saveLeaderboardToSupabase();
    return;
  }

  try {
    await fs.mkdir(path.dirname(leaderboardPath), { recursive: true });
    await fs.writeFile(
      leaderboardPath,
      JSON.stringify(
        {
          players: leaderboardStore.players,
          sessions: leaderboardStore.sessions.slice(-historyLimit),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.warn(`Could not save leaderboard: ${error.message}`);
  }
}

async function saveLeaderboardToSupabase() {
  try {
    const playerRows = Object.entries(leaderboardStore.players).map(([playerKey, record]) =>
      mapLeaderboardPlayerToRow(playerKey, record),
    );
    const sessionRows = leaderboardStore.sessions.slice(-historyLimit).map(mapLeaderboardSessionToRow);

    if (playerRows.length > 0) {
      await supabaseRequest("/leaderboard_players?on_conflict=player_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(playerRows),
      });
    }

    if (sessionRows.length > 0) {
      await supabaseRequest("/leaderboard_sessions?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(sessionRows),
      });
    }
  } catch (error) {
    console.warn(`Could not save Supabase leaderboard: ${error.message}`);
  }
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeSupabaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

async function loadLocalEnv() {
  try {
    const envPath = path.join(root, ".env");
    const envFile = await fs.readFile(envPath, "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) {
        continue;
      }

      process.env[match[1]] = unquoteEnvValue(match[2]);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not load .env: ${error.message}`);
    }
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function mapLeaderboardPlayerFromRow(row) {
  const bestBuildData = decodeStoredBuild(row.best_build);
  const lastBuildData = decodeStoredBuild(row.last_build);
  const totalKills = Math.max(
    0,
    Math.floor(Number(row.total_kills) || 0),
    Math.floor(Number(lastBuildData.metadata.totalKills) || 0),
  );
  const lastKills = Math.max(
    0,
    Math.floor(Number(row.last_kills) || 0),
    Math.floor(Number(lastBuildData.metadata.kills) || 0),
  );
  const bestKills = Math.max(
    0,
    Math.floor(Number(row.best_kills) || 0),
    Math.floor(Number(bestBuildData.metadata.kills) || 0),
    totalKills,
    lastKills,
  );

  return {
    name: sanitizePlayerName(row.name),
    bestScore: Math.max(0, Math.floor(Number(row.best_score) || 0)),
    bestKills,
    bestWave: Math.max(1, Math.floor(Number(row.best_wave) || 1)),
    bestLevel: Math.max(1, Math.floor(Number(row.best_level) || 1)),
    bestBuild: bestBuildData.build,
    gamesPlayed: Math.max(0, Math.floor(Number(row.games_played) || 0)),
    totalScore: Math.max(0, Math.floor(Number(row.total_score) || 0)),
    totalKills,
    totalPlayMs: Math.max(0, Math.floor(Number(row.total_play_ms) || 0)),
    lastScore: Math.max(0, Math.floor(Number(row.last_score) || 0)),
    lastKills,
    lastWave: Math.max(1, Math.floor(Number(row.last_wave) || 1)),
    lastLevel: Math.max(1, Math.floor(Number(row.last_level) || 1)),
    lastBuild: lastBuildData.build,
    firstSeenAt: row.first_seen_at || new Date().toISOString(),
    lastSeenAt: row.last_seen_at || new Date().toISOString(),
  };
}

function mapLeaderboardPlayerToRow(playerKey, record) {
  return {
    player_key: playerKey,
    name: sanitizePlayerName(record.name),
    best_score: Math.max(0, Math.floor(Number(record.bestScore) || 0)),
    best_wave: Math.max(1, Math.floor(Number(record.bestWave) || 1)),
    best_level: Math.max(1, Math.floor(Number(record.bestLevel) || 1)),
    best_build: encodeBuildForStorage(record.bestBuild, { kills: record.bestKills }),
    games_played: Math.max(0, Math.floor(Number(record.gamesPlayed) || 0)),
    total_score: Math.max(0, Math.floor(Number(record.totalScore) || 0)),
    total_play_ms: Math.max(0, Math.floor(Number(record.totalPlayMs) || 0)),
    last_score: Math.max(0, Math.floor(Number(record.lastScore) || 0)),
    last_wave: Math.max(1, Math.floor(Number(record.lastWave) || 1)),
    last_level: Math.max(1, Math.floor(Number(record.lastLevel) || 1)),
    last_build: encodeBuildForStorage(record.lastBuild, { kills: record.lastKills, totalKills: record.totalKills }),
    first_seen_at: record.firstSeenAt || new Date().toISOString(),
    last_seen_at: record.lastSeenAt || new Date().toISOString(),
  };
}

function mapLeaderboardSessionFromRow(row) {
  const buildData = decodeStoredBuild(row.build);
  return {
    id: row.id,
    name: sanitizePlayerName(row.name),
    score: Math.max(0, Math.floor(Number(row.score) || 0)),
    kills: Math.max(0, Math.floor(Number(row.kills) || 0), Math.floor(Number(buildData.metadata.kills) || 0)),
    wave: Math.max(1, Math.floor(Number(row.wave) || 1)),
    level: Math.max(1, Math.floor(Number(row.level) || 1)),
    build: buildData.build,
    durationMs: Math.max(0, Math.floor(Number(row.duration_ms) || 0)),
    endedAt: row.ended_at || new Date().toISOString(),
  };
}

function mapLeaderboardSessionToRow(session) {
  session.id ||= crypto.randomUUID();

  return {
    id: session.id,
    player_key: getPlayerRecordKey(session.name),
    name: sanitizePlayerName(session.name),
    score: Math.max(0, Math.floor(Number(session.score) || 0)),
    wave: Math.max(1, Math.floor(Number(session.wave) || 1)),
    level: Math.max(1, Math.floor(Number(session.level) || 1)),
    build: encodeBuildForStorage(session.build, { kills: session.kills }),
    duration_ms: Math.max(0, Math.floor(Number(session.durationMs) || 0)),
    ended_at: session.endedAt || new Date().toISOString(),
  };
}

function broadcast(room, message, exceptId) {
  for (const client of room.clients.values()) {
    if (client.id !== exceptId) {
      sendJson(client, message);
    }
  }
}

function sendJson(client, message) {
  if (!client.connected || !client.socket) return;
  sendFrame(client.socket, 0x1, Buffer.from(JSON.stringify(message)));
}

function sendFrame(socket, opcode, payload = Buffer.alloc(0)) {
  if (!socket || socket.destroyed || socket.writableEnded) {
    return;
  }

  const payloadLength = payload.length;
  let header;

  if (payloadLength < 126) {
    header = Buffer.from([0x80 | opcode, payloadLength]);
  } else if (payloadLength <= 65_535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  socket.write(Buffer.concat([header, payload]));
}

function removeClient(client, socket = client.socket) {
  const room = rooms.get(client.roomId);
  if (!room || room.clients.get(client.id) !== client || client.socket !== socket || !client.connected) return;
  client.connected = false; client.disconnectedAt = Date.now(); client.socket = null;
  client.state.skills = skillSnapshot(client.skills); client.skillMovementUntil = 0;
  client.state.shooting = false;
  broadcast(room, { type: "playerLeft", id: client.id, resumable: true, resumeGraceMs: reconnectGraceMs }, client.id);
  broadcastLeaderboard(room);
}

function expireDisconnectedClients(room) {
  const now = Date.now();
  for (const client of [...room.clients.values()]) {
    if (!client.connected && now - client.disconnectedAt >= reconnectGraceMs) expireClient(client);
  }
}

function expireClient(client) {
  const room = rooms.get(client.roomId);
  if (!room || room.clients.get(client.id) !== client) return;
  cancelSkills(client.skills, event => broadcast(room, { type: 'skillEvent', serverTime: Date.now(), id: client.id, runId: client.state.runId, event }), 'expired');
  client.state.skills = skillSnapshot(client.skills);
  room.clients.delete(client.id);
  resumableClients.delete(client.resumeToken);
  finishPlayerSession(client);
  broadcastLeaderboard(room);
  if (room.clients.size === 0) rooms.delete(client.roomId);
}

function closeSocket(socket) {
  if (!socket.destroyed) {
    socket.end();
  }
}

setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    for (const client of room.clients.values()) {
      if (!client.connected) continue;
      if (now - client.lastSeen > 45_000) {
        closeSocket(client.socket);
      } else {
        sendFrame(client.socket, 0x9);
      }
    }
  }
}, 15_000).unref();

setInterval(updateRoomWorlds, serverWorldTickMs).unref();
