import { GoogleGenAI } from '@google/genai';
import { AnalysisResult, BehavioralPattern, CoachInsightContext, CoachQueryPlan, NormalizedMessage, PatternEvidence } from '../types';
import { RelationshipMode } from './relationshipReport';
import { matchPatternsToQuery } from './patternDetectors';
import { buildCoachInsightContext } from './coachRetrieval';
import { buildConversationProfile } from './relationshipMemory';
import { buildCoachAnswerPrompt } from './prompts/coachAnswerPrompt';
import { buildCoachPlannerPrompt } from './prompts/coachPlannerPrompt';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

interface CoachContext {
  query: string;
  viewerName?: string | null;
  names: string[];
  compactSummary: AnalysisResult['llmSummary'] | null;
  retrieval: Array<{
    date: string;
    author: string;
    text: string;
    signals: string[];
  }>;
  dayStats: Array<{
    date: string;
    total: number;
    breakdown: Record<string, number>;
  }>;
  patterns: Array<{
    id: BehavioralPattern['id'];
    label: string;
    description: string;
    severity: number;
    occurrenceCount: number;
    perpetrator?: string;
    victim?: string;
    dateRange: { start: string; end: string };
    evidence: PatternEvidence[];
  }>;
}

const STOPWORDS = new Set([
  'ben', 'sen', 'o', 'biz', 'siz', 'ne', 'niye', 'neden', 'nasıl', 'mi', 'mı', 'mu', 'mü',
  'bir', 'bu', 'şu', 've', 'de', 'da', 'ile', 'için', 'gibi', 'çok', 'az', 'mıydı', 'acaba',
  'kanka', 'luna', 'bana', 'onu', 'ona', 'şey', 'şeyi', 'mesaj', 'gün', 'konu', 'hakkında',
]);

const maskSensitive = (text: string): string =>
  text
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[telefon]')
    .replace(/\b\d{4,}\b/g, '[sayı]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

const tokenize = (query: string): string[] =>
  query
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s.\/-]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));

const dateKeysFromQuery = (query: string): string[] => {
  const keys = new Set<string>();
  const isoMatches = query.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || [];
  isoMatches.forEach(match => keys.add(match));

  const trMatches = query.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}|\d{2}))?\b/g) || [];
  trMatches.forEach(match => {
    const parts = match.split(/[./-]/).map(Number);
    const day = parts[0];
    const month = parts[1];
    const rawYear = parts[2] || new Date().getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      keys.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  });

  return Array.from(keys);
};

const parseJsonObject = <T,>(text: string | undefined): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
};

const extractGeminiText = (response: any): string => {
  const direct = typeof response?.text === 'string' ? response.text : '';
  const partsText = Array.isArray(response?.candidates)
    ? response.candidates
        .flatMap((candidate: any) => candidate?.content?.parts || [])
        .map((part: any) => typeof part?.text === 'string' ? part.text : '')
        .join('')
    : '';
  return (partsText || direct).trim();
};

