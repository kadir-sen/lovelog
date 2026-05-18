// SavedChatsCard — HomeScreen üzerinde "Kayıtlı sohbetler" listesi.
// Her satır: dosya adı + yüklenme tarihi + boyut. Tıklayınca açıyo, sağda × silme.
// Privacy: server'da bu device-id'ye ait sohbetler — başka device görmez.

import React from 'react';
import { LL, Glass } from './lovelog/tokens';
import type { SavedChatSummary } from '../services/apiClient';

interface SavedChatsCardProps {
  chats: SavedChatSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  if (same) return `Bugün ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
};

export const SavedChatsCard: React.FC<SavedChatsCardProps> = ({ chats, loading, onOpen, onDelete }) => {
  return (
    <Glass style={{ padding: 16, borderRadius: 20, marginTop: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: LL.gold,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Kayıtlı sohbetler</span>
        <span style={{ fontSize: 11, color: LL.fgMuted, textTransform: 'none', letterSpacing: 0 }}>
          {loading ? '…' : `${chats.length} sohbet`}
        </span>
      </div>

      {loading && chats.length === 0 && (
        <div style={{ fontSize: 12, color: LL.fgMuted, padding: '8px 4px' }}>Yükleniyor…</div>
      )}

      {!loading && chats.length === 0 && (
        <div style={{ fontSize: 12, color: LL.fgMuted, padding: '12px 4px', lineHeight: 1.5 }}>
          Henüz hiç sohbet kaydetmedin. Bir <strong>.txt</strong> yüklediğinde otomatik olarak sunucuya
          kaydedilir ve burada listelenir. Aynı linki başka bir cihazdan açtığında da kendi yüklediklerini görürsün.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chats.map(c => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              onClick={() => onOpen(c.id)}
              style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') onOpen(c.id);
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 2 }}>
                {formatDate(c.uploadedAt)} · {formatSize(c.sizeBytes)}
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm(`"${c.name}" silinsin mi?`)) onDelete(c.id);
              }}
              aria-label="Sohbeti sil"
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: LL.fgMuted,
                fontSize: 14,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Glass>
  );
};
