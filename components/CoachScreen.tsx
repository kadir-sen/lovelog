import React from 'react';
import { LL, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { AnalysisResult } from '../types';
import { askRelationshipCoach } from '../services/coachService';
import { RelationshipMode } from '../services/relationshipReport';

interface CoachScreenProps {
  analysis: AnalysisResult | null;
  onBack: () => void;
  relationMode?: RelationshipMode;
  viewerName?: string | null;
}

interface ChatMessage {
  id: number;
  side: 'left' | 'right';
  body: React.ReactNode;
}

const SUGGESTED = ['ayrılalım mı?', 'nasıl barışırım?', 'şu gün neden soğuktu?', 'ne yazmalıyım?'];
const QUICK_REPLIES = ['ben attım', 'o attı', 'kimse atmadı', 'hatırlamıyorum'];

const ChatBubble: React.FC<{ side: 'left' | 'right'; children: React.ReactNode }> = ({ side, children }) => {
  const isLeft = side === 'left';
  const content = typeof children === 'string'
    ? (
      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {children}
      </div>
    )
    : children;
  return (
    <div style={{ display: 'flex', justifyContent: isLeft ? 'flex-start' : 'flex-end' }}>
      <div
        className="ll-fade-in"
        style={{
          maxWidth: '78%',
          padding: '12px 16px',
          borderRadius: isLeft ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
          background: isLeft ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
          border: '1px solid ' + LL.glassBorder,
          backdropFilter: isLeft ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: isLeft ? 'blur(20px)' : 'none',
          fontSize: 13.5,
          lineHeight: 1.45,
          color: LL.fg,
          boxShadow: isLeft ? 'none' : `0 6px 20px ${LL.hotPink}40`,
          overflow: 'visible',
        }}
      >
        {content}
      </div>
    </div>
  );
};

export const CoachScreen: React.FC<CoachScreenProps> = ({ analysis, onBack, relationMode = 'lover', viewerName }) => {
  const [localViewerName, setLocalViewerName] = React.useState(viewerName ?? '');
  const activeViewerName = viewerName || localViewerName;
  const p1 = analysis?.participants[0]?.name ?? 'sen';
  const p2 = analysis?.participants[1]?.name ?? 'partner';
  const intro = React.useMemo<ChatMessage[]>(() => {
    if (!analysis) {
      return [
        {
          id: 1,
      side: 'left',
      body: relationMode === 'friend'
        ? 'Zeyno burada ama arkadaşlık analizini görmeden spesifik gün/mesaj okuyamam. Önce WhatsApp sohbetini yükle, sonra kanka dinamiğine gün gün bakarız.'
        : 'Kanka ben buradayım ama sohbet analizini görmeden spesifik gün/mesaj okuyamam. Önce bir sohbet yükle, sonra hem özet ritme hem de sorduğun güne bakıp konuşalım.',
        },
      ];
    }

    const tension = analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy;
    const love = analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks;
    const firstNote = relationMode === 'friend'
      ? 'Bunu romantik ilişki gibi okumuyorum; destek, iç şaka, drama ve karşılıklılık ayrı ayrı bakılacak. Spesifik günü sorarsan oraya ineriz.'
      : tension > love * 0.45
      ? 'İlk bakışta tatlı sinyaller var ama bazı kaos izleri de göz kırpıyor. Kanka ben burada biraz korumacı moda geçerim.'
      : 'İlk bakışta ritim tamamen karanlık değil; tatlı sinyaller daha görünür. Ama spesifik bir günü sorarsan oraya ineriz.';

    return [
      {
        id: 1,
        side: 'left',
        body: `Selam ${activeViewerName || p1}. ${p2} ile ${relationMode === 'friend' ? 'arkadaşlık' : 'sohbet'} özetini okudum; toplam ${analysis.totalMessages.toLocaleString('tr-TR')} mesaj üzerinden konuşabiliriz.`,
      },
      {
        id: 2,
        side: 'left',
        body: (
          <>
            <div className="ll-serif" style={{ fontSize: 14, fontStyle: 'italic', color: LL.gold, marginBottom: 4 }}>
              İlk gözlemim:
            </div>
            {firstNote}
          </>
        ),
      },
    ];
  }, [analysis, activeViewerName, p1, p2, relationMode]);

  const [messages, setMessages] = React.useState<ChatMessage[]>(intro);
  const [input, setInput] = React.useState('');
  const [showQuickReplies, setShowQuickReplies] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMessages(intro);
    setShowQuickReplies(true);
  }, [intro]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now(), side: 'right', body: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowQuickReplies(false);
    setLoading(true);

    try {
      const replyText = await askRelationshipCoach(analysis, text, relationMode, activeViewerName);
      const reply: ChatMessage = { id: Date.now() + 1, side: 'left', body: replyText };
      setMessages(prev => [...prev, reply]);
    } finally {
      setLoading(false);
    }
  };

  if (analysis && !activeViewerName) {
    return (
      <Screen scroll={false} starDensity={50}>
        <div style={{ minHeight: '100dvh', padding: '20px 20px calc(112px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <Glass
              onClick={onBack}
              style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              ‹
            </Glass>
            <div style={{ fontSize: 13, color: LL.fgMuted, fontWeight: 700 }}>{relationMode === 'friend' ? 'Zeyno' : 'Luna'}</div>
            <div style={{ width: 36 }} />
          </div>
          <div style={{ marginTop: 'auto', marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: LL.gold, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase' }}>
              Koça başlamadan
            </div>
            <h1 className="ll-serif" style={{ fontSize: 34, fontStyle: 'italic', lineHeight: 1.08, margin: '8px 0 10px' }}>
              Bu sohbette sen hangi kişisin?
            </h1>
            <p style={{ fontSize: 13, color: LL.fgMuted, lineHeight: 1.5 }}>
              Cevapları senin tarafından kurayım; spesifik gün/mesaj sorunca da bağlamı ona göre okuyayım.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 'auto' }}>
            {analysis.participants.slice(0, 2).map(person => (
              <Glass
                key={person.name}
                strong
                hover
                onClick={() => setLocalViewerName(person.name)}
                style={{ padding: 16, borderRadius: 20, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div className="ll-serif" style={{ fontSize: 23, fontStyle: 'italic' }}>{person.name}</div>
                    <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2 }}>{person.messageCount.toLocaleString('tr-TR')} mesaj</div>
                  </div>
                  <div style={{ width: 42, height: 42, borderRadius: 16, background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`, display: 'grid', placeItems: 'center', fontFamily: LL.serif, fontSize: 18 }}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                </div>
              </Glass>
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} starDensity={50}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          paddingBottom: 'calc(92px + env(safe-area-inset-bottom))',
          overflow: 'hidden',
        }}
      >
        {/* Nav */}
        <div
          style={{
            padding: '20px 20px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Glass
            onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}
          >
            ‹
          </Glass>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 14,
              }}
            >
              ☽
            </div>
            <div>
              <div className="ll-serif" style={{ fontSize: 14, fontStyle: 'italic' }}>
                {relationMode === 'friend' ? 'Zeyno' : 'Luna'}
              </div>
              <div style={{ fontSize: 9, color: LL.mint }}>● {relationMode === 'friend' ? 'kanka koçun' : 'ilişki koçun'}</div>
            </div>
          </div>
          <Glass style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>⋯</Glass>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px 20px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: LL.fgDim,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              margin: '4px 0',
            }}
          >
            Bugün
          </div>

          {messages.map(m => (
            <ChatBubble key={m.id} side={m.side}>
              {m.body}
            </ChatBubble>
          ))}

          {loading && (
            <ChatBubble side="left">
              {relationMode === 'friend' ? 'Zeyno' : 'Luna'} metriklere ve ilgili günlere bakıyor…
            </ChatBubble>
          )}

          {showQuickReplies && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {QUICK_REPLIES.map(c => (
                <button
                  key={c}
                  onClick={() => sendMessage(c)}
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid ' + LL.glassBorder,
                    color: LL.fg,
                    cursor: 'pointer',
                    fontFamily: LL.sans,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Suggested */}
        <div
          style={{
            padding: '4px 20px 8px',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {SUGGESTED.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 600,
                background: `linear-gradient(135deg, ${LL.hotPink}25, ${LL.violet}25)`,
                border: '1px solid ' + LL.glassBorder,
                color: LL.fg,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                fontFamily: LL.sans,
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input (sits above tab bar) */}
        <div style={{ padding: '8px 16px 12px', flexShrink: 0 }}>
          <Glass
            strong
            style={{ padding: '8px 8px 8px 18px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !loading) sendMessage(input);
              }}
              placeholder={relationMode === 'friend' ? "Zeyno'ya tea ver…" : "Luna'ya bir şey sor…"}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: LL.fg,
                fontSize: 14,
                fontFamily: LL.sans,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
                display: 'grid',
                placeItems: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                boxShadow: `0 4px 12px ${LL.hotPink}50`,
                opacity: loading ? 0.55 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                <path d="M3 11l18-8-8 18-2-8-8-2z" />
              </svg>
            </button>
          </Glass>
        </div>
      </div>
    </Screen>
  );
};
