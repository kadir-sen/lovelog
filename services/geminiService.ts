import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, GeminiInsight } from "../types";
import { RelationshipMode } from "./relationshipReport";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const unavailableInsight = (reason: string): GeminiInsight => ({
  summary: reason,
  negativeSummary: "Kaos yorumu için yapay zeka yanıtı alınamadı.",
  mostEmotional: "Veri yok",
  mostCurious: "Veri yok",
  mostInterested: "Veri yok",
  mostArgumentative: "Veri yok",
  mostUnfair: "Veri yok",
  mostToxic: "Veri yok",
  funFact: "Detaylı yorum için yapay zeka bağlantısı gerekiyor.",
  relationshipTimeline: "Dönemsel hikaye üretilemedi.",
  loveLanguageAnalysis: "Sevgi dili analizi üretilemedi.",
  communicationBalance: "İletişim dengesi yorumlanamadı.",
  responseRhythm: "Cevap ritmi yorumlanamadı.",
  tensionAnalysis: "Gerilim analizi üretilemedi.",
  evidenceBasedFun: "Kanıtlı eğlenceli çıkarım üretilemedi.",
  carefulAdvice: "Bu analiz sohbet metriklerinden türetilen eğlenceli bir yorumdur; kesin hüküm değildir."
});

export const generateRelationshipInsights = async (analysis: AnalysisResult, mode: RelationshipMode = 'lover'): Promise<GeminiInsight> => {
  if (!apiKey) {
    return unavailableInsight("API Anahtarı eksik, yapay zeka analizi yapılamıyor.");
  }

  const compactSummary = JSON.stringify(analysis.llmSummary);

  const prompt = `
    Sen Türkçe konuşan bir ilişki verisi yorumlayıcısısın.
    Analiz tipi: ${mode === 'friend' ? 'ARKADAŞLIK. Romantik sevgili analizi yapma; destek, eğlence, iç şaka, drama, karşılıklılık, plan yapma ve uzaklaşma sinyallerini yorumla.' : 'SEVGİLİ/ROMANTİK. Sevgi, flört, gerilim, cevap ritmi ve iletişim dengesini yorumla.'}
    Aşağıdaki veri ham WhatsApp konuşması değildir. Tarayıcıda çıkarılmış sıkıştırılmış NLP metrikleri ve kısa kanıt parçalarıdır.
    Kişi adları kullanıcının tercihiyle gerçek isimleriyle korundu; bu adları yorumlarda olduğu gibi kullan, takma ad türetme.
    Not: tension/harsh/love sayımları gülme tokenleri ve negasyon ("değil", "sevmiyorum") açısından düzeltilmiştir; "salak 😂" veya "seni sevmiyorum" gibi şaka/iğneleme/olumsuz ifadeler bu sayımlardan çıkarılmıştır. Sertlik yorumlarını bu düzeltilmiş sayımlara göre yap; ham metinde geçen kelimelerden hareketle ek varsayım kurma.

    KOMPAKT ANALİZ VERİSİ:
    ${compactSummary}

    GÖREVİN:
    Bu metrikleri kullanarak JSON formatında hem tatlı hem de hafif kaotik ama kanıta dayalı bir analiz üret.
    Kesin psikolojik teşhis koyma; "sinyal", "ritim", "izlenim" gibi dikkatli ifadeler kullan.
    LLM çıktısı anlatı katmanıdır; metriklerle çelişen iddialar üretme.

    Lütfen şu alanları doldur:
    1. summary: Genel dinamikleri anlatan kısa, tatlı ve esprili paragraf (maks 3 cümle).
    2. negativeSummary: Gölgeli tarafları iğneleyici ama ağır suçlayıcı olmayan bir "Kaos Özeti" olarak anlat (maks 3 cümle).
    3. mostEmotional: Kim daha duygusal görünüyor ve hangi sinyale göre?
    4. mostCurious: Kim daha çok soru soruyor veya meraklı?
    5. mostInterested: Kim daha ilgili veya ilişkiye daha çok emek veriyor?
    6. mostArgumentative: Kimde tartışma/gerilim sinyali daha yüksek görünüyor?
    7. mostUnfair: Kimde dengesizlik veya zorlayıcı iletişim sinyali görünüyor?
    8. mostToxic: Kimde sert dil sinyali daha belirgin? Ağır itham kurma.
    9. funFact: İstatistiklerden çıkan ilginç veya komik bir detay.
    10. relationshipTimeline: Dönemsel ilişki hikayesini 2-4 cümlede anlat.
    11. loveLanguageAnalysis: Sevgi dili ve şefkat sinyallerini özetle.
    12. communicationBalance: İletişim dengesi, soru sorma ve başlatma ritmini yorumla.
    13. responseRhythm: Cevap verme ritmini ortalama ve medyan farkına dikkat ederek yorumla.
    14. tensionAnalysis: Gerilim/kaos sinyallerini ölçülü ve eğlenceli şekilde açıkla.
    15. evidenceBasedFun: Kanıt parçalarına dayalı eğlenceli bir çıkarım yap.
    16. carefulAdvice: Bunun kesin hüküm değil, sohbet ritmine dayalı eğlenceli analiz olduğunu nazikçe hatırlatan kısa not.

    Yanıtı sadece saf JSON olarak ver.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            negativeSummary: { type: Type.STRING },
            mostEmotional: { type: Type.STRING },
            mostCurious: { type: Type.STRING },
            mostInterested: { type: Type.STRING },
            mostArgumentative: { type: Type.STRING },
            mostUnfair: { type: Type.STRING },
            mostToxic: { type: Type.STRING },
            funFact: { type: Type.STRING },
            relationshipTimeline: { type: Type.STRING },
            loveLanguageAnalysis: { type: Type.STRING },
            communicationBalance: { type: Type.STRING },
            responseRhythm: { type: Type.STRING },
            tensionAnalysis: { type: Type.STRING },
            evidenceBasedFun: { type: Type.STRING },
            carefulAdvice: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Boş yanıt");

    return JSON.parse(text) as GeminiInsight;
  } catch (error) {
    console.error("Gemini Error:", error);
    return unavailableInsight("Yapay zeka şu anda yanıt veremiyor, daha sonra tekrar deneyin.");
  }
};
