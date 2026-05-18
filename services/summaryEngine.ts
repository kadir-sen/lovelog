import { AnalysisResult } from '../types';
import { RelationshipMode } from './relationshipReport';

export type InsightMode = 'love' | 'chaos';

export interface SummarySection {
  heading: string;
  body: string;
}

export interface AlgorithmicReport {
  intro: string;
  sections: SummarySection[];
}

type ToneBand = 'glowing' | 'steady' | 'tense' | 'distant';

const bandForScore = (score: number): ToneBand => {
  if (score >= 80) return 'glowing';
  if (score >= 60) return 'steady';
  if (score >= 40) return 'tense';
  return 'distant';
};

const computeLoveScore = (analysis: AnalysisResult): number => {
  const total = analysis.totalMessages || 1;
  const love = analysis.nlpSignals.totals.loveAdjusted || 0;
  const tension = analysis.nlpSignals.totals.tensionAdjusted || 0;
  const harsh = analysis.nlpSignals.totals.harshAdjusted || 0;
  const positive = (love / total) * 600;
  const negative = ((tension + harsh) / total) * 200;
  return Math.max(20, Math.min(99, Math.round(60 + positive - negative)));
};

const computeFriendScore = (analysis: AnalysisResult): number => {
  const total = analysis.totalMessages || 1;
  const support = analysis.nlpSignals.totals.thanks
    + analysis.nlpSignals.totals.apology
    + analysis.nlpSignals.totals.planning
    + analysis.nlpSignals.totals.future;
  const fun = analysis.nlpSignals.totals.playfulMessages
    + analysis.emojiAnalysis
        .filter(e => ['😂', '🤣', '😅', '😁', '😄', '😆'].includes(e.char))
        .reduce((s, e) => s + e.count, 0);
  const drama = analysis.nlpSignals.totals.tensionAdjusted
    + analysis.nlpSignals.totals.harshAdjusted
    + analysis.nlpSignals.totals.shortReplies * 0.25;
  return Math.max(20, Math.min(99, Math.round(62 + ((support + fun) / total) * 520 - (drama / total) * 180)));
};

const formatMinutes = (m: number): string => {
  if (!isFinite(m) || m <= 0) return 'belirsiz';
  if (m < 1) return 'bir dakikadan az';
  if (m < 60) return `${Math.round(m)} dakika`;
  if (m < 24 * 60) return `${Math.round(m / 60)} saat`;
  return `${Math.round(m / (24 * 60))} gün`;
};

const pickFromSeed = <T,>(items: T[], seed: number): T => items[Math.abs(seed) % items.length];

const introTemplates = {
  glowing: [
    (a: string, b: string) => `${a} ve ${b}, sohbetinizden taşan ilk şey sıcaklık. İletişim ritminiz tutuyor; sözler iz bırakıyor.`,
    (a: string, b: string) => `${a} ve ${b} arasında, sayıların da gösterdiği gibi parlak bir dönem var. Birbirinize alan açıyorsunuz.`,
  ],
  steady: [
    (a: string, b: string) => `${a} ve ${b}, dengeli bir ritimle ilerliyor. Tatlı anlar ile küçük pürüzler iç içe; bu olağan.`,
    (a: string, b: string) => `${a} ile ${b} arasında inişli çıkışlı ama temeli sağlam bir sohbet var.`,
  ],
  tense: [
    (a: string, b: string) => `${a} ve ${b}, sözlerden çok davranış ritmi konuşan bir dönemden geçiyor. Pürüzler isimlendirilince çoğu yumuşar.`,
    (a: string, b: string) => `${a} ile ${b} arasında biraz mesafe ya da yorgunluk hissi var; veriler bunu doğruluyor.`,
  ],
  distant: [
    (a: string, b: string) => `${a} ve ${b}, görünür şekilde uzaklaşmış bir dönemden geçiyor. Sayılar bunu gizlemiyor.`,
    (a: string, b: string) => `${a} ile ${b}, kalbi olan bir bağ ama şu anda iletişim yorgun.`,
  ],
};

