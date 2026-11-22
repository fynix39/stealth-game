// A tiny static server for game/ (Node 22, standard library only), so the entry can
// be played locally without a build step: `node serve.ts` serves game/ on
// http://localhost:8080. It sends the MIME types a browser game needs and refuses any
// path outside game/. A development convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = normalize(url.pathname).replace(/^\.\.(\/|\\)/, '');
  const file = resolve(join(root, pathname === '/' ? 'index.html' : pathname));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Silent Steps on http://localhost:${port}`);
});
