import type { FastifyRequest, FastifyReply } from 'fastify';

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export const deviceIdHook = async (req: FastifyRequest, reply: FastifyReply) => {
  const raw = req.headers['x-device-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !DEVICE_ID_RE.test(id)) {
    reply.code(400).send({ error: 'missing_or_invalid_device_id' });
    return reply;
  }
  (req as any).deviceId = id;
};

export const getDeviceId = (req: FastifyRequest): string => (req as any).deviceId as string;
