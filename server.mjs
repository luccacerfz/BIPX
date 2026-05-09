import fs from "node:fs/promises";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const leaderboardBackend = supabaseUrl && supabaseServiceRoleKey ? "supabase" : "file";
const rooms = new Map();
const leaderboardStore = {
  players: {},
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
};

await loadLeaderboard();

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

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

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(getLeaderboardSnapshot()));
    return;
  }

  if (pathname === "/api/leaderboard/session") {
    writeCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST" });
      response.end("Method not allowed");
      return;
    }

    try {
      const session = await readJsonBody(request);
      const leaderboard = recordSoloLeaderboardSession(session);
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(leaderboard));
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.normalize(path.join(root, requestedFile));

  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(file);
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
  console.log(`http://${host}:${port}`);
  console.log(`Multiplayer WebSocket: ws://${host}:${port}/ws?room=cemiterio`);
});

function joinMultiplayerRoom(requestUrl, socket) {
  const roomId = sanitizeRoomId(requestUrl.searchParams.get("room"));
  const room = getRoom(roomId);

  if (room.clients.size >= maxPlayersPerRoom) {
    sendFrame(socket, 0x1, Buffer.from(JSON.stringify({ type: "roomFull", maxPlayers: maxPlayersPerRoom })));
    setTimeout(() => socket.end(), 120);
    return;
  }

  const slot = getFreeSlot(room);
  const client = {
    id: crypto.randomUUID(),
    name: sanitizePlayerName(requestUrl.searchParams.get("name"), slot),
    roomId,
    slot,
    socket,
    buffer: Buffer.alloc(0),
    lastSeen: Date.now(),
    sessionBestScore: 0,
    sessionBestKills: 0,
    sessionBestWave: 1,
    sessionBestLevel: 1,
    sessionBestBuild: [],
    sessionStartedAt: null,
    state: {
      x: getSpawnPoint(slot).x,
      z: getSpawnPoint(slot).z,
      rotation: 0,
      aimX: 0,
      aimZ: -1,
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
    },
  };

  room.clients.set(client.id, client);

  sendJson(client, {
    type: "welcome",
    id: client.id,
    room: roomId,
    maxPlayers: maxPlayersPerRoom,
    spawn: getSpawnPoint(slot),
    players: [...room.clients.values()].map(createPlayerSnapshot),
    leaderboard: getLeaderboardSnapshot(),
  });

  broadcast(room, {
    type: "playerJoined",
    player: createPlayerSnapshot(client),
  }, client.id);

  socket.on("data", (chunk) => handleSocketData(client, chunk));
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, clients: new Map() });
  }

  return rooms.get(roomId);
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

function getSpawnPoint(slot) {
  return [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: -4, z: 0 },
    { x: 0, z: 4 },
  ][slot] ?? { x: 0, z: 0 };
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

  const room = rooms.get(client.roomId);
  if (!room) {
    return;
  }

  if (message.type === "state") {
    const previousState = client.state.state;
    client.state = normalizePlayerState(message.state, client.state);
    const leaderboardChanged = updatePlayerHistory(client, previousState);
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

  if (message.type === "damagePlayer") {
    damagePlayer(room, client, message);
    return;
  }

  if (message.type === "attack") {
    broadcast(room, {
      type: "playerAttack",
      id: client.id,
      attack: normalizeAttack(message.attack, client.state),
    }, client.id);
  }
}

