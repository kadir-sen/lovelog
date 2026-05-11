import { AnalysisResult, BehavioralPattern, CoachChatTurn, CoachInsightContext, CoachQueryPlan, NormalizedMessage, PatternEvidence } from '../types';
import { RelationshipMode } from './relationshipReport';
import { matchPatternsToQuery } from './patternDetectors';
import { buildCoachInsightContext } from './coachRetrieval';
import { buildConversationProfile } from './relationshipMemory';
import { ConversationProfile } from '../types';

// analyzeChat sırasında precompute edilmiş profil varsa onu kullan; yoksa eski
// lazy build'e düş (cihazdan yüklenen eski kayıtlar / persistence'tan strip
// edilmiş profile için backwards-compat).
const getOrBuildProfile = (
  analysis: AnalysisResult,
  viewerName: string | null | undefined,
  relationMode: RelationshipMode,
): ConversationProfile => {
  const cached = analysis.coachProfile;
  if (cached) {
    const expectedRange = `${analysis.dateRange.start.toISOString().slice(0, 10)}/${analysis.dateRange.end.toISOString().slice(0, 10)}`;
    const cachedRange = `${cached.dateRange.start}/${cached.dateRange.end}`;
    // viewerName veya relationMode değiştiyse profile yeniden kurulur.
    if (cachedRange === expectedRange && cached.totalMessages === analysis.totalMessages) return cached;
  }
  return buildConversationProfile(analysis, viewerName, relationMode);
};
import { buildCoachSystemInstruction, buildCoachAnswerPrompt } from './prompts/coachAnswerPrompt';
import { buildCoachPlannerPrompt } from './prompts/coachPlannerPrompt';
import { llmGenerate, llmStream, LlmUnavailableError } from './apiClient';

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
  return (direct || partsText).trim();
};

