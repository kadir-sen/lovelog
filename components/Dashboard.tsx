import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalysisResult, BehavioralPattern, GeminiInsight } from '../types';
import { generateRelationshipInsights } from '../services/geminiService';
import { buildRelationshipReport, CalendarDayReport, RelationshipMode, RelationshipReport } from '../services/relationshipReport';
import { LL, Glass, Heart, Sparkle } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';

interface DashboardProps {
  analysis: AnalysisResult;
  reset: () => void;
  onBack: () => void;
  onOpenFal: () => void;
  relationMode?: RelationshipMode;
  viewerName?: string | null;
}

type InsightMode = 'love' | 'chaos';

const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR');

const formatDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

const formatRange = (start: Date, end: Date): string => `${formatDate(start)} - ${formatDate(end)}`;

const formatMinutes = (minutes: number): string => {
  if (!minutes) return 'veri yok';
  if (minutes < 1) return '<1 dk';
  if (minutes < 60) return `${Math.round(minutes)} dk`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} saat`;
  return `${(hours / 24).toFixed(1)} gün`;
};

const computeLoveScore = (a: AnalysisResult): number => {
  const total = a.totalMessages || 1;
  const love = a.nlpSignals.totals.loveAdjusted || 0;
  const tension = a.nlpSignals.totals.tensionAdjusted || 0;
  const harsh = a.nlpSignals.totals.harshAdjusted || 0;
  const positive = (love / total) * 600;
  const negative = ((tension + harsh) / total) * 200;
  return Math.max(20, Math.min(99, Math.round(60 + positive - negative)));
};

const computeFriendScore = (a: AnalysisResult): number => {
  const total = a.totalMessages || 1;
  const support = a.nlpSignals.totals.thanks + a.nlpSignals.totals.apology + a.nlpSignals.totals.planning + a.nlpSignals.totals.future;
  const fun = a.nlpSignals.totals.playfulMessages + a.emojiAnalysis
    .filter(e => ['😂', '🤣', '😅', '😁', '😄', '😆'].includes(e.char))
    .reduce((sum, e) => sum + e.count, 0);
  const drama = a.nlpSignals.totals.tensionAdjusted + a.nlpSignals.totals.harshAdjusted + a.nlpSignals.totals.shortReplies * 0.25;
  return Math.max(20, Math.min(99, Math.round(62 + ((support + fun) / total) * 520 - (drama / total) * 180)));
};

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(31, 13, 54, 0.94)',
  color: LL.fg,
  boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
};

const SectionTitle: React.FC<{ eyebrow?: string; title: string; action?: React.ReactNode }> = ({ eyebrow, title, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, margin: '22px 0 10px' }}>
    <div>
      {eyebrow && (
        <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          {eyebrow}
        </div>
      )}
      <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.15 }}>
        {title}
      </div>
    </div>
    {action}
  </div>
);

const MiniMetric: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = LL.fg }) => (
  <Glass style={{ padding: 12, borderRadius: 16, minHeight: 78 }}>
    <div style={{ fontSize: 10, color: LL.fgDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
    <div className="ll-serif" style={{ fontSize: 22, marginTop: 6, color: tone, lineHeight: 1.05 }}>
      {value}
    </div>
  </Glass>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: 18, color: LL.fgMuted, fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>{text}</div>
);

const ModeToggle: React.FC<{ mode: InsightMode; setMode: (mode: InsightMode) => void }> = ({ mode, setMode }) => (
  <Glass style={{ padding: 4, borderRadius: 999, display: 'flex', gap: 4 }}>
    {[
      { id: 'love' as const, label: 'Aşk Modu' },
      { id: 'chaos' as const, label: 'Kaos Modu' },
    ].map(item => {
      const on = mode === item.id;
      return (
        <button
          key={item.id}
          onClick={() => setMode(item.id)}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '9px 13px',
            background: on
              ? item.id === 'love'
                ? `linear-gradient(135deg, ${LL.hotPink}, ${LL.violet})`
                : `linear-gradient(135deg, ${LL.red}, ${LL.amethyst})`
              : 'transparent',
            color: on ? '#fff' : LL.fgMuted,
            fontSize: 12,
            fontWeight: 800,
            fontFamily: LL.sans,
            cursor: 'pointer',
          }}
        >
          {item.label}
        </button>
      );
    })}
  </Glass>
);

const HeroSummary: React.FC<{ report: RelationshipReport; score: number; relationMode: RelationshipMode; onPrint: () => void; reset: () => void; onBack: () => void }> = ({
  report,
  score,
  relationMode,
  onPrint,
  reset,
  onBack,
}) => (
  <>
    <div className="ll-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
      <Glass onClick={onBack} style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>
        ‹
      </Glass>
      <div style={{ textAlign: 'center' }}>
        <div className="ll-serif" style={{ fontSize: 17, fontStyle: 'italic' }}>
          LoveLog
        </div>
        <div style={{ fontSize: 10, color: LL.fgMuted }}>{report.couple.personAName} & {report.couple.personBName}</div>
      </div>
      <Glass onClick={reset} style={{ width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center' }}>
        ↻
      </Glass>
    </div>

    <Glass
      strong
      style={{
        padding: 20,
        borderRadius: 24,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${LL.hotPink}28, ${LL.violet}20)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {relationMode === 'friend' ? 'Arkadaşlık Hacmi' : 'İlişki Hacmi'}
          </div>
          <div className="ll-serif" style={{ fontSize: 58, lineHeight: 1, marginTop: 6 }}>
            {fmt(report.overview.totalMessages)}
          </div>
          <div style={{ color: LL.fgMuted, fontSize: 12, marginTop: 4 }}>Toplam mesaj</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 86 }}>
          <div className="ll-serif" style={{ fontSize: 40, lineHeight: 1, color: LL.blush }}>{score}</div>
          <div style={{ color: LL.fgMuted, fontSize: 11 }}>
            /100 {relationMode === 'friend' ? 'bestie skoru' : 'aşk skoru'}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
        <MiniMetric label="Dönem" value={formatRange(report.overview.dateRange.start, report.overview.dateRange.end)} tone={LL.lavender} />
        <MiniMetric label="Kelime" value={fmt(report.overview.totalWords)} tone={LL.blush} />
        <MiniMetric label="Aktif gün" value={fmt(report.overview.activeDays)} tone={LL.mint} />
        <MiniMetric label="Günlük ort." value={fmt(report.overview.averageMessagesPerDay)} tone={LL.gold} />
      </div>
      <div className="ll-no-print" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="ll-action" onClick={onPrint}>Raporu indir</button>
        <button className="ll-action ll-action-ghost" onClick={reset}>Yenisini yükle</button>
      </div>
    </Glass>
  </>
);

const AiSummary: React.FC<{ report: RelationshipReport; aiInsight: GeminiInsight | null; loading: boolean; mode: InsightMode; setMode: (mode: InsightMode) => void; relationMode: RelationshipMode }> = ({
  report,
  aiInsight,
  loading,
  mode,
  setMode,
  relationMode,
}) => {
  const body = mode === 'love'
    ? aiInsight?.summary || report.overview.aiSummary
    : aiInsight?.negativeSummary || `${report.timeline.chaoticPeriod?.description || 'Kaos sinyali düşük.'} Bu bölüm eğlenceli bir ritim okumasıdır; kesin hüküm değildir.`;
  return (
    <Glass strong style={{ padding: 18, borderRadius: 22, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Yapay Zeka Özeti
          </div>
          <div style={{ fontSize: 11, color: LL.fgDim, marginTop: 2 }}>Sohbet ritminin kısa yorumu.</div>
        </div>
        {relationMode === 'friend' ? (
          <Glass style={{ padding: '8px 12px', borderRadius: 999, fontSize: 11, color: LL.gold, fontWeight: 800 }}>
            Arkadaş NLP
          </Glass>
        ) : (
          <ModeToggle mode={mode} setMode={setMode} />
        )}
      </div>
      <div className="ll-serif" style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.55 }}>
        {loading ? 'Yıldızlar metrikleri yorumluyor…' : body}
      </div>
    </Glass>
  );
};

const ProfileCards: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
    {Object.values(report.profiles).map((profile, index) => (
      <Glass key={profile.title} style={{ padding: 14, borderRadius: 18, minHeight: 150 }}>
        <div style={{ fontSize: 10, color: [LL.blush, LL.gold, LL.mint][index], fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {profile.title}
        </div>
        <div className="ll-serif" style={{ fontSize: 23, fontStyle: 'italic', marginTop: 8, lineHeight: 1.1 }}>
          {profile.winner}
        </div>
        <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 12 }}>
          <div style={{ width: `${Math.min(100, Math.max(12, profile.score))}%`, height: '100%', background: [LL.blush, LL.gold, LL.mint][index] }} />
        </div>
        <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.35, marginTop: 10 }}>{profile.description}</div>
      </Glass>
    ))}
  </div>
);

const ViewerStrengths: React.FC<{ report: RelationshipReport; viewerName: string; relationMode: RelationshipMode }> = ({
  report,
  viewerName,
  relationMode,
}) => {
  const isA = viewerName === report.couple.personAName;
  const viewer = isA ? report.people.personA : report.people.personB;
  const other = isA ? report.people.personB : report.people.personA;
  const messageShare = report.overview.totalMessages ? Math.round((viewer.messageCount / report.overview.totalMessages) * 100) : 0;
  const viewerQuestionRate = Math.round(viewer.questionRate);
  const viewerLoveRate = Number(viewer.loveSignalRate.toFixed(1));
  const cards = relationMode === 'friend'
    ? [
        {
          label: 'Sohbet sıcaklığı',
          value: `%${messageShare}`,
          text: `${viewer.name}, konuşmanın ${messageShare}%'lik kısmında görünür. Destek, plan ve karşılıklılık sinyalleri bu ritmin güçlü tarafını anlatıyor.`,
          tone: LL.blush,
        },
        {
          label: 'Destek dili',
          value: fmt(viewer.conversationStarts),
          text: `${viewer.conversationStarts} kez sohbet başlatma, bağ kopmasın diye küçük temaslar kuran bir iletişim diline işaret ediyor.`,
          tone: LL.gold,
        },
        {
          label: 'İnce ayar',
          value: formatMinutes(viewer.averageResponseTime),
          text: `${other.name} ile ritimdeki farklar okunurken emek, özen ve karşılık sinyalleri birlikte değerlendiriliyor.`,
          tone: LL.mint,
        },
      ]
    : [
        {
          label: 'Sıcak temas',
          value: `%${messageShare}`,
          text: `${viewer.name}, konuşmanın ${messageShare}%'lik kısmında yer alıyor. Bu hacim, ilişki ritmini canlı tutan temas enerjisini gösteriyor.`,
          tone: LL.blush,
        },
        {
          label: 'Sevgi dili',
          value: `%${viewerLoveRate}`,
          text: `Sevgi kelimeleri, kalp/öpücük emojileri ve duygu ifadeleri ${viewerLoveRate}% oranında sıcak bir iz bırakıyor.`,
          tone: LL.hotPink,
        },
        {
          label: 'Merak ve ilgi',
          value: `%${viewerQuestionRate}`,
          text: `${viewerQuestionRate}% soru oranı ve ${viewer.conversationStarts} sohbet başlatma, ilişkiye merak ve devamlılık katan tarafı görünür yapıyor.`,
          tone: LL.gold,
        },
      ];

  return (
    <Glass strong style={{ padding: 16, borderRadius: 22, marginTop: 12, background: `linear-gradient(135deg, ${LL.hotPink}18, ${LL.gold}12)` }}>
      <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase' }}>
        Ritmi güzelleştiren taraflar
      </div>
      <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', marginTop: 4 }}>
        İlişkide iyi çalışan sinyaller burada parlıyor.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        {cards.map(card => (
          <div key={card.label} style={{ padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.055)' }}>
            <div style={{ fontSize: 10, color: card.tone, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{card.label}</div>
            <div className="ll-serif" style={{ fontSize: 26, marginTop: 4, color: card.tone }}>{card.value}</div>
            <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.4, marginTop: 4 }}>{card.text}</div>
          </div>
        ))}
      </div>
    </Glass>
  );
};

