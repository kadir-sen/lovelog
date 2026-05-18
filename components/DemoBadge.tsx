import React from 'react';
import { LL } from './lovelog/tokens';

interface DemoBadgeProps {
  onExit: () => void;
}

/**
 * Fixed banner shown above Dashboard / HomeScreen when the user is in demo
 * mode. Communicates clearly that the data isn't theirs and gives a one-tap
 * exit into the real upload flow.
 *
 * Privacy implication: this banner is also a trust signal — users who
 * accidentally see demo data should not mistake it for their own analysis.
 */
export const DemoBadge: React.FC<DemoBadgeProps> = ({ onExit }) => {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: `linear-gradient(135deg, ${LL.amethyst}, ${LL.violet})`,
        borderBottom: `1px solid ${LL.glassBorderStrong}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        fontFamily: LL.sans,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            background: LL.gold,
            color: LL.ink,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          ✦
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: LL.fgMuted,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Demo modu
          </div>
          <div
            style={{
              fontSize: 13,
              color: LL.fg,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Ali &amp; Burcu örnek verisi
          </div>
        </div>
      </div>
      <button
        onClick={onExit}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.92)',
          color: LL.ink,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: LL.sans,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Kendi verinle dene →
      </button>
    </div>
  );
};
