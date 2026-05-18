// Partner-invite client. Phase A: read-only viewer link.
//
// All endpoints proxy through services/apiClient.ts patterns (device-id
// header for owner ops; public for /view).

const DEVICE_KEY = 'lovelog.deviceId';

const baseUrl = ((import.meta as any).env?.VITE_API_BASE_URL ?? '/api')
  .toString()
  .replace(/\/+$/, '');

const getDeviceId = (): string => {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? '';
  } catch {
    return '';
  }
};

const ownerHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
});

export interface InviteSummary {
  token: string;
  chatId: string;
  createdAt: number;
  expiresAt: number;
  viewCount: number;
  revoked?: boolean;
}

export const createInvite = async (chatId: string): Promise<InviteSummary> => {
  const res = await fetch(`${baseUrl}/invites`, {
    method: 'POST',
    headers: ownerHeaders(),
    body: JSON.stringify({ chatId }),
  });
  if (!res.ok) throw new Error(`create_invite_failed ${res.status}`);
  return (await res.json()) as InviteSummary;
};

export const listInvites = async (): Promise<InviteSummary[]> => {
  const res = await fetch(`${baseUrl}/invites`, { headers: ownerHeaders() });
  if (!res.ok) {
    if (res.status === 400) return [];
    throw new Error(`list_invites_failed ${res.status}`);
  }
  const data = (await res.json()) as { invites: InviteSummary[] };
  return data.invites ?? [];
};

export const revokeInvite = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch(`${baseUrl}/invites/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: ownerHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export interface InviteView {
  token: string;
  chatName: string;
  uploadedAt: number;
  raw: string;
  expiresAt: number;
}

/**
 * Public endpoint: anyone with the link can fetch the chat raw text and
 * render the analysis read-only client-side. Server-side rate limited.
 */
export const fetchInviteView = async (token: string): Promise<InviteView | null> => {
  try {
    const res = await fetch(
      `${baseUrl}/invites/${encodeURIComponent(token)}/view`,
    );
    if (!res.ok) return null;
    return (await res.json()) as InviteView;
  } catch {
    return null;
  }
};

/**
 * Compose the shareable URL for an invite token. Uses the current origin
 * + a /share?invite=TOKEN path that App.tsx handles via URL parsing.
 */
export const buildInviteUrl = (token: string): string => {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://lovelog.app';
  return `${origin}/?invite=${encodeURIComponent(token)}`;
};
