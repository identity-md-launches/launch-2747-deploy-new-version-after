import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const i = process.argv.indexOf('--port');
const port = i < 0 ? 4173 : Number(process.argv[i + 1]);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.txt':'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') { res.writeHead(302, { Location: './preview/' }); res.end(); return; }
    if (!pathname.startsWith('/preview/')) { res.writeHead(404); res.end('Not found'); return; }
    const file = resolve(root, pathname.slice('/preview/'.length) || 'index.html');
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(content);
  } catch { res.writeHead(404, { 'Content-Type':'text/plain' }); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Static preview: http://localhost:${server.address().port}/preview/`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