const buildIntro = (analysis: AnalysisResult, mode: RelationshipMode, score: number, seed: number): string => {
  const personA = analysis.participants[0]?.name ?? 'Sen';
  const personB = analysis.participants[1]?.name ?? 'O';
  const tmpl = pickFromSeed(introTemplates[bandForScore(score)], seed);
  return tmpl(personA, personB);
};

const buildTone = (analysis: AnalysisResult, mode: RelationshipMode, score: number): SummarySection => {
  const subject = mode === 'friend' ? 'arkadaşlığın' : 'ilişkinin';
  const band = bandForScore(score);
  const map: Record<ToneBand, string> = {
    glowing: `${subject} tonu genel olarak sıcak; sevgi/destek sinyalleri pürüz sinyallerinin önünde gidiyor.`,
    steady: `${subject} tonu dengeli; tatlı anlar açık, pürüzler de tabii ki var ama oran sağlıklı.`,
    tense: `${subject} tonu biraz gergin; pürüzler tatlı sinyallere baskın çıkıyor, ama umutsuz değil.`,
    distant: `${subject} tonu uzak; yakınlık göstergeleri zayıf ve net konuşmaya ihtiyaç var.`,
  };
  return { heading: 'Genel Ton', body: map[band] };
};

const buildRhythm = (analysis: AnalysisResult, mode: RelationshipMode): SummarySection => {
  const subject = mode === 'friend' ? 'Arkadaşlık' : 'İlişki';
  const totals = analysis.nlpSignals.totals;
  const total = analysis.totalMessages || 1;
  const shortRate = totals.shortReplies / total;
  const questionRate = totals.questions / total;
  const personA = analysis.participants[0];
  const personB = analysis.participants[1];
  const medianA = personA?.medianResponseTimeMinutes ?? 0;
  const medianB = personB?.medianResponseTimeMinutes ?? 0;

  const lines: string[] = [];
  lines.push(`Ortalama cevap süresi: ${personA?.name ?? 'A'} ${formatMinutes(medianA)}, ${personB?.name ?? 'B'} ${formatMinutes(medianB)}.`);
  if (questionRate > 0.12) {
    lines.push('Soru sorma oranı yüksek; merak/ilgi göstergesi güçlü.');
  } else if (questionRate < 0.04) {
    lines.push('Soru sorma oranı düşük; sohbet karşılıklı keşiften çok anlatıma kayıyor.');
  }
  if (shortRate > 0.25) {
    lines.push('Kısa cevap oranı yüksek; bazen sohbet hızlıca kapanıyor.');
  } else if (shortRate < 0.08) {
    lines.push('Cevaplar genelde dolu — kısa kapanış az.');
  }
  return { heading: `${subject} Ritmi`, body: lines.join(' ') };
};

const buildPositiveSignals = (analysis: AnalysisResult, mode: RelationshipMode): SummarySection => {
  const totals = analysis.nlpSignals.totals;
  const lines: string[] = [];
  if (mode === 'friend') {
    lines.push(`Destek ve teşekkür sinyalleri: ${totals.thanks + totals.apology}. Plan/gelecek sinyalleri: ${totals.planning + totals.future}.`);
    const laughEmojis = analysis.emojiAnalysis
      .filter(e => ['😂', '🤣', '😅', '😁'].includes(e.char))
      .reduce((s, e) => s + e.count, 0);
    if (laughEmojis > 0) lines.push(`Gülme emojileri: ${laughEmojis} kez — mizah aranızda işliyor.`);
  } else {
    lines.push(`Sevgi sözleri: ${totals.loveAdjusted}. Duygusal ifade: ${totals.emotional}. Teşekkür/özür: ${totals.thanks + totals.apology}.`);
    const loveEmojis = analysis.emojiAnalysis
      .filter(e => ['❤️', '❤', '♥', '💕', '💖', '🥰', '😘', '😍'].includes(e.char))
      .reduce((s, e) => s + e.count, 0);
    if (loveEmojis > 0) lines.push(`Sevgi emojileri: ${loveEmojis} kez kullanılmış.`);
  }
  return { heading: mode === 'friend' ? 'İyi Sinyaller' : 'Tatlı Sinyaller', body: lines.join(' ') };
};

