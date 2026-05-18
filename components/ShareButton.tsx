import React, { useCallback, useState } from 'react';
import { LL } from './lovelog/tokens';
import {
  composeSnapshot,
  shareSnapshot,
  type SnapshotVariant,
  type SnapshotData,
} from '../services/snapshot';
import { track } from '../services/telemetry';

interface ShareButtonProps {
  /** Which snapshot template to render. */
  variant: SnapshotVariant;
  /** Payload + couple names + date label. Caller is responsible for masking. */
  data: SnapshotData;
  /** Marketing pillar tag for telemetry (1=product, 2=pattern, 3=privacy, 4=culture, 5=ugc). */
  pillar?: 1 | 2 | 3 | 4 | 5;
  /** Where in the UI this share button lives (telemetry). */
  surface: string;
  /** Compact icon-only variant for inline placement on cards. */
  compact?: boolean;
  /** Optional className. */
  className?: string;
  /** Optional inline style override. */
  style?: React.CSSProperties;
}

/**
 * One button → composes a branded PNG snapshot of `data` and pushes it
 * through the platform share sheet. Privacy: caller MUST pre-mask the
 * `data.payload` — we don't reach back into application state to grab
 * names or evidence. Default anonymize=true on SnapshotData.
 *
 * Behavior:
 *   • Click → telemetry `share_initiated`
 *   • Compose snapshot, hand to shareSnapshot()
 *   • Success → `share_completed`
 *   • Failure (non-AbortError) → `share_failed`
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  variant,
  data,
  pillar,
  surface,
  compact = false,
  className,
  style,
}) => {
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      track('share_initiated', { variant, surface, pillar });
      try {
        const snapshot = await composeSnapshot(variant, data);
        const outcome = await shareSnapshot(
          snapshot,
          `lovelog-${variant}-${Date.now()}.png`,
          'LoveLog',
        );
        track('share_completed', { variant, surface, outcome });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // User cancelled native share — not an error.
          track('share_completed', { variant, surface, outcome: 'cancelled' });
        } else {
          console.warn('[ShareButton] failed', err);
          track('share_failed', {
            variant,
            surface,
            errorName: err?.name ?? 'unknown',
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, variant, data, surface, pillar],
  );

  if (compact) {
    return (
      <button
        onClick={onClick}
        disabled={busy}
        aria-label="Paylaş"
        className={className}
        style={{
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: 12,
          border: `1px solid ${LL.glassBorder}`,
          background: 'rgba(255,255,255,0.10)',
          color: LL.fg,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.5 : 1,
          display: 'grid',
          placeItems: 'center',
          fontFamily: LL.sans,
          fontSize: 14,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          ...style,
        }}
      >
        {busy ? '…' : '↗'}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={className}
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        border: `1px solid ${LL.glassBorder}`,
        background: 'rgba(255,255,255,0.10)',
        color: LL.fg,
        fontSize: 13,
        fontWeight: 700,
        fontFamily: LL.sans,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      {busy ? 'Hazırlanıyor…' : '↗ Paylaş'}
    </button>
  );
};
