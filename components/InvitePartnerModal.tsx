import React, { useCallback, useEffect, useState } from 'react';
import { LL, Glass } from './lovelog/tokens';
import {
  createInvite,
  listInvites,
  revokeInvite,
  buildInviteUrl,
  type InviteSummary,
} from '../services/inviteService';
import { listSavedChats, type SavedChatSummary } from '../services/apiClient';
import { track } from '../services/telemetry';

interface InvitePartnerModalProps {
  open: boolean;
  onClose: () => void;
}

const formatExpiry = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const isCapacitor = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

/**
 * Token generator + active-invites list. Reveals the privacy warning
 * prominently because this is the only flow that exposes chat analysis
 * outside the device.
 */
export const InvitePartnerModal: React.FC<InvitePartnerModalProps> = ({ open, onClose }) => {
  const [chats, setChats] = useState<SavedChatSummary[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const [{ chats: list }, ownedInvites] = await Promise.all([
          listSavedChats(),
          listInvites(),
        ]);
        setChats(list);
        setInvites(ownedInvites);
      } catch (e: any) {
        setError(e?.message ?? 'failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const handleCreate = useCallback(async (chatId: string) => {
    setError(null);
    try {
      const invite = await createInvite(chatId);
      setInvites((prev) => [invite, ...prev]);
      setJustCreated(invite.token);
      track('invite_generated', { tokenLength: invite.token.length });
      // Auto copy + native share
      const url = buildInviteUrl(invite.token);
      if (isCapacitor()) {
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({
            title: 'LoveLog raporu',
            text: 'Sohbet raporumuza bak — LoveLog',
            url,
            dialogTitle: 'Partnerine gönder',
          });
          track('invite_link_copied', { via: 'native_share' });
        } catch {
          await copyToClipboard(url);
          track('invite_link_copied', { via: 'clipboard_fallback' });
        }
      } else if (typeof navigator !== 'undefined' && (navigator as any).share) {
        try {
          await (navigator as any).share({ url, title: 'LoveLog raporu' });
          track('invite_link_copied', { via: 'web_share' });
        } catch {
          await copyToClipboard(url);
          track('invite_link_copied', { via: 'clipboard_fallback' });
        }
      } else {
        await copyToClipboard(url);
        track('invite_link_copied', { via: 'clipboard' });
      }
    } catch (e: any) {
      setError(e?.message ?? 'create_failed');
    }
  }, []);

  const handleRevoke = useCallback(async (token: string) => {
    setError(null);
    const ok = await revokeInvite(token);
    if (ok) {
      setInvites((prev) =>
        prev.map((i) => (i.token === token ? { ...i, revoked: true } : i)),
      );
    } else {
      setError('Revoke başarısız.');
    }
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(10,5,30,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          background: `linear-gradient(180deg, ${LL.ink2}, ${LL.ink})`,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          overflowY: 'auto',
          fontFamily: LL.sans,
          color: LL.fg,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Partner davet
            </div>
            <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 2 }}>
              Onunla raporunu paylaş
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 18, border: 'none',
              background: 'rgba(255,255,255,0.10)', color: LL.fg,
              fontSize: 18, cursor: 'pointer',
            }}
            aria-label="Kapat"
          >×</button>
        </div>

        <Glass
          style={{
            padding: 14, marginBottom: 16, borderRadius: 16,
            background: `${LL.amethyst}20`, border: `1px solid ${LL.amethyst}50`,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 18, lineHeight: 1 }}>🔒</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                Linki açan herkes raporunu görür
              </div>
              <div style={{ fontSize: 11.5, color: LL.fgMuted, lineHeight: 1.5 }}>
                Sohbet analizinizi içeren bu link 30 gün sonra otomatik silinir.
                Linki yalnız partnerinle paylaş. Yanlış kişiye gittiyse aşağıdan
                hemen iptal edebilirsin.
              </div>
            </div>
          </div>
        </Glass>

        {loading && <div style={{ color: LL.fgMuted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Yükleniyor…</div>}
        {error && (
          <div style={{ color: LL.red, fontSize: 13, padding: '10px 12px', background: 'rgba(255,107,138,0.10)', borderRadius: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {chats.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: LL.fgMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Hangi sohbeti paylaşalım?
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
              {chats.map((c) => (
                <Glass key={c.id} style={{ padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: LL.fgMuted }}>
                      {new Date(c.uploadedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreate(c.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 999, border: 'none',
                      background: LL.hotPink, color: '#fff',
                      fontSize: 12, fontWeight: 700, fontFamily: LL.sans, cursor: 'pointer',
                    }}
                  >
                    Link üret →
                  </button>
                </Glass>
              ))}
            </div>
          </>
        )}

        {invites.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: LL.fgMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Aktif linkler
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {invites.map((inv) => {
                const isJust = justCreated === inv.token;
                const expired = inv.expiresAt < Date.now();
                const status = inv.revoked ? 'revoked' : expired ? 'expired' : 'active';
                return (
                  <Glass key={inv.token} style={{ padding: 12, borderRadius: 14, opacity: status === 'active' ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                          {inv.token.slice(0, 8)}…
                        </div>
                        <div style={{ fontSize: 10.5, color: LL.fgMuted, marginTop: 2 }}>
                          {inv.viewCount} görüntüleme · {status === 'active' ? `${formatExpiry(inv.expiresAt)}'e kadar` : status === 'revoked' ? 'iptal edildi' : 'süresi doldu'}
                        </div>
                      </div>
                      {status === 'active' && (
                        <>
                          <button
                            onClick={() => {
                              void copyToClipboard(buildInviteUrl(inv.token));
                              track('invite_link_copied', { via: 'manual_copy' });
                            }}
                            style={{
                              padding: '6px 10px', borderRadius: 8, border: `1px solid ${LL.glassBorder}`,
                              background: 'rgba(255,255,255,0.06)', color: LL.fg,
                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Kopyala
                          </button>
                          <button
                            onClick={() => handleRevoke(inv.token)}
                            style={{
                              padding: '6px 10px', borderRadius: 8, border: 'none',
                              background: 'rgba(255,107,138,0.18)', color: LL.red,
                              fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            İptal et
                          </button>
                        </>
                      )}
                    </div>
                    {isJust && (
                      <div style={{ marginTop: 8, fontSize: 11, color: LL.mint }}>
                        ✓ Link panoya kopyalandı / paylaşıma açıldı
                      </div>
                    )}
                  </Glass>
                );
              })}
            </div>
          </>
        )}

        {!loading && chats.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: LL.fgMuted, fontSize: 13 }}>
            Önce bir sohbet yüklemelisin.
          </div>
        )}
      </div>
    </div>
  );
};

async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* fall through */
  }
  // Legacy execCommand fallback
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  } catch {
    /* ignore */
  }
}