function normalizePlayerState(state, fallback) {
  const maxHealth = clampNumber(state?.maxHealth, 1, playerNetworkMaxHealthCap, fallback.maxHealth ?? playerBaseMaxHealth);
  const fallbackHealth = Number.isFinite(Number(fallback.health)) ? Math.min(Number(fallback.health), maxHealth) : maxHealth;
  const level = Math.max(1, Math.floor(clampNumber(state?.level, 1, 999, fallback.level ?? 1)));
  const bestLevel = Math.max(level, Math.floor(clampNumber(state?.bestLevel, 1, 999, fallback.bestLevel ?? 1)));

  return {
    x: clampNumber(state?.x, -65, 65, fallback.x),
    z: clampNumber(state?.z, -65, 65, fallback.z),
    rotation: clampNumber(state?.rotation, -Math.PI * 2, Math.PI * 2, fallback.rotation),
    aimX: clampNumber(state?.aimX, -1, 1, fallback.aimX),
    aimZ: clampNumber(state?.aimZ, -1, 1, fallback.aimZ),
    health: clampNumber(state?.health, 0, maxHealth, fallbackHealth),
    maxHealth,
    score: Math.max(0, Math.floor(clampNumber(state?.score, 0, 999_999, fallback.score))),
    kills: Math.max(0, Math.floor(clampNumber(state?.kills, 0, 999_999, fallback.kills ?? 0))),
    wave: Math.max(1, Math.floor(clampNumber(state?.wave, 1, 999, fallback.wave))),
    level,
    bestLevel,
    build: normalizeBuildSummary(state?.build ?? fallback.build),
    weapon: typeof state?.weapon === "string" ? state.weapon.slice(0, 24) : fallback.weapon,
    shooting: Boolean(state?.shooting),
    state: state?.state === "playing" || state?.state === "dead" ? state.state : "menu",
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

function normalizeAttack(attack, fallbackState) {
  return {
    kind: typeof attack?.kind === "string" ? attack.kind.slice(0, 24) : "pistol",
    weapon: typeof attack?.weapon === "string" ? attack.weapon.slice(0, 24) : fallbackState.weapon,
    x: clampNumber(attack?.x, -65, 65, fallbackState.x),
    z: clampNumber(attack?.z, -65, 65, fallbackState.z),
    aimX: clampNumber(attack?.aimX, -1, 1, fallbackState.aimX),
    aimZ: clampNumber(attack?.aimZ, -1, 1, fallbackState.aimZ),
  };
}

function damagePlayer(room, sourceClient, message) {
  const target = room.clients.get(String(message.targetId || ""));

  if (!target || target.id === sourceClient.id) {
    return;
  }

  const amount = Math.ceil(clampNumber(message.amount, 0, 40, 0));

  if (amount <= 0 || target.state.state !== "playing" || target.state.health <= 0) {
    return;
  }

  target.state = {
    ...target.state,
    health: Math.max(0, target.state.health - amount),
  };

  if (target.state.health <= 0) {
    target.state.state = "dead";
  }

  updatePlayerHistory(target, target.state.state === "dead" ? "playing" : target.state.state);

  broadcast(room, {
    type: "playerDamaged",
    id: target.id,
    amount,
    sourceId: sourceClient.id,
    state: target.state,
  });

  broadcastLeaderboard(room);
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
    leaderboardStore.players = typeof data.players === "object" && data.players ? data.players : {};
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
  } catch (error) {
    console.warn(`Could not load Supabase leaderboard: ${error.message}`);
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
  const shouldTrackPlayer =
    state.state === "playing" || previousState === "playing" || state.score > 0 || state.wave > 1 || state.level > 1;

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

function recordSoloLeaderboardSession(data) {
  const name = sanitizePlayerName(data?.name);
  const record = getOrCreatePlayerRecord(name);
  const endedAt = new Date().toISOString();
  const score = Math.max(0, Math.floor(clampNumber(data?.score, 0, 999_999, 0)));
  const kills = Math.max(0, Math.floor(clampNumber(data?.kills, 0, 999_999, 0)));
  const wave = Math.max(1, Math.floor(clampNumber(data?.wave, 1, 999, 1)));
  const level = Math.max(1, Math.floor(clampNumber(data?.level ?? data?.bestLevel, 1, 999, 1)));
  const build = normalizeBuildSummary(data?.build);
  const durationMs = Math.max(0, Math.floor(clampNumber(data?.durationMs, 0, 86_400_000, 0)));

  record.name = name;
  record.gamesPlayed += 1;
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
    name,
    score,
    kills,
    wave,
    level,
    build,
    durationMs,
    endedAt,
  });
  leaderboardStore.sessions = leaderboardStore.sessions.slice(-historyLimit);
  markLeaderboardChanged();
  return getLeaderboardSnapshot();
}

function getOrCreatePlayerRecord(name) {
  const safeName = sanitizePlayerName(name);
  const key = getPlayerRecordKey(safeName);

  if (!leaderboardStore.players[key]) {
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

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) {
      throw new Error("Payload too large");
    }
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new Error("Invalid JSON");
  }
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
  const players = Object.values(leaderboardStore.players)
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

  return {
    generatedAt: new Date().toISOString(),
    totalPlayers: Object.keys(leaderboardStore.players).length,
    players,
    recentSessions,
  };
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
  return {
    name: sanitizePlayerName(row.name),
    bestScore: Math.max(0, Math.floor(Number(row.best_score) || 0)),
    bestKills: Math.max(0, Math.floor(Number(row.best_kills) || 0)),
    bestWave: Math.max(1, Math.floor(Number(row.best_wave) || 1)),
    bestLevel: Math.max(1, Math.floor(Number(row.best_level) || 1)),
    bestBuild: normalizeBuildSummary(row.best_build),
    gamesPlayed: Math.max(0, Math.floor(Number(row.games_played) || 0)),
    totalScore: Math.max(0, Math.floor(Number(row.total_score) || 0)),
    totalKills: Math.max(0, Math.floor(Number(row.total_kills) || 0)),
    totalPlayMs: Math.max(0, Math.floor(Number(row.total_play_ms) || 0)),
    lastScore: Math.max(0, Math.floor(Number(row.last_score) || 0)),
    lastKills: Math.max(0, Math.floor(Number(row.last_kills) || 0)),
    lastWave: Math.max(1, Math.floor(Number(row.last_wave) || 1)),
    lastLevel: Math.max(1, Math.floor(Number(row.last_level) || 1)),
    lastBuild: normalizeBuildSummary(row.last_build),
    firstSeenAt: row.first_seen_at || new Date().toISOString(),
    lastSeenAt: row.last_seen_at || new Date().toISOString(),
  };
}

