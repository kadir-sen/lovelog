import React from 'react';
import { LL, Sparkle, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';

interface AnalyzingScreenProps {
  currentStage: string | null;
  totalMessages?: number;
}

const STAGES = [
  'Dosya okunuyor',
  'Mesajlar ayrıştırılıyor',
  'Mesajlar normalize ediliyor',
  'Temel metrikler hesaplanıyor',
  'Dönemler çıkarılıyor',
  'Dönemler ve oturumlar çıkarılıyor',
  'NLP sinyalleri hesaplanıyor',
  'Yapay zeka için güvenli özet hazırlanıyor',
  'Arkadaşlık sinyalleri hazırlanıyor',
  'İlişki sinyalleri hazırlanıyor',
  'Bestie raporu hazırlanıyor',
  'Dashboard hazırlanıyor',
];

const FRIENDLY = [
  { t: 'Mesajlar okundu', match: ['Dosya okunuyor', 'Mesajlar ayrıştırılıyor', 'Mesajlar normalize ediliyor'] },
  { t: 'Duygu eğrisi çiziliyor', match: ['Temel metrikler hesaplanıyor', 'Dönemler çıkarılıyor', 'Dönemler ve oturumlar çıkarılıyor'] },
  { t: 'Aşk skoru hesaplanıyor', match: ['NLP sinyalleri hesaplanıyor', 'Yapay zeka için güvenli özet hazırlanıyor'] },
  { t: 'Yıldız haritası okunuyor', match: ['Arkadaşlık sinyalleri hazırlanıyor', 'İlişki sinyalleri hazırlanıyor', 'Bestie raporu hazırlanıyor', 'Dashboard hazırlanıyor'] },
];

export const AnalyzingScreen: React.FC<AnalyzingScreenProps> = ({ currentStage, totalMessages }) => {
  const currentIndex = currentStage ? STAGES.indexOf(currentStage) : 0;

  const stageStatus = (matches: string[]) => {
    const matchIndices = matches.map(m => STAGES.indexOf(m));
    const lastIdx = Math.max(...matchIndices);
    const firstIdx = Math.min(...matchIndices);
    if (currentIndex > lastIdx) return 'done';
    if (currentIndex >= firstIdx && currentIndex <= lastIdx) return 'active';
    return 'pending';
  };

  return (
    <Screen scroll={false} starDensity={80}>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          position: 'relative',
        }}
      >
        {/* Orb */}
        <div style={{ position: 'relative', width: 240, height: 240, marginBottom: 32 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${LL.blush}, ${LL.hotPink} 35%, ${LL.violet} 70%, ${LL.amethyst} 100%)`,
              boxShadow: `0 0 80px ${LL.hotPink}80, inset -20px -30px 60px rgba(0,0,0,0.4), inset 20px 20px 40px rgba(255,255,255,0.3)`,
              animation: 'll-pulse 3s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 35,
              left: 50,
              width: 60,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.5)',
              filter: 'blur(8px)',
            }}
          />
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: -10,
                animation: `ll-orbit ${8 + i * 2}s linear infinite`,
                animationDelay: `${i * -1.5}s`,
              }}
            >
              <Sparkle size={10 + i * 2} color={LL.gold} style={{ position: 'absolute', top: -10, left: '50%' }} />
            </div>
          ))}
        </div>

        <div className="ll-serif" style={{ fontSize: 28, fontStyle: 'italic', textAlign: 'center', marginBottom: 8 }}>
          Yıldızlar konuşuyor…
        </div>
        <div style={{ fontSize: 14, color: LL.fgMuted, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          {totalMessages ? `${totalMessages.toLocaleString()} mesaj okundu · ` : ''}
          duygular ölçülüyor · enerjiler hizalanıyor
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginTop: 36,
            width: '100%',
            maxWidth: 320,
          }}
        >
          {FRIENDLY.map((s, i) => {
            const status = stageStatus(s.match);
            return (
              <Glass
                key={i}
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  borderRadius: 14,
                  opacity: status === 'pending' ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background:
                      status === 'done'
                        ? LL.mint
                        : status === 'active'
                        ? `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`
                        : 'rgba(255,255,255,0.1)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: status === 'done' ? LL.ink : '#fff',
                  }}
                >
                  {status === 'done' ? '✓' : ''}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{s.t}</div>
                {status === 'active' && <div style={{ fontSize: 11, color: LL.gold }}>•••</div>}
              </Glass>
            );
          })}
        </div>

        {currentStage && (
          <div style={{ marginTop: 18, fontSize: 11, color: LL.fgDim, fontStyle: 'italic' }}>{currentStage}</div>
        )}
      </div>
    </Screen>
  );
};
