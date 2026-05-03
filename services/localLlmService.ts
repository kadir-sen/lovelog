
import { CreateMLCEngine, MLCEngineInterface } from "@mlc-ai/web-llm";
import { AnalysisResult, GeminiInsight } from "../types";

// Kullanılacak model (Gemma 2B - Mobil için optimize edilmiş)
const SELECTED_MODEL = "gemma-2b-it-q4f32_1-MLC";

let engine: MLCEngineInterface | null = null;

export const initLocalLLM = async (onProgress: (text: string) => void) => {
  try {
    onProgress("Model yükleniyor... (Bu işlem ~1.5GB veri indirebilir)");
    engine = await CreateMLCEngine(SELECTED_MODEL, {
      initProgressCallback: (report) => {
        onProgress(report.text);
      },
    });
    return true;
  } catch (error) {
    console.error("Local LLM Init Error:", error);
    return false;
  }
};

export const generateLocalInsights = async (analysis: AnalysisResult): Promise<GeminiInsight> => {
  if (!engine) {
    throw new Error("Yerel model henüz yüklenmedi.");
  }

  // Yerel modellere de ham sohbet vermiyoruz; sadece anonim kompakt özet gider.
  const compactSummary = JSON.stringify(analysis.llmSummary).slice(0, 6000);

  // JSON şeması local modellerde zor olabilir, bu yüzden metin isteyip parse etmeye çalışacağız
  // veya daha basit bir prompt kullanacağız.
  const prompt = `
    Sen bir ilişki koçusun. Şu verilere bak:
    Anonim kompakt sohbet özeti: ${compactSummary}
    
    Bu ilişki için JSON formatında bir analiz yap. Format kesinlikle şöyle olmalı, başka bir şey yazma:
    {
      "summary": "İlişki hakkında tatlı bir yorum",
      "negativeSummary": "İlişki hakkında iğneleyici, kaotik bir yorum",
      "mostEmotional": "Kim daha duygusal ve neden",
      "mostCurious": "Kim daha meraklı",
      "mostInterested": "Kim daha ilgili",
      "mostArgumentative": "Kim daha kavgacı",
      "mostUnfair": "Kim daha anlayışsız",
      "mostToxic": "Kim daha sert konuşuyor",
      "funFact": "İlginç bir detay"
    }
  `;

  const messages = [
    { role: "system", content: "Sen yardımsever bir asistansın. Sadece JSON formatında cevap ver." },
    { role: "user", content: prompt }
  ];

  const reply = await engine.chat.completions.create({
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 800, // Kısa tutuyoruz
  });

  const rawText = reply.choices[0].message.content || "{}";
  
  // Basit JSON temizleme (Markdown taglerini silme)
  const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(jsonStr) as GeminiInsight;
  } catch (e) {
    // Fallback eğer model bozuk JSON üretirse
    return {
      summary: "Yerel model yoruldu ve JSON üretemedi.",
      negativeSummary: "Kaos modu verisi alınamadı.",
      mostEmotional: analysis.participants[0].name,
      mostCurious: analysis.participants[1]?.name || "Bilinmiyor",
      mostInterested: analysis.participants[0].name,
      mostArgumentative: analysis.participants[1]?.name || "Bilinmiyor",
      mostUnfair: "Veri yok",
      mostToxic: "Veri yok",
      funFact: "Yerel model kullanıldığı için analiz sınırlı."
    };
  }
};
