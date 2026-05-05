import { GoogleGenAI } from '@google/genai';
import { AnalysisResult } from '../types';
import { RelationshipMode } from './relationshipReport';

export type FalMode = 'tarot' | 'kahve' | 'burc' | 'el';

export interface FalReading {
  title: string;
  reading: string;
  symbols: Array<{ label: string; value: string; note: string }>;
}

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const pick = <T,>(items: T[], seed: number): T => items[Math.abs(seed) % items.length];

const fallbackReading = (analysis: AnalysisResult | null, mode: FalMode, relationMode: RelationshipMode, nonce = 0): FalReading => {
  const p1 = analysis?.participants[0]?.name ?? 'Sen';
  const p2 = analysis?.participants[1]?.name ?? 'O';
  const totalPositive = analysis
    ? analysis.nlpSignals.totals.loveAdjusted + analysis.nlpSignals.totals.emotional + analysis.nlpSignals.totals.thanks
    : 0;
  const totalFriction = analysis
    ? analysis.nlpSignals.totals.tensionAdjusted + analysis.nlpSignals.totals.harshAdjusted + analysis.nlpSignals.totals.jealousy
    : 0;
  const topEmoji = analysis?.emojiAnalysis[0]?.char ?? '♡';
  const tone = totalPositive >= totalFriction ? 'tatlı ama nazlı' : 'biraz dumanlı, biraz netlik isteyen';
  const subject = relationMode === 'friend' ? 'arkadaşlık' : 'ilişki';
  const openings = [
    `${p1} ve ${p2} arasında ${tone} bir ${subject} enerjisi görünüyor.`,
    `Bu açılımda ${subject} ritmi düz bir çizgi değil; ${tone} bir dalgalanma veriyor.`,
    `Falda ilk çıkan şey şu: ${p1} ve ${p2} tarafında sözlerden çok tekrar eden davranış ritmi konuşuyor.`,
    `${topEmoji} sembolü bu açılımın kapısını açtı; ${subject} tarafında küçük işaretler büyük ritmi anlatıyor.`,
  ];
  const advice = relationMode === 'friend'
    ? [
        'Kanka falı diyor ki: dramatize etmeden karşılıklılığa bak.',
        'Plan, destek ve iç şaka aynı anda görünüyorsa bu bağın ana dili orada.',
        'Biraz mesafe varsa bile önce niyet değil ritim oku.',
      ]
    : [
        'Fal diliyle söyleyeyim: söz kadar davranış sürekliliğine de bak.',
        'Tatlı sinyal varsa büyüt, pürüz varsa isim koymadan konuş.',
        'Kalp tarafı romantik; ama netlik tarafı küçük bir konuşma istiyor.',
      ];

  return {
    title: mode === 'tarot' ? 'Üç Kart Açılımı' : mode === 'kahve' ? 'Fincan Yorumu' : mode === 'burc' ? 'Uyum Haritası' : 'El Çizgisi Yorumu',
    reading: `${pick(openings, nonce)} ${topEmoji} sembolü sık görünmüş; bu da sohbet dilinde küçük ama tekrar eden bir işaret gibi. ${pick(advice, nonce + totalPositive + totalFriction)}`,
    symbols: [
      { label: relationMode === 'friend' ? 'Vibe' : 'Sevgi', value: String(totalPositive), note: relationMode === 'friend' ? 'destek, gülme ve pozitif kanka dili' : 'sevgi, duygu ve teşekkür sinyalleri' },
      { label: relationMode === 'friend' ? 'Drama' : 'Kaos', value: String(totalFriction), note: 'gerilim ve sürtüşme sinyalleri' },
      { label: 'Sembol', value: topEmoji, note: 'en görünür emoji' },
    ],
  };
};

export const generateFalReading = async (analysis: AnalysisResult | null, mode: FalMode, relationMode: RelationshipMode = 'lover', nonce = 0): Promise<FalReading> => {
  if (!apiKey || !analysis) return fallbackReading(analysis, mode, relationMode, nonce);

  const prompt = `
Sen LoveLog uygulamasında eğlenceli ama veriye dayalı Türkçe fal yorumcususun.
Fal modu: ${mode}
Açılım varyasyonu: ${nonce}. Aynı metni tekrar etme; önceki açılımlardan farklı sembol, başlık ve vurgu kullan.
Analiz tipi: ${relationMode === 'friend' ? 'ARKADAŞLIK. Romantik aşk yorumu yapma; destek, eğlence, kanka dili, drama, uzaklaşma, plan yapma, iç şaka ve karşılıklılık üzerinden yorumla.' : 'SEVGİLİ/ROMANTİK. Sevgi dili, ritim, gerilim ve flört sinyalleri üzerinden yorumla.'}
Kurallar:
- Ham sohbet yok; sadece kompakt metrik özeti var.
- Kesin gelecek iddiası, psikolojik teşhis veya ağır suçlama üretme.
- Yorum mistik/eğlenceli olsun ama mesaj ritmi, emoji, sevgi/kaos sinyallerine dayansın.
- Kısa tut: title, reading ve 3 sembol.

KOMPAKT ÖZET:
${JSON.stringify(analysis.llmSummary).slice(0, 9000)}

Sadece şu JSON formatında yanıt ver:
{
  "title": "kısa başlık",
  "reading": "2-4 cümlelik Türkçe fal yorumu",
  "symbols": [{"label":"...","value":"...","note":"..."}]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.9,
        maxOutputTokens: 700,
      },
    });
    const text = response.text;
    if (!text) return fallbackReading(analysis, mode, relationMode, nonce);
    const parsed = JSON.parse(text) as FalReading;
    const fallback = fallbackReading(analysis, mode, relationMode, nonce);
    return {
      title: parsed.title || fallback.title,
      reading: parsed.reading || fallback.reading,
      symbols: Array.isArray(parsed.symbols) && parsed.symbols.length ? parsed.symbols.slice(0, 4) : fallback.symbols,
    };
  } catch (error) {
    console.error('Fal LLM Error:', error);
    return fallbackReading(analysis, mode, relationMode, nonce);
  }
};