export const deterministicCoachPlan = (query: string): CoachQueryPlan => {
  const q = query.toLocaleLowerCase('tr-TR');
  const dateKeys = dateKeysFromQuery(query);
  const safetyMode: CoachQueryPlan['safetyMode'] =
    /intihar|kendime zarar|ölmek istiyorum|yaşamak istemiyorum/i.test(q) ? 'self_harm_risk'
    : /tehdit|vur|döv|şiddet|takip ediyor|zorladı|korkuyorum/i.test(q) ? 'violence_risk'
    : /istismar|baskı|zorla|kontrol ediyor/i.test(q) ? 'abuse_risk'
    : /çok kötüyüm|dayanamıyorum|çöktüm/i.test(q) ? 'emotional_distress'
    : 'normal';

  let intent = 'general_relationship_analysis';
  if (/ghost|so[ğg]u|ilgisi azald|az yaz|görüldü|cevap vermiyor|yavaş/i.test(q)) intent = 'ghosting_or_interest_drop';
  else if (/seviyor|seviyor mu|ho[şs]lan|istiyor|özlüyor|a[şs]k/i.test(q)) intent = 'love_or_interest';
  else if (/manip[üu]le|narsist|gaslighting|abart[ıi]yor|uydur|kontrol|konum|k[ıi]skan/i.test(q)) intent = 'manipulation_or_control';
  else if (/tek taraf|hep ben|kar[şs][ıi]l[ıi]ks[ıi]z|dengesiz/i.test(q)) intent = 'one_sidedness';
  else if (/ben mi abart|kim hatal|kavga|tart[ıi][şs]|su[çc]/i.test(q)) intent = 'conflict_fault';
  else if (/ayr[ıi]lmal[ıi]|devam etmeli|bar[ıi][şs]|d[öo]ner mi/i.test(q)) intent = 'relationship_decision';

  const neededSignalsByIntent: Record<string, string[]> = {
    ghosting_or_interest_drop: ['avoidance', 'withdrawal', 'affection', 'planning', 'longing'],
    love_or_interest: ['affection', 'longing', 'reassurance', 'planning', 'futureTalk', 'avoidance', 'withdrawal'],
    manipulation_or_control: ['control', 'jealousy', 'manipulationLike', 'boundaryViolation', 'blameShifting', 'contempt', 'accountability'],
    one_sidedness: ['repairAttempt', 'accountability', 'affection', 'question', 'avoidance', 'withdrawal'],
    conflict_fault: ['criticism', 'contempt', 'defensiveness', 'apology', 'accountability', 'repairAttempt'],
  };
  const neededPatternsByIntent: Record<string, string[]> = {
    ghosting_or_interest_drop: ['slow_fade', 'hot_cold_cycle', 'breadcrumbing', 'reciprocity_drop'],
    love_or_interest: ['slow_fade', 'hot_cold_cycle', 'repair_imbalance'],
    manipulation_or_control: ['gaslighting_like', 'control_or_surveillance', 'guilt_tripping_like', 'repair_imbalance'],
    one_sidedness: ['emotional_labor_imbalance', 'repair_imbalance', 'slow_fade'],
    conflict_fault: ['repair_imbalance', 'gaslighting_like', 'control_or_surveillance'],
  };

  return {
    intent,
    questionType: intent === 'general_relationship_analysis' ? 'general' : 'relationship_pattern_analysis',
    targetPerson: /ben mi|bende|benim/i.test(q) ? 'user' : /o |onu|onda|partner|kar[şs][ıi]/i.test(q) ? 'partner' : 'both',
    timeRange: dateKeys[0]
      ? { mode: 'specific_date', startDate: dateKeys[0], endDate: dateKeys[0], days: null }
      : { mode: /son|yak[ıi]n|art[ıi]k|şimdi/i.test(q) ? 'recent' : 'all', startDate: null, endDate: null, days: /son|yak[ıi]n|art[ıi]k|şimdi/i.test(q) ? 30 : null },
    neededSignals: neededSignalsByIntent[intent] || ['affection', 'planning', 'avoidance', 'repairAttempt'],
    neededPatterns: neededPatternsByIntent[intent] || [],
    neededEpisodes: intent === 'conflict_fault' ? ['conflict', 'repair'] : intent === 'ghosting_or_interest_drop' ? ['ghosting_gap', 'slow_fade', 'withdrawal_period'] : [],
    retrievalStrategy: {
      messageLimit: intent === 'general_relationship_analysis' ? 16 : 24,
      includeRecentExamples: true,
      includeOldBaseline: ['ghosting_or_interest_drop', 'love_or_interest'].includes(intent),
      includeConflictEpisodes: ['conflict_fault', 'manipulation_or_control'].includes(intent),
      includeAffectionExamples: ['love_or_interest', 'ghosting_or_interest_drop'].includes(intent),
      includePlanEvents: /plan|bulu[şs]|iptal|gelecek/i.test(q),
      includeLongSilences: intent === 'ghosting_or_interest_drop',
      includeCounterEvidence: true,
    },
    answerStyle: safetyMode !== 'normal' ? 'protective' : intent === 'conflict_fault' ? 'balanced' : intent === 'manipulation_or_control' ? 'protective' : 'analytical',
    safetyMode,
    shouldAvoid: ['kesin psikolojik teşhis', 'kanıtsız suçlama', 'tek mesajdan kesin hüküm'],
    requiresCounterEvidence: true,
    confidence: 0.72,
  };
};

