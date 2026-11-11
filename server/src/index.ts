import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { migrate } from './db/index.js';
import { authRoutes } from './auth.js';
import { gameRoutes } from './routes.js';
import { pizoteRoutes } from './pizoteRoutes.js';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST ?? join(here, '../../web/dist');

export async function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });
  await app.register(cookie);
  gameRoutes(app);
  authRoutes(app);
  pizoteRoutes(app);
  app.get('/api/health', async () => ({ ok: true }));

  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    // SPA: cualquier ruta que no sea /api devuelve index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No encontrado' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await migrate();
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
}