export const deterministicCoachPlan = (query: string, relationMode: RelationshipMode = 'lover'): CoachQueryPlan => {
  const q = query.toLocaleLowerCase('tr-TR');
  const dateKeys = dateKeysFromQuery(query);
  const safetyMode: CoachQueryPlan['safetyMode'] =
    /intihar|kendime zarar|ölmek istiyorum|yaşamak istemiyorum/i.test(q) ? 'self_harm_risk'
    : /tehdit|vur|döv|şiddet|takip ediyor|zorladı|korkuyorum/i.test(q) ? 'violence_risk'
    : /istismar|baskı|zorla|kontrol ediyor/i.test(q) ? 'abuse_risk'
    : /çok kötüyüm|dayanamıyorum|çöktüm/i.test(q) ? 'emotional_distress'
    : 'normal';

  let intent = 'general_relationship_analysis';
  if (/giyim|k[ıi]yafet|ne giyece[ğg]im|kimle konu[şs]|kimle g[öo]r[üu][şs]|saat ka[çc]ta|nereye gid|telefon[ıi]|şifre|konum payla[şs]|takip|engelle/i.test(q)) intent = 'personal_rights_violation';
  else if (/ne yazay[ıi]m|ne diyeyim|nas[ıi]l mesaj|cevap tasla[ğg]|[şs][öo]yle yazsam|ne yazsam/i.test(q)) intent = 'script_request';
  else if (/ne demek istedi|ne anlama gel|nas[ıi]l okurum|bu mesaj[ıi] nas[ıi]l|bu ne demek/i.test(q)) intent = 'decoding_request';
  else if (/i[çc]ime sinmedi|tuhaf hissediyorum|sezgim|nedenini bilmiyorum ama/i.test(q)) intent = 'gut_feeling';
  else if (/aldat|ba[şs]kas[ıi]|[üu][çc][üu]nc[üu] ki[şs]i|mesaj sildi|gizli|[şs][üu]phe/i.test(q)) intent = 'loyalty_signal';
  else if (/ailesi|annesi|babas[ıi]|yak[ıi]n[ıi]|aile bask[ıi]/i.test(q)) intent = 'family_pressure';
  else if (/hediye|s[üu]rpriz|çiçek|cicek|ald[ıi]|alm[ıi]ş|yapt[ıi]|jest|do[ğg]um g[üu]n|y[ıi]ld[öo]n[üu]m|kutlad[ıi]|unutmu[şs]|telafi/i.test(q)) intent = 'positive_gesture_check';
  else if (relationMode === 'friend' && /arkada[şs]|kanka|bestie|vibe|trip|küs|d[ıi][şs]lad|ça[ğg][ıi]rmad|hep ben|görüldü|cevap vermiyor|so[ğg]uk/i.test(q)) intent = 'friendship_dynamic';
  else if (/ghost|so[ğg]u|ilgisi azald|az yaz|görüldü|cevap vermiyor|yavaş/i.test(q)) intent = 'ghosting_or_interest_drop';
  else if (/seviyor|seviyor mu|ho[şs]lan|istiyor|özlüyor|a[şs]k/i.test(q)) intent = 'love_or_interest';
  else if (/manip[üu]le|narsist|gaslighting|abart[ıi]yor|uydur|kontrol|k[ıi]skan/i.test(q)) intent = 'manipulation_or_control';
  else if (/tek taraf|hep ben|kar[şs][ıi]l[ıi]ks[ıi]z|dengesiz/i.test(q)) intent = 'one_sidedness';
  else if (/ben mi abart|kim hatal|kavga|tart[ıi][şs]|su[çc]/i.test(q)) intent = 'conflict_fault';
  else if (/ayr[ıi]l(?:al[ıi]m|mal[ıi]|sak|d[ıi]k m[ıi]|sam? m[ıi]|al[ıi]m m[ıi]|ay[ıi]m)|devam etmeli|bar[ıi][şs]|d[öo]ner mi|d[öo]neyim mi|bitirelim|bitirsem mi|terk etmeli/i.test(q)) intent = 'relationship_decision';

  const neededSignalsByIntent: Record<string, string[]> = {
    ghosting_or_interest_drop: ['avoidance', 'withdrawal', 'affection', 'planning', 'longing'],
    love_or_interest: ['affection', 'longing', 'reassurance', 'planning', 'futureTalk', 'avoidance', 'withdrawal'],
    manipulation_or_control: ['control', 'jealousy', 'manipulationLike', 'boundaryViolation', 'blameShifting', 'contempt', 'accountability'],
    personal_rights_violation: ['control', 'jealousy', 'boundaryViolation', 'manipulationLike', 'contempt'],
    one_sidedness: ['repairAttempt', 'accountability', 'affection', 'question', 'avoidance', 'withdrawal'],
    conflict_fault: ['criticism', 'contempt', 'defensiveness', 'apology', 'accountability', 'repairAttempt'],
    friendship_dynamic: ['friendSupport', 'insideJoke', 'friendCheckIn', 'friendReciprocity', 'friendExclusion', 'friendDrama', 'planning', 'cancellation', 'withdrawal'],
    positive_gesture_check: ['affection', 'reassurance', 'planning', 'futureTalk', 'apology', 'repairAttempt', 'accountability', 'avoidance', 'withdrawal', 'manipulationLike', 'contempt', 'control', 'jealousy'],
    relationship_decision: ['affection', 'repairAttempt', 'accountability', 'avoidance', 'withdrawal', 'control', 'jealousy', 'manipulationLike', 'contempt'],
    family_pressure: ['boundaryViolation', 'control', 'planning', 'avoidance'],
    loyalty_signal: ['avoidance', 'withdrawal', 'manipulationLike', 'jealousy', 'control'],
    script_request: ['affection', 'repairAttempt', 'accountability', 'planning'],
    decoding_request: ['affection', 'avoidance', 'manipulationLike', 'planning'],
    gut_feeling: ['avoidance', 'withdrawal', 'manipulationLike', 'control', 'jealousy', 'contempt'],
  };
  const neededPatternsByIntent: Record<string, string[]> = {
    ghosting_or_interest_drop: ['slow_fade', 'hot_cold_cycle', 'breadcrumbing', 'reciprocity_drop'],
    love_or_interest: ['slow_fade', 'hot_cold_cycle', 'repair_imbalance'],
    manipulation_or_control: ['gaslighting_like', 'control_or_surveillance', 'guilt_tripping_like', 'repair_imbalance'],
    personal_rights_violation: ['control_or_surveillance', 'guilt_tripping_like', 'gaslighting_like', 'jealousy_spiral'],
    one_sidedness: ['emotional_labor_imbalance', 'repair_imbalance', 'slow_fade'],
    conflict_fault: ['repair_imbalance', 'gaslighting_like', 'control_or_surveillance'],
    friendship_dynamic: ['emotional_labor_imbalance', 'repair_imbalance', 'reciprocity_drop', 'plan_cancel_pattern'],
    positive_gesture_check: ['love_bombing_like', 'hot_cold_cycle', 'slow_fade', 'repair_imbalance', 'future_faking_like', 'gaslighting_like', 'control_or_surveillance'],
    relationship_decision: ['repair_imbalance', 'hot_cold_cycle', 'slow_fade', 'gaslighting_like', 'control_or_surveillance', 'attack_apology_cycle', 'love_bombing_like'],
    family_pressure: ['control_or_surveillance', 'guilt_tripping_like'],
    loyalty_signal: ['slow_fade', 'breadcrumbing', 'hot_cold_cycle'],
    gut_feeling: ['slow_fade', 'hot_cold_cycle', 'gaslighting_like', 'control_or_surveillance'],
  };

  return {
    intent,
    questionType: intent === 'general_relationship_analysis' ? 'general' : relationMode === 'friend' ? 'friendship_pattern_analysis' : 'relationship_pattern_analysis',
    targetPerson: /ben mi|bende|benim/i.test(q) ? 'user' : /o |onu|onda|partner|kar[şs][ıi]/i.test(q) ? 'partner' : 'both',
    timeRange: dateKeys[0]
      ? { mode: 'specific_date', startDate: dateKeys[0], endDate: dateKeys[0], days: null }
      : { mode: /son|yak[ıi]n|art[ıi]k|şimdi/i.test(q) ? 'recent' : 'all', startDate: null, endDate: null, days: /son|yak[ıi]n|art[ıi]k|şimdi/i.test(q) ? 30 : null },
    neededSignals: neededSignalsByIntent[intent] || ['affection', 'planning', 'avoidance', 'repairAttempt'],
    neededPatterns: neededPatternsByIntent[intent] || [],
    neededEpisodes: intent === 'conflict_fault' ? ['conflict', 'repair'] : intent === 'ghosting_or_interest_drop' ? ['ghosting_gap', 'slow_fade', 'withdrawal_period'] : [],
    retrievalStrategy: {
      messageLimit: intent === 'general_relationship_analysis' ? 16 : relationMode === 'friend' ? 28 : 24,
      includeRecentExamples: true,
      includeOldBaseline: ['ghosting_or_interest_drop', 'love_or_interest', 'positive_gesture_check'].includes(intent),
      includeConflictEpisodes: ['conflict_fault', 'manipulation_or_control', 'positive_gesture_check'].includes(intent),
      includeAffectionExamples: ['love_or_interest', 'ghosting_or_interest_drop', 'positive_gesture_check'].includes(intent),
      includePlanEvents: /plan|bulu[şs]|iptal|gelecek/i.test(q),
      includeLongSilences: intent === 'ghosting_or_interest_drop',
      includeCounterEvidence: true,
    },
    answerStyle: safetyMode !== 'normal'
      ? 'protective'
      : intent === 'relationship_decision' || intent === 'personal_rights_violation'
      ? 'decision'
      : intent === 'conflict_fault' || intent === 'friendship_dynamic'
      ? 'balanced'
      : intent === 'manipulation_or_control' || intent === 'positive_gesture_check' || intent === 'loyalty_signal'
      ? 'protective'
      : intent === 'script_request'
      ? 'direct'
      : 'analytical',
    safetyMode,
    shouldAvoid: ['kesin psikolojik teşhis', 'kanıtsız suçlama', 'tek mesajdan kesin hüküm'],
    requiresCounterEvidence: true,
    confidence: 0.72,
  };
};