const createLlmPlan = async (analysis: AnalysisResult, query: string): Promise<CoachQueryPlan> => {
  const fallback = deterministicCoachPlan(query);
  if (!apiKey) return fallback;
  try {
    const prompt = buildCoachPlannerPrompt(
      query,
      analysis.participants.map(p => p.name),
      `${analysis.dateRange.start.toISOString().slice(0, 10)} / ${analysis.dateRange.end.toISOString().slice(0, 10)}`
    );
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        maxOutputTokens: 900,
      },
    });
    const parsed = parseJsonObject<CoachQueryPlan>(extractGeminiText(response));
    return parsed ? { ...fallback, ...parsed, retrievalStrategy: { ...fallback.retrievalStrategy, ...parsed.retrievalStrategy } } : fallback;
  } catch (error) {
    console.error('Coach planner LLM Error:', error);
    return fallback;
  }
};

const signalNames = (msg: NormalizedMessage): string[] => {
  const names: string[] = [];
  if (msg.hasQuestion) names.push('soru');
  if (msg.isShortReply) names.push('kısa cevap');
  if (msg.adjustedSignals.love || msg.signals.emotional || msg.signals.thanks) names.push('sevgi/duygu');
  if (msg.signals.planning || msg.signals.future) names.push('plan');
  if (msg.adjustedSignals.tension || msg.adjustedSignals.harsh || msg.signals.jealousy) names.push('gerilim');
  return names;
};

