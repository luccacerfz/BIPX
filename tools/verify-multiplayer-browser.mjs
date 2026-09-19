import fs from "node:fs";
import path from "node:path";
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, evidenceDir } from "./quality-browser.mjs";

const base = new URL(process.argv[2] || "http://127.0.0.1:5173/");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) throw new Error("Browser multiplayer verification requires isolated localhost");
base.searchParams.set("ws", `ws://${base.host}/ws`);
base.searchParams.set("room", `qa-browser-${Date.now()}`);
base.searchParams.set("autoplay", "1");
base.searchParams.delete("offline");
const browser = await chromium.launch(browserLaunchOptions);
const clients = [];
const report = { ok: false, room: base.searchParams.get("room"), evidenceKind: "two_real_browser_contexts", syntheticFixture: false, coverageLimit: "Actual input, shared world, peer replication, disconnect and fresh late rejoin. Does not establish packet-loss tolerance, resumed identity after transient disconnect, simultaneous death/wipe or competitive security." };
try {
  const first = await join("first", "warrior");
  const second = await join("second", "dwarf");
  await first.page.waitForFunction(() => window.__zombieNightDebug.getState().multiplayer.remotePlayers === 1);
  await second.page.waitForFunction(() => window.__zombieNightDebug.getState().multiplayer.remotePlayers === 1);
  const initial = await first.page.evaluate(() => window.__zombieNightDebug.getState());
  await first.page.bringToFront();
  await first.page.keyboard.down("w");
  await first.page.mouse.move(920, 400);
  await first.page.mouse.down();
  await first.page.waitForTimeout(450);
  await first.page.keyboard.up("w");
  await first.page.mouse.up();
  const moved = await first.page.evaluate(() => window.__zombieNightDebug.getState());
  assert(moved.player.z < initial.player.z - 0.1, "First real browser did not move from keyboard input");
  await second.page.waitForTimeout(500);
  const replicated = second.received.filter((message) => message.type === "playerState" && message.id === initial.multiplayer.id).at(-1);
  assert(replicated && Math.abs(replicated.state.z - moved.player.z) < 0.2, "Second browser did not receive actual movement position");
  assert(first.sent.some((message) => message.type === "attack"), "Real mouse firing did not produce an authoritative attack message");
  assert(moved.character === "warrior" && moved.weapon === "katana" && moved.bullets === 0, "Warrior browser produced a projectile or changed its fixed weapon");
  assert(first.sent.filter(message => message.type === "attack").every(message => message.attack.kind === "katana"), "Warrior sent a non-melee attack");
  assert(second.received.some(message => message.type === "playerAttack" && message.id === initial.multiplayer.id && message.attack.kind === "katana"), "Peer did not receive the authoritative warrior impact");
  assert(replicated.state.character === "warrior" && replicated.state.weapon === "katana", "Peer movement state lost class selection");
  await second.page.bringToFront();
  await second.page.mouse.move(920, 400);
  await second.page.mouse.down();
  await second.page.waitForTimeout(450);
  await second.page.mouse.up();
  const rifle = await second.page.evaluate(() => window.__zombieNightDebug.getState());
  assert(rifle.character === "dwarf" && rifle.weapon === "pistol", "Second browser did not keep the rifle role");
  assert(second.sent.some(message => message.type === "attack" && message.attack.kind === "pistol"), "Rifle pointer input did not send an attack");
  await first.page.waitForTimeout(200);
  assert(first.received.some(message => message.type === "playerAttack" && message.id === rifle.multiplayer.id && message.attack.kind === "pistol"), "Peer did not receive the authoritative rifle shot");
  report.classReplication = { warrior: { character: moved.character, weapon: moved.weapon, bullets: moved.bullets }, rifle: { character: rifle.character, weapon: rifle.weapon, bullets: rifle.bullets }, bothPeerAttacksObserved: true };
  // seq increments on spawn/damage, not every motion update. serverTime identifies
  // a broadcast; comparing seq alone can pair two different moving snapshots.
  const matched = first.received.filter((message) => message.type === "worldState" && message.world.monsters.length > 0).findLast((message) => second.received.some((other) => other.type === "worldState" && other.world.seq === message.world.seq && other.world.serverTime === message.world.serverTime));
  assert(matched, "Browsers did not observe a common populated server-world sequence");
  const counterpart = second.received.find((message) => message.type === "worldState" && message.world.seq === matched.world.seq && message.world.serverTime === matched.world.serverTime);
  assert(JSON.stringify(matched.world.monsters) === JSON.stringify(counterpart.world.monsters), "Same authoritative tick has different monster layer in browsers");
  report.sharedWorld = { seq: matched.world.seq, serverTime: matched.world.serverTime, monsterCount: matched.world.monsters.length, identical: true };
  report.input = { before: initial.player, after: moved.player, replicatedPosition: { x: replicated.state.x, z: replicated.state.z }, attackMessages: first.sent.filter((message) => message.type === "attack").length };
  await first.telemetry.capture("shared-world");
  await second.telemetry.capture("shared-world");
  first.telemetry.assertClean();
  await first.telemetry.save();
  await first.context.close();
  first.closed = true;
  await second.page.waitForFunction(() => window.__zombieNightDebug.getState().multiplayer.remotePlayers === 0);
  const third = await join("late-rejoin", "warrior");
  await third.page.waitForFunction(() => window.__zombieNightDebug.getState().serverWorld.active && window.__zombieNightDebug.getState().multiplayer.remotePlayers === 1);
  await second.page.waitForFunction(() => window.__zombieNightDebug.getState().multiplayer.remotePlayers === 1);
  report.lateRejoin = await third.page.evaluate(() => window.__zombieNightDebug.getState());
  assert(report.lateRejoin.multiplayer.id !== initial.multiplayer.id, "Fresh reconnect unexpectedly reused disconnected socket identity");
  assert(report.lateRejoin.serverWorld.monsters.length > 0, "Late rejoin did not hydrate populated authoritative world");
  assert(report.lateRejoin.character === "warrior" && report.lateRejoin.weapon === "katana", "Fresh rejoin did not restore selected warrior role");
  await third.telemetry.capture("late-rejoin");
  for (const client of clients) client.telemetry.assertClean();
  report.ok = true;
} catch (error) {
  report.failure = error.stack || error.message;
  for (const client of clients) client.telemetry.fail(error);
  process.exitCode = 1;
} finally {
  for (const client of clients) {
    if (!client.closed) { await client.telemetry.save(); await client.context.close(); }
  }
  fs.writeFileSync(path.join(evidenceDir, "browser-multiplayer.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ ...report, evidenceDir }, null, 2));
}

async function join(name, character) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(character => localStorage.setItem("bipx-character", character), character);
  const page = await context.newPage();
  const telemetry = attachQualityTelemetry(page, name);
  const client = { name, context, page, telemetry, received: [], sent: [], closed: false };
  clients.push(client);
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => record(client.received, payload));
    socket.on("framesent", ({ payload }) => record(client.sent, payload));
  });
  await page.goto(base.toString(), { waitUntil: "networkidle" });
  await waitForRuntimeAssets(page, telemetry);
  await page.waitForFunction(() => window.__zombieNightDebug?.getState().multiplayer.connected && window.__zombieNightDebug.getState().serverWorld.active);
  const welcome = client.received.find(message => message.type === "welcome");
  const own = welcome?.players.find(player => player.id === welcome.id);
  assert(own?.character === character && own?.state.character === character, `${name}: server welcome did not include requested class`);
  return client;
}
function record(messages, payload) { try { messages.push(JSON.parse(payload.toString())); if (messages.length > 300) messages.shift(); } catch {} }
function assert(condition, message) { if (!condition) throw new Error(message); }
