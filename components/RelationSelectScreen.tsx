import React from 'react';
import { LL, Glass, Heart } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';

export type RelationMode = 'lover' | 'friend';

interface RelationSelectScreenProps {
  messageCount: number;
  onBack: () => void;
  onSelect: (mode: RelationMode) => void;
}

const FR = {
  peach: '#ffb38a',
  lila: '#b19cff',
  butter: '#ffe28a',
};

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: 9,
      padding: '3px 8px',
      borderRadius: 999,
      background: 'rgba(255,255,255,0.1)',
      color: LL.fgMuted,
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export const RelationSelectScreen: React.FC<RelationSelectScreenProps> = ({ messageCount, onBack, onSelect }) => {
  const [pick, setPick] = React.useState<RelationMode | null>(null);

  const submit = () => {
    if (pick) onSelect(pick);
  };

  return (
    <Screen starDensity={70}>
      <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <Glass onClick={onBack} style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>
            ‹
          </Glass>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: i === 2 ? 24 : 8,
                  height: 4,
                  borderRadius: 2,
                  background: i <= 2 ? LL.fg : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: LL.gold, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
            {messageCount.toLocaleString('tr-TR')} WhatsApp mesajı okundu ✦
          </div>
          <h1
            className="ll-serif"
            style={{ fontSize: 36, fontStyle: 'italic', fontWeight: 400, margin: '8px 0 0', lineHeight: 1.05 }}
          >
            Bu kişi senin
            <br />
            <span
              style={{
                background: `linear-gradient(135deg, ${LL.blush}, ${LL.lavender})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              kim oluyor?
            </span>
          </h1>
          <p style={{ fontSize: 14, color: LL.fgMuted, marginTop: 10, lineHeight: 1.5 }}>
            Sevgili ve arkadaş sohbetlerini farklı okuyoruz. Doğru rapor için enerjiyi seç.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          <Glass
            strong
            hover
            onClick={() => setPick('lover')}
            style={{
              padding: 20,
              borderRadius: 24,
              position: 'relative',
              overflow: 'hidden',
              border: pick === 'lover' ? `2px solid ${LL.hotPink}` : `1px solid ${LL.glassBorder}`,
              background: pick === 'lover' ? `linear-gradient(135deg, ${LL.hotPink}30, ${LL.violet}30)` : LL.glassFillStrong,
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(${LL.hotPink}50, transparent 70%)`, filter: 'blur(20px)' }} />
            <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`, display: 'grid', placeItems: 'center', boxShadow: `0 8px 24px ${LL.hotPink}50`, flexShrink: 0 }}>
                <Heart size={28} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Sevgili</div>
                <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2, lineHeight: 1.4 }}>
                  Aşk skoru, sevgi dili, ilişki koçu ve romantik fal.
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <Tag>aşk skoru</Tag>
                  <Tag>fal</Tag>
                  <Tag>kim daha çok seviyor</Tag>
                </div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 14, border: pick === 'lover' ? 'none' : `2px solid ${LL.glassBorder}`, background: pick === 'lover' ? `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})` : 'transparent', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                {pick === 'lover' ? '✓' : ''}
              </div>
            </div>
          </Glass>

          <Glass
            strong
            hover
            onClick={() => setPick('friend')}
            style={{
              padding: 20,
              borderRadius: 24,
              position: 'relative',
              overflow: 'hidden',
              border: pick === 'friend' ? `2px solid ${FR.peach}` : `1px solid ${LL.glassBorder}`,
              background: pick === 'friend' ? `linear-gradient(135deg, ${FR.peach}30, ${FR.lila}30)` : LL.glassFillStrong,
            }}
          >
            <div style={{ position: 'absolute', top: -20, right: -20, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(${FR.peach}55, transparent 70%)`, filter: 'blur(20px)' }} />
            <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${FR.peach}, ${FR.lila})`, display: 'grid', placeItems: 'center', boxShadow: `0 8px 24px ${FR.peach}50`, flexShrink: 0 }}>
                <svg width="34" height="34" viewBox="0 0 32 32" fill="#fff">
                  <path d="M9 4 L10 8 L14 9 L10 10 L9 14 L8 10 L4 9 L8 8 Z" />
                  <path d="M23 18 L24 22 L28 23 L24 24 L23 28 L22 24 L18 23 L22 22 Z" />
                  <path d="M11 14 Q16 16 21 18" stroke="#fff" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Arkadaş</div>
                <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2, lineHeight: 1.4 }}>
                  Bestie skoru, vibe haritası, drama sayacı ve kanka koçu.
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  <Tag>vibe</Tag>
                  <Tag>drama</Tag>
                  <Tag>kanka koçu</Tag>
                </div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 14, border: pick === 'friend' ? 'none' : `2px solid ${LL.glassBorder}`, background: pick === 'friend' ? `linear-gradient(135deg, ${FR.peach}, ${FR.lila})` : 'transparent', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                {pick === 'friend' ? '✓' : ''}
              </div>
            </div>
          </Glass>

          <div style={{ textAlign: 'center', fontSize: 12, color: LL.fgDim, marginTop: 4 }}>
            Emin değilsen önce arkadaş seçip sonra yeni analiz yükleyebilirsin.
          </div>
        </div>

        <button
          disabled={!pick}
          onClick={submit}
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 20,
            border: 'none',
            background: pick === 'friend'
              ? `linear-gradient(135deg, ${FR.peach}, ${FR.lila})`
              : pick === 'lover'
              ? `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`
              : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            fontFamily: LL.sans,
            cursor: pick ? 'pointer' : 'default',
            opacity: pick ? 1 : 0.5,
            boxShadow: pick ? `0 8px 24px ${pick === 'friend' ? FR.peach : LL.hotPink}50` : 'none',
          }}
        >
          {pick === 'friend' ? 'Arkadaşlık enerjisini oku ✦' : pick === 'lover' ? 'Aşk skorunu hesapla ♡' : 'Birini seç'}
        </button>
      </div>
    </Screen>
  );
};