const buildFriction = (analysis: AnalysisResult, mode: RelationshipMode): SummarySection => {
  const totals = analysis.nlpSignals.totals;
  const lines: string[] = [];
  const total = analysis.totalMessages || 1;
  lines.push(`Gerilim: ${totals.tensionAdjusted}, sert dil: ${totals.harshAdjusted}, kıskançlık: ${totals.jealousy}.`);
  if (totals.longSilences > 0) {
    lines.push(`Uzun sessizlikler (24 saatten fazla): ${totals.longSilences} kez.`);
  }
  const dramaShare = (totals.tensionAdjusted + totals.harshAdjusted) / total;
  if (dramaShare > 0.08) {
    lines.push(mode === 'friend'
      ? 'Drama payı yüksek; küçük gerilimler tekrar ediyor.'
      : 'Gerilim payı yüksek; iletişim tarzında ufak bir düzeltme rahatlatır.');
  } else if (dramaShare < 0.02) {
    lines.push('Gerilim payı düşük; sürtünme az.');
  }
  return { heading: mode === 'friend' ? 'Pürüzler' : 'Ritimdeki Pürüzler', body: lines.join(' ') };
};

const buildAdvice = (analysis: AnalysisResult, mode: RelationshipMode, score: number, seed: number): SummarySection => {
  const band = bandForScore(score);
  const adviceMap: Record<ToneBand, string[]> = {
    glowing: mode === 'friend'
      ? ['Bu enerjiyi koru: ortak planlar ve küçük jestler arkadaşlığı uzun ömürlü yapar.', 'Sıcaklığı sözle de besle; iç şakalar bir bağı kalıcı kılar.']
      : ['Bu enerjiyi koru — küçük ritüeller (günaydın, iyi geceler) sıcaklığı sürekli kılar.', 'Sıcaklığı yorgun anlarda da hatırla; takdir cümlesi büyük fark yapar.'],
    steady: mode === 'friend'
      ? ['Dengeyi koru: küçük dramalar büyümeden konuşulduğunda mesafe oluşmaz.', 'Plan/buluşma tarafına biraz daha yatırım iyi gelir.']
      : ['Dengeyi koru: küçük pürüzleri biriktirmek yerine kısa konuşmak rahatlatır.', 'Mesaj kadar zaman da paylaş — birlikte yapılan küçük planlar tonu yükseltir.'],
    tense: mode === 'friend'
      ? ['Drama döngülerini fark et: aynı konu birden fazla kez patladıysa konuşma vakti.', 'Bir-iki haftalık yumuşak iletişim çoğu pürüzü çözer.']
      : ['Pürüzleri isimlendirmek çoğu sertliği yumuşatır.', 'Yargılayan değil tanımlayan cümle kur: "şu davranış bana şunu hissettirdi".'],
    distant: mode === 'friend'
      ? ['Şu anda samimi bir tek konuşma çoğu mesafeyi kapatabilir.', 'Beklenti netleşmezse uzaklık büyür.']
      : ['Şu anda netlik yakınlıktan önemli; "ben şunu hissediyorum" cümlesi köprü olur.', 'Mesafe büyümeden, beklentileri açıkça konuşmak iyi gelir.'],
  };
  return { heading: 'Bir Cümle Tavsiye', body: pickFromSeed(adviceMap[band], seed) };
};

export const buildAlgorithmicReport = (
  analysis: AnalysisResult,
  mode: RelationshipMode,
  insightMode: InsightMode = 'love'
): AlgorithmicReport => {
  const score = mode === 'friend' ? computeFriendScore(analysis) : computeLoveScore(analysis);
  const seed = analysis.totalMessages + (analysis.participants[0]?.name?.length ?? 0);
  const intro = buildIntro(analysis, mode, score, seed);
  const sections: SummarySection[] = [];
  sections.push(buildTone(analysis, mode, score));
  sections.push(buildRhythm(analysis, mode));
  if (insightMode === 'love') {
    sections.push(buildPositiveSignals(analysis, mode));
    sections.push(buildFriction(analysis, mode));
  } else {
    // chaos modu önce pürüzleri, sonra iyi sinyalleri öne çıkarır
    sections.push(buildFriction(analysis, mode));
    sections.push(buildPositiveSignals(analysis, mode));
  }
  sections.push(buildAdvice(analysis, mode, score, seed));
  return { intro, sections };
};
