import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, handle, normalizeBody, DomainError } from '../public/mock/engine.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function createDemoServer({
  dataFile = resolve(root, '.demo-data/state.json'),
  staticRoot = resolve(root, 'dist/FrontEnd-AIToDu/browser'),
} = {}) {
  let state;
  try {
    state = JSON.parse(await readFile(dataFile, 'utf8'));
    if (![1, 2].includes(state.version)) throw new Error('Unsupported persisted demo version');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    state = await seed();
  }
  let queue = Promise.resolve();
  const persist = async (value) => {
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile + '.tmp', JSON.stringify(value, null, 2));
    await rename(dataFile + '.tmp', dataFile);
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/v1/')) {
      let payload = '';
      try {
        for await (const chunk of req) {
          payload += chunk;
          if (payload.length > 100000) {
            res.writeHead(413);
            res.end();
            return;
          }
        }
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const task = async () => {
        try {
          const path = url.pathname.slice('/api/v1'.length);
          const body = await normalizeBody(payload ? JSON.parse(payload) : {}, path);
          const result = handle(
            state,
            req.method,
            path,
            body,
            String(req.headers.authorization ?? '').replace(/^Bearer /, ''),
          );
          if (result.status < 400) {
            await persist(result.state);
            state = result.state;
          }
          res.writeHead(result.status, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-AI-ToDu-Transport': 'node-http-demo',
          });
          res.end(result.status === 204 ? undefined : JSON.stringify(result.body));
        } catch (e) {
          const status = e instanceof DomainError ? e.status : e instanceof SyntaxError ? 400 : 503;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              code:
                e instanceof DomainError
                  ? e.code
                  : status === 400
                    ? 'INVALID_JSON'
                    : 'STORAGE_UNAVAILABLE',
            }),
          );
        }
      };
      queue = queue.then(task, task);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const target = resolve(staticRoot, '.' + decodeURIComponent(url.pathname));
      if (target !== staticRoot && !target.startsWith(staticRoot + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let file = target;
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      const mime = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
      };
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const portIndex = process.argv.indexOf('--port');
  const port = portIndex < 0 ? 8850 : Number(process.argv[portIndex + 1]);
  const server = await createDemoServer();
  server.listen(port, '127.0.0.1', () =>
    console.log(`AI-ToDu demo HTTP: http://127.0.0.1:${port}/?api=http#/login`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
