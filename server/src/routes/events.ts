// /api/events — optional telemetry sink.
//
// Privacy contract:
//   • Body 'props' is JSON-encoded primitives + collapsed-arrays only
//     (server-side schema enforces this; client services/telemetry.ts also
//     sanitizes before sending).
//   • DeviceId comes via header (or `?did=...` query param when called via
//     navigator.sendBeacon which can't set custom headers).
//
// This route lives OUTSIDE the device-id-protected scope so the beacon
// fallback works. We still require a valid device-id format.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { insertEvent } from '../lib/storage.js';

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const EVENT_NAME_RE = /^[a-z][a-z0-9_]{1,40}$/;

const propsSchema = z
  .record(
    z.union([
      z.string().max(200),
      z.number().finite(),
      z.boolean(),
      z.null(),
    ]),
  )
  .optional();

const eventBody = z.object({
  name: z.string().regex(EVENT_NAME_RE),
  props: propsSchema,
}).strict();

export const registerEventsRoutes = async (api: FastifyInstance) => {
  api.post('/events', {
    config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const headerDid = req.headers['x-device-id'] as string | undefined;
    const queryDid = ((req.query as any) ?? {}).did as string | undefined;
    const deviceId = headerDid ?? queryDid;
    if (!deviceId || !DEVICE_ID_RE.test(deviceId)) {
      return reply.code(400).send({ error: 'missing_device_id' });
    }
    const parsed = eventBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    insertEvent(deviceId, parsed.data.name, parsed.data.props);
    return reply.code(202).send({ ok: true });
  });
};
