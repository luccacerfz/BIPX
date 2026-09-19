// Personal solo records. These values never claim server verification.
const STORAGE_KEY = 'bipx-solo-records-v1';
const count = (value, min = 0, max = 999999999) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));
const cleanName = value => String(value || 'Caçador').trim().replace(/\s+/g, ' ').replace(/[<>]/g, '').slice(0, 16) || 'Caçador';
const cleanBuild = value => Array.isArray(value) ? value.slice(0, 8).map(item => String(item).replace(/[<>]/g, '').slice(0, 40)) : [];
const keyFor = name => cleanName(name).toLocaleLowerCase('pt-BR');

export function createLocalLeaderboard(storage, { now = () => Date.now() } = {}) {
  let saved = null, persistence = Boolean(storage);
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'); }
  catch { persistence = false; }
  const valid = saved?.schema === 1;
  const players = new Map();
  for (const entry of valid && Array.isArray(saved.players) ? saved.players.slice(0, 500) : []) {
    if (!entry || typeof entry !== 'object') continue;
    const name = cleanName(entry.name);
    players.set(keyFor(name), {
      name, gamesPlayed: count(entry.gamesPlayed), totalScore: count(entry.totalScore), totalKills: count(entry.totalKills),
      totalPlayMs: count(entry.totalPlayMs, 0, Number.MAX_SAFE_INTEGER),
      bestScore: count(entry.bestScore), bestKills: count(entry.bestKills), bestWave: count(entry.bestWave, 1, 999), bestLevel: count(entry.bestLevel, 1, 999), bestBuild: cleanBuild(entry.bestBuild),
      lastScore: count(entry.lastScore), lastKills: count(entry.lastKills), lastWave: count(entry.lastWave, 1, 999), lastLevel: count(entry.lastLevel, 1, 999), lastBuild: cleanBuild(entry.lastBuild),
      firstSeenAt: typeof entry.firstSeenAt === 'string' ? entry.firstSeenAt.slice(0, 32) : null,
      lastSeenAt: typeof entry.lastSeenAt === 'string' ? entry.lastSeenAt.slice(0, 32) : null,
    });
  }
  const processed = new Set(valid && Array.isArray(saved.processed) ? saved.processed.filter(id => typeof id === 'string' && id.length <= 96).slice(-512) : []);
  let sessions = valid && Array.isArray(saved.sessions) ? saved.sessions.filter(entry => entry && typeof entry === 'object').slice(-120).map(entry => ({ id: String(entry.id || '').slice(0, 96), name: cleanName(entry.name), score: count(entry.score), kills: count(entry.kills), wave: count(entry.wave, 1, 999), level: count(entry.level, 1, 999), build: cleanBuild(entry.build), durationMs: count(entry.durationMs, 0, 86400000), endedAt: typeof entry.endedAt === 'string' ? entry.endedAt.slice(0, 32) : null })) : [];
  const clone = value => JSON.parse(JSON.stringify(value));
  function persist() {
    try {
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(STORAGE_KEY, JSON.stringify({ schema: 1, players: [...players.values()], processed: [...processed], sessions }));
      persistence = true;
    } catch { persistence = false; }
  }
  function snapshot() {
    const ranked = [...players.values()].sort((a, b) => b.bestScore - a.bestScore || b.totalScore - a.totalScore || b.bestLevel - a.bestLevel || a.name.localeCompare(b.name, 'pt-BR'));
    return { scope: 'device', persistence, generatedAt: new Date(now()).toISOString(), totalPlayers: ranked.length, players: clone(ranked.slice(0, 10).map((record, i) => ({ rank: i + 1, ...record }))), livePlayers: [], recentSessions: clone(sessions.slice(-10).reverse()) };
  }
  function record(run) {
    const id = String(run?.runId || '').slice(0, 96);
    if (!id || processed.has(id)) return { recorded: false, snapshot: snapshot() };
    const name = cleanName(run.name), key = keyFor(name), endedAt = new Date(now()).toISOString();
    const session = { id, name, score: count(run.score), kills: count(run.kills), wave: count(run.wave, 1, 999), level: count(run.bestLevel ?? run.level, 1, 999), build: cleanBuild(run.build), durationMs: count(run.durationMs, 0, 86400000), endedAt };
    const player = players.get(key) || { name, gamesPlayed: 0, totalScore: 0, totalKills: 0, totalPlayMs: 0, bestScore: 0, bestKills: 0, bestWave: 1, bestLevel: 1, bestBuild: [], firstSeenAt: endedAt };
    player.name = name;
    player.gamesPlayed += 1; player.totalScore += session.score; player.totalKills += session.kills; player.totalPlayMs += session.durationMs;
    player.bestScore = Math.max(player.bestScore, session.score); player.bestKills = Math.max(player.bestKills, session.kills); player.bestWave = Math.max(player.bestWave, session.wave);
    if (session.level >= player.bestLevel) { player.bestLevel = session.level; player.bestBuild = session.build; }
    Object.assign(player, { lastScore: session.score, lastKills: session.kills, lastWave: session.wave, lastLevel: session.level, lastBuild: session.build, lastSeenAt: endedAt });
    players.set(key, player);
    while (players.size > 500) players.delete(players.keys().next().value);
    processed.add(id);
    while (processed.size > 512) processed.delete(processed.values().next().value);
    sessions.push(session); sessions = sessions.slice(-120);
    persist();
    return { recorded: true, snapshot: snapshot() };
  }
  return { record, snapshot };
}
