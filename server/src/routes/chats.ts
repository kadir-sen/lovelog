// /api/chats — kullanıcı sohbet (raw .txt) saklama endpoint'leri.
// Erişim modeli: device-id isolation. Her cihaz kendi sohbetlerini görür.
// Auth yok (link-paylaşımı modeli). Rate limit + size guard.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createChat,
  listChats,
  getChat,
  deleteChat,
  deleteAllForDevice,
  countChats,
  STORAGE_LIMITS,
} from '../lib/storage.js';
import { getDeviceId } from '../middleware/deviceId.js';

const uploadBody = z
  .object({
    name: z.string().min(1).max(STORAGE_LIMITS.maxNameLength),
    raw: z.string().min(1).max(STORAGE_LIMITS.maxRawBytesPerChat),
  })
  .strict();

export const registerChatsRoutes = async (api: FastifyInstance) => {
  // POST /api/chats — yeni chat yükle
  api.post('/chats', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const deviceId = getDeviceId(req);
    const parsed = uploadBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { name, raw } = parsed.data;

    const existing = countChats(deviceId);
    if (existing >= STORAGE_LIMITS.maxChatsPerDevice) {
      return reply.code(409).send({
        error: 'quota_exceeded',
        message: `Bu cihazda en fazla ${STORAGE_LIMITS.maxChatsPerDevice} sohbet saklanabilir. Eski birini silmeniz gerekir.`,
        current: existing,
        max: STORAGE_LIMITS.maxChatsPerDevice,
      });
    }

    const summary = createChat(deviceId, name, raw);
    return reply.code(201).send(summary);
  });

  // GET /api/chats — bu cihazın kayıtlı sohbet listesi
  api.get('/chats', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const deviceId = getDeviceId(req);
    const chats = listChats(deviceId);
    return { chats, max: STORAGE_LIMITS.maxChatsPerDevice };
  });

  // GET /api/chats/:id — tek sohbetin raw içeriği
  api.get<{ Params: { id: string } }>('/chats/:id', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const deviceId = getDeviceId(req);
    const row = getChat(deviceId, req.params.id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return {
      id: row.id,
      name: row.name,
      uploadedAt: row.uploadedAt,
      sizeBytes: row.sizeBytes,
      raw: row.raw,
    };
  });

  // DELETE /api/chats/:id — tek sohbet sil
  api.delete<{ Params: { id: string } }>('/chats/:id', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const deviceId = getDeviceId(req);
    const ok = deleteChat(deviceId, req.params.id);
    if (!ok) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });

  // DELETE /api/chats — bu cihazın TÜM sohbetlerini sil
  // ("Hesap silme" akışı device delete + buna çağırır)
  api.delete('/chats', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req) => {
    const deviceId = getDeviceId(req);
    const deleted = deleteAllForDevice(deviceId);
    return { ok: true, deleted };
  });
};
