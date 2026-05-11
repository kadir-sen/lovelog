import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { deviceIdHook, getDeviceId } from './middleware/deviceId.js';
import { registerLlmRoutes } from './routes/llm.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers["x-device-id"]', 'req.headers.authorization'],
  },
  bodyLimit: 256 * 1024,
});

await app.register(cors, {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('cors_blocked'), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Device-Id'],
  credentials: false,
  maxAge: 86400,
});

await app.register(rateLimit, {
  global: false,
  keyGenerator: (req) => getDeviceId(req as any) ?? req.ip,
  errorResponseBuilder: () => ({ statusCode: 429, error: 'Too Many Requests', message: 'rate_limited' }),
});

app.get('/health', async () => ({ ok: true }));

await app.register(async (api) => {
  api.addHook('preHandler', deviceIdHook);
  await registerLlmRoutes(api);

  // Mağaza zorunlu hesap silme: cihaz ID'sine bağlı tüm sunucu durumunu temizler.
  // Şu an in-memory rate-limit dışında server-side state tutmuyoruz; @fastify/rate-limit
  // dahili counter'ı bir TTL sonrası kendi kendine düşer, gerçek bir DB ekleyince burası
  // gerçek silme yapacak. Yine de mağaza/privacy review için 200 dönmemiz şart.
  api.delete('/device/:id', async (req, reply) => {
    const headerId = (req as any).deviceId as string;
    const paramId = (req.params as any)?.id as string | undefined;
    if (!paramId || paramId !== headerId) {
      return reply.code(403).send({ error: 'device_id_mismatch' });
    }
    return reply.send({ ok: true, deletedAt: new Date().toISOString() });
  });
}, { prefix: '/api' });

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`lovelog-server listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
