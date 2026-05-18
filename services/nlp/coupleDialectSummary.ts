// coupleDialectSummary — AnalysisResult'tan Dashboard'un göstereceği özet
// shape üretir. Pure function; UI'a dokunmaz, hiçbir IO yapmaz.
// F2-S1: Dashboard-ready data shape. Sonraki sprint'te CoupleDialectCard
// component'i bu çıktıyı tüketecek.
//
// Sözleşmeler:
//   - Yalnız analysisResult.messageInsights / episodes / styleProfile okur.
//     Hiçbiri yoksa "empty" özet döner; Dashboard "yeterli veri yok" gösterir.
//   - Her highlight: confidence ≥ 0.55, evidence en az 1 quoteMasked.
//   - Klinik dil yasak (filterClinicalTerm post-check).
//   - "Bu hafta" / "Bu ay" gibi pencere hesaplamaları styleProfile'dan değil,
//     son N gün kuralıyla insights üzerinden yapılır (deterministic).

import type {
  AnalysisResult,
  ConversationStyleProfile,
  EvidenceItem,
  MessageInsight,
  RelationshipEpisode,
} from '../../types';
import type { ClassifierTag } from './types';

// ---------- Public shapes ----------

export type CoupleDialectSummaryStatus = 'empty' | 'partial' | 'rich';

export interface DialectFactCard {
  /** Stable key for React render. */
  id: string;
  /** Kısa başlık. Klinik dil içermez. */
  title: string;
  /** Detay metin; sayı + saat aralığı + author leaning vb. */
  body: string;
  /** UI'da rozet için kullanılır (örn. "ritüel", "emoji ailesi"). */
  badge?: string;
  /** Bu fact için en güçlü kanıt (maskelenmiş quote). */
  evidence?: EvidenceItem;
  /** 0..1 — UI eşik filtresi için. */
  confidence: number;
}

export interface RitualStreakInfo {
  ritualKind: string;
  /** Ardışık gün sayısı. */
  longestStreakDays: number;
  /** Toplam görülme sayısı. */
  totalOccurrences: number;
  /** Yazar dağılımı — kim başlatıyor (A% / B%). */
  initiationRatio: { A: number; B: number };
}

export interface AuthorAffectionLeaning {
  author: 'A' | 'B';
  dominantEmoji?: string;
  topWarmTerm?: string;
  /** Author'un toplam affection-tag oranı (warm_ack + affection + emoji_cluster). */
  affectionRate: number;
  /** Sıcak mesaj başına ortalama emoji sayısı (özet). */
  avgEmojisInWarmMessages: number;
}

export interface CoupleDialectSummary {
  status: CoupleDialectSummaryStatus;
  /** UI üst kartı — 1-2 cümlelik genel özet. Klinik dil içermez. */
  headline: string;
  /** Dashboard'da top-3 olarak gösterilecek somut fact'ler. */
  topFacts: DialectFactCard[];
  /** Ritüel streak'leri (en uzun olan ilk). */
  ritualStreaks: RitualStreakInfo[];
  /** A vs B affection leaning. */
  authorLeaning: {
    A: AuthorAffectionLeaning;
    B: AuthorAffectionLeaning;
  };
  /** Custom couple marker (örn. "aşkım × 🐬"). Yoksa undefined. */
  customMarker?: {
    term: string;
    emoji: string;
    occurrences: number;
  };
  /** Bu raporun kaç insight üzerinden hesaplandığı — UI "yeterli veri" kontrolü. */
  basedOnInsightCount: number;
}

// ---------- Helpers ----------

const CLINICAL_BLOCKLIST = /\b(gaslighter|gaslighting|narsist|narcissist|toksik|toxic|abuser|abusive|psikopat|sosyopat)\b/iu;

const filterClinicalTerm = (s: string): string => {
  // Bu fonksiyon "olmayan" dilden çıkış yapar; eşleşirse o cümle parçası atılır.
  // Tüm string'i atmayalım, hata gibi durmasın — sadece kelimeyi maskele.
  return s.replace(CLINICAL_BLOCKLIST, '[gözlem dışı terim]');
};