const buildContext = (analysis: AnalysisResult | null, query: string, viewerName?: string | null): CoachContext => {
  if (!analysis) {
    return { query, viewerName, names: [], compactSummary: null, retrieval: [], dayStats: [], patterns: [] };
  }

  const tokens = tokenize(query);
  const dateKeys = dateKeysFromQuery(query);
  const lowerTokens = new Set(tokens);

  const scored = analysis.normalizedMessages
    .filter(msg => !msg.isMedia && msg.content.trim().length > 0)
    .map(msg => {
      const lower = msg.content.toLocaleLowerCase('tr-TR');
      let score = 0;
      if (dateKeys.includes(msg.dateKey)) score += 10;
      tokens.forEach(token => {
        if (lower.includes(token)) score += 2;
      });
      if (/ayrıl|barış|aldat|kavga|tartış|soğuk|yazmad|görüldü|engelle/i.test(query)) {
        score += msg.adjustedSignals.tension + msg.adjustedSignals.harsh + msg.signals.jealousy + (msg.isShortReply ? 0.5 : 0);
      }
      if (/sev|aşk|özle|barış|ne yaz/i.test(query)) {
        score += msg.adjustedSignals.love + msg.signals.emotional + msg.signals.thanks + msg.signals.planning;
      }
      if (!lowerTokens.size && signalNames(msg).length) score += 0.2;
      return { msg, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => ({
      date: item.msg.dateKey,
      author: item.msg.author,
      text: maskSensitive(item.msg.content),
      signals: signalNames(item.msg),
    }));

  const dayStats = dateKeys.length
    ? analysis.dailyStats.filter(day => dateKeys.includes(day.date)).slice(0, 5)
    : analysis.dailyStats.slice().sort((a, b) => b.total - a.total).slice(0, 3);

  const matchedPatterns = matchPatternsToQuery(query, analysis.patterns).map(p => ({
    id: p.id,
    label: p.label,
    description: p.description,
    severity: Number(p.severity.toFixed(2)),
    occurrenceCount: p.occurrenceCount,
    perpetrator: p.perpetrator,
    victim: p.victim,
    dateRange: p.dateRange,
    evidence: p.evidence,
  }));

  return {
    query,
    viewerName,
    names: analysis.participants.map(p => p.name),
    compactSummary: analysis.llmSummary,
    retrieval: scored,
    dayStats,
    patterns: matchedPatterns,
  };
};

const fallbackCoachReply = (analysis: AnalysisResult | null, query: string, relationMode: RelationshipMode, viewerName?: string | null): string => {
  if (!analysis) {
    return 'Kanka sohbet analizini yüklemeden elimde kanıt yok; içgüdüyle gaz veririm ama veriyle konuşmak daha iyi. Dosyayı yükleyince gün gün bakıp netleşiriz.';
  }
  const profile = buildConversationProfile(analysis);
  const plan = deterministicCoachPlan(query);
  const insightContext = buildCoachInsightContext(query, plan, profile, analysis.participants.map(p => p.name));
  return fallbackInsightReply(insightContext, relationMode, viewerName);
};

const confidenceText = (confidence: number): string =>
  confidence >= 0.72 ? 'güçlü' : confidence >= 0.5 ? 'orta' : 'düşük';

const fallbackInsightReply = (
  context: CoachInsightContext,
  relationMode: RelationshipMode,
  _viewerName?: string | null
): string => {
  if (context.plan.safetyMode !== 'normal') {
    return 'Bu soru güvenlik tarafına dokunuyor olabilir. Mesaj örüntülerine göre yorum yapabilirim ama tehdit, takip, zorlama, şiddet veya kendine zarar riski varsa bunu tek başına çözmeye çalışma; güvendiğin birine, yerel acil destek hattına veya profesyonel desteğe hemen ulaş. Kanıt konuşmasını sonra yaparız, önce güvenlik.';
  }

  const topPattern = context.detectedPatterns[0];
  const evidenceLines = context.retrievedMessages
    .slice(0, 4)
    .map(item => `- ${item.timestamp.slice(0, 10)} ${item.speaker}: "${item.quoteMasked}" (${item.reason})`)
    .join('\n');
  const counterLines = context.counterEvidence
    .slice(0, 3)
    .map(item => `- ${item.timestamp.slice(0, 10)} ${item.speaker}: "${item.quoteMasked}"`)
    .join('\n');

  const metric = context.relevantMetrics;
  const introByIntent: Record<string, string> = {
    ghosting_or_interest_drop: `Ghosting demek için tek başına kesin konuşmam; ama geri çekilme/slow fade tarafında ${topPattern ? confidenceText(topPattern.confidence) : 'sınırlı'} sinyal var.`,
    love_or_interest: '“Seviyor mu?” sorusuna fal gibi kesin cevap veremem; mesajlarda sıcaklık, özlem, plan ve tutarlılık izlerine bakınca daha dengeli bir resim çıkar.',
    manipulation_or_control: 'Kesin “manipülasyon” etiketi basmam; ama kontrol, küçümseme, suç kaydırma veya gaslighting-benzeri dil tekrar ediyorsa bunu ciddiye almak gerekir.',
    one_sidedness: `Tek taraflılık için mesaj payı kadar onarma ve duygusal emek dengesine baktım; one-sidedness skoru yaklaşık ${metric.oneSidednessScore}.`,
    conflict_fault: 'Kim tamamen hatalı diye keskin hüküm vermek yerine tartışmadaki eylemlere baktım: suçlama, savunma, onarma ve sorumluluk alma.',
  };

  const patternText = topPattern
    ? `Öne çıkan örüntü: ${topPattern.summary} Güven: ${confidenceText(topPattern.confidence)}.`
    : 'Tekrarlayan güçlü bir örüntü sınırlı; bu yüzden cevabı daha temkinli okumak lazım.';

  const nextStep = relationMode === 'friend'
    ? 'Bence net ama yumuşak bir sınır cümlesi iyi olur: “Son dönemde iletişimimizde bir dengesizlik hissediyorum; bunu konuşabilir miyiz?”'
    : 'Pratik adım olarak suçlamadan, davranış üzerinden konuş: “Son dönemde cevap ritmimiz ve yakınlığımız değişti gibi hissediyorum; sen bunu nasıl görüyorsun?”';

  return [
    introByIntent[context.plan.intent] || 'Mesajlara göre kesin hüküm değil, örüntü okuması yapabilirim.',
    patternText,
    evidenceLines ? `Kanıt olarak baktığım parçalar:\n${evidenceLines}` : 'Bu soruya doğrudan bağlanacak yeterli kanıt parçası bulamadım.',
    counterLines ? `Karşı kanıt / belirsizlik:\n${counterLines}` : 'Belirgin karşı kanıt az; bu, kesinlik değil sadece veri sınırlılığı demek.',
    nextStep,
  ].join('\n\n');
};

const legacyFallbackCoachReply = (analysis: AnalysisResult | null, query: string, relationMode: RelationshipMode, viewerName?: string | null): string => {
  if (!analysis) {
    return 'Kanka sohbet analizini yüklemeden elimde kanıt yok; içgüdüyle gaz veririm ama veriyle konuşmak daha iyi. Dosyayı yükleyince gün gün bakıp netleşiriz.';
  }
  const context = buildContext(analysis, query, viewerName);
  const names = analysis.participants.map(p => p.name);
  const matchText = context.retrieval[0]
    ? `Baktığım en yakın parça ${context.retrieval[0].date} tarihinde ${context.retrieval[0].author} tarafında: "${context.retrieval[0].text}".`
    : 'Bu soruya birebir uyan güvenli bir mesaj parçası bulamadım.';

  const patternText = context.patterns.length
    ? `Veride şunu görüyorum kanka: ${context.patterns
        .slice(0, 2)
        .map(p => `${p.label.toLowerCase()} (${p.occurrenceCount} tekrar, ${p.dateRange.start} → ${p.dateRange.end}${p.perpetrator ? `, kaynak: ${p.perpetrator}` : ''})`)
        .join('; ')}.`
    : '';
  if (relationMode === 'friend') {
    const fun = analysis.nlpSignals.totals.playfulMessages;
    const support = analysis.nlpSignals.totals.thanks + analysis.nlpSignals.totals.apology + analysis.nlpSignals.totals.planning;
    const drama = analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.shortReplies * 0.25;
    const stance = support + fun >= drama
      ? 'Kanka burada romantik ilişki gibi okumuyorum; daha çok destek + iç şaka + gündelik ritim meselesi. Drama varsa bile dostluk zemini tamamen kararmamış.'
      : 'Kanka burada biraz “ben hep dinliyorum ama karşılığı ne?” sorusu doğuyor. Direkt kötülemem ama sınır konuşması iyi gelebilir.';
    return [matchText, patternText, `${stance} İstersen Zeyno modu ile ona kırmadan ama net bir mesaj taslağı çıkarayım.`]
      .filter(Boolean)
      .join('\n\n');
  }

  const tension = analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy;
  const love = analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks;
  const stance = tension > love * 0.45
    ? 'Kanka burada sınırlarını koruma tarafına biraz daha yaslanırım; hemen hüküm vermem ama bu ritim seni yoruyorsa ciddiye alınmalı.'
    : 'Kanka burada direkt kötü niyet demem; veri daha çok konuşup netleştirme tarafını destekliyor.';
  return [matchText, patternText, `${stance} ${names.find(name => name !== viewerName) || names[1] || 'karşı taraf'} için ağır etiket basmadan söyleyeyim: söz değil davranış sürekliliğine bak. İstersen ona yazılacak kısa, net ve gururlu bir mesaj taslağı çıkarayım.`]
    .filter(Boolean)
    .join('\n\n');
};

export const askRelationshipCoach = async (analysis: AnalysisResult | null, query: string, relationMode: RelationshipMode = 'lover', viewerName?: string | null): Promise<string> => {
  if (!analysis) return fallbackCoachReply(analysis, query, relationMode, viewerName);

  const profile = buildConversationProfile(analysis);
  const plan = await createLlmPlan(analysis, query);
  const insightContext = buildCoachInsightContext(query, plan, profile, analysis.participants.map(p => p.name));
  if (!apiKey) return fallbackInsightReply(insightContext, relationMode, viewerName);

  const prompt = buildCoachAnswerPrompt(insightContext, relationMode, viewerName);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.55,
        maxOutputTokens: 1800,
      },
    });
    return extractGeminiText(response) || fallbackInsightReply(insightContext, relationMode, viewerName);
  } catch (error) {
    console.error('Coach LLM Error:', error);
    return legacyFallbackCoachReply(analysis, query, relationMode, viewerName);
  }
};