// Basit, tek-niyetli sorularda LLM planner'a gerek yok; deterministic plan yeterli.
// LLM planner sadece (a) tarih/zaman aralığı, (b) çok-kriterli sorgu, (c) takip sorusu (chat history > 0)
// ya da (d) deterministic plan'ın "general_relationship_analysis"a düştüğü belirsiz sorular için.
const shouldUseLlmPlanner = (query: string, fallbackPlan: CoachQueryPlan, chatHistory: CoachChatTurn[]): boolean => {
  if (chatHistory.length > 0) return true;
  if (fallbackPlan.intent === 'general_relationship_analysis') return true;
  if (fallbackPlan.timeRange.mode !== 'all') return true;
  // Çok kriterli ipucu: "ve / ama / hem ... hem" + 60+ karakter
  if (query.length > 60 && /\b(ve|ama|fakat|hem|veya)\b/i.test(query)) return true;
  return false;
};

const createLlmPlan = async (
  analysis: AnalysisResult,
  query: string,
  relationMode: RelationshipMode,
  chatHistory: CoachChatTurn[] = [],
  signal?: AbortSignal,
): Promise<CoachQueryPlan> => {
  const fallback = deterministicCoachPlan(query, relationMode);
  if (!shouldUseLlmPlanner(query, fallback, chatHistory)) return fallback;
  try {
    const previousIntent = [...chatHistory].reverse().find(turn => turn.intent)?.intent ?? null;
    const todayISO = new Date().toISOString().slice(0, 10);
    const prompt = buildCoachPlannerPrompt(
      query,
      analysis.participants.map(p => p.name),
      `${analysis.dateRange.start.toISOString().slice(0, 10)} / ${analysis.dateRange.end.toISOString().slice(0, 10)}`,
      relationMode,
      chatHistory,
      todayISO,
      previousIntent,
    );
    const response = await llmGenerate({
      model: 'gemini-2.5-flash',
      prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        maxOutputTokens: 900,
      },
      signal,
    });
    const parsed = parseJsonObject<CoachQueryPlan>(extractGeminiText(response));
    return parsed ? { ...fallback, ...parsed, retrievalStrategy: { ...fallback.retrievalStrategy, ...parsed.retrievalStrategy } } : fallback;
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw error;
    if (!(error instanceof LlmUnavailableError)) console.error('Coach planner LLM Error:', error);
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
  if ((msg as any).signals.friendSupport || (msg as any).signals.insideJoke) names.push('arkadaşlık desteği/vibe');
  if ((msg as any).signals.friendDrama || (msg as any).signals.friendExclusion) names.push('arkadaşlık draması');
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

const fallbackCoachReply = (
  analysis: AnalysisResult | null,
  query: string,
  relationMode: RelationshipMode,
  viewerName?: string | null,
  chatHistory: CoachChatTurn[] = []
): string => {
  if (!analysis) {
    return 'Kanka sohbet analizini yüklemeden elimde kanıt yok; içgüdüyle gaz veririm ama veriyle konuşmak daha iyi. Dosyayı yükleyince gün gün bakıp netleşiriz.';
  }
  const profile = getOrBuildProfile(analysis, viewerName, relationMode);
  const plan = deterministicCoachPlan(query, relationMode);
  const insightContext = buildCoachInsightContext(query, plan, profile, analysis.participants.map(p => p.name), relationMode, viewerName, chatHistory);
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
    friendship_dynamic: 'Bunu romantik ilişki gibi okumuyorum; arkadaşlıkta destek, çağırma/çağırmama, plan tutarlılığı, iç şaka ve trip/soğuma izlerine baktım.',
    positive_gesture_check: 'Jest güzel olabilir; ama bunu tek başına romantize etmeden, geçmişte ihmal/soğuma/kontrol/telafi döngüsü var mı diye de kontrol ettim.',
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

export const askRelationshipCoach = async (
  analysis: AnalysisResult | null,
  query: string,
  relationMode: RelationshipMode = 'lover',
  viewerName?: string | null,
  chatHistory: CoachChatTurn[] = [],
  signal?: AbortSignal,
): Promise<string> => {
  if (!analysis) return fallbackCoachReply(analysis, query, relationMode, viewerName, chatHistory);

  const profile = getOrBuildProfile(analysis, viewerName, relationMode);
  const plan = await createLlmPlan(analysis, query, relationMode, chatHistory, signal);
  const insightContext = buildCoachInsightContext(query, plan, profile, analysis.participants.map(p => p.name), relationMode, viewerName, chatHistory);

  const systemInstruction = buildCoachSystemInstruction(relationMode);
  const prompt = buildCoachAnswerPrompt(insightContext, relationMode, viewerName);

  try {
    const response = await llmGenerate({
      model: 'gemini-2.5-flash',
      prompt,
      config: {
        systemInstruction,
        temperature: 0.6,
        maxOutputTokens: 1200,
      },
      signal,
    });
    return extractGeminiText(response) || fallbackInsightReply(insightContext, relationMode, viewerName);
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw error;
    if (error instanceof LlmUnavailableError) return fallbackInsightReply(insightContext, relationMode, viewerName);
    console.error('Coach LLM Error:', error);
    return legacyFallbackCoachReply(analysis, query, relationMode, viewerName);
  }
};

export type CoachStreamEvent =
  | { type: 'intent'; intent: string }
  | { type: 'bubble'; text: string }
  | { type: 'done' };

// Modeller bazen baloncuk ayırıcı olarak `\n\n` yerine `---`, `===`, `***`
// veya tek `\n` kullanıyor. Hepsini ayırıcı kabul ediyoruz; hiçbiri yoksa
// metni tek baloncuk olarak döndürmek yerine cümle/punctuation tabanlı
// kaba bir bölme yapıyoruz ki kullanıcı duvar metin görmesin.
const BUBBLE_SEPARATOR = /\n\s*\n|\n\s*[-=*]{3,}\s*\n?|\n\s*[-=*]{3,}\s*$/;

const splitBubbles = (text: string): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(BUBBLE_SEPARATOR)
    .map(s => s.replace(/^[-=*\s]+|[-=*\s]+$/g, '').trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  // Ayırıcı bulunamadıysa cümle sonu noktalarına göre 2-3 cümlelik gruplar yap.
  const sentences = trimmed.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/g) ?? [trimmed];
  if (sentences.length <= 2) return [trimmed];
  const grouped: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    grouped.push(sentences.slice(i, i + 2).join('').trim());
  }
  return grouped.filter(Boolean);
};

