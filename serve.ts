// Minimal static file server for local play: serves this directory's
// game/ at http://localhost:8080. Standard library only, no dependencies.
//   node serve.ts [port]
// The game itself makes no network requests; this only serves its files.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = parseInt(process.argv[2] || '8080', 10) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = normalize(join(here, decodeURIComponent(url.pathname)));
    if (!path.startsWith(here)) { res.writeHead(403); res.end(); return; }
    if (path.endsWith('/')) path = join(path, 'game', 'index.html');
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log('Solport at http://localhost:' + port + '/game/index.html');
});
