import React from 'react';
import { LL, Sparkle, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { AnalysisResult } from '../types';
import { FalReading, generateFalReading, FalMode } from '../services/falService';
import { RelationshipMode } from '../services/relationshipReport';
import { ZODIACS, ZodiacId, findZodiac } from '../services/zodiacEngine';

interface FalScreenProps {
  analysis: AnalysisResult | null;
  onBack: () => void;
  relationMode?: RelationshipMode;
}

const MODES: { id: FalMode; icon: string; label: string }[] = [
  { id: 'tarot', icon: '☽', label: 'Tarot' },
  { id: 'kahve', icon: '☕', label: 'Kahve' },
  { id: 'burc', icon: '✦', label: 'Burç' },
];

export const FalScreen: React.FC<FalScreenProps> = ({ analysis, onBack, relationMode = 'lover' }) => {
  const [mode, setMode] = React.useState<FalMode>('tarot');
  const [reading, setReading] = React.useState<FalReading | null>(null);
  const [readingNonce, setReadingNonce] = React.useState(0);
  const [signA, setSignA] = React.useState<ZodiacId | null>(null);
  const [signB, setSignB] = React.useState<ZodiacId | null>(null);
  const p1 = analysis?.participants[0]?.name ?? 'Sen';
  const p2 = analysis?.participants[1]?.name ?? 'O';

  React.useEffect(() => {
    if (mode === 'burc') {
      if (signA && signB) {
        setReading(generateFalReading(analysis, 'burc', relationMode, readingNonce, { signA, signB }));
      } else {
        setReading(null);
      }
      return;
    }
    setReading(generateFalReading(analysis, mode, relationMode, readingNonce));
  }, [mode, readingNonce, analysis, relationMode, signA, signB]);

  return (
    <Screen withTabBar starDensity={70}>
      <div style={{ padding: '20px 20px 24px' }}>
        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Glass
            onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            ‹
          </Glass>
          <div style={{ fontSize: 13, color: LL.fgMuted, fontWeight: 600 }}>Fal</div>
          <Glass style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>ⓘ</Glass>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            {p1} & {p2}
          </div>
          <h1
            className="ll-serif"
            style={{
              fontSize: 32,
              fontStyle: 'italic',
              fontWeight: 400,
              margin: '6px 0 0',
              letterSpacing: -0.3,
            }}
          >
            {relationMode === 'friend' ? 'Arkadaşlık falınız ne diyor?' : 'Falınız ne diyor?'}
          </h1>
        </div>

        {/* Mode selector */}
        <Glass style={{ padding: 4, borderRadius: 20, marginBottom: 20, display: 'flex', gap: 2 }}>
          {MODES.map(m => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 16,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: on ? `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})` : 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  color: LL.fg,
                  fontFamily: LL.sans,
                  boxShadow: on ? `0 4px 16px ${LL.hotPink}50` : 'none',
                }}
              >
                <div style={{ fontSize: 16 }}>{m.icon}</div>
                <div style={{ marginTop: 2 }}>{m.label}</div>
              </button>
            );
          })}
        </Glass>

        {mode === 'tarot' && <TarotView reading={reading} nonce={readingNonce} onRefresh={() => setReadingNonce(n => n + 1)} />}
        {mode === 'kahve' && <KahveView reading={reading} onRefresh={() => setReadingNonce(n => n + 1)} />}
        {mode === 'burc' && (
          <BurcView
            p1={p1}
            p2={p2}
            signA={signA}
            signB={signB}
            onPickA={setSignA}
            onPickB={setSignB}
            reading={reading}
          />
        )}
      </div>
    </Screen>
  );
};

// ─── Reading card (paylaşılan) ───
const ReadingCard: React.FC<{ reading: FalReading | null; emptyText?: string }> = ({ reading, emptyText }) => (
  <Glass strong style={{ padding: 16, borderRadius: 20, marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
      {reading?.title || 'Yorumum'}
    </div>
    <div className="ll-serif" style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.5, marginTop: 8 }}>
      {reading?.reading || emptyText || 'Fal hazırlanıyor; semboller birazdan burada belirecek.'}
    </div>
    {!!reading?.symbols?.length && (
      <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        {reading.symbols.map(symbol => (
          <div
            key={`${symbol.label}-${symbol.value}`}
            title={symbol.note}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              fontSize: 11,
              color: LL.fg,
              border: '1px solid ' + LL.glassBorder,
            }}
          >
            {symbol.label}: {symbol.value}
          </div>
        ))}
      </div>
    )}
  </Glass>
);