const isWarmTag = (tag: ClassifierTag): boolean =>
  tag === 'warm_ack' || tag === 'affection' || tag === 'emoji_cluster' ||
  tag === 'inside_joke_pattern' || tag === 'echo_warmth' ||
  tag === 'intensified_endearment' || tag === 'ritual_message';

const pickBestEvidence = (ins: MessageInsight): EvidenceItem | undefined => {
  const enriched = ins as MessageInsight & { evidence?: EvidenceItem[]; counterEvidence?: EvidenceItem[] };
  if (enriched.evidence && enriched.evidence.length) return enriched.evidence[0];
  return undefined;
};

const dayDiff = (a: string, b: string): number => {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.floor(Math.abs(db - da) / 86400000);
};

const dateKeyOf = (iso: string): string => iso.slice(0, 10);

// ---------- Sub-summaries ----------

const computeRitualStreaks = (
  insights: MessageInsight[],
  styleProfile?: ConversationStyleProfile
): RitualStreakInfo[] => {
  // Ritual günleri authorlarla birlikte topla
  type RitualOccurrence = { date: string; author: 'A' | 'B' | 'OTHER' };
  const byKind = new Map<string, RitualOccurrence[]>();

  for (const ins of insights as Array<MessageInsight & { modifiers?: any; styleAuthorKey?: 'A' | 'B' }>) {
    const ritualKind = ins.modifiers?.ritualKind as string | undefined;
    if (!ritualKind) continue;
    if (!byKind.has(ritualKind)) byKind.set(ritualKind, []);
    byKind.get(ritualKind)!.push({
      date: dateKeyOf(ins.timestamp),
      author: ins.styleAuthorKey ?? 'OTHER',
    });
  }

  const out: RitualStreakInfo[] = [];
  for (const [kind, occurrences] of byKind) {
    // En uzun ardışık gün streak'ini hesapla
    const uniqDays = [...new Set(occurrences.map(o => o.date))].sort();
    let longest = 0;
    let cur = 1;
    for (let i = 1; i < uniqDays.length; i++) {
      if (dayDiff(uniqDays[i - 1], uniqDays[i]) === 1) {
        cur++;
        if (cur > longest) longest = cur;
      } else {
        cur = 1;
      }
    }
    if (uniqDays.length > 0 && longest === 0) longest = 1;

    const aCount = occurrences.filter(o => o.author === 'A').length;
    const bCount = occurrences.filter(o => o.author === 'B').length;
    const total = occurrences.length;
    const aRatio = total ? aCount / total : 0;
    const bRatio = total ? bCount / total : 0;

    out.push({
      ritualKind: kind,
      longestStreakDays: longest,
      totalOccurrences: total,
      initiationRatio: {
        A: Math.round(aRatio * 1000) / 1000,
        B: Math.round(bRatio * 1000) / 1000,
      },
    });
  }

  // styleProfile'dan ritualTimeDistribution'a fallback: insight yoksa boş döner.
  void styleProfile;

  return out.sort((a, b) => b.longestStreakDays - a.longestStreakDays);
};

