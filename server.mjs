import fs from "node:fs/promises";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? "0.0.0.0";
const maxPlayersPerRoom = 4;
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const rooms = new Map();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
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
    roomId,
    slot,
    socket,
    buffer: Buffer.alloc(0),
    lastSeen: Date.now(),
    state: {
      x: getSpawnPoint(slot).x,
      z: getSpawnPoint(slot).z,
      rotation: 0,
      aimX: 0,
      aimZ: -1,
      health: 100,
      score: 0,
      wave: 1,
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
    client.state = normalizePlayerState(message.state, client.state);
    broadcast(room, {
      type: "playerState",
      id: client.id,
      state: client.state,
    }, client.id);
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
  return {
    x: clampNumber(state?.x, -65, 65, fallback.x),
    z: clampNumber(state?.z, -65, 65, fallback.z),
    rotation: clampNumber(state?.rotation, -Math.PI * 2, Math.PI * 2, fallback.rotation),
    aimX: clampNumber(state?.aimX, -1, 1, fallback.aimX),
    aimZ: clampNumber(state?.aimZ, -1, 1, fallback.aimZ),
    health: clampNumber(state?.health, 0, 100, fallback.health),
    score: Math.max(0, Math.floor(clampNumber(state?.score, 0, 999_999, fallback.score))),
    wave: Math.max(1, Math.floor(clampNumber(state?.wave, 1, 999, fallback.wave))),
    weapon: typeof state?.weapon === "string" ? state.weapon.slice(0, 24) : fallback.weapon,
    shooting: Boolean(state?.shooting),
    state: state?.state === "playing" || state?.state === "dead" ? state.state : "menu",
  };
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
    name: `P${client.slot + 1}`,
    color: ["#74d1ff", "#ffd36d", "#d978ff", "#8ef151"][client.slot] ?? "#f6fbff",
    state: client.state,
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
  broadcast(room, { type: "playerLeft", id: client.id }, client.id);

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