function mapLeaderboardPlayerToRow(playerKey, record) {
  return {
    player_key: playerKey,
    name: sanitizePlayerName(record.name),
    best_score: Math.max(0, Math.floor(Number(record.bestScore) || 0)),
    best_kills: Math.max(0, Math.floor(Number(record.bestKills) || 0)),
    best_wave: Math.max(1, Math.floor(Number(record.bestWave) || 1)),
    best_level: Math.max(1, Math.floor(Number(record.bestLevel) || 1)),
    best_build: normalizeBuildSummary(record.bestBuild),
    games_played: Math.max(0, Math.floor(Number(record.gamesPlayed) || 0)),
    total_score: Math.max(0, Math.floor(Number(record.totalScore) || 0)),
    total_kills: Math.max(0, Math.floor(Number(record.totalKills) || 0)),
    total_play_ms: Math.max(0, Math.floor(Number(record.totalPlayMs) || 0)),
    last_score: Math.max(0, Math.floor(Number(record.lastScore) || 0)),
    last_kills: Math.max(0, Math.floor(Number(record.lastKills) || 0)),
    last_wave: Math.max(1, Math.floor(Number(record.lastWave) || 1)),
    last_level: Math.max(1, Math.floor(Number(record.lastLevel) || 1)),
    last_build: normalizeBuildSummary(record.lastBuild),
    first_seen_at: record.firstSeenAt || new Date().toISOString(),
    last_seen_at: record.lastSeenAt || new Date().toISOString(),
  };
}

function mapLeaderboardSessionFromRow(row) {
  return {
    id: row.id,
    name: sanitizePlayerName(row.name),
    score: Math.max(0, Math.floor(Number(row.score) || 0)),
    kills: Math.max(0, Math.floor(Number(row.kills) || 0)),
    wave: Math.max(1, Math.floor(Number(row.wave) || 1)),
    level: Math.max(1, Math.floor(Number(row.level) || 1)),
    build: normalizeBuildSummary(row.build),
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
    kills: Math.max(0, Math.floor(Number(session.kills) || 0)),
    wave: Math.max(1, Math.floor(Number(session.wave) || 1)),
    level: Math.max(1, Math.floor(Number(session.level) || 1)),
    build: normalizeBuildSummary(session.build),
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
  sendFrame(client.socket, 0x1, Buffer.from(JSON.stringify(message)));
}

function sendFrame(socket, opcode, payload = Buffer.alloc(0)) {
  if (socket.destroyed) {
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

function removeClient(client) {
  const room = rooms.get(client.roomId);

  if (!room || !room.clients.has(client.id)) {
    return;
  }

  room.clients.delete(client.id);
  finishPlayerSession(client);
  broadcast(room, { type: "playerLeft", id: client.id }, client.id);
  broadcastLeaderboard(room);

  if (room.clients.size === 0) {
    rooms.delete(client.roomId);
  }
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
      if (now - client.lastSeen > 45_000) {
        closeSocket(client.socket);
      } else {
        sendFrame(client.socket, 0x9);
      }
    }
  }
}, 15_000).unref();