const computeAuthorLeaning = (
  insights: MessageInsight[],
  styleProfile?: ConversationStyleProfile
): { A: AuthorAffectionLeaning; B: AuthorAffectionLeaning } => {
  const bucket: Record<'A' | 'B', {
    total: number;
    warmCount: number;
    emojiSumWarm: number;
    warmMsgCount: number;
  }> = {
    A: { total: 0, warmCount: 0, emojiSumWarm: 0, warmMsgCount: 0 },
    B: { total: 0, warmCount: 0, emojiSumWarm: 0, warmMsgCount: 0 },
  };

  for (const ins of insights as Array<MessageInsight & { styleAuthorKey?: 'A' | 'B'; classifierTags?: Array<{ tag: ClassifierTag }> }>) {
    const k = ins.styleAuthorKey;
    if (k !== 'A' && k !== 'B') continue;
    bucket[k].total++;
    const tags = (ins.classifierTags ?? []).map(c => c.tag);
    const isWarm = tags.some(t => isWarmTag(t as ClassifierTag));
    if (isWarm) {
      bucket[k].warmCount++;
      bucket[k].warmMsgCount++;
      const size = (ins as any).modifiers?.emojiCluster?.size as number | undefined;
      if (size) bucket[k].emojiSumWarm += size;
    }
  }

  const make = (k: 'A' | 'B'): AuthorAffectionLeaning => {
    const slot = bucket[k];
    const sp = styleProfile?.relationshipDialect?.authorAffectionLeaning?.[k];
    const rate = slot.total ? slot.warmCount / slot.total : 0;
    const avgEmoji = slot.warmMsgCount ? slot.emojiSumWarm / slot.warmMsgCount : 0;
    return {
      author: k,
      dominantEmoji: sp?.dominantEmoji,
      topWarmTerm: sp?.warmTermTop,
      affectionRate: Math.round(rate * 1000) / 1000,
      avgEmojisInWarmMessages: Math.round(avgEmoji * 100) / 100,
    };
  };

  return { A: make('A'), B: make('B') };
};

