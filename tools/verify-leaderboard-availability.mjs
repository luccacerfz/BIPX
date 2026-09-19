import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

// Exercise the shipped client functions across HTTP and WebSocket recovery.
const source = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function definition(name) {
  const declarations = [...source.matchAll(/^(?:async )?function (\w+)\(/gm)];
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, `Missing production function ${name}`);
  return source.slice(declarations[index].index, declarations[index + 1]?.index ?? source.length);
}
let response;
let networkError = false;
let fetchCount = 0;
let rendered;
const count = { textContent: '' };
const scope = { textContent: '' };
const context = vm.createContext({
  multiplayer: { enabled: true, leaderboard: {} },
  menuLeaderboardCountElement: count,
  menuLeaderboardListElement: {},
  document: { querySelector: () => scope },
  getLeaderboardApiUrl: route => `https://example.invalid${route}`,
  updateOnlineScoreboardHud() {},
  renderMenuLeaderboard: (leaders, status) => { rendered = { leaders, status }; },
  soloLeaderboard: { snapshot: () => ({ scope: 'device', players: [], totalPlayers: 0 }) },
  fetch: async () => {
    fetchCount++;
    if (networkError) throw new Error('Simulated network outage');
    return response;
  },
});
vm.runInContext(['updateLeaderboard', 'updateLeaderboardHud', 'loadLeaderboardSnapshot'].map(definition).join('\n'), context);
const checks = [];

// A cold failure must not appear as an authoritative empty leaderboard.
response = { ok: false, status: 503 };
await context.loadLeaderboardSnapshot({ clearBeforeFetch: true });
assert.equal(context.multiplayer.leaderboard.status, 'error');
assert.equal(rendered.status, 'error');
assert.equal(count.textContent, 'indisponível');
checks.push('Cold HTTP 503 reports unavailable');

// A welcome/update from WebSocket must retain the same availability contract.
context.updateLeaderboard({ available: false, players: [], totalPlayers: 0 });
assert.equal(rendered.status, 'error');
assert.equal(count.textContent, 'indisponível');
checks.push('Unavailable WebSocket snapshot cannot reset status to ready');

const historical = { name: 'Existing player', totalScore: 1732 };
context.updateLeaderboard({ players: [historical], totalPlayers: 1 });
await context.loadLeaderboardSnapshot();
assert.equal(context.multiplayer.leaderboard.players[0].totalScore, 1732);
assert.equal(rendered.status, 'error');
assert.equal(count.textContent, 'indisponível');
checks.push('Refresh HTTP 503 preserves cached records and marks them unavailable');

networkError = true;
await context.loadLeaderboardSnapshot();
assert.equal(context.multiplayer.leaderboard.players[0].totalScore, 1732);
assert.equal(rendered.status, 'error');
checks.push('Network failure preserves cached records');

networkError = false;
response = { ok: true, json: async () => ({ available: true, players: [historical], totalPlayers: 1 }) };
await context.loadLeaderboardSnapshot();
assert.equal(rendered.status, 'ready');
assert.equal(count.textContent, '1 jogadores');
assert.equal(context.multiplayer.leaderboard.players[0].totalScore, 1732);
checks.push('Successful recovery restores ready state and historical records');

context.multiplayer.enabled = false;
const beforeSolo = fetchCount;
await context.loadLeaderboardSnapshot();
assert.equal(fetchCount, beforeSolo);
assert.equal(context.multiplayer.leaderboard.status, 'ready');
assert.equal(context.multiplayer.leaderboard.scope, 'device');
checks.push('Solo records remain local and available');

console.log(JSON.stringify({
  passed: true,
  scope: 'Synthetic CPU transitions through source-extracted production client functions; not browser or gameplay proof.',
  sourceMainSha256: crypto.createHash('sha256').update(source).digest('hex'),
  checks,
}, null, 2));
