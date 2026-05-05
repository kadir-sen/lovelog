import React from 'react';
import { LL, Sparkle, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { AnalysisResult } from '../types';
import { FalReading, generateFalReading } from '../services/falService';
import { RelationshipMode } from '../services/relationshipReport';

interface FalScreenProps {
  analysis: AnalysisResult | null;
  onBack: () => void;
  relationMode?: RelationshipMode;
}

type FalMode = 'tarot' | 'kahve' | 'burc' | 'el';

const MODES: { id: FalMode; icon: string; label: string }[] = [
  { id: 'tarot', icon: '☽', label: 'Tarot' },
  { id: 'kahve', icon: '☕', label: 'Kahve' },
  { id: 'burc', icon: '✦', label: 'Burç' },
  { id: 'el', icon: '✋', label: 'El' },
];

const ZODIACS = [
  { sign: 'Koç', glyph: '♈', element: 'Ateş', vibe: 'atak' },
  { sign: 'Boğa', glyph: '♉', element: 'Toprak', vibe: 'sakin' },
  { sign: 'İkizler', glyph: '♊', element: 'Hava', vibe: 'meraklı' },
  { sign: 'Yengeç', glyph: '♋', element: 'Su', vibe: 'duygusal' },
  { sign: 'Aslan', glyph: '♌', element: 'Ateş', vibe: 'görünür' },
  { sign: 'Başak', glyph: '♍', element: 'Toprak', vibe: 'özenli' },
  { sign: 'Terazi', glyph: '♎', element: 'Hava', vibe: 'uyumlu' },
  { sign: 'Akrep', glyph: '♏', element: 'Su', vibe: 'derin' },
  { sign: 'Yay', glyph: '♐', element: 'Ateş', vibe: 'özgür' },
  { sign: 'Oğlak', glyph: '♑', element: 'Toprak', vibe: 'ciddi' },
  { sign: 'Kova', glyph: '♒', element: 'Hava', vibe: 'farklı' },
  { sign: 'Balık', glyph: '♓', element: 'Su', vibe: 'sezgisel' },
];

const normalizeTr = (text: string): string =>
  text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ı/g, 'i');

const zodiacBySign = (sign: string) => ZODIACS.find(item => item.sign === sign) ?? ZODIACS[3];

const inferZodiac = (analysis: AnalysisResult | null, author: string): string => {
  if (!analysis) return author === 'Sen' ? 'Yengeç' : 'Akrep';
  const normalizedSigns = ZODIACS.map(item => ({ ...item, key: normalizeTr(item.sign) }));
  const ownMessages = analysis.normalizedMessages.filter(msg => msg.author === author);
  const direct = ownMessages.find(msg => normalizedSigns.some(sign => normalizeTr(msg.content).includes(sign.key)));
  if (direct) {
    const lower = normalizeTr(direct.content);
    return normalizedSigns.find(sign => lower.includes(sign.key))?.sign ?? 'Yengeç';
  }

  const messages = analysis.normalizedMessages;
  for (let i = 0; i < messages.length - 1; i += 1) {
    const current = normalizeTr(messages[i].content);
    if (/burc|burcun|burcusun/.test(current)) {
      const next = messages.slice(i + 1, i + 5).find(msg => msg.author === author && normalizedSigns.some(sign => normalizeTr(msg.content).includes(sign.key)));
      if (next) {
        const lower = normalizeTr(next.content);
        return normalizedSigns.find(sign => lower.includes(sign.key))?.sign ?? 'Yengeç';
      }
    }
  }

  return author === analysis.participants[0]?.name ? 'Yengeç' : 'Akrep';
};

