// Backend API istemcisi. Bu sürümde Gemini API kullanılmıyor — tüm içerik üretimi
// yerel (algoritmik) motorlarla yapılıyor. İstemci sadece sohbet kaydı ve cihaz
// yönetimi için backend ile konuşur.

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
    return generateDeviceId();
  }
};

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? '/api')
  .toString()
  .replace(/\/+$/, '');

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
});

// Mağaza zorunluluğu (Play 2024+): kullanıcı hesabını/verisini silebilmeli.
// Bu sürümde "hesap" = cihaz kaydı (Sprint 2'de email/şifre ile değişecek).
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

// ===========================================================================
// Saved chats API — yüklenen .txt dosyalarını sunucu tarafında saklama.
// Device-id bazlı isolation; link-paylaşımı access modeli.
// ===========================================================================

export interface SavedChatSummary {
  id: string;
  name: string;
  uploadedAt: number;
  sizeBytes: number;
}

export interface SavedChatFull extends SavedChatSummary {
  raw: string;
}

export const uploadChat = async (name: string, raw: string): Promise<SavedChatSummary> => {
  const res = await fetch(`${baseUrl}/chats`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, raw }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`upload_chat_failed ${res.status} ${detail}`);
  }
  return (await res.json()) as SavedChatSummary;
};

export const listSavedChats = async (): Promise<{ chats: SavedChatSummary[]; max: number }> => {
  const res = await fetch(`${baseUrl}/chats`, { headers: headers() });
  if (!res.ok) {
    if (res.status === 400) return { chats: [], max: 0 };
    throw new Error(`list_chats_failed ${res.status}`);
  }
  return (await res.json()) as { chats: SavedChatSummary[]; max: number };
};

export const getSavedChat = async (id: string): Promise<SavedChatFull> => {
  const res = await fetch(`${baseUrl}/chats/${encodeURIComponent(id)}`, { headers: headers() });
  if (!res.ok) throw new Error(`get_chat_failed ${res.status}`);
  return (await res.json()) as SavedChatFull;
};

export const deleteSavedChat = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${baseUrl}/chats/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const deleteAllSavedChats = async (): Promise<number> => {
  try {
    const res = await fetch(`${baseUrl}/chats`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { deleted?: number };
    return data.deleted ?? 0;
  } catch {
    return 0;
  }
};