// Stream sırasında buffer'da en erken görülen ayırıcının konumunu döndür.
// Index ve uzunluk verir; çağıran kısım kesip bir baloncuk yayınlar.
const findBubbleBoundary = (buffer: string): { index: number; length: number } | null => {
  const re = /\n\s*\n|\n\s*[-=*]{3,}\s*\n/g;
  const m = re.exec(buffer);
  if (!m) return null;
  return { index: m.index, length: m[0].length };
};

export async function* askRelationshipCoachStream(
  analysis: AnalysisResult | null,
  query: string,
  relationMode: RelationshipMode = 'lover',
  viewerName?: string | null,
  chatHistory: CoachChatTurn[] = [],
  signal?: AbortSignal,
): AsyncGenerator<CoachStreamEvent, void, unknown> {
  if (!analysis) {
    const fallback = fallbackCoachReply(analysis, query, relationMode, viewerName, chatHistory);
    yield { type: 'intent', intent: 'general_relationship_analysis' };
    for (const bubble of splitBubbles(fallback)) yield { type: 'bubble', text: bubble };
    yield { type: 'done' };
    return;
  }

  const profile = getOrBuildProfile(analysis, viewerName, relationMode);
  const plan = await createLlmPlan(analysis, query, relationMode, chatHistory, signal);
  if (signal?.aborted) return;
  yield { type: 'intent', intent: plan.intent };

  const insightContext = buildCoachInsightContext(query, plan, profile, analysis.participants.map(p => p.name), relationMode, viewerName, chatHistory);

  const systemInstruction = buildCoachSystemInstruction(relationMode);
  const prompt = buildCoachAnswerPrompt(insightContext, relationMode, viewerName);

  const emitFallback = function* (): Generator<CoachStreamEvent> {
    for (const bubble of splitBubbles(fallbackInsightReply(insightContext, relationMode, viewerName))) {
      yield { type: 'bubble', text: bubble };
    }
  };

  try {
    let buffer = '';
    let streamErrored = false;
    for await (const ev of llmStream({
      model: 'gemini-2.5-flash',
      prompt,
      config: { systemInstruction, temperature: 0.6, maxOutputTokens: 1200 },
      signal,
    })) {
      if (signal?.aborted) return;
      if (ev.type === 'chunk') {
        buffer += ev.text;
        while (true) {
          const boundary = findBubbleBoundary(buffer);
          if (!boundary) break;
          const bubble = buffer.slice(0, boundary.index).replace(/^[-=*\s]+|[-=*\s]+$/g, '').trim();
          buffer = buffer.slice(boundary.index + boundary.length);
          if (bubble) yield { type: 'bubble', text: bubble };
        }
      } else if (ev.type === 'error') {
        streamErrored = true;
        console.error('Coach LLM stream error:', ev.message);
      }
    }
    // Stream temiz bittiyse: kalan buffer için splitBubbles ile esnek bölme
    // (hiç \n\n görmediysek bile cümle bazlı kaba böl).
    if (!streamErrored && buffer.trim()) {
      for (const bubble of splitBubbles(buffer)) yield { type: 'bubble', text: bubble };
    }
    if (streamErrored) {
      for (const bubble of emitFallback()) yield bubble;
    }
  } catch (error) {
    if ((error as any)?.name === 'AbortError') return;
    if (!(error instanceof LlmUnavailableError)) console.error('Coach LLM stream transport error:', error);
    for (const bubble of emitFallback()) yield bubble;
  }
  yield { type: 'done' };
}

