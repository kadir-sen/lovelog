import React from 'react';
import { LL, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { AnalysisResult, CoachChatTurn } from '../types';
import { askRelationshipCoachStream, suggestQuickReplies } from '../services/coachService';
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

const SUGGESTED_LOVER = ['ayrılalım mı?', 'nasıl barışırım?', 'şu gün neden soğuktu?', 'ne yazmalıyım?'];
const SUGGESTED_FRIEND = ['trip mi atıyor?', 'hep ben mi yazıyorum?', 'neden dışlanmış hissettim?', 'ne yazmalıyım?'];

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

    const totals = analysis.nlpSignals.totals;
    const total = analysis.totalMessages || 1;
    const MIN_SAMPLE = 80;
    const tensionRate = (totals.tensionAdjusted + totals.harshAdjusted + totals.jealousy) / total;
    const loveRate = (totals.loveAdjusted + totals.emotional + totals.thanks) / total;

    let firstNote: string;
    if (relationMode === 'friend') {
      firstNote = 'Bunu romantik ilişki gibi okumuyorum; destek, iç şaka, drama ve karşılıklılık ayrı ayrı bakılacak. Spesifik günü sorarsan oraya ineriz.';
    } else if (total < MIN_SAMPLE) {
      firstNote = 'Mesaj sayısı henüz az, tablo netleşmemiş. Spesifik bir gün veya soru ile başlayalım, oradan büyütürüz.';
    } else if (tensionRate > 0.08 && tensionRate > loveRate * 0.6) {
      firstNote = 'İlk bakışta tatlı sinyaller var ama gerilim oranı yüksek — burada korumacı modda konuşurum, gerek yoksa ben yumuşatırım.';
    } else if (loveRate > 0.12 && tensionRate < loveRate * 0.4) {
      firstNote = 'İlk okumada sıcak sinyaller baskın. Yine de spesifik günü sorarsan oraya ineriz, her ilişkide kör nokta vardır.';
    } else {
      firstNote = 'İlk okumada karışık bir tablo — hem sıcaklık hem gerilim var. Spesifik günü sorarsan oraya ineriz.';
    }

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
  const [coachTurns, setCoachTurns] = React.useState<CoachChatTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [dynamicReplies, setDynamicReplies] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inFlightRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setMessages(intro);
    setCoachTurns([]);
    setDynamicReplies([]);
  }, [intro]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => () => inFlightRef.current?.abort(), []);

  const sendMessage = async (text: string, queryOverride?: string) => {
    if (!text.trim()) return;
    if (inFlightRef.current) return; // in-flight guard: çift gönderim ve StrictMode 2x çağrısını engeller
    const ac = new AbortController();
    inFlightRef.current = ac;

    const userMsg: ChatMessage = { id: Date.now(), side: 'right', body: text };
    const query = (queryOverride || text).trim();
    const nextTurns: CoachChatTurn[] = [...coachTurns, { role: 'user', content: query }].slice(-10);
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setDynamicReplies([]);
    setLoading(true);

    const collectedBubbles: string[] = [];
    let detectedIntent: string | undefined;

    try {
      for await (const event of askRelationshipCoachStream(analysis, query, relationMode, activeViewerName, nextTurns, ac.signal)) {
        if (ac.signal.aborted) break;
        if (event.type === 'intent') {
          detectedIntent = event.intent;
        } else if (event.type === 'bubble' && event.text) {
          const bubbleText = event.text;
          collectedBubbles.push(bubbleText);
          setMessages(prev => [...prev, { id: Date.now() + Math.random(), side: 'left', body: bubbleText }]);
        }
      }

      if (ac.signal.aborted) return;

      const fullReply = collectedBubbles.join('\n\n');
      const lastUserTurn = nextTurns[nextTurns.length - 1];
      const taggedUserTurn: CoachChatTurn = { ...lastUserTurn, intent: detectedIntent };
      const assistantTurn: CoachChatTurn = { role: 'assistant', content: fullReply, intent: detectedIntent };
      setCoachTurns([...nextTurns.slice(0, -1), taggedUserTurn, assistantTurn].slice(-10));

      const recent = analysis?.normalizedMessages.slice(-6).map(m => ({
        date: m.dateKey,
        speaker: m.author,
        text: m.content,
      })) ?? [];
      suggestQuickReplies(query, fullReply, recent, ac.signal).then(setDynamicReplies).catch(() => {});
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        console.error('coach send failed:', err);
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), side: 'left', body: 'Bağlantıda gecikme oldu, tekrar dener misin?' }]);
      }
    } finally {
      if (inFlightRef.current === ac) inFlightRef.current = null;
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

          {!loading && dynamicReplies.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {dynamicReplies.map(c => (
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
          {(relationMode === 'friend' ? SUGGESTED_FRIEND : SUGGESTED_LOVER).map(q => (
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
