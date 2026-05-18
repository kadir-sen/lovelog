import React from 'react';
import { LL, Sparkle, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { AnalysisResult } from '../types';
import { RelationMode } from './RelationSelectScreen';
import { SavedChatsCard } from './SavedChatsCard';
import { ShareButton } from './ShareButton';
import type { SavedChatSummary } from '../services/apiClient';

interface HomeScreenProps {
  analysis: AnalysisResult | null;
  onUpload: () => void;
  onOpenAnalysis: () => void;
  onOpenFal: () => void;
  onStartDemo?: () => void;
  onOpenQuiz?: () => void;
  onOpenWrapped?: () => void;
  isDemo?: boolean;
  relationMode?: RelationMode;
  savedChats?: SavedChatSummary[];
  savedChatsLoading?: boolean;
  onOpenSavedChat?: (id: string) => void;
  onDeleteSavedChat?: (id: string) => void;
}

const computeLoveScore = (a: AnalysisResult): number => {
  const total = a.totalMessages || 1;
  const love = a.nlpSignals.totals.loveAdjusted || 0;
  const tension = a.nlpSignals.totals.tensionAdjusted || 0;
  const harsh = a.nlpSignals.totals.harshAdjusted || 0;
  const positive = (love / total) * 600;
  const negative = ((tension + harsh) / total) * 200;
  const raw = 60 + positive - negative;
  return Math.max(20, Math.min(99, Math.round(raw)));
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  analysis,
  onUpload,
  onOpenAnalysis,
  onOpenFal,
  onStartDemo,
  onOpenQuiz,
  onOpenWrapped,
  isDemo = false,
  relationMode = 'lover',
  savedChats = [],
  savedChatsLoading = false,
  onOpenSavedChat,
  onDeleteSavedChat,
}) => {
  const p1 = analysis?.participants[0];
  const p2 = analysis?.participants[1] ?? p1;
  const score = analysis ? computeLoveScore(analysis) : null;
  const dateRange = analysis
    ? `${analysis.totalMessages.toLocaleString()} mesaj`
    : null;

  const greetingName = p1?.name ?? 'Sen';
  const initial = greetingName.charAt(0).toUpperCase();

  return (
    <Screen withTabBar starDensity={70}>
      <div style={{ padding: '24px 20px 24px' }}>
        {/* Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, color: LL.fgMuted }}>
              {getGreeting()}, {greetingName} ✨
            </div>
            <h1
              className="ll-serif"
              style={{
                fontSize: 30,
                fontStyle: 'italic',
                fontWeight: 400,
                margin: '4px 0 0',
                letterSpacing: -0.3,
              }}
            >
              Bugün ne keşfedelim?
            </h1>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
              display: 'grid',
              placeItems: 'center',
              fontFamily: LL.serif,
              fontWeight: 600,
              fontSize: 18,
            }}
          >
            {initial}
          </div>
        </div>

        {/* Last analysis card */}
        {analysis && score !== null ? (
          <Glass strong hover onClick={onOpenAnalysis} style={{ padding: 0, marginBottom: 18, overflow: 'hidden' }}>
            <div
              style={{
                padding: 20,
                position: 'relative',
                background: `linear-gradient(135deg, ${LL.hotPink}30, ${LL.violet}30)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(${LL.gold}40, transparent 70%)`,
                  filter: 'blur(8px)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: LL.fgMuted,
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Son analiz
                  </div>
                  <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 4 }}>
                    {p1?.name} & {p2?.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: LL.fgMuted }}>{dateRange}</div>
                  <div style={{ fontSize: 11, color: LL.gold, marginTop: 2 }}>● aktif</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 18 }}>
                <div
                  className="ll-serif"
                  style={{
                    fontSize: 64,
                    fontWeight: 400,
                    lineHeight: 1,
                    background: `linear-gradient(135deg, ${LL.blush}, ${LL.lavender})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {score}
                </div>
                <div style={{ fontSize: 18, color: LL.fgMuted }}>/100</div>
                <div
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: `${LL.mint}20`,
                    color: LL.mint,
                    fontWeight: 600,
                  }}
                >
                  {relationMode === 'friend'
                    ? score >= 80
                      ? 'bestie enerjisi'
                      : score >= 60
                      ? 'iyi vibe'
                      : 'konuşmak gerek'
                    : score >= 80
                    ? 'çok uyumlu'
                    : score >= 60
                    ? 'sıcak'
                    : 'inceleme gerek'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                {[
                  { l: relationMode === 'friend' ? 'Vibe' : 'Aşk', v: Math.min(99, score + 5), c: LL.hotPink },
                  { l: 'İletişim', v: Math.max(40, score - 9), c: LL.lavender },
                  { l: relationMode === 'friend' ? 'Destek' : 'Güven', v: Math.max(40, score - 2), c: LL.gold },
                  { l: relationMode === 'friend' ? 'Drama' : 'Tutku', v: Math.min(99, score + 3), c: LL.blush },
                ].map(b => (
                  <div key={b.l} style={{ flex: 1 }}>
                    <div
                      style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}
                    >
                      <div style={{ height: '100%', width: b.v + '%', background: b.c, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: LL.fgMuted, marginTop: 4, fontWeight: 500 }}>{b.l}</div>
                  </div>
                ))}
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}
              >
                <ShareButton
                  compact
                  variant="score"
                  surface="home_hero"
                  pillar={1}
                  data={{
                    names: [p1?.name ?? 'A', p2?.name ?? 'B'],
                    anonymize: true,
                    dateLabel: analysis
                      ? `${new Date(analysis.dateRange.start).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })} – ${new Date(analysis.dateRange.end).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}`
                      : undefined,
                    payload: {
                      score,
                      totalMessages: analysis?.totalMessages ?? 0,
                      modeLabel: relationMode === 'friend' ? 'bestie skoru' : 'aşk skoru',
                    },
                  }}
                />
              </div>
            </div>
          </Glass>
        ) : null}

        {analysis && onOpenWrapped && (
          <Glass
            hover
            onClick={onOpenWrapped}
            style={{
              padding: 0,
              marginBottom: 18,
              overflow: 'hidden',
              borderRadius: 22,
            }}
          >
            <div
              style={{
                padding: 18,
                position: 'relative',
                background: `linear-gradient(135deg, ${LL.amethyst}55, ${LL.violet}55)`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -30,
                  left: -30,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${LL.hotPink}55, transparent 70%)`,
                  filter: 'blur(20px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -20,
                  right: -10,
                  fontSize: 96,
                  opacity: 0.18,
                  lineHeight: 1,
                }}
              >
                🎁
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: LL.gold,
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}
                >
                  {new Date(analysis.dateRange.end).getFullYear()} Wrapped
                </div>
                <div
                  className="ll-serif"
                  style={{
                    fontSize: 22,
                    fontStyle: 'italic',
                    marginTop: 6,
                    lineHeight: 1.2,
                    maxWidth: 280,
                  }}
                >
                  Yılın hikâyesini birlikte kaydır
                </div>
                <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>
                  En sıcak ay, yılın emojisi, ritüelleriniz — bir Story gibi.
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: '#fff',
                    color: LL.ink,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Wrapped'ı aç →
                </div>
              </div>
            </div>
          </Glass>
        )}

        {!analysis && (
          <>
            <Glass strong hover onClick={onUpload} style={{ padding: 22, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${LL.hotPink}55, transparent 70%)`,
                  filter: 'blur(20px)',
                }}
              />
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: LL.gold,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                  }}
                >
                  İlk adım
                </div>
                <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 6, lineHeight: 1.2 }}>
                  Sohbetini yükle, yıldızlar konuşsun ✨
                </div>
                <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 8, lineHeight: 1.5 }}>
                  Sadece WhatsApp .txt dışa aktarımını seç, gerisini bize bırak.
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    borderRadius: 999,
                    background: '#fff',
                    color: LL.ink,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Sohbet yükle →
                </div>
              </div>
            </Glass>
            {onStartDemo && (
              <Glass
                hover
                onClick={onStartDemo}
                style={{
                  padding: 14,
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 16,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: `${LL.lavender}25`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    fontSize: 16,
                  }}
                >
                  ✦
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: LL.lavender, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Önce demo'yu gör
                  </div>
                  <div style={{ fontSize: 13, color: LL.fg, fontWeight: 500, marginTop: 2 }}>
                    Ali &amp; Burcu örnek raporu — 30 saniye
                  </div>
                </div>
                <div style={{ color: LL.fgMuted, fontSize: 18 }}>›</div>
              </Glass>
            )}
          </>
        )}

        {/* Kayıtlı sohbetler — birden fazla yükleme için */}
        {onOpenSavedChat && onDeleteSavedChat && (
          <SavedChatsCard
            chats={savedChats}
            loading={savedChatsLoading}
            onOpen={onOpenSavedChat}
            onDelete={onDeleteSavedChat}
          />
        )}

        {/* Quick actions */}
        <div
          style={{
            fontSize: 11,
            color: LL.fgMuted,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Bugün senin için
        </div>
        <div style={{ marginBottom: 18, display: 'grid', gap: 10, gridTemplateColumns: onOpenQuiz ? '1fr 1fr' : '1fr' }}>
          {onOpenQuiz && (
            <Glass hover onClick={onOpenQuiz} style={{ padding: 16, position: 'relative', overflow: 'hidden', minHeight: 110 }}>
              <div style={{ position: 'absolute', bottom: -10, right: -10, fontSize: 56, opacity: 0.22 }}>✦</div>
              <div style={{ fontSize: 11, color: LL.lavender, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                2 dk
              </div>
              <div className="ll-serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 6, lineHeight: 1.1 }}>
                Bağlanma stilin?
              </div>
              <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 8 }}>
                kısa quiz
              </div>
            </Glass>
          )}
          <Glass hover onClick={onOpenFal} style={{ padding: 16, position: 'relative', overflow: 'hidden', minHeight: 110 }}>
            <div style={{ position: 'absolute', bottom: -10, right: -10, fontSize: 60, opacity: 0.25 }}>☾</div>
            <div
              style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}
            >
              Yeni
            </div>
            <div className="ll-serif" style={{ fontSize: 18, fontStyle: 'italic', marginTop: 6, lineHeight: 1.1 }}>
              {relationMode === 'friend' ? 'Arkadaşlık' : 'Bugünün'} Falı
            </div>
            <div style={{ fontSize: 11, color: LL.fgMuted, marginTop: 8 }}>
              {relationMode === 'friend' ? 'vibe açılımı' : '3 kart çek'}
            </div>
          </Glass>
        </div>

        {/* Daily insight */}
        <Glass style={{ padding: 16, borderRadius: 20, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: `${LL.gold}25`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkle size={16} color={LL.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  color: LL.gold,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Günün enerjisi
              </div>
              <div className="ll-serif" style={{ fontSize: 15, fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 }}>
                {relationMode === 'friend'
                  ? '"Bugün kanka enerjisi netlik istiyor. İçine attığını tatlı ama açık söyle."'
                  : '"Bugün Venüs sana cesaret veriyor. Kalbindekini söyle 💌"'}
              </div>
            </div>
          </div>
        </Glass>

        {/* Upload new */}
        <button
          onClick={onUpload}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 18,
            border: '1px solid ' + LL.glassBorder,
            background: 'rgba(255,255,255,0.06)',
            color: LL.fg,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: LL.sans,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          ✦ Yeni sohbet yükle
        </button>

        {/* History (optional) */}
        {analysis && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: LL.fgMuted,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                Bu analizden
              </div>
              <div style={{ fontSize: 12, color: LL.lavender, fontWeight: 600 }}>{analysis.totalMessages}</div>
            </div>
            <Glass style={{ padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, borderRadius: 16 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 18,
                }}
              >
                💌
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {p1?.name} & {p2?.name}
                </div>
                <div style={{ fontSize: 11, color: LL.fgMuted }}>
                  {new Date(analysis.dateRange.start).toLocaleDateString('tr-TR')} →{' '}
                  {new Date(analysis.dateRange.end).toLocaleDateString('tr-TR')}
                </div>
              </div>
              <div className="ll-serif" style={{ fontSize: 22 }}>
                {score}
              </div>
            </Glass>
          </>
        )}
      </div>
    </Screen>
  );
};
