// /api/quiz — bağlanma stili lead magnet endpoint.
//
// Public: kullanıcı app indirmeden de quiz'i tamamlayabilir (web landing
// üzerinden). DeviceId opsiyonel. Email ZORUNLU.
//
// Email delivery YOK — sadece DB'ye yazar. Ayrı bir export flow ile Mailchimp/
// Buttondown'a manuel taşınabilir. Resend entegrasyonu Phase 4+ scope dışı.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { insertQuiz } from '../lib/storage.js';

const ATTACHMENT_STYLES = ['secure', 'anxious', 'avoidant', 'disorganized'] as const;

const submitQuizBody = z
  .object({
    email: z.string().email().max(200),
    responses: z
      .array(
        z.object({
          q: z.string().min(1).max(120),
          a: z.string().min(1).max(120),
        }),
      )
      .min(1)
      .max(20),
    result: z.enum(ATTACHMENT_STYLES),
    source: z.string().min(1).max(40).optional(),
  })
  .strict();

export const registerQuizRoutes = async (api: FastifyInstance) => {
  // POST /api/quiz — submit responses + email
  // Public: no device-id required.
  api.post('/quiz', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    const parsed = submitQuizBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { email, responses, result, source } = parsed.data;
    const deviceId = (req.headers['x-device-id'] as string | undefined) ?? null;

    const row = insertQuiz({
      email,
      responses,
      result,
      deviceId,
      source: source ?? 'web',
    });

    return reply.code(201).send({
      id: row.id,
      result: row.result,
      submittedAt: row.submittedAt,
    });
  });
};