const compatibilityScore = (a: string, b: string): { score: number; note: string } => {
  const one = zodiacBySign(a);
  const two = zodiacBySign(b);
  if (one.element === two.element) return { score: 92, note: `iki ${one.element} elementi · ritim kolay akıyor` };
  const pair = [one.element, two.element].sort().join('-');
  if (pair === 'Ateş-Hava') return { score: 84, note: 'Ateş + Hava · kıvılcım ve sohbet yüksek' };
  if (pair === 'Su-Toprak') return { score: 86, note: 'Su + Toprak · güven ve derinlik iyi' };
  if (pair === 'Ateş-Su') return { score: 68, note: 'Ateş + Su · tutku var, tempo ayarı ister' };
  if (pair === 'Hava-Toprak') return { score: 70, note: 'Hava + Toprak · biri akıl, biri düzen getirir' };
  return { score: 76, note: `${one.element} + ${two.element} · farklılıklar konuşunca güzelleşir` };
};

const TAROT_DECK = [
  { glyph: '♡', meaning: 'Aşıklar', color: LL.blush },
  { glyph: '☼', meaning: 'Güneş', color: LL.gold },
  { glyph: '☽', meaning: 'Ay', color: LL.lavender },
  { glyph: '✦', meaning: 'Yıldız', color: LL.mint },
  { glyph: '♢', meaning: 'Kupa', color: LL.hotPink },
  { glyph: '⌁', meaning: 'Denge', color: LL.violet },
];

const drawTarotCards = (nonce: number) => ['Geçmiş', 'Şimdi', 'Gelecek'].map((label, index) => ({
  label,
  ...TAROT_DECK[(nonce + index * 2) % TAROT_DECK.length],
}));

export const FalScreen: React.FC<FalScreenProps> = ({ analysis, onBack, relationMode = 'lover' }) => {
  const [mode, setMode] = React.useState<FalMode>('tarot');
  const [reading, setReading] = React.useState<FalReading | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [readingNonce, setReadingNonce] = React.useState(0);
  const p1 = analysis?.participants[0]?.name ?? 'Sen';
  const p2 = analysis?.participants[1]?.name ?? 'O';
  const tarotCards = React.useMemo(() => drawTarotCards(readingNonce), [readingNonce]);

  const refreshReading = React.useCallback(async (nextMode: FalMode, nextNonce: number) => {
    setLoading(true);
    try {
      const result = await generateFalReading(analysis, nextMode, relationMode, nextNonce);
      setReading(result);
    } finally {
      setLoading(false);
    }
  }, [analysis, relationMode]);

  React.useEffect(() => {
    refreshReading(mode, readingNonce);
  }, [mode, readingNonce, refreshReading]);

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

        {loading && (
          <Glass style={{ padding: 14, borderRadius: 18, marginBottom: 12, textAlign: 'center', color: LL.fgMuted, fontSize: 12 }}>
            Fal metriklere bakıyor…
          </Glass>
        )}

        {mode === 'tarot' && <TarotView reading={reading} cards={tarotCards} onRefresh={() => setReadingNonce(n => n + 1)} />}
        {mode === 'kahve' && <KahveView reading={reading} />}
        {mode === 'burc' && <BurcView p1={p1} p2={p2} analysis={analysis} reading={reading} />}
        {mode === 'el' && <ElView reading={reading} />}
      </div>
    </Screen>
  );
};

// ─── Tarot ───
interface TarotCardProps {
  label: string;
  meaning: string;
  glyph: string;
  revealed: boolean;
  onClick: () => void;
  color?: string;
}

const TarotCard: React.FC<TarotCardProps> = ({ label, meaning, glyph, revealed, onClick, color = LL.hotPink }) => (
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
      <div
        style={{
          fontSize: 9,
          color: LL.fgMuted,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 48, lineHeight: 1, color, filter: `drop-shadow(0 0 8px ${color})` }}>{glyph}</div>
      <div className="ll-serif" style={{ fontSize: 11, fontStyle: 'italic', color: LL.fg, lineHeight: 1.2 }}>
        {meaning}
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
        <div className="ll-serif" style={{ fontSize: 26, fontStyle: 'italic', color: LL.gold, opacity: 0.9 }}>
          L
        </div>
        <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 8, color: LL.gold, opacity: 0.7 }}>✦</div>
        <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, color: LL.gold, opacity: 0.7 }}>✦</div>
      </div>
    </div>
  </div>
);

