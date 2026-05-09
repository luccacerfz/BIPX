const wsUrl = process.argv[2] ?? "ws://127.0.0.1:5173/ws?room=authoritative-smoke";

const first = await connectClient(`${wsUrl}&name=SmokeA`);
const second = await connectClient(`${wsUrl}&name=SmokeB`);

sendPlayingState(first, 0, 0);
sendPlayingState(second, 4, 0);

const firstWorld = await waitForWorld(first, (world) => world.monsters.length > 0);
const secondWorld = await waitForWorld(second, (world) => world.monsters.length > 0 && sameIds(world.monsters, firstWorld.monsters));

const target = firstWorld.monsters[0];
first.socket.send(JSON.stringify({
  type: "attack",
  attack: {
    kind: "axe",
    weapon: "axe",
    x: target.x,
    z: target.z,
    aimX: 1,
    aimZ: 0,
    damageMultiplier: 8,
    areaMultiplier: 2,
  },
}));

const killed = await Promise.race([
  waitForMessage(first, "monsterKilled"),
  waitForWorld(first, (world) => !world.monsters.some((monster) => monster.id === target.id)).then(() => ({ type: "worldState" })),
]);

const third = await connectClient(`${wsUrl}&name=SmokeC`);
sendPlayingState(third, -4, 0);
const lateWorld = third.welcome.world?.monsters?.length
  ? third.welcome.world
  : await waitForWorld(third, (world) => world.monsters.length > 0);
const latestFirstWorld = first.latestWorld ?? lateWorld;

assert(firstWorld.monsters.length > 0, "first client did not receive monsters");
assert(secondWorld.monsters.length > 0, "second client did not receive monsters");
assert(sameIds(firstWorld.monsters, secondWorld.monsters), "clients did not receive the same monster IDs");
assert(killed.type === "monsterKilled" || killed.type === "worldState", "attack did not affect the authoritative world");
assert(Array.isArray(lateWorld.monsters), "late join did not receive world state");
assert(lateWorld.monsters.every((monster) => latestFirstWorld.monsters.some((known) => known.id === monster.id)), "late join received a different monster layer");

first.socket.close();
second.socket.close();
third.socket.close();

console.log(JSON.stringify({
  ok: true,
  initialMonsterIds: firstWorld.monsters.map((monster) => monster.id).slice(0, 8),
  lateJoinMonsters: lateWorld.monsters.length,
}));

function connectClient(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const client = { socket, welcome: null, latestWorld: null, messages: [] };
    const timeout = setTimeout(() => reject(new Error(`timeout connecting to ${url}`)), 5000);

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      client.messages.push(message);
      if (message.type === "worldState") {
        client.latestWorld = message.world;
      }
      if (message.type === "welcome") {
        client.welcome = message;
        if (message.world) {
          client.latestWorld = message.world;
        }
        clearTimeout(timeout);
        resolve(client);
      }
    });
    socket.addEventListener("error", () => reject(new Error(`websocket error for ${url}`)));
  });
}

function waitForWorld(client, predicate, timeoutMs = 8000) {
  if (client.latestWorld && predicate(client.latestWorld)) {
    return Promise.resolve(client.latestWorld);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.socket.removeEventListener("message", onMessage);
      reject(new Error("timeout waiting for worldState"));
    }, timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.type !== "worldState") {
        return;
      }
      client.latestWorld = message.world;
      if (predicate(message.world)) {
        clearTimeout(timeout);
        client.socket.removeEventListener("message", onMessage);
        resolve(message.world);
      }
    }
    client.socket.addEventListener("message", onMessage);
  });
}

function waitForMessage(client, type, timeoutMs = 5000) {
  const existing = client.messages.find((message) => message.type === type);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.socket.removeEventListener("message", onMessage);
      reject(new Error(`timeout waiting for ${type}`));
    }, timeoutMs);
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.type === type) {
        clearTimeout(timeout);
        client.socket.removeEventListener("message", onMessage);
        resolve(message);
      }
    }
    client.socket.addEventListener("message", onMessage);
  });
}

function sendPlayingState(client, x, z) {
  client.socket.send(JSON.stringify({
    type: "state",
    state: {
      x,
      z,
      rotation: 0,
      aimX: 1,
      aimZ: 0,
      health: 200,
      maxHealth: 200,
      score: 0,
      kills: 0,
      wave: 1,
      level: 1,
      bestLevel: 1,
      build: [],
      weapon: "pistol",
      shooting: false,
      state: "playing",
    },
  }));
}

function sameIds(firstMonsters, secondMonsters) {
  const firstIds = firstMonsters.map((monster) => monster.id).sort((a, b) => a - b);
  const secondIds = secondMonsters.map((monster) => monster.id).sort((a, b) => a - b);
  return firstIds.length === secondIds.length && firstIds.every((id, index) => id === secondIds[index]);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
