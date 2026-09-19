import http from 'node:http';

export function createFakeSupabase({ host = '127.0.0.1' } = {}) {
  let mode = 'down';
  let delayMs = 0;
  const posts = [];
  const gets = { players: 0, sessions: 0 };
  const db = { players: [], sessions: [] };

  function send(response, status, body, contentType = 'application/json; charset=utf-8') {
    response.writeHead(status, { 'Content-Type': contentType });
    if (body === undefined) return response.end();
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
  }

  function wait() {
    return delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  }

  function malformedBody() {
    if (mode === 'malformed-null') return 'null';
    if (mode === 'malformed-object') return '{}';
    return null;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${host}`);
    const path = url.pathname;
    if (request.method === 'GET' && path === '/rest/v1/leaderboard_players') {
      gets.players += 1;
      await wait();
      if (mode === 'down') return send(response, 503, { message: 'fetch failed' });
      const bad = malformedBody();
      if (bad !== null) return send(response, 200, bad);
      return send(response, 200, db.players);
    }
    if (request.method === 'GET' && path === '/rest/v1/leaderboard_sessions') {
      gets.sessions += 1;
      await wait();
      if (mode === 'down') return send(response, 503, { message: 'fetch failed' });
      const bad = malformedBody();
      if (bad !== null) return send(response, 200, bad);
      return send(response, 200, db.sessions);
    }
    if (request.method === 'POST' && path === '/rest/v1/leaderboard_players') {
      const raw = await readBody(request);
      const rows = JSON.parse(raw || '[]');
      posts.push({ table: 'players', at: Date.now(), rows });
      if (mode === 'down') return send(response, 503, { message: 'fetch failed' });
      for (const row of rows) {
        const index = db.players.findIndex((item) => item.player_key === row.player_key);
        if (index >= 0) db.players[index] = { ...db.players[index], ...row };
        else db.players.push(row);
      }
      response.writeHead(201, { 'Content-Type': 'application/json', Prefer: 'return=minimal' });
      return response.end();
    }
    if (request.method === 'POST' && path === '/rest/v1/leaderboard_sessions') {
      const raw = await readBody(request);
      const rows = JSON.parse(raw || '[]');
      posts.push({ table: 'sessions', at: Date.now(), rows });
      if (mode === 'down') return send(response, 503, { message: 'fetch failed' });
      for (const row of rows) {
        const index = db.sessions.findIndex((item) => item.id === row.id);
        if (index >= 0) db.sessions[index] = { ...db.sessions[index], ...row };
        else db.sessions.push(row);
      }
      response.writeHead(201);
      return response.end();
    }
    send(response, 404, { error: 'not_found' });
  });

  return {
    posts,
    gets,
    db,
    down() { mode = 'down'; delayMs = 0; },
    malformed(kind) {
      mode = kind === 'null' ? 'malformed-null' : 'malformed-object';
      delayMs = 0;
    },
    setDelay(ms) { delayMs = Math.max(0, Number(ms) || 0); },
    restore(rows) {
      db.players = structuredClone(rows.players || []);
      db.sessions = structuredClone(rows.sessions || []);
      mode = 'up';
    },
    listen() {
      return new Promise((resolve) => {
        server.listen(0, host, () => {
          const port = server.address().port;
          resolve({
            port,
            origin: `http://${host}:${port}`,
            close: () => new Promise((done) => server.close(done)),
          });
        });
      });
    },
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export const SYNTHETIC_HISTORY = {
  players: [
    {
      player_key: 'guarda',
      name: 'GuardA',
      best_score: 400,
      best_wave: 3,
      best_level: 6,
      best_build: ['+Dano x2'],
      games_played: 5,
      total_score: 900,
      total_play_ms: 120000,
      last_score: 400,
      last_wave: 3,
      last_level: 6,
      last_build: ['+Dano x2'],
      first_seen_at: '2026-09-01T00:00:00.000Z',
      last_seen_at: '2026-09-01T00:10:00.000Z',
    },
  ],
  sessions: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'GuardA',
      score: 400,
      kills: 20,
      wave: 3,
      level: 6,
      build: ['+Dano x2'],
      duration_ms: 40000,
      ended_at: '2026-09-01T00:10:00.000Z',
    },
  ],
};