const ReadingCard: React.FC<{ reading: FalReading | null }> = ({ reading }) => (
  <Glass strong style={{ padding: 16, borderRadius: 20, marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
      {reading?.title || 'Yorumum'}
    </div>
    <div className="ll-serif" style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.5, marginTop: 8 }}>
      {reading?.reading || 'Fal hazırlanıyor; sohbet ritmindeki semboller birazdan burada belirecek.'}
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

const TarotView: React.FC<{ reading: FalReading | null; cards: Array<{ label: string; glyph: string; meaning: string; color: string }>; onRefresh: () => void }> = ({ reading, cards, onRefresh }) => {
  const [rev, setRev] = React.useState<boolean[]>([true, true, false]);
  return (
    <>
      <div style={{ fontSize: 13, color: LL.fgMuted, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
        Üç kart çekildi. Geleceği görmek için <span style={{ color: LL.gold }}>son kartı çevir</span>.
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        {cards.map((c, i) => (
          <TarotCard
            key={i}
            {...c}
            revealed={rev[i]}
            onClick={() => setRev(r => r.map((x, j) => (j === i ? !x : x)))}
          />
        ))}
      </div>

      <ReadingCard reading={reading} />

      <button
        onClick={() => {
          setRev([false, false, false]);
          onRefresh();
        }}
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
const KahveView: React.FC<{ reading: FalReading | null }> = ({ reading }) => (
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
        <div style={{ position: 'absolute', top: '30%', left: '40%', fontSize: 22, color: '#3d1f0f' }}>♡</div>
        <div style={{ position: 'absolute', top: '55%', left: '20%', fontSize: 14, color: '#3d1f0f' }}>✦</div>
        <div style={{ position: 'absolute', top: '60%', left: '65%', fontSize: 18, color: '#3d1f0f' }}>☽</div>
        <div style={{ position: 'absolute', top: '40%', right: '20%', fontSize: 12, color: '#3d1f0f' }}>♥</div>
      </div>
      <Sparkle size={20} color={LL.gold} style={{ position: 'absolute', top: 20, left: 60 }} />
      <Sparkle size={14} color={LL.gold} style={{ position: 'absolute', bottom: 30, right: 50 }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
      {[
        { s: '♡', t: 'Kalp', m: 'Yakın bir aşk haberi' },
        { s: '☽', t: 'Ay', m: 'Romantik bir gece' },
        { s: '✦', t: 'Yıldız', m: 'Şans kapıda' },
        { s: '♥', t: 'Sevda', m: 'İçten bir bağ' },
      ].map(s => (
        <Glass key={s.t} style={{ padding: 14, borderRadius: 16 }}>
          <div className="ll-serif" style={{ fontSize: 22, color: LL.gold }}>
            {s.s}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{s.t}</div>
          <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 2, lineHeight: 1.3 }}>{s.m}</div>
        </Glass>
      ))}
    </div>
    <ReadingCard reading={reading} />
  </>
);

// ─── Burç ───
const BurcView: React.FC<{ p1: string; p2: string; analysis: AnalysisResult | null; reading: FalReading | null }> = ({
  p1,
  p2,
  analysis,
  reading,
}) => {
  const inferredP1 = React.useMemo(() => inferZodiac(analysis, p1), [analysis, p1]);
  const inferredP2 = React.useMemo(() => inferZodiac(analysis, p2), [analysis, p2]);
  const [signA, setSignA] = React.useState(inferredP1);
  const [signB, setSignB] = React.useState(inferredP2);

  React.useEffect(() => {
    setSignA(inferredP1);
    setSignB(inferredP2);
  }, [inferredP1, inferredP2]);

  const personSigns = [
    { name: p1, sign: zodiacBySign(signA), value: signA, set: setSignA, color: LL.lavender, inferred: inferredP1 },
    { name: p2, sign: zodiacBySign(signB), value: signB, set: setSignB, color: LL.hotPink, inferred: inferredP2 },
  ];
  const compatibility = compatibilityScore(signA, signB);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {personSigns.map(p => (
          <Glass key={p.name} strong style={{ padding: 16, borderRadius: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: LL.fgMuted }}>{p.name}</div>
            <div className="ll-serif" style={{ fontSize: 48, color: p.color, lineHeight: 1, margin: '6px 0' }}>
              {p.sign.glyph}
            </div>
            <select
              value={p.value}
              onChange={e => p.set(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid ' + LL.glassBorder,
                color: LL.fg,
                fontFamily: LL.sans,
                fontWeight: 800,
                outline: 'none',
              }}
            >
              {ZODIACS.map(zodiac => (
                <option key={zodiac.sign} value={zodiac.sign} style={{ color: LL.ink }}>
                  {zodiac.sign}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: LL.fgMuted, marginTop: 7 }}>
              {p.sign.element} · {p.sign.vibe}
              {p.inferred === p.value && analysis ? ' · sohbetten tahmin' : ''}
            </div>
          </Glass>
        ))}
      </div>
      <Glass style={{ padding: 16, borderRadius: 18, marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Uyumluluk
        </div>
        <div
          className="ll-serif"
          style={{
            fontSize: 48,
            lineHeight: 1,
            marginTop: 4,
            background: `linear-gradient(135deg, ${LL.blush}, ${LL.lavender})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          %{compatibility.score}
        </div>
        <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 4 }}>{compatibility.note}</div>
      </Glass>
      <ReadingCard reading={reading} />
    </>
  );
};

// ─── El ───
const ElView: React.FC<{ reading: FalReading | null }> = ({ reading }) => {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
    <Glass style={{ padding: 20, borderRadius: 22, marginBottom: 12, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, color: LL.fgMuted, marginBottom: 8 }}>
        {fileName ? 'Fotoğraf hazır' : 'Avucunun fotoğrafını yükle'}
      </div>
      <div
        style={{
          width: 140,
          height: 200,
          margin: '0 auto',
          borderRadius: 14,
          background: `linear-gradient(180deg, ${LL.blush}30, ${LL.violet}30)`,
          border: '1.5px dashed ' + LL.glassBorder,
          display: 'grid',
          placeItems: 'center',
          fontSize: 60,
        }}
      >
        {fileName ? '✓' : '✋'}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          marginTop: 14,
          padding: '10px 18px',
          borderRadius: 999,
          border: 'none',
          background: '#fff',
          color: LL.ink,
          fontWeight: 700,
          fontSize: 13,
          fontFamily: LL.sans,
          cursor: 'pointer',
        }}
      >
        {fileName ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      {fileName && (
        <div style={{ marginTop: 8, fontSize: 11, color: LL.gold, wordBreak: 'break-word' }}>{fileName}</div>
      )}
    </Glass>
    <Glass style={{ padding: 16, borderRadius: 18 }}>
      <div
        style={{
          fontSize: 11,
          color: LL.fgMuted,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Çizgiler ne anlatır
      </div>
      {[
        { l: 'Kalp çizgisi', t: 'derin, romantik' },
        { l: 'Aşk çizgisi', t: 'ikinci büyük aşk' },
        { l: 'Evlilik çizgisi', t: '2 belirgin' },
      ].map(c => (
        <div
          key={c.l}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid ' + LL.glassBorder,
            fontSize: 13,
          }}
        >
          <span style={{ color: LL.fgMuted }}>{c.l}</span>
          <span className="ll-serif" style={{ fontStyle: 'italic' }}>
            {c.t}
          </span>
        </div>
      ))}
    </Glass>
    <ReadingCard reading={reading} />
    </>
  );
};
