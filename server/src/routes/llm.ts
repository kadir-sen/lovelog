import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ai, hasApiKey } from '../lib/gemini.js';

const MAX_PROMPT_BYTES = 200_000;
const GENERATE_TIMEOUT_MS = 28_000;
const STREAM_IDLE_TIMEOUT_MS = 35_000;
const STREAM_HEARTBEAT_MS = 10_000;

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
    p.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); },
    );
  });

const configSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().max(4096).optional(),
    responseMimeType: z.enum(['application/json', 'text/plain']).optional(),
    responseSchema: z.any().optional(),
    systemInstruction: z.string().max(8000).optional(),
  })
  .strict()
  .default({});

const generateBody = z
  .object({
    model: z.string().default('gemini-2.5-flash'),
    prompt: z.string().min(1),
    config: configSchema,
  })
  .strict();

type GenerateBody = z.infer<typeof generateBody>;

const buildGeminiConfig = (cfg: GenerateBody['config']) => {
  const out: Record<string, unknown> = {};
  if (cfg.temperature !== undefined) out.temperature = cfg.temperature;
  if (cfg.maxOutputTokens !== undefined) out.maxOutputTokens = cfg.maxOutputTokens;
  if (cfg.responseMimeType) out.responseMimeType = cfg.responseMimeType;
  if (cfg.responseSchema) out.responseSchema = cfg.responseSchema;
  if (cfg.systemInstruction) out.systemInstruction = cfg.systemInstruction;
  return out;
};

const validatePromptSize = (prompt: string): string | null => {
  const bytes = Buffer.byteLength(prompt, 'utf-8');
  if (bytes > MAX_PROMPT_BYTES) return `prompt_too_large (${bytes} > ${MAX_PROMPT_BYTES})`;
  return null;
};

export const registerLlmRoutes = async (app: FastifyInstance) => {
  app.post('/llm/generate', {
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    if (!hasApiKey()) return reply.code(503).send({ error: 'llm_unavailable' });

    const parsed = generateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const { model, prompt, config } = parsed.data;
    const sizeErr = validatePromptSize(prompt);
    if (sizeErr) return reply.code(413).send({ error: sizeErr });

    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: buildGeminiConfig(config),
        }),
        GENERATE_TIMEOUT_MS,
        'gemini_generate',
      );
      return reply.send({ text: (response as any).text ?? '', candidates: (response as any).candidates ?? null });
    } catch (err: any) {
      const isTimeout = /^gemini_generate_timeout_/.test(err?.message ?? '');
      req.log.error({ err: err?.message, timeout: isTimeout }, 'gemini generate failed');
      return reply.code(isTimeout ? 504 : 502).send({
        error: isTimeout ? 'gemini_timeout' : 'gemini_error',
        message: err?.message ?? 'unknown',
      });
    }
  });

  app.post('/llm/stream', {
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    if (!hasApiKey()) return reply.code(503).send({ error: 'llm_unavailable' });

    const parsed = generateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const { model, prompt, config } = parsed.data;
    const sizeErr = validatePromptSize(prompt);
    if (sizeErr) return reply.code(413).send({ error: sizeErr });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let closed = false;
    const send = (event: string, data: unknown): boolean => {
      if (closed) return false;
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch {
        closed = true;
        return false;
      }
    };

    const heartbeat = setInterval(() => {
      if (closed) return;
      try { reply.raw.write(`: ping\n\n`); } catch { closed = true; }
    }, STREAM_HEARTBEAT_MS);

    let lastChunkAt = Date.now();
    const idleTimer = setInterval(() => {
      if (Date.now() - lastChunkAt > STREAM_IDLE_TIMEOUT_MS) {
        send('error', { message: `stream_idle_timeout_${STREAM_IDLE_TIMEOUT_MS}ms` });
        closed = true;
        try { reply.raw.end(); } catch { /* noop */ }
      }
    }, 2_000);

    req.raw.on('close', () => { closed = true; });

    let chunkCount = 0;
    let totalChars = 0;
    let lastFinishReason: string | undefined;
    let aborted = false;
    try {
      const stream = await withTimeout(
        ai.models.generateContentStream({
          model,
          contents: prompt,
          config: buildGeminiConfig(config),
        }),
        GENERATE_TIMEOUT_MS,
        'gemini_stream_open',
      );

      for await (const part of stream) {
        if (closed) { aborted = true; break; }
        const text = (part as any)?.text ?? '';
        const finish = (part as any)?.candidates?.[0]?.finishReason;
        if (finish) lastFinishReason = String(finish);
        if (text) {
          chunkCount++;
          totalChars += text.length;
          lastChunkAt = Date.now();
          send('chunk', { text });
        }
      }
      req.log.info({ chunkCount, totalChars, finishReason: lastFinishReason, aborted }, 'gemini stream complete');
      if (lastFinishReason && lastFinishReason !== 'STOP' && lastFinishReason !== 'MAX_TOKENS') {
        send('error', { message: `gemini_finish_${lastFinishReason}` });
      }
      send('done', {});
    } catch (err: any) {
      req.log.error({ err: err?.message, chunkCount, totalChars }, 'gemini stream failed');
      send('error', { message: err?.message ?? 'unknown' });
    } finally {
      clearInterval(heartbeat);
      clearInterval(idleTimer);
      closed = true;
      try { reply.raw.end(); } catch { /* noop */ }
    }
  });
};
