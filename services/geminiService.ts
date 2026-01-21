import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, GeminiInsight } from "../types";

const apiKey = process.env.API_KEY || ''; 
// Note: In a real production build, handle missing API key gracefully or prompt user if permitted. 
// Here we assume it is injected via env as per instructions.

const ai = new GoogleGenAI({ apiKey });

export const generateRelationshipInsights = async (analysis: AnalysisResult): Promise<GeminiInsight> => {
  if (!apiKey) {
    return {
      summary: "API Anahtarı eksik, yapay zeka analizi yapılamıyor.",
      negativeSummary: "Karanlık tarafı görmek için API anahtarı gerekiyor.",
      mostEmotional: "Veri yok",
      mostCurious: "Veri yok",
      mostInterested: "Veri yok",
      mostArgumentative: "Veri yok",
      mostUnfair: "Veri yok",
      mostToxic: "Veri yok",
      funFact: "API Anahtarı ekleyerek detaylı analiz alabilirsiniz."
    };
  }

  // Prepare prompt data
  const participantNames = analysis.participants.map(p => p.name).join(" ve ");
  const statsSummary = analysis.participants.map(p => 
    `${p.name}: ${p.messageCount} mesaj, Ortalama cevap süresi: ${p.avgResponseTimeMinutes.toFixed(1)} dk, Sevgi sözcükleri skoru: ${p.loveWordsScore}`
  ).join('\n');

  const prompt = `
    Sen bir ilişki koçu ve veri analistisin. Aşağıda ${participantNames} arasındaki bir WhatsApp sohbetinin istatistikleri ve örnek konuşmaları var.
    
    İSTATİSTİKLER:
    ${statsSummary}

    ÖRNEK KONUŞMA KESİTLERİ:
    ${analysis.sampleConversation.substring(0, 8000)} (Kısaltılmış)

    GÖREVİN:
    Bu verileri kullanarak JSON formatında hem "Aşk Dolu" (Pozitif) hem de "Kaotik/Karanlık" (Negatif/Hicivsel) yönleri analiz et.
    
    Lütfen şu alanları doldur:
    1. summary: İlişkinin genel dinamiklerini anlatan kısa, tatlı ve esprili bir paragraf (maks 3 cümle). "Ne kadar tatlı bir çift" tonunda.
    2. negativeSummary: İlişkinin gölgeli taraflarını, inatlaşmaları, kaprisleri veya kimin kimi darladığını anlatan, iğneleyici ve hicivsel bir "Karanlık Özet" (maks 3 cümle). "Bunlar birbirini yiyor" tonunda.
    
    POZİTİF ANALİZ:
    3. mostEmotional: Kim daha duygusal görünüyor ve neden? (Kısa cevap)
    4. mostCurious: Kim daha çok soru soruyor veya meraklı? (Kısa cevap)
    5. mostInterested: Kim ilişkiye daha fazla yatırım yapıyor veya daha ilgili? (Kısa cevap)

    NEGATİF / KAOS ANALİZİ (Acımasız ve komik ol):
    6. mostArgumentative: Kim daha çok kavga başlatıyor, sorun çıkarıyor veya tartışmaya meyilli? (Kısa cevap)
    7. mostUnfair: Kim daha anlayışsız, inatçı, trip atan veya empati yoksunu davranıyor? (Kısa cevap)
    8. mostToxic: Kim daha sert, kırıcı, argo veya 'evil' (şeytani) konuşuyor veya manipülatif? (Kısa cevap)

    9. funFact: Sohbetten veya istatistiklerden çıkarılan çok ilginç veya komik bir detay.

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
            funFact: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Boş yanıt");
    
    return JSON.parse(text) as GeminiInsight;

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      summary: "Yapay zeka şu anda biraz yorgun, daha sonra tekrar deneyin.",
      negativeSummary: "Karanlık güçler şu an devre dışı.",
      mostEmotional: "Analiz edilemedi",
      mostCurious: "Analiz edilemedi",
      mostInterested: "Analiz edilemedi",
      mostArgumentative: "Analiz edilemedi",
      mostUnfair: "Analiz edilemedi",
      mostToxic: "Analiz edilemedi",
      funFact: "Bağlantı hatası oluştu."
    };
  }
};
