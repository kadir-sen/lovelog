import { CoachChatTurn } from '../../types';
import { RelationshipMode } from '../relationshipReport';

export const buildCoachPlannerPrompt = (
  question: string,
  participants: string[],
  dateRange: string,
  relationMode: RelationshipMode,
  chatHistory: CoachChatTurn[] = [],
  todayISO: string = new Date().toISOString().slice(0, 10),
  previousIntent?: string | null,
): string => `
Sen LoveLog'un Türkçe sorgu planlayıcısısın. SADECE geçerli JSON döndür. Markdown veya açıklama yok.

Bugünün tarihi: ${todayISO}
Sohbet katılımcıları: ${participants.join(', ') || 'bilinmiyor'}
Sohbet tarih aralığı: ${dateRange}
Mod: ${relationMode === 'friend' ? 'arkadaşlık' : 'flört/ilişki'}
Önceki intent: ${previousIntent || '(yok)'}

Önceki tur bağlamı (en son 6):
${chatHistory.slice(-6).map(t => `${t.role}: ${t.content.replace(/\s+/g, ' ').slice(0, 240)}`).join('\n') || '(yok)'}

Türkçe kullanıcı sorusunu sınıflandır ve retrieval planı çıkar. Soruyu cevaplama.

Şema:
{
  "intent": string,
  "questionType": string,
  "targetPerson": "user" | "partner" | "both" | "unknown",
  "isFollowUp": boolean,
  "topicShift": boolean,
  "timeRange": {
    "mode": "all" | "recent" | "specific_date" | "specific_range" | "before_after",
    "startDate": string | null,
    "endDate": string | null,
    "days": number | null
  },
  "neededSignals": string[],
  "neededPatterns": string[],
  "neededEpisodes": string[],
  "retrievalStrategy": {
    "messageLimit": number,
    "includeRecentExamples": boolean,
    "includeOldBaseline": boolean,
    "includeConflictEpisodes": boolean,
    "includeAffectionExamples": boolean,
    "includePlanEvents": boolean,
    "includeLongSilences": boolean,
    "includeCounterEvidence": boolean
  },
  "answerStyle": "soft" | "direct" | "protective" | "analytical" | "balanced" | "decision",
  "safetyMode": "normal" | "emotional_distress" | "abuse_risk" | "self_harm_risk" | "violence_risk",
  "shouldAvoid": string[],
  "requiresCounterEvidence": boolean,
  "userClaimedNewEvidence": boolean,
  "confidence": number
}

Türkçe intent ipuçları:
- hediye / sürpriz / çiçek / aldı / yaptı / özür / telafi / güzel davranış / iyi gün => positive_gesture_check
- ghosting / soğudu / az yazıyor / görüldü kaldı / cevap vermiyor / yavaşladı => ghosting_or_interest_drop
- seviyor mu / hoşlanıyor mu / istiyor mu / özlüyor mu / aşk / takıntı => love_or_interest
- manipüle / narsist / gaslighting / abartıyorsun diyor / suç bana atıyor / çevirme / hep ben hatalıyım => manipulation_or_control
- giyim / kıyafet / kimle konuş / kimle görüş / saat / şifre / konum / takip / engelle / izin => personal_rights_violation
- tek taraflı / hep ben / karşılıksız / dengesiz / sadece ben emek / ben yazıyorum hep => one_sidedness
- ben mi abartıyorum / kim hatalı / kavga / tartışma / suç / haklı mıyım => conflict_fault
- ayrılmalı mıyım / devam etmeli miyim / barışmalı mıyım / dönmeli mi / sonu var mı => relationship_decision
- ailesi / annesi / babası / yakını / aile baskı / kıskanç aile => family_pressure
- aldat / başkası / üçüncü kişi / mesaj sildi / şüphe / gizli => loyalty_signal
- ne yazayım / ne diyeyim / nasıl mesaj / cevap taslağı / şöyle yazsam => script_request
- şu mesajla ne demek istedi / ne anlama geliyor / bunu nasıl okurum => decoding_request
- içime sinmedi / tuhaf hissediyorum / nedenini bilmiyorum ama / sezgi => gut_feeling
${relationMode === 'friend' ? '- arkadaş / kanka / vibe / trip / küstü / dışladı / çağırmadı / hep ben yazıyorum / dedikodu => friendship_dynamic' : ''}

Takip eden soru tespiti:
- Soru çok kısa veya zamir/işaret içeriyorsa ("peki ya", "yani", "sence", "ya o", "bu ne demek") → isFollowUp: true.
- Önceki intent'ten farklı bir konuya geçiyorsa → topicShift: true.
- isFollowUp=true ve topicShift=false ise → previousIntent'i koru.

userClaimedNewEvidence:
- Kullanıcı yeni mesajında "o şöyle dedi", "bana vurdu", "tehdit etti", "öldürürüm dedi" gibi sohbette OLMAYAN olaylar iddia ediyorsa → true.
- Bu durumda safetyMode'u sadece bu iddiaya bakarak yükseltme; dosyada kanıt yoksa "emotional_distress" ile sınırla. Kanıt sohbette varsa retrieval zaten bulur.

Güvenlik:
- intihar / kendime zarar / yaşamak istemiyorum / artık dayanamıyorum (somut) => self_harm_risk
- vurdu / döver / şiddet / fiziksel / takip ediyor / tehdit ediyor / korkuyorum => violence_risk
- istismar / baskı / zorla / izin vermiyor / kontrol ediyor (somut) => abuse_risk
- çok kötüyüm / çöktüm / dayanamıyorum (somut yok) => emotional_distress
- Klinik tanı etiketi koyma.

answerStyle:
- safetyMode != normal → protective
- relationship_decision veya personal_rights_violation → decision
- conflict_fault → balanced
- manipulation_or_control / positive_gesture_check / loyalty_signal → protective
- love_or_interest / friendship_dynamic / ghosting_or_interest_drop / decoding_request / gut_feeling → analytical
- script_request → direct

Soru: ${question}
`;