// ─── Tarot ───
interface CardVisualProps {
  label: string;
  glyph: string;
  meaning: string;
  reversed: boolean;
  revealed: boolean;
  onClick: () => void;
  color?: string;
}

const TarotCardVisual: React.FC<CardVisualProps> = ({ label, glyph, meaning, reversed, revealed, onClick, color = LL.hotPink }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1,
      aspectRatio: '2/3',
      borderRadius: 16,
      position: 'relative',
      cursor: 'pointer',
      transformStyle: 'preserve-3d',
      transition: 'transform 0.6s',
      transform: revealed ? 'rotateY(0)' : 'rotateY(180deg)',
    }}
  >
    {/* Front */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        background: `linear-gradient(160deg, ${LL.ink2}, ${LL.ink})`,
        border: `1.5px solid ${color}`,
        boxShadow: `0 8px 24px ${color}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
        backfaceVisibility: 'hidden',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 9, color: LL.fgMuted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 48,
          lineHeight: 1,
          color,
          filter: `drop-shadow(0 0 8px ${color})`,
          transform: reversed ? 'rotate(180deg)' : 'none',
        }}
      >
        {glyph}
      </div>
      <div className="ll-serif" style={{ fontSize: 11, fontStyle: 'italic', color: LL.fg, lineHeight: 1.2 }}>
        {meaning}{reversed ? ' (ters)' : ''}
      </div>
    </div>
    {/* Back */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 16,
        background: `linear-gradient(160deg, ${LL.amethyst}, ${LL.ink2})`,
        border: '1.5px solid ' + LL.glassBorder,
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: '70%',
          height: '70%',
          borderRadius: 10,
          border: `1px solid ${LL.gold}80`,
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
        }}
      >
        <div className="ll-serif" style={{ fontSize: 26, fontStyle: 'italic', color: LL.gold, opacity: 0.9 }}>L</div>
        <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 8, color: LL.gold, opacity: 0.7 }}>✦</div>
        <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, color: LL.gold, opacity: 0.7 }}>✦</div>
      </div>
    </div>
  </div>
);

const TarotView: React.FC<{ reading: FalReading | null; nonce: number; onRefresh: () => void }> = ({ reading, nonce, onRefresh }) => {
  const [rev, setRev] = React.useState<boolean[]>([false, false, false]);
  React.useEffect(() => {
    // Yeni nonce gelince kartlar tekrar kapalı başlasın
    setRev([false, false, false]);
  }, [nonce]);

  // reading.symbols artık 3 kart bilgisi taşıyor (Geçmiş/Şimdi/Gelecek)
  const cards = reading?.symbols?.slice(0, 3) ?? [];

  return (
    <>
      <div style={{ fontSize: 13, color: LL.fgMuted, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
        Üç kart çekildi. <span style={{ color: LL.gold }}>Her kartı çevir</span> ve yorumu oku.
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        {cards.map((c, i) => {
          // value formatı: "♡ Aşıklar (ters)" gibi → glyph + isim ayrıştır
          const parts = c.value.split(' ');
          const glyph = parts[0] ?? '✦';
          const name = parts.slice(1).join(' ').replace(' (ters)', '');
          const reversed = c.value.includes('(ters)');
          return (
            <TarotCardVisual
              key={i}
              label={c.label}
              glyph={glyph}
              meaning={name}
              reversed={reversed}
              revealed={rev[i]}
              onClick={() => setRev(r => r.map((x, j) => (j === i ? !x : x)))}
            />
          );
        })}
      </div>

      <ReadingCard reading={reading} />

      <button
        onClick={() => onRefresh()}
        style={{
          width: '100%',
          padding: 16,
          borderRadius: 18,
          border: 'none',
          background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: LL.sans,
          cursor: 'pointer',
          boxShadow: `0 8px 24px ${LL.hotPink}50`,
        }}
      >
        ✦ Tekrar fal aç
      </button>
    </>
  );
};

// ─── Kahve ───
const KahveView: React.FC<{ reading: FalReading | null; onRefresh: () => void }> = ({ reading, onRefresh }) => (
  <>
    <div style={{ position: 'relative', height: 240, marginBottom: 16, display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: `radial-gradient(circle at 30% 25%, ${LL.cream} 0%, #d4a373 25%, #8b5a2b 60%, #3d1f0f 100%)`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.5), inset -10px -15px 30px rgba(0,0,0,0.5)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {reading?.symbols?.slice(0, 4).map((s, idx) => {
          const positions = [
            { top: '28%', left: '38%', size: 22 },
            { top: '54%', left: '20%', size: 16 },
            { top: '60%', left: '62%', size: 18 },
            { top: '38%', right: '20%', size: 14 },
          ] as const;
          const pos = positions[idx];
          return (
            <div key={`${s.label}-${idx}`} style={{ position: 'absolute', ...pos, fontSize: pos.size, color: '#3d1f0f' }}>
              {s.value}
            </div>
          );
        })}
      </div>
      <Sparkle size={20} color={LL.gold} style={{ position: 'absolute', top: 20, left: 60 }} />
      <Sparkle size={14} color={LL.gold} style={{ position: 'absolute', bottom: 30, right: 50 }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
      {(reading?.symbols ?? []).slice(0, 4).map(s => (
        <Glass key={s.label} style={{ padding: 14, borderRadius: 16 }}>
          <div className="ll-serif" style={{ fontSize: 22, color: LL.gold }}>
            {s.value}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{s.label}</div>
          <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 2, lineHeight: 1.3 }}>{s.note}</div>
        </Glass>
      ))}
    </div>
    <ReadingCard reading={reading} />
    <button
      onClick={() => onRefresh()}
      style={{
        width: '100%',
        padding: 16,
        marginTop: 4,
        borderRadius: 18,
        border: 'none',
        background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        fontFamily: LL.sans,
        cursor: 'pointer',
        boxShadow: `0 8px 24px ${LL.hotPink}50`,
      }}
    >
      ☕ Fincanı tekrar çevir
    </button>
  </>
);

