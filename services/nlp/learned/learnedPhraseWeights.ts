// Çakışan etiket gruplarında confidence kalibrasyonu için ağırlıklar.
// Annotation pipeline'ında confusion_candidates.md çıktısı bu ağırlıkları
// belirledi: en sık iki etiket çakışması "affection + warm_ack" (330 →
// gerçek bir çakışma değil, multi-label), sonra "harsh_language + warm_ack"
// (22 → playful insult ipucu).

export const learnedPhraseWeights = {
  // sarcasm baskınsa warmth'ı bu kadar azaltırız (0..1)
  sarcasmDampensWarmth: 0.4,
  // gülme baskınsa harshness'ı bu kadar azaltırız
  laughDampensHarsh: 0.55,
  // care + control çakışırsa care'i tutmak için confidence eşiği
  careOverControlThreshold: 0.65,
  // cold_ack için prev mesajın min "uzun/duygusal" karakter eşiği
  coldAckPrevLongChars: 80,
  // intensifier-drag (süpppersin) ekstra sarcasm boost'u
  intensifierDragBoost: 0.15,
  // playful_insult (warm + harsh aynı mesajda): harshness'ı sıfırla
  playfulInsultDampensHarshToZero: true,
};