export const suggestQuickReplies = async (
  lastQuestion: string,
  lastAnswer: string,
  recentMessages: { date: string; speaker: string; text: string }[],
  signal?: AbortSignal,
): Promise<string[]> => {
  if (!lastAnswer.trim()) return [];
  try {
    const prompt = `
Aşağıdaki Türkçe sohbet koçu cevabına ve sohbetin son mesajlarına bak. Kullanıcının yazabileceği 3 doğal kısa follow-up öner.

Kurallar:
- Her öneri 2-6 kelime, küçük harf, samimi sohbet dili.
- Birbirinden farklı yönlere açılsın: biri derinleşme ("neden böyle düşünüyorsun?"), biri eylem ("ne yazayım peki?"), biri sınama ("ya tam tersi olduysa?").
- Sadece JSON dizisi döndür: ["...", "...", "..."]

Önceki soru: ${lastQuestion}
Koç cevabı: ${lastAnswer.slice(0, 800)}
Sohbetin son mesajları:
${recentMessages.slice(-6).map(m => `[${m.date}] ${m.speaker}: ${m.text.slice(0, 120)}`).join('\n') || '(yok)'}
`;
    const response = await llmGenerate({
      model: 'gemini-2.5-flash',
      prompt,
      config: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 200 },
      signal,
    });
    const arr = parseJsonObject<string[]>(extractGeminiText(response));
    return Array.isArray(arr) ? arr.slice(0, 3).filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
};