const DeepAnalysis: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <Glass strong style={{ padding: 16, borderRadius: 22 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 14, display: 'grid', placeItems: 'center', background: `${LL.mint}25` }}>⌁</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Derin Analiz</div>
        <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.45, marginTop: 3 }}>
          {report.privacy.note}
        </div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
      {Object.values(report.deepAnalysis).map(metric => (
        <div key={metric.label} style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.055)', minHeight: 108 }}>
          <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, textTransform: 'uppercase' }}>{metric.label}</div>
          <div className="ll-serif" style={{ fontSize: 24, marginTop: 4 }}>{metric.value}</div>
          <div style={{ fontSize: 10.5, color: LL.fgMuted, lineHeight: 1.3, marginTop: 5 }}>{metric.description}</div>
        </div>
      ))}
    </div>
  </Glass>
);

const severityTone = (severity: number): string => {
  if (severity >= 0.66) return LL.red;
  if (severity >= 0.33) return LL.gold;
  return LL.lavender;
};

const PatternCard: React.FC<{ pattern: BehavioralPattern }> = ({ pattern }) => {
  const tone = severityTone(pattern.severity);
  const pct = Math.max(8, Math.round(pattern.severity * 100));
  return (
    <Glass style={{ padding: 14, borderRadius: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div className="ll-serif" style={{ fontSize: 17, fontStyle: 'italic', lineHeight: 1.2 }}>{pattern.label}</div>
        <div style={{ fontSize: 10, color: LL.fgDim, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          {pattern.occurrenceCount} tekrar
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
      </div>
      <div style={{ fontSize: 12, color: LL.fgMuted, lineHeight: 1.45, marginTop: 10 }}>{pattern.description}</div>
      {pattern.evidence.length > 0 && (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {pattern.evidence.slice(0, 2).map((ev, idx) => (
            <div key={`${ev.messageId}-${idx}`} style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.045)' }}>
              <div style={{ fontSize: 10, color: LL.fgDim, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {ev.date} · {ev.author} · {ev.role === 'trigger' ? 'tetik' : ev.role === 'response' ? 'yanıt' : 'bağlam'}
              </div>
              <div style={{ fontSize: 12, color: LL.fg, marginTop: 3, lineHeight: 1.4 }}>{ev.text}</div>
            </div>
          ))}
        </div>
      )}
    </Glass>
  );
};

const PatternsSection: React.FC<{ patterns: BehavioralPattern[] }> = ({ patterns }) => (
  <div style={{ display: 'grid', gap: 10 }}>
    {patterns.map(pattern => (
      <PatternCard key={`${pattern.id}-${pattern.perpetrator || 'na'}`} pattern={pattern} />
    ))}
  </div>
);

const Timeline: React.FC<{ report: RelationshipReport }> = ({ report }) => {
  const items = [
    report.timeline.mostActiveDay,
    report.timeline.longestSilence,
    report.timeline.chaoticPeriod,
    report.timeline.sweetestPeriod,
  ].filter(Boolean);
  return (
    <Glass style={{ padding: 16, borderRadius: 22 }}>
      {items.length ? items.map(item => (
        <div key={item!.title} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 14, background: `${LL.hotPink}22`, display: 'grid', placeItems: 'center', color: LL.gold }}>{item!.icon}</div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{item!.title}</div>
              <div style={{ fontSize: 10, color: LL.fgDim }}>{formatDate(item!.date)}</div>
            </div>
            <div style={{ fontSize: 11.5, color: LL.fgMuted, lineHeight: 1.45, marginTop: 3 }}>{item!.description}</div>
          </div>
        </div>
      )) : <EmptyState text="Timeline için yeterli veri bulunamadı." />}
    </Glass>
  );
};

const MonthlyChart: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <Glass style={{ padding: 12, borderRadius: 22 }}>
    {report.charts.monthlyIntensity.length ? (
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={report.charts.monthlyIntensity} margin={{ left: -20, right: 8, top: 16, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="key" tick={{ fill: LL.fgDim, fontSize: 10 }} />
            <YAxis tick={{ fill: LL.fgDim, fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="messages" name="Mesaj" stroke={LL.lavender} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="love" name="Sevgi" stroke={LL.hotPink} strokeWidth={2} dot />
            <Line type="monotone" dataKey="chaos" name="Kaos" stroke={LL.gold} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : <EmptyState text="Aylık yoğunluk için yeterli veri yok." />}
  </Glass>
);

const DailyChart: React.FC<{ report: RelationshipReport; onSelectDay: (day: CalendarDayReport) => void }> = ({ report, onSelectDay }) => {
  const data = report.charts.dailyMessages.length > 90
    ? report.charts.dailyMessages.filter((_, i) => i % Math.ceil(report.charts.dailyMessages.length / 90) === 0)
    : report.charts.dailyMessages;
  return (
    <Glass style={{ padding: 12, borderRadius: 22 }}>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: -20, right: 8, top: 16, bottom: 0 }}
            onClick={state => {
              const date = state?.activePayload?.[0]?.payload?.date;
              const day = report.calendar.find(item => item.date === date);
              if (day) onSelectDay(day);
            }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fill: LL.fgDim, fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={value => formatDate(String(value))} />
            <Bar dataKey="personA" name={report.couple.personAName} stackId="a" fill={LL.lavender} />
            <Bar dataKey="personB" name={report.couple.personBName} stackId="a" fill={LL.hotPink} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11, color: LL.fgDim, textAlign: 'center' }}>Gün detayları için grafikte bir güne tıkla.</div>
    </Glass>
  );
};

const HourlyChart: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <Glass style={{ padding: 12, borderRadius: 22 }}>
    <div style={{ height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={report.charts.hourlyActivity} margin={{ left: -20, right: 8, top: 16, bottom: 0 }}>
          <defs>
            <linearGradient id="ll-hourly" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LL.gold} stopOpacity={0.75} />
              <stop offset="95%" stopColor={LL.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: LL.fgDim, fontSize: 10 }} tickFormatter={value => `${value}:00`} />
          <YAxis tick={{ fill: LL.fgDim, fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={value => `${value}:00`} />
          <Area type="monotone" dataKey="count" name="Mesaj" stroke={LL.gold} fill="url(#ll-hourly)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </Glass>
);

const LoveDictionary: React.FC<{ report: RelationshipReport }> = ({ report }) => {
  const max = Math.max(...report.loveDictionary.map(item => item.count), 1);
  return (
    <Glass style={{ padding: 16, borderRadius: 22 }}>
      {report.loveDictionary.length ? report.loveDictionary.slice(0, 10).map(item => {
        const a = item.byParticipant[report.couple.personAName] || 0;
        const b = item.byParticipant[report.couple.personBName] || 0;
        return (
          <div key={item.word} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span className="ll-serif" style={{ fontStyle: 'italic', color: LL.blush }}>{item.word}</span>
              <span style={{ color: LL.fgMuted }}>{a} / {b}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(a / max) * 100}%`, background: LL.lavender }} />
              <div style={{ width: `${(b / max) * 100}%`, background: LL.hotPink }} />
            </div>
          </div>
        );
      }) : <EmptyState text="Aşk sözlüğü için yeterli sevgi kelimesi bulunamadı." />}
    </Glass>
  );
};

const ScoreCards: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
    {[report.scoreCards.sweetest, report.scoreCards.chaotic, report.scoreCards.quietest].filter(Boolean).map((card, index) => (
      <Glass key={card!.label} style={{ padding: 14, borderRadius: 18, minHeight: 138 }}>
        <div style={{ fontSize: 10, color: [LL.blush, LL.red, LL.lavender][index], fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
          {card!.label}
        </div>
        <div className="ll-serif" style={{ fontSize: 32, marginTop: 4 }}>{card!.value}</div>
        <div style={{ fontSize: 11, color: LL.fgMuted, lineHeight: 1.35 }}>{card!.description}</div>
      </Glass>
    ))}
  </div>
);

const ResponseSpeed: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <Glass style={{ padding: 12, borderRadius: 22 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
      <MiniMetric label={`${report.couple.personAName} ort.`} value={formatMinutes(report.people.personA.averageResponseTime)} />
      <MiniMetric label={`${report.couple.personBName} ort.`} value={formatMinutes(report.people.personB.averageResponseTime)} />
    </div>
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={report.charts.responseSpeedDistribution.map(item => ({
            range: item.range,
            personA: item.counts[report.couple.personAName] || 0,
            personB: item.counts[report.couple.personBName] || 0,
          }))}
          margin={{ left: -20, right: 8, top: 16, bottom: 0 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="range" tick={{ fill: LL.fgDim, fontSize: 9 }} />
          <YAxis tick={{ fill: LL.fgDim, fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="personA" name={report.couple.personAName} fill={LL.lavender} radius={[4, 4, 0, 0]} />
          <Bar dataKey="personB" name={report.couple.personBName} fill={LL.hotPink} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Glass>
);

const CalendarGrid: React.FC<{ report: RelationshipReport; onSelectDay: (day: CalendarDayReport) => void }> = ({ report, onSelectDay }) => {
  const max = Math.max(...report.calendar.map(day => day.total), 1);
  return (
    <Glass style={{ padding: 14, borderRadius: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 5 }}>
        {report.calendar.slice(-112).map(day => {
          const opacity = 0.12 + (day.total / max) * 0.78;
          return (
            <button
              key={day.date}
              onClick={() => onSelectDay(day)}
              title={`${formatDate(day.date)} · ${day.total} mesaj`}
              style={{
                aspectRatio: '1/1',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.08)',
                background: `rgba(255, 93, 148, ${opacity})`,
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: LL.fgDim, marginTop: 10 }}>Son {Math.min(112, report.calendar.length)} aktif gün. Detay için güne tıkla.</div>
    </Glass>
  );
};

const EmojiWorld: React.FC<{ report: RelationshipReport }> = ({ report }) => (
  <EmojiWorldInner report={report} />
);

const EmojiWorldInner: React.FC<{ report: RelationshipReport }> = ({ report }) => {
  const [selectedEmoji, setSelectedEmoji] = useState(report.emoji.topOverall[0]?.emoji ?? '');
  const selected = report.emoji.topOverall.find(item => item.emoji === selectedEmoji) ?? report.emoji.topOverall[0];
  const topDays = selected?.timeline.slice().sort((a, b) => b.count - a.count).slice(0, 6) ?? [];

  return (
    <Glass style={{ padding: 16, borderRadius: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {report.emoji.topOverall.length ? report.emoji.topOverall.slice(0, 8).map(item => {
          const on = selected?.emoji === item.emoji;
          return (
            <button
              key={item.emoji}
              onClick={() => setSelectedEmoji(item.emoji)}
              style={{
                padding: 10,
                borderRadius: 16,
                background: on ? `${LL.hotPink}30` : 'rgba(255,255,255,0.055)',
                border: `1px solid ${on ? LL.hotPink : 'rgba(255,255,255,0.08)'}`,
                textAlign: 'center',
                cursor: 'pointer',
                color: LL.fg,
                fontFamily: LL.sans,
              }}
            >
              <div style={{ fontSize: 26 }}>{item.emoji}</div>
              <div style={{ fontSize: 11, color: on ? LL.blush : LL.fgMuted, marginTop: 4 }}>{fmt(item.count)}</div>
            </button>
          );
        }) : <EmptyState text="Emoji bulunamadı." />}
      </div>

      {selected && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.045)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Günlük emoji kullanımı
              </div>
              <div className="ll-serif" style={{ fontSize: 24, marginTop: 2 }}>
                {selected.emoji} · {fmt(selected.count)}
              </div>
            </div>
            <div style={{ fontSize: 11, color: LL.fgMuted }}>{selected.timeline.length} gün</div>
          </div>

          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selected.timeline} margin={{ left: -26, right: 4, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fill: LL.fgDim, fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={value => formatDate(String(value))} />
                <Bar dataKey="count" name={`${selected.emoji} sayısı`} fill={LL.gold} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            {topDays.map(day => (
              <div key={day.date} style={{ padding: 9, borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: LL.fgDim }}>{formatDate(day.date)}</div>
                <div className="ll-serif" style={{ fontSize: 20, marginTop: 2 }}>{day.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <MiniMetric label="Sevgi emojileri" value={fmt(report.emoji.loveEmojiCount)} tone={LL.blush} />
        <MiniMetric label="Gülme emojileri" value={fmt(report.emoji.laughEmojiCount)} tone={LL.gold} />
      </div>
    </Glass>
  );
};

const DayModal: React.FC<{ day: CalendarDayReport | null; report: RelationshipReport; onClose: () => void }> = ({ day, report, onClose }) => {
  if (!day) return null;
  return (
    <div className="ll-no-print" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <Glass strong style={{ width: '100%', maxWidth: 420, padding: 18, borderRadius: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase' }}>Gün detayı</div>
            <div className="ll-serif" style={{ fontSize: 24, fontStyle: 'italic' }}>{formatDate(day.date)}</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'rgba(255,255,255,0.1)', color: LL.fg, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MiniMetric label="Toplam" value={fmt(day.total)} />
          <MiniMetric label="Medya" value={fmt(day.mediaCount)} />
          <MiniMetric label={report.couple.personAName} value={fmt(day.personA)} tone={LL.lavender} />
          <MiniMetric label={report.couple.personBName} value={fmt(day.personB)} tone={LL.hotPink} />
          <MiniMetric label="Sevgi" value={fmt(day.loveScore)} tone={LL.blush} />
          <MiniMetric label="Kaos" value={fmt(day.chaosScore)} tone={LL.gold} />
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: LL.fgMuted, lineHeight: 1.5 }}>{day.insight}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {day.topEmojis.map(item => <span key={item.emoji} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}>{item.emoji} {item.count}</span>)}
          {day.topLoveWords.map(item => <span key={item.word} style={{ padding: '6px 10px', borderRadius: 999, background: `${LL.hotPink}22`, fontSize: 12 }}>{item.word} {item.count}</span>)}
        </div>
      </Glass>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ analysis, reset, onBack, onOpenFal, relationMode = 'lover', viewerName }) => {
  const [aiInsight, setAiInsight] = useState<GeminiInsight | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [mode, setMode] = useState<InsightMode>('love');
  const [selectedDay, setSelectedDay] = useState<CalendarDayReport | null>(null);

  const report = useMemo(() => buildRelationshipReport(analysis, relationMode), [analysis, relationMode]);
  const score = useMemo(
    () => (relationMode === 'friend' ? computeFriendScore(analysis) : computeLoveScore(analysis)),
    [analysis, relationMode]
  );

  useEffect(() => {
    let cancelled = false;
    const fetchInsights = async () => {
      setLoadingAi(true);
      try {
        const result = await generateRelationshipInsights(analysis, relationMode);
        if (!cancelled) setAiInsight(result);
      } finally {
        if (!cancelled) setLoadingAi(false);
      }
    };
    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, [analysis, relationMode]);

  const handlePrint = () => window.print();

  return (
    <Screen withTabBar starDensity={70} maxWidth={1120}>
      <div className="ll-dashboard-print" style={{ padding: '20px 20px 24px' }}>
        <HeroSummary report={report} score={score} relationMode={relationMode} onPrint={handlePrint} reset={reset} onBack={onBack} />
        <AiSummary report={report} aiInsight={aiInsight} loading={loadingAi} mode={mode} setMode={setMode} relationMode={relationMode} />

        <SectionTitle eyebrow="Profil" title={relationMode === 'friend' ? 'Destekçi · Eğlenceli · Planlayıcı' : 'Duygusal · Meraklı · İlgili'} />
        <ProfileCards report={report} />

        <SectionTitle eyebrow={relationMode === 'friend' ? 'Arkadaş Modu' : mode === 'love' ? 'Aşk Modu' : 'Kaos Modu'} title={relationMode === 'friend' ? 'Vibe ve Drama Ayrımı' : mode === 'love' ? 'Tatlı Sinyaller' : 'Ritimdeki Pürüzler'} />
        {relationMode === 'friend' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniMetric label="Destek + vibe" value={fmt(Number(report.deepAnalysis.signals.value))} tone={LL.blush} />
            <MiniMetric label="Drama" value={fmt(Number(report.deepAnalysis.tension.value))} tone={LL.gold} />
            <MiniMetric label="Gülme emojisi" value={fmt(report.emoji.laughEmojiCount)} tone={LL.mint} />
            <MiniMetric label="Plan sinyali" value={fmt(Number(report.deepAnalysis.plans.value))} tone={LL.lavender} />
          </div>
        ) : mode === 'love' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniMetric label="Sevgi sinyali" value={fmt(Number(report.deepAnalysis.signals.value))} tone={LL.blush} />
            <MiniMetric label="En tatlı dönem" value={String(report.scoreCards.sweetest?.value ?? 0)} tone={LL.hotPink} />
            <MiniMetric label="Sevgi emojisi" value={fmt(report.emoji.loveEmojiCount)} tone={LL.gold} />
            <MiniMetric label="Aşk sözlüğü" value={fmt(report.loveDictionary.length)} tone={LL.mint} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MiniMetric label="Gerilim" value={fmt(Number(report.deepAnalysis.tension.value))} tone={LL.red} />
            <MiniMetric label="Kısa cevap" value={fmt(Number(report.deepAnalysis.shortReplies.value))} tone={LL.gold} />
            <MiniMetric label="En uzun sessizlik" value={String(report.timeline.longestSilence?.value ?? 'yok')} tone={LL.lavender} />
            <MiniMetric label="Kaos dönemi" value={String(report.scoreCards.chaotic?.value ?? 0)} tone={LL.red} />
          </div>
        )}

        {viewerName && (relationMode === 'friend' || mode === 'love') && (
          <ViewerStrengths report={report} viewerName={viewerName} relationMode={relationMode} />
        )}

        <SectionTitle eyebrow="Detaylar" title="Derin Analiz" />
        <DeepAnalysis report={report} />

        <SectionTitle eyebrow="İçgörü" title="Biliyor muydun?" />
        <Glass style={{ padding: 16, borderRadius: 22 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Sparkle size={18} color={LL.gold} />
            <div style={{ fontSize: 13, color: LL.fgMuted, lineHeight: 1.55 }}>{aiInsight?.funFact || report.narratives.funFact}</div>
          </div>
        </Glass>

        <SectionTitle eyebrow="Zaman" title={relationMode === 'friend' ? 'Arkadaşlık Zaman Çizgisi' : 'İlişki Zaman Çizgisi'} />
        <Timeline report={report} />

        {analysis.patterns.length > 0 && (
          <>
            <SectionTitle eyebrow="Davranış" title="Tespit Edilen Desenler" />
            <PatternsSection patterns={analysis.patterns} />
          </>
        )}

        <SectionTitle eyebrow="Grafikler" title="Dönemsel Yoğunluk" />
        <MonthlyChart report={report} />

        <SectionTitle title="Günlük Mesaj Yoğunluğu" />
        <DailyChart report={report} onSelectDay={setSelectedDay} />

        <SectionTitle title="Genel Saat Yoğunluğu" />
        <HourlyChart report={report} />

        <SectionTitle eyebrow="Viral" title={relationMode === 'friend' ? 'Kanka Sözlüğü' : 'Aşk Sözlüğü'} />
        <LoveDictionary report={report} />

        <SectionTitle title="Mesaj Pastası" />
        <ScoreCards report={report} />

        <SectionTitle title="Medya & Görsel" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <MiniMetric label={report.couple.personAName} value={fmt(report.media.personA)} tone={LL.lavender} />
          <MiniMetric label={report.couple.personBName} value={fmt(report.media.personB)} tone={LL.hotPink} />
          <MiniMetric label="Toplam medya" value={`${fmt(report.media.total)} · %${report.media.rate}`} tone={LL.gold} />
        </div>

        <SectionTitle title="Hız Testi" />
        <ResponseSpeed report={report} />

        <SectionTitle title="Sohbet Akıcılığı" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <MiniMetric label="Toplam" value={`${report.flow.totalFlowHours.toFixed(1)} sa`} />
          <MiniMetric label="En uzun" value={formatMinutes(report.flow.longestFlowMinutes)} />
          <MiniMetric label="Oturum" value={fmt(report.flow.sessionCount)} />
          <MiniMetric label="Ortalama" value={formatMinutes(report.flow.averageFlowMinutes)} />
        </div>

        <SectionTitle title={relationMode === 'friend' ? 'Arkadaşlık Takvimi' : 'İlişki Takvimi'} />
        <CalendarGrid report={report} onSelectDay={setSelectedDay} />

        <SectionTitle title="Emoji Dünyası" />
        <EmojiWorld report={report} />

        <SectionTitle eyebrow="Yorumlar" title={relationMode === 'friend' ? 'Arkadaşlık Dili' : 'Sevgi Dili'} />
        <Glass style={{ padding: 16, borderRadius: 22, fontSize: 13, color: LL.fgMuted, lineHeight: 1.6 }}>
          {aiInsight?.loveLanguageAnalysis || report.narratives.loveLanguage}
        </Glass>

        <SectionTitle title="İletişim Dengesi" />
        <Glass style={{ padding: 16, borderRadius: 22, fontSize: 13, color: LL.fgMuted, lineHeight: 1.6 }}>
          {aiInsight?.communicationBalance || report.narratives.communicationBalance}
        </Glass>

        <SectionTitle title="Cevap Ritmi" />
        <Glass style={{ padding: 16, borderRadius: 22, fontSize: 13, color: LL.fgMuted, lineHeight: 1.6 }}>
          {aiInsight?.responseRhythm || report.narratives.responseRhythm}
        </Glass>

        <SectionTitle title="Kanıtlı Eğlence" />
        <Glass style={{ padding: 16, borderRadius: 22, fontSize: 13, color: LL.fgMuted, lineHeight: 1.6 }}>
          {aiInsight?.evidenceBasedFun || report.narratives.evidenceBasedFun}
        </Glass>

        <Glass
          hover
          strong
          onClick={onOpenFal}
          className="ll-no-print"
          style={{ padding: 18, borderRadius: 22, marginTop: 18, background: `linear-gradient(135deg, ${LL.gold}22, ${LL.hotPink}22)` }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Heart size={20} color={LL.blush} />
            <div>
              <div className="ll-serif" style={{ fontSize: 20, fontStyle: 'italic' }}>
                {relationMode === 'friend' ? 'Arkadaşlık falına bak →' : 'Bu ilişkinin falına bak →'}
              </div>
              <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2 }}>
                {relationMode === 'friend' ? 'Bestie vibe için biraz tea iyi gider.' : 'Analizden sonra biraz eğlence iyi gider.'}
              </div>
            </div>
          </div>
        </Glass>

        <Glass style={{ padding: 14, borderRadius: 18, marginTop: 14, fontSize: 11.5, color: LL.fgMuted, lineHeight: 1.55 }}>
          {aiInsight?.carefulAdvice || report.narratives.shortNote}
        </Glass>
      </div>
      <DayModal day={selectedDay} report={report} onClose={() => setSelectedDay(null)} />
    </Screen>
  );
};
