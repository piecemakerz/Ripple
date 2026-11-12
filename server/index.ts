import express from 'express';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from './app.js';
import { RippleStore } from './store.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const dbPath = resolve(
  process.env.RIPPLE_DB_PATH ||
    join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Ripple', 'demo-v1'),
);
const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer from 1 to 65535');
const store = new RippleStore(dbPath);
store.seed();
const app = createApp(store);
let vite: Awaited<ReturnType<(typeof import('vite'))['createServer']>> | undefined;
if (process.argv.includes('--production')) {
  if (!existsSync('dist/index.html')) throw new Error('Run npm run build before npm start');
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Ripple ready: http://127.0.0.1:${port}`);
  console.log(`Relate 1.0.1 database: ${dbPath}`);
});
server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
  void vite?.close();
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close();
  await vite?.close();
  store.checkpoint();
  // Relate 1.0.1 Node binding has no public close(). Process exit releases its native handles.
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