// ─── Burç ───
const BurcView: React.FC<{
  p1: string;
  p2: string;
  signA: ZodiacId | null;
  signB: ZodiacId | null;
  onPickA: (id: ZodiacId) => void;
  onPickB: (id: ZodiacId) => void;
  reading: FalReading | null;
}> = ({ p1, p2, signA, signB, onPickA, onPickB, reading }) => {
  const [picker, setPicker] = React.useState<null | 'A' | 'B'>(null);

  const slots = [
    { name: p1, value: signA, color: LL.lavender, slot: 'A' as const, onPick: onPickA },
    { name: p2, value: signB, color: LL.hotPink, slot: 'B' as const, onPick: onPickB },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {slots.map(s => {
          const info = s.value ? findZodiac(s.value) : null;
          return (
            <Glass key={s.slot} strong style={{ padding: 16, borderRadius: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: LL.fgMuted }}>{s.name}</div>
              <div
                className="ll-serif"
                style={{
                  fontSize: 48,
                  color: s.color,
                  lineHeight: 1,
                  margin: '6px 0',
                  opacity: info ? 1 : 0.35,
                }}
              >
                {info?.glyph ?? '?'}
              </div>
              <button
                onClick={() => setPicker(s.slot)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 12,
                  background: info ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
                  border: '1px solid ' + LL.glassBorder,
                  color: LL.fg,
                  fontFamily: LL.sans,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {info ? info.name : 'Burç seç ↓'}
              </button>
              {info && (
                <div style={{ fontSize: 10, color: LL.fgMuted, marginTop: 7 }}>
                  {info.element} · {info.vibe}
                </div>
              )}
            </Glass>
          );
        })}
      </div>

      {picker && (
        <Glass strong style={{ padding: 12, borderRadius: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: LL.fgMuted, marginBottom: 8, textAlign: 'center' }}>
            {picker === 'A' ? `${p1} için burç seç` : `${p2} için burç seç`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {ZODIACS.map(z => (
              <button
                key={z.id}
                onClick={() => {
                  if (picker === 'A') onPickA(z.id);
                  else onPickB(z.id);
                  setPicker(null);
                }}
                style={{
                  padding: '10px 6px',
                  borderRadius: 12,
                  border: '1px solid ' + LL.glassBorder,
                  background: 'rgba(255,255,255,0.06)',
                  color: LL.fg,
                  cursor: 'pointer',
                  fontFamily: LL.sans,
                }}
              >
                <div className="ll-serif" style={{ fontSize: 22 }}>{z.glyph}</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>{z.name}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setPicker(null)}
            style={{
              width: '100%',
              padding: '8px 0',
              marginTop: 10,
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid ' + LL.glassBorder,
              color: LL.fgMuted,
              cursor: 'pointer',
              fontFamily: LL.sans,
            }}
          >
            Vazgeç
          </button>
        </Glass>
      )}

      {signA && signB ? (
        <ReadingCard reading={reading} />
      ) : (
        <Glass style={{ padding: 16, borderRadius: 18, textAlign: 'center', color: LL.fgMuted, fontSize: 13 }}>
          İki burcu da seç, yıldızlar konuşsun.
        </Glass>
      )}
    </>
  );
};
