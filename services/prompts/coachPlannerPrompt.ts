export const buildCoachPlannerPrompt = (question: string, participants: string[], dateRange: string): string => `
You are LoveLog's query planner. Return strict JSON only. No markdown. No prose.

Conversation participants: ${participants.join(', ') || 'unknown'}
Conversation date range: ${dateRange}

Classify the Turkish user question and create a retrieval plan. Do not answer the question.

Schema:
{
  "intent": string,
  "questionType": string,
  "targetPerson": "user" | "partner" | "both" | "unknown",
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
  "answerStyle": "soft" | "direct" | "protective" | "analytical" | "balanced",
  "safetyMode": "normal" | "emotional_distress" | "abuse_risk" | "self_harm_risk" | "violence_risk",
  "shouldAvoid": string[],
  "requiresCounterEvidence": boolean,
  "confidence": number
}

Intent hints:
- ghosting / ilgisi azaldı / soğudu => ghosting_or_interest_drop
- seviyor mu / istekli mi => love_or_interest
- manipüle / narsist / gaslighting / kontrol => manipulation_or_control
- tek taraflı / hep ben => one_sidedness
- ben mi abartıyorum / kim hatalı => conflict_fault
- ayrılmalı mıyım / tehlike / tehdit => safety_or_decision

Safety:
- self-harm or suicide => self_harm_risk
- threat, violence, stalking, coercion => violence_risk or abuse_risk
- diagnostic labels must be avoided.

Question: ${question}
`;
