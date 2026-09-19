import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

// CPU-only audio fixtures use their own loopback port, independent of the user game.
export async function createAudioTestServer() {
  const root = process.cwd();
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') {
        response.setHeader('content-type', 'text/html');
        response.end('<!doctype html><html><head><base href="/"></head><body><button id="unlock">Unlock audio</button></body></html>');
        return;
      }
      if (!/^\/(src\/audio|assets\/audio)\/[\w/.-]+$/.test(pathname) && pathname !== '/src/combat/class-skills.mjs') { response.writeHead(404).end(); return; }
      const filename = path.resolve(root, `.${pathname}`);
      if (!filename.startsWith(`${root}/`) || pathname.split('/').includes('..')) { response.writeHead(403).end(); return; }
      response.setHeader('content-type', /\.m?js$/.test(filename) ? 'text/javascript' : filename.endsWith('.json') ? 'application/json' : 'audio/mpeg');
      response.end(await fs.readFile(filename));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