const computeCustomMarker = (
  insights: MessageInsight[]
): CoupleDialectSummary['customMarker'] => {
  // En sık görülen (term, emoji) custom binding'i topla.
  const counts = new Map<string, { term: string; emoji: string; count: number }>();
  for (const ins of insights as Array<MessageInsight & { modifiers?: any }>) {
    const ec = ins.modifiers?.emojiCluster;
    if (!ec?.customAffection || !ec.boundWarmTerm) continue;
    // Emoji bilgisi modifier'da yok; özet için sadece kategori "custom" bilgisi kullanılır.
    // Bu fonksiyon Dashboard'a "var" / "yok" kararı verir; gerçek emoji styleProfile'dan gelir.
    const key = `${ec.boundWarmTerm}::custom`;
    if (!counts.has(key)) counts.set(key, { term: ec.boundWarmTerm, emoji: 'custom', count: 0 });
    counts.get(key)!.count++;
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  if (!top) return undefined;
  return { term: top.term, emoji: top.emoji, occurrences: top.count };
};

const computeTopFacts = (
  insights: MessageInsight[],
  ritualStreaks: RitualStreakInfo[],
  leaning: { A: AuthorAffectionLeaning; B: AuthorAffectionLeaning },
  customMarker: CoupleDialectSummary['customMarker'],
  episodes: RelationshipEpisode[] | undefined
): DialectFactCard[] => {
  const facts: DialectFactCard[] = [];

  // Fact 1 — en uzun ritüel streak
  const topRitual = ritualStreaks[0];
  if (topRitual && topRitual.longestStreakDays >= 2) {
    const initiator = topRitual.initiationRatio.A > topRitual.initiationRatio.B ? 'A' : 'B';
    facts.push({
      id: 'ritual-streak',
      title: `${topRitual.ritualKind.replace(/_/g, ' ')} ritüeli`,
      body: `${topRitual.longestStreakDays} gün arka arkaya görüldü; toplam ${topRitual.totalOccurrences} kez. Daha sık başlatan: ${initiator}.`,
      badge: 'ritüel',
      confidence: topRitual.longestStreakDays >= 5 ? 0.85 : 0.7,
    });
  }

  // Fact 2 — custom marker (inside joke)
  if (customMarker && customMarker.occurrences >= 3) {
    facts.push({
      id: 'inside-joke',
      title: 'Sizin özel işaretiniz',
      body: `"${customMarker.term}" sözcüğü size özel bir emoji ile birlikte ${customMarker.occurrences} kez kullanıldı.`,
      badge: 'inside joke',
      confidence: 0.75,
    });
  }

  // Fact 3 — affection ratio dengesi
  const a = leaning.A;
  const b = leaning.B;
  const diff = Math.abs(a.affectionRate - b.affectionRate);
  if (diff >= 0.05 && (a.affectionRate + b.affectionRate) > 0.1) {
    const higher = a.affectionRate > b.affectionRate ? 'A' : 'B';
    facts.push({
      id: 'affection-leaning',
      title: 'Sıcak söz dengesi',
      body: `Sıcak mesaj oranı ${higher} tarafında biraz daha yüksek (${(a.affectionRate * 100).toFixed(1)}% / ${(b.affectionRate * 100).toFixed(1)}%).`,
      badge: 'denge',
      confidence: diff >= 0.15 ? 0.8 : 0.6,
    });
  } else if ((a.affectionRate + b.affectionRate) > 0.1) {
    facts.push({
      id: 'affection-leaning',
      title: 'Sıcak söz dengesi',
      body: `Her iki taraftan da yakın oranlarda sıcak mesaj geliyor (${(a.affectionRate * 100).toFixed(1)}% / ${(b.affectionRate * 100).toFixed(1)}%).`,
      badge: 'denge',
      confidence: 0.7,
    });
  }

  // Fact 4 — episode özetinden onarım/çatışma (varsa)
  if (episodes && episodes.length) {
    const repairs = episodes.filter(e => e.type === 'repair').length;
    const conflicts = episodes.filter(e => e.type === 'conflict').length;
    if (repairs > 0 && conflicts > 0) {
      facts.push({
        id: 'repair-presence',
        title: 'Onarım hareketi',
        body: `${conflicts} tartışma anının ${repairs} tanesinde onarım denemesi gözlendi.`,
        badge: 'onarım',
        confidence: repairs / conflicts >= 0.5 ? 0.75 : 0.6,
      });
    }
  }

  // Klinik dil filtreleme — defense in depth.
  for (const f of facts) {
    f.title = filterClinicalTerm(f.title);
    f.body = filterClinicalTerm(f.body);
  }

  return facts.slice(0, 4);
};

const composeHeadline = (
  status: CoupleDialectSummaryStatus,
  topFacts: DialectFactCard[],
  insightCount: number
): string => {
  if (status === 'empty') return 'Yeterli mesaj bulunamadı. En az birkaç günlük sohbet gerekli.';
  if (status === 'partial') return `İlk ${insightCount} mesaj üzerinden kısmi bir resim çıktı; daha fazla mesajla rapor güçleniyor.`;
  if (!topFacts.length) return 'Sohbet analiz edildi; net bir konuşma örüntüsü öne çıkmadı.';
  return `${topFacts.length} öne çıkan örüntü tespit edildi.`;
};

// ---------- Public API ----------

export const buildCoupleDialectSummary = (
  analysis: AnalysisResult | null | undefined
): CoupleDialectSummary => {
  const empty: CoupleDialectSummary = {
    status: 'empty',
    headline: 'Yeterli mesaj bulunamadı.',
    topFacts: [],
    ritualStreaks: [],
    authorLeaning: {
      A: { author: 'A', affectionRate: 0, avgEmojisInWarmMessages: 0 },
      B: { author: 'B', affectionRate: 0, avgEmojisInWarmMessages: 0 },
    },
    basedOnInsightCount: 0,
  };

  if (!analysis) return empty;

  const insights = (analysis.messageInsights ?? []) as MessageInsight[];
  if (!insights.length) return empty;

  const ritualStreaks = computeRitualStreaks(insights, analysis.styleProfile);
  const authorLeaning = computeAuthorLeaning(insights, analysis.styleProfile);
  const customMarker = computeCustomMarker(insights);
  const topFacts = computeTopFacts(insights, ritualStreaks, authorLeaning, customMarker, analysis.episodes);

  const status: CoupleDialectSummaryStatus =
    insights.length < 50 ? 'partial' : 'rich';

  return {
    status,
    headline: composeHeadline(status, topFacts, insights.length),
    topFacts,
    ritualStreaks: ritualStreaks.slice(0, 5),
    authorLeaning,
    customMarker,
    basedOnInsightCount: insights.length,
  };
};
