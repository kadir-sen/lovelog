// /api/invites — partner-share read-only viewer links (Phase A).
//
// Pattern:
//   • POST /api/invites — sahip cihaz token üretir (device-id gerekli)
//   • GET /api/invites — sahibin aktif tokenlarını listele (device-id gerekli)
//   • DELETE /api/invites/:token — sahibi revoke eder (device-id gerekli)
//   • GET /api/invites/:token/view — PUBLIC, herhangi biri açar; chat'in
//     parsed raw text'ini döner. Frontend client-side analyze edip read-only
//     dashboard render eder. (Server-side analyze yapmıyoruz çünkü
//     services/analytics.ts client-only Vite bundle.)
//
// Privacy: raw text public link'e açılabilir hale geliyor. Sahibe açık
// uyarı verilir (frontend), 30 gün TTL, revoke edilebilir, view sayısı
// görünür. Phase B'de raw text yerine sanitize edilmiş analiz çıktısı
// dönmek için server'a analiz pipeline'ı taşınacak.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createInvite,
  getInvite,
  incrementInviteView,
  revokeInvite,
  listInvitesForDevice,
  getChat,
} from '../lib/storage.js';
import { getDeviceId } from '../middleware/deviceId.js';

const createInviteBody = z.object({ chatId: z.string().min(1).max(64) }).strict();

export const registerInvitesRoutes = async (api: FastifyInstance) => {
  // POST /api/invites — generate token for a saved chat
  api.post('/invites', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const deviceId = getDeviceId(req);
    const parsed = createInviteBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { chatId } = parsed.data;
    // Sanity: chat must belong to this device.
    const chat = getChat(deviceId, chatId);
    if (!chat) {
      return reply.code(404).send({ error: 'chat_not_found' });
    }
    const invite = createInvite(deviceId, chatId);
    return reply.code(201).send({
      token: invite.token,
      chatId: invite.chatId,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      viewCount: invite.viewCount,
    });
  });

  // GET /api/invites — list invites owned by this device
  api.get('/invites', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const deviceId = getDeviceId(req);
    const rows = listInvitesForDevice(deviceId);
    return { invites: rows.map(r => ({
      token: r.token,
      chatId: r.chatId,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      viewCount: r.viewCount,
      revoked: r.revoked === 1,
    })) };
  });

  // DELETE /api/invites/:token — revoke (only owner)
  api.delete('/invites/:token', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const deviceId = getDeviceId(req);
    const token = (req.params as any)?.token;
    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ error: 'invalid_token' });
    }
    const ok = revokeInvite(deviceId, token);
    if (!ok) return reply.code(404).send({ error: 'not_found_or_not_owner' });
    return { revoked: true };
  });
};

// PUBLIC route: token-only access. Lives outside the device-id-protected
// scope so anyone with the link can fetch the chat content.
export const registerInviteViewRoute = async (api: FastifyInstance) => {
  api.get('/invites/:token/view', {
    config: { rateLimit: { max: 600, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const token = (req.params as any)?.token;
    if (!token || typeof token !== 'string') {
      return reply.code(400).send({ error: 'invalid_token' });
    }
    const invite = getInvite(token);
    if (!invite) return reply.code(404).send({ error: 'not_found' });
    if (invite.revoked === 1) return reply.code(410).send({ error: 'revoked' });
    if (invite.expiresAt < Date.now()) return reply.code(410).send({ error: 'expired' });
    const chat = getChat(invite.deviceId, invite.chatId);
    if (!chat) return reply.code(404).send({ error: 'chat_missing' });

    incrementInviteView(token);

    return {
      token: invite.token,
      chatName: chat.name,
      uploadedAt: chat.uploadedAt,
      raw: chat.raw,
      expiresAt: invite.expiresAt,
    };
  });
};
