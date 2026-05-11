// Backend Gemini proxy istemcisi. Anahtar artık client'ta yok; tüm AI çağrıları
// X-Device-Id ile rate-limit edilen /api/llm/* endpoint'lerinden geçer.

const DEVICE_KEY = 'lovelog.deviceId';

const generateDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const getDeviceId = (): string => {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const fresh = generateDeviceId();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // private mode / no-storage fallback — non-persistent
    return generateDeviceId();
  }
};

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? '/api')
  .toString()
  .replace(/\/+$/, '');

export interface LlmConfig {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: unknown;
  systemInstruction?: string;
}

export interface LlmGenerateRequest {
  model?: string;
  prompt: string;
  config?: LlmConfig;
  signal?: AbortSignal;
}

const GENERATE_TIMEOUT_MS = 35_000;
const STREAM_IDLE_TIMEOUT_MS = 40_000;

const linkSignal = (external: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } => {
  const ac = new AbortController();
  const onAbort = () => ac.abort(external?.reason);
  const timer = setTimeout(() => ac.abort(new DOMException('timeout', 'AbortError')), timeoutMs);
  if (external) {
    if (external.aborted) ac.abort(external.reason);
    else external.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ac.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', onAbort);
    },
  };
};

export interface LlmGenerateResponse {
  text: string;
  candidates: unknown;
}

export class LlmUnavailableError extends Error {
  constructor(message = 'llm_unavailable') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
});

export const llmGenerate = async (req: LlmGenerateRequest): Promise<LlmGenerateResponse> => {
  const { signal: externalSignal, ...rest } = req;
  const { signal, cleanup } = linkSignal(externalSignal, GENERATE_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/llm/generate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(rest),
      signal,
    });
    if (res.status === 503) throw new LlmUnavailableError();
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`llm_generate_failed ${res.status} ${detail}`);
    }
    return (await res.json()) as LlmGenerateResponse;
  } finally {
    cleanup();
  }
};

export type LlmStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export async function* llmStream(req: LlmGenerateRequest): AsyncGenerator<LlmStreamEvent, void, unknown> {
  const { signal: externalSignal, ...rest } = req;
  const { signal, cleanup } = linkSignal(externalSignal, STREAM_IDLE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/llm/stream`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(rest),
      signal,
    });
  } catch (err) {
    cleanup();
    throw err;
  }
  if (res.status === 503) { cleanup(); throw new LlmUnavailableError(); }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    cleanup();
    throw new Error(`llm_stream_failed ${res.status} ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // Minimal SSE parser: parses `event: x\ndata: {...}\n\n` records.
  const flush = function* (): Generator<LlmStreamEvent> {
    while (true) {
      const sep = buffer.indexOf('\n\n');
      if (sep === -1) return;
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      const dataParts: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataParts.push(line.slice(5).trim());
      }
      if (!dataParts.length) continue;
      const dataStr = dataParts.join('\n');
      try {
        const data = JSON.parse(dataStr);
        if (event === 'chunk' && typeof data?.text === 'string') yield { type: 'chunk', text: data.text };
        else if (event === 'done') yield { type: 'done' };
        else if (event === 'error') yield { type: 'error', message: data?.message ?? 'unknown' };
      } catch {
        // ignore malformed line
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const ev of flush()) yield ev;
  }
  buffer += decoder.decode();
  for (const ev of flush()) yield ev;
}

export const llmIsAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${baseUrl}/../health`.replace(/\/api\/\.\.\//, '/'), { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
};

// Mağaza zorunluluğu (Play 2024+): kullanıcı hesabını/verisini silebilmeli.
// Anonim cihaz ID kullandığımız için "hesap" = cihaz kaydı.
export const deleteDeviceData = async (): Promise<boolean> => {
  const id = getDeviceId();
  try {
    const res = await fetch(`${baseUrl}/device/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Device-Id': id },
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const getActiveDeviceId = (): string => getDeviceId();
