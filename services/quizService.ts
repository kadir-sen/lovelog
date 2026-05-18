// Quiz lead magnet client.
//
// Public endpoint: device-id header is forwarded if present (lets us join
// quiz responses back to in-app analyses later), but not required — the
// quiz works even when run on the marketing web landing without app install.

const DEVICE_KEY = 'lovelog.deviceId';

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? '/api')
  .toString()
  .replace(/\/+$/, '');

export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant' | 'disorganized';

export interface QuizResponse {
  q: string;
  a: string;
}

const getDeviceId = (): string | null => {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
};

export const submitQuiz = async (input: {
  email: string;
  responses: QuizResponse[];
  result: AttachmentStyle;
  source?: 'web' | 'app' | 'ad';
}): Promise<{ id: string; submittedAt: number }> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const did = getDeviceId();
  if (did) headers['X-Device-Id'] = did;

  const res = await fetch(`${baseUrl}/quiz`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: input.email,
      responses: input.responses,
      result: input.result,
      source: input.source ?? 'app',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`submit_quiz_failed ${res.status} ${detail}`);
  }
  return (await res.json()) as { id: string; submittedAt: number };
};
