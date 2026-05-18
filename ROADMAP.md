# LoveLog — Vision & Roadmap

> WhatsApp sohbetlerinden ilişki örüntüleri çıkartan, **kanıt-temelli ve klinik-olmayan** dille raporlayan, ileride sohbet bazlı bir asistana pivotlanacak privacy-first uygulama.

---

## İçindekiler

1. [Yönetici Özeti](#1-yönetici-özeti)
2. [Vizyon](#2-vizyon)
3. [Mevcut Durum](#3-mevcut-durum-2026-05-16)
4. [Ürün Stratejisi](#4-ürün-stratejisi)
5. [NLP Yaklaşımı](#5-nlp-yaklaşımı)
6. [Veri Katmanı](#6-veri-katmanı)
7. [Sistem Mimarisi](#7-sistem-mimarisi)
8. [Roadmap (Faz Planı)](#8-roadmap-faz-planı)
9. [Hemen Başlanacak: Faz 2 Sprint-1](#9-hemen-başlanacak-faz-2-sprint-1)
10. [Privacy + Ethics](#10-privacy--ethics)
11. [Tech Debt](#11-tech-debt)
12. [Risk + Açık Sorular](#12-risk--açık-sorular)

---

## 1. Yönetici Özeti

**Ne yapıyoruz?** Bir WhatsApp `.txt` dosyasını lokal cihazda parse edip, ilişki dinamiğini saat-aware ritüel mesajlar, emoji cluster'ları, sarcasm/withdrawal/control ayrımı, echo-reciprocity, intensifier-drag gibi gözlenebilir konuşma davranışları üzerinden raporlayan bir uygulama yazıyoruz.

**Neden?** Çiftlerin kendi sohbetlerinde gördükleri ama dile getiremedikleri ritmik örüntüleri (kim hangi saatte sıcak, kim ne sıklıkla küs gibi davranıyor, "iyi geceler" ritüeli kaç gün üst üste sürüyor) **kanıta dayalı, ucu açık** bir rapora dönüştürmek. Klinik teşhis yapmak ya da kişiyi etiketlemek değil; ilişkinin **akışını** görmelerini sağlamak.

**Kime?** İlk hedef: kendisinin ve partnerinin ortak WhatsApp'ı olan, ilişki üzerine "veriye dayalı bir ayna" arayan kullanıcılar. İleride: terapist destekli refleksiyon, evlilik öncesi/sonrası çift workshop, friendship analytics.

**Nasıl?** İki yönlü mimari: (1) **rapor modu** (mevcut akış: yükle → analiz et → dashboard), (2) **chatbot modu** (gelecek pivot: aynı veriyi RAG ile sohbet üzerinden sorgula — "geçen ay biz kavga ettiğimizde özür dileyen genelde kim oluyor?").

**Niye şimdi?** services/nlp katmanı 9 classifier + 8 learned cue dosyasıyla çalışıyor (85/85 test yeşil) ama Dashboard hâlâ eski 9-key signal yapısını gösteriyor. Yeni NLP zenginliği UI'a yansımıyor — pivot için **en kritik blocker** Dashboard surface'ı.

---

## 2. Vizyon

> **"Mesajların ardındaki davranışı, kanıtla ve şefkatle göster."**

### Ürün ilkeleri

1. **Klinik dil yasak.** "Gaslighter", "narsist", "toxic" gibi etiketler asla. Yalnız gözlenebilir davranış: `reality_denial`, `invalidation`, `blame_shift`.
2. **Kanıt + karşı-kanıt birlikte.** Her insight `evidence` ve `counterEvidence` taşır. UI tek-yönlü "haklısın/haksızsın" demez.
3. **Belirsizliği saklamaz.** `confidence < 0.55` → UI'da gösterilmez. `0.55–0.70` arası → "olası" diliyle. `≥ 0.70` ve counterEvidence yok → öne çıkarılabilir.
4. **Local-first.** Raw mesajlar diskten çıkmaz; backend yalnız maskelenmiş kompakt özet alır.
5. **Tek bir cihaz, tek bir ilişki.** Multi-couple/account sonraki faz; ilk versiyon tek cihaz tek WhatsApp.
6. **Ucu açık ton.** Dashboard ifadeleri sonuçlandırıcı (`"X kişisi pasif-agresif"`) değil, davet edici (`"Bu hafta iyi geceler ritüeli 5 gün arka arkaya görüldü"`).

### Pivot vizyonu — "report → chat"

| Mevcut (rapor) | Gelecek (chat) |
|---|---|
| Statik dashboard kartları | Sohbet üzerinden konuşulan insight'lar |
| `analyzeChat()` tek pas | `messageInsights[]` üzerinde RAG sorgu |
| "İyi geceler ritüeli 47 kez" | "Geçen ay iyi geceler kim daha önce attı?" → tool call → cevap |
| Tek seferlik yükleme | Sohbet boyunca öğrenen `styleProfile` (persist) |
| Önceden belirlenmiş narrative | LLM-destekli ama **tool-grounded** cevap |

---

## 3. Mevcut Durum (2026-05-16)

### 3.1 Çalışan katmanlar

- **Frontend**: React 19 + Vite SPA. Capacitor 8 ile iOS + Android.
- **Backend**: Fastify 5 + Gemini SDK. Sadece "Fal" eğlence özelliği için LLM proxy.
- **Analiz pipeline**: [services/analytics.ts](services/analytics.ts) → 9-key `signals` + clause-bazlı negation + playful damper + 4 örüntü dedektörü.
- **NLP layer** ([services/nlp/](services/nlp/)):
  - Classifier'lar: `shortReplyClassifier`, `sarcasmModifier`, `laughClassifier`, `controlPressureClassifier`, `emojiClusterClassifier`, `ritualMessageClassifier`, `intensifierDragClassifier`, `echoResponseClassifier`.
  - Learned cues: `learnedWarmTerms`, `learnedSarcasmCues`, `learnedShortReplyCues`, `learnedCareCheckinCues`, `learnedControlPressureCues`, `learnedEmojiSemantics`, `learnedLaughPatterns`, `learnedEmojiClusters`, `learnedCustomAffectionEmojis`, `learnedEmojiTermBindings`, `learnedRitualPhrases`, `learnedIntensifierDrag`, `learnedPhraseWeights`.
  - `buildMessageInsights()` → `EnrichedInsight[]` (`AnalysisResult.messageInsights` opsiyonel alanı).
  - `buildStyleProfile()` → emoji pair frekansı, ritüel saat dağılımı, author affection leaning.
  - `extractEpisodes()` → conflict / repair / ghosting_gap / plan_cancel episodes.
- **Annotation pipeline** ([tools/annotation/](tools/annotation/)): `parse → mask → windows → weak-label → select-review → evaluate`. 127k mesaj, 119k pencere, 9.7k human review queue.
- **Test**: Vitest. 13 dosya, 85 test, 0 fail.
- **Bundle**: 760KB dist; `tools/annotation` ve `messages/` bundle'a sızmıyor.

### 3.2 Bilinen boşluklar (bu roadmap bunları kapatacak)

| Boşluk | Açıklama | Faz |
|---|---|---|
| Dashboard NLP'yi yansıtmıyor | `messageInsights`, `episodes`, `styleProfile.relationshipDialect` üretiliyor ama UI'da görünmüyor. | **F2** |
| Episode timeline UI yok | `AnalysisResult.episodes` mevcut ama Dashboard'da kart yok. | **F3** |
| Pattern detector seti zayıf | Yalnız 4 örüntü (stonewalling, attack_apology_loop, plan_cancellation, reciprocity_decline). | **F3** |
| `relationshipReport.ts` couple-dialect okumuyor | Narrative metin hâlâ jenerik. | **F2** |
| Gold dataset yok | Annotation pipeline çıkış aşamasında insan etiketi yok → F1/precision yok. | **F2** |
| LLM labeler entegre değil | Belirsiz örnekler için fallback yok. | **F3** |
| `styleProfile` persist yok | Her yüklemede sıfırdan; per-couple öğrenme uçucu. | **F4** |
| Multi-couple support yok | Tek cihaz tek sohbet. | **F4** |
| Chatbot yok | RAG + intent + guardrails yok. | **F5** |

---

## 4. Ürün Stratejisi

### 4.1 İki ürün, tek omurga

LoveLog'un omurgası `EnrichedInsight[]` + `RelationshipEpisode[]` + `RelationshipPattern[]` + `ConversationStyleProfile`. Bu shape iki farklı **deneyim** sunar:

- **Rapor deneyimi (V1)** — kullanıcı yükler, dashboard görür. Kartlar mesajlar üzerinden hikâye anlatır.
- **Sohbet deneyimi (V2)** — aynı veri üzerinde "Geçen ay..." gibi sorgu cevaplanır. LLM **tool call** ile insight'lara erişir; serbestçe konuşmaz.

V2, V1'in üzerine bina edilir. Önce V1'i tamamla, sonra V2 için tool layer'ı yaz.

### 4.2 Hedef kullanıcı persona'ları

- **Refleksif çift** (birincil): "Son 6 ayda biz nasıl bir ilişkiydik?" Akıllı yardımcıdan **kanıta dayalı geri bildirim** ister, içgörü ister.
- **Tartışma-sonrası okuyucu**: "Geçen pazar bizdeki gerilimde ben mi başlattım?" Episode-bazlı sorgu.
- **İlişki düzeyini izleyen**: Aylık digest (warmth/conflict ratio, ritüel sürekliliği, intensifier-drag yoğunluğu).
- **Terapist eşlikçisi** (gelecek): kullanıcı sohbeti seansa götürür, terapistle açar.

### 4.3 Privacy-first ürün sözleşmesi

Hiçbir aşamada feragat edilmez:

1. **Raw text** asla cihazdan çıkmaz (mevcut sözleşme).
2. **`AnalysisResult.messageInsights[*].evidence`** ekrana basılırken `maskSensitiveText` üzerinden geçer.
3. **`styleProfile.customAffectionEmojis`** persist edilirken sadece emoji + kategori; raw mesaj değil.
4. **Chatbot tool layer**ı LLM'e raw mesaj göndermez; yalnız `MessageInsightDTO` (maskli + alias'lı + truncate'lı) yollar.
5. **Tek-tıkla silme** (mevcut `clearAllDeviceData()`): yeni eklenen persist alanları da bu silmeye dahil edilir.

---

## 5. NLP Yaklaşımı

### 5.1 Katman mimarisi (mevcut + planlanan)

```
                                    ┌──────────────────────┐
   WhatsApp .txt                    │  Dashboard / Chatbot │
        │                           └──────────▲───────────┘
        ▼                                      │
   parseChatFile                               │
        │                          AnalysisResult (zenginleştirilmiş)
        ▼                                      ▲
   normalizeMessages                           │
   (clause + negation + playful damper)        │
        │                                      │
        ▼                                      │
   ┌─ services/nlp ──────────────────────────────────┐
   │                                                  │
   │   1. extractRelationshipSignals                  │
   │   2. shortReply / sarcasm / laugh / control      │
   │   3. negationScope                               │
   │   4. ritualMessage  ◄─ saat-aware                │
   │   5. emojiCluster   ◄─ inside_joke_pattern       │
   │   6. intensifierDrag ◄─ sarcasm counter inject   │
   │   7. echoResponse   ◄─ out[]-aware reciprocity   │
   │   8. (F3 yeni) couple-pattern detectors          │
   │      - longing_loop / withdrawal_pattern         │
   │      - care_imbalance / repair_imbalance         │
   │      - jealousy_spiral / control_spiral          │
   │      - micro_apology_cycle                       │
   │      - good_night_chain (streak)                 │
   │                                                  │
   │   9. dialogueActs                                │
   │  10. confidence + evidence aggregate             │
   │  11. extractRelationshipEpisodes                 │
   │  12. (F3 yeni) detectRelationshipPatterns        │
   │                                                  │
   └──────────────────────────────────────────────────┘
```

### 5.2 Pattern (örüntü) tespit felsefesi

**Tek mesaj → insight. N insight üst üste → episode. Episode'lar tekrarlanıyor → pattern.**

| Seviye | Örnek | Confidence eşiği |
|---|---|---|
| Insight | `cold_ack`, conf 0.65 | ≥ 0.55 görünür |
| Episode | "Tartışma sonrası onarım" (4 insight) | ≥ 0.65 + ≥ 2 evidence |
| Pattern | "Onarım imbalance — A 18× özür diliyor, B 3×" | ≥ 0.70 + ≥ 4 episode |

Pattern'lar **counter-evidence şartlı** UI'a gelir: "Bu 4 ay içinde 18 onarım hareketinden 14'ü A tarafından geldi. Ama B'nin 'haklısın' dediği 3 mesaj da var."

### 5.3 Confidence + Evidence + CounterEvidence (mevcut)

`services/nlp/confidence.ts`:
- `aggregateConfidence(results)`: max(skor) − counterPenalty
- `isVisible(conf, hasCounter)`: 0.55 minimum; counterEvidence varsa 0.70 minimum
- `needsReview(conf)`: [0.45, 0.75] zorunlu review zonu

UI'a basılırken:
- **Yüksek** (≥ 0.70, counterEvidence yok): "Bu hafta iyi geceler ritüeliniz **7 gün** üst üste tekrarlandı."
- **Orta** (0.55–0.70 veya counterEvidence var): "Bu mesajda **olası** sarcasm sinyali; tek başına net değil — bağlamı 🙄'da."
- **Düşük** (< 0.55): UI'da gösterilmez.

### 5.4 Annotation loop (gold dataset)

Mevcut: weak labels (rule-based) + human review queue (CSV).

Hedef (F2 sonu):
```
chat.masked.jsonl
    │
    ├─► weak labels (regex-rule based)
    │       │
    │       ├─► confidence ≥ 0.85 + no counter  →  silver pool (auto-accepted)
    │       │
    │       ├─► confidence 0.45–0.85 OR ALWAYS_REVIEW
    │       │       │
    │       │       └─► human_review.csv  →  insan etiketler
    │       │               │
    │       │               └─► gold_labels.jsonl
    │       │
    │       └─► confidence < 0.45 → ambiguous (atılır, F3'te LLM labeler)
    │
    └─► gold + silver → regression test fixtures (private repo? veya synthetic-augment)
```

**Anahtar metrik:** Cohen's κ (annotator agreement) ≥ 0.70 = gold güvenilir.

---

## 6. Veri Katmanı

### 6.1 Annotation pipeline (mevcut)

`tools/annotation/`:
- `parse → mask → windows → weak-label → select-review → evaluate → report`
- 127.343 mesaj → 119.688 pencere → 9.763 review queue
- Output: `messages/labels/`, `messages/reports/` (gitignore'lı)

**Eksik:**
- Gold etiket yok (CSV elle doldurulmadı). **F2'de** minimal 200 örnek hedeflenecek.
- LLM labeler yok. **F3'te** Gemini proxy üzerinden, **dry-run zorunlu**.

### 6.2 Gold dataset hedefleri (F2)

| Etiket | Min örnek | Öncelik |
|---|---:|---|
| `sarcasm_possible` | 30 | Yüksek (weakLabeler az yakalıyor: 25 örnek) |
| `passive_aggressive_possible` | 20 | Yüksek |
| `cold_ack` vs `neutral_ack` | 40 | Çok yüksek (sınır belirsiz) |
| `care_checkin` vs `control_pressure` | 30 | Çok yüksek (etik kritik) |
| `reality_denial` / `invalidation` / `blame_shift` | 30 | Çok yüksek (klinik dil yasak — doğru etiket kritik) |
| `harsh_language` + `humor_playful` çakışması | 20 | Orta (playful insult ayrımı) |
| `echo_warmth` | 30 | Orta (yeni etiket, hiç gold yok) |

**Toplam:** ~200 örnek. Bir hafta sonu içinde elle etiketlenebilir.

### 6.3 LLM labeler (F3)

`tools/annotation/src/llmLabeler.ts`:
- Sadece maskelenmiş context window'ları gönder.
- `prompts/label_window_prompt.md`'yi kullan.
- `--dry-run` default.
- Çıktı: `messages/labels/llm_labels.jsonl`.
- `adjudication_prompt.md` ile weak + LLM uzlaştırma.

---

## 7. Sistem Mimarisi

### 7.1 Mevcut (raporlama modu)

```
Cihaz                              Backend (opsiyonel)
┌──────────────────────────────┐   ┌──────────────────────────┐
│  React SPA / Capacitor       │   │  Fastify @ Lightsail     │
│                              │   │                          │
│  FileUpload (.txt)           │   │  /api/llm/generate       │
│      ▼                       │   │  (sadece "Fal" özelliği) │
│  parser → analytics → nlp    │   │                          │
│      ▼                       │   │  /api/device/:id         │
│  AnalysisResult (localStorage)   │  (anonim id'ye kayıt)    │
│      ▼                       │   │                          │
│  Dashboard / Fal             │   │                          │
└──────────────────────────────┘   └──────────────────────────┘
                                    raw mesaj backend'e GİTMEZ
```

### 7.2 Chatbot pivot mimarisi (F5)

```
Cihaz                              Backend
┌──────────────────────────────┐   ┌──────────────────────────────┐
│                              │   │                              │
│  ChatScreen (yeni)           │   │  /api/chat/converse           │
│      │                       │   │      ▲                        │
│      │ user message          │   │      │                        │
│      ▼                       │   │      │                        │
│  buildChatPayload            │   │  Intent classifier (lokal)    │
│   (intent + insight refs)    │   │  Tool layer (LLM-grounded)    │
│      ▼                       │   │      │                        │
│  POST + bearer device-id     ───►       │                        │
│                              │   │  Tools (server-side):         │
│                              │   │   • getInsightsBetween(d1,d2) │
│                              │   │   • getEpisodesByType(...)    │
│                              │   │   • getPatternEvidence(id)    │
│  Streamed reply              │◄── LLM (Gemini/Claude) w/        │
│                              │   │  system prompt + tools         │
│                              │   │                              │
│  ChatScreen renders          │   │  Raw mesaj YİNE backend'e    │
│  (with evidence chips)       │   │  gitmiyor; sadece DTO         │
└──────────────────────────────┘   └──────────────────────────────┘
```

**Anahtar kararlar:**
- Chatbot **stateful değil**; her sorgu bağımsız tool call zinciri.
- LLM **serbest cevap üretmez**; cevabın içeriği tool çıktısından gelir. Hallucination = düşük (tool-grounded).
- `EnrichedInsight` → `InsightDTO` çevirisi backend tarafında: `quoteMasked` korunur, `id` ve `confidence` korunur, raw text yok.
- Guardrails: system prompt'ta "klinik dil yasak", "tool çıktısı dışında bilgi üretme".

---

## 8. Roadmap (Faz Planı)

| Faz | Hedef | Süre tahmini | Durum |
|---|---|---|---|
| **F1** | Foundation: services/nlp + couple-dialect classifier'lar + annotation pipeline | 2-3 hafta | ✅ DONE |
| **F2** | Reporting Surface: Dashboard'da couple-dialect kartları + narrative + gold dataset (200) | 3-4 hafta | 🟡 NOW |
| **F3** | Episode + Pattern Library: 8+ pattern detector + episode UI + LLM labeler | 4-5 hafta | ⏳ NEXT |
| **F4** | Personalization: per-couple styleProfile persist + multi-couple support + weekly digest | 3-4 hafta | ⏳ |
| **F5** | Chatbot Pivot: RAG tool layer + intent classifier + chat UI | 6-8 hafta | ⏳ |

### Faz 2 — Reporting Surface (NOW)

**Hedef:** Mevcut `analysis.messageInsights` + `analysis.episodes` + `analysis.styleProfile.relationshipDialect`'i kullanıcıya görünür kıl.

| Sprint | Kapsam |
|---|---|
| **S1** | `services/nlp/coupleDialectSummary.ts` (Dashboard-ready data shape util) + tests |
| **S2** | `components/CoupleDialectCard.tsx` (yeni component, Dashboard'a montaj) |
| **S3** | `components/RitualStreakCard.tsx` (iyi geceler / günaydın / kolay gelsin streak'leri) |
| **S4** | `components/EpisodeTimeline.tsx` (conflict / repair / ghosting_gap episode'ları) |
| **S5** | `relationshipReport.ts` couple-dialect narrative entegrasyonu (ileride F3 ile dolar) |
| **S6** | Annotation: 200 gold örnek (manuel) + `evaluate` ile F1/precision raporları |
| **S7** | Bug bash + privacy audit + sprint retrospective |

### Faz 3 — Episode + Pattern Library

**Hedef:** Mevcut 4 örüntü + 8 yeni couple-pattern detector.

| Yeni pattern | Tanım |
|---|---|
| `longing_loop` | "özledim" 3+ gün üst üste, karşı tarafın response gap'i artıyor |
| `withdrawal_pattern` | `cold_ack` + `withdrawal_possible` 5+ örnek / hafta |
| `care_imbalance` | `care_checkin` A 80% / B 20% (4+ haftalık trend) |
| `repair_imbalance` | `apology` + `repair_attempt` aynı yazardan ≥ %80 |
| `jealousy_spiral` | `jealousy_check` ardından `control_pressure` < 30 dk içinde, tekrarlanan |
| `control_spiral` | `control_pressure` 3+ örnek 24 saatte, response gap düşüyor |
| `micro_apology_cycle` | `apology` her 24-48 saatte bir; conflict olmadan |
| `good_night_chain` | `ritual_message:good_night` 7+ gün streak |

Her pattern: severity 0..1, perpetrator/affected (eğer varsa), evidence + counterEvidence, dateRange.

### Faz 4 — Personalization

- `styleProfile` → `localStorage` (yeni key: `lovelog.styleProfile.v1`).
- Multi-couple: birden çok `AnalysisResult` slot'u (max 3 bağlantı).
- Weekly digest: son 7 günün warmth/conflict/ritual istatistikleri, push notification (Capacitor).
- "Anchor pattern" detection: kullanıcı manuel olarak bir patternı pinleyebilir, sonraki yüklemelerde tracking.

### Faz 5 — Chatbot Pivot

- **Frontend**: yeni `ChatScreen.tsx`, `TabBar` 4. tab.
- **Backend tool layer**: 6-8 tool (getInsightsBetween, getEpisodesByType, getPatternEvidence, summarizePeriod, compareAuthors, findCounterExamples).
- **Intent classifier** (lokal, regex + small LLM call): "zaman sorgusu" / "kişi karşılaştırma" / "pattern açıklama" / "ne yapmalıyım".
- **LLM call**: tool-grounded. Sistem promptu klinik dil yasaklarını içerir.
- **Guardrails**: cevap içinde `evidence chip` zorunlu; tool çıktısı boşsa "Yeterli veri yok" der.

---

## 9. Hemen Başlanacak: Faz 2 Sprint-1

**Bugünden** itibaren ilk hareket: `services/nlp/coupleDialectSummary.ts`. Bu utility:
- `AnalysisResult` alır.
- Dashboard'un göstereceği özet shape üretir: `CoupleDialectSummary`.
- Hiçbir UI'a dokunmaz; pure function, test edilebilir.
- F2-S2'de bir `CoupleDialectCard` component'i bu çıktıyı render eder.

**Bu MD dokümanına ek olarak şu dosyalar bu turda yazılacak:**

1. `services/nlp/coupleDialectSummary.ts` — Dashboard-ready data shape.
2. `tests/nlp/coupleDialectSummary.test.ts` — 5-6 senaryo.

**Bu turda yapılmayacaklar (F2 sonraki sprintler):**
- Dashboard.tsx'e component montajı.
- `relationshipReport.ts` narrative değişikliği.
- Yeni recharts kartı.
- Gold dataset.

---

## 10. Privacy + Ethics

- Tüm mevcut sözleşmeler ([CLAUDE.md](CLAUDE.md), [tools/annotation/README.md](tools/annotation/README.md)) geçerli kalır.
- Yeni veri persist'i (`styleProfile`) yalnız maskelenmiş alanlar içerir; raw text yok.
- Chatbot tool layer'ı: LLM'e gönderilen her DTO `maskSensitiveText` üzerinden geçer.
- Klinik dil yasağı sistem promptunda enforce edilir; LLM cevabı içinde "gaslighting", "narcissist", "abuser" geçerse cevap kullanıcıya gösterilmeden filtrelenir (post-processing).
- Multi-couple eklenirken: her bağlantı için ayrı `deviceId + couple-slot` izolasyonu; cross-leakage yok.

---

## 11. Tech Debt

| Madde | Risk | F |
|---|---|---|
| `services/analytics.ts` `rawMessages` localStorage'a yazıyor — quota baskısı + jailbreak okuma | Orta | F2 (cleanup) |
| `RelationshipSignalKey` 32 anahtar, hâlâ map'lenmemiş bazı tag'ler (`emoji_cluster` → affection, daha doğru anahtar olabilirdi) | Düşük | F3 (yeni anahtar eklenir) |
| `Dashboard.tsx` 700+ satır tek dosya; modularize edilmedi | Orta | F2 (CoupleDialectCard ayrılırken refactor) |
| Capacitor ↔ web farkı: notification için F4 native bridge | Orta | F4 |
| Backend `/api/llm/generate` rate limit: in-memory; gerçek DB yok | Düşük (Fal eğlence) | F5 (chatbot için ciddileşir) |
| `extractRelationshipSignals` boş `MessageSignal` yapısı tüm 32 anahtarı 0 ile init etmiyor — bazı durumlarda `score` undefined | Düşük | F3 |

---

## 12. Risk + Açık Sorular

### 12.1 Riskler

1. **Klinik dil sızıntısı** — UI ya da chatbot cevabında yanlışlıkla "narcissist" geçmesi. **Mitigation**: post-processing filtreli regex bloklayıcı + system prompt enforcement.
2. **False-positive `control_pressure`** — yanlış kişiyi "control" olarak göstermek ilişki için zararlı. **Mitigation**: confidence ≥ 0.70 + counterEvidence boş şartı; "olası" diliyle gösterim.
3. **Veri privacy ihlali** — raw mesaj sızıntısı. **Mitigation**: bundle isolation grep + privacy CI test (F2 sonu).
4. **Dashboard bilişsel yük** — çok fazla kart, kullanıcı boğulur. **Mitigation**: F2-S2'de sadece top 3 insight; "more" expand butonu.
5. **Chatbot hallucination** — F5'te LLM tool dışı cevap üretir. **Mitigation**: tool-grounded zorunluluk; tool çıktısı boşsa kalıp cevap.
6. **Single-cihaz veri kaybı** — kullanıcı uygulamayı silerse styleProfile gider. **Mitigation**: F4'te şifrelenmiş export/import.

### 12.2 Açık sorular (bu doc cevaplayamıyor — kullanıcı kararı)

- **Chatbot fiyatlandırma**: ücretsiz / freemium / abonelik?
- **Çift-onayı**: A kişisi sohbeti yüklüyor; B kişisinin bilgisi/onayı olmadan analiz edilebilir mi? Etik soru.
- **Çift sayısı**: tek cihaz tek bağlantı mı, multi-relationship mi (eski sohbetler de)?
- **Terapist entegrasyonu**: B2B kanalı sonradan açılır mı?
- **Yaş kısıtı**: 18+ enforce edilecek mi (App Store/Play kuralları)?

---

## Eki: Doğrulanmış metrikler (mevcut sohbet üzerinden)

> Bu sayılar repo'daki tek aktif sohbet verisi üzerinden çıkartıldı; yeni sohbetlerde değişecek (per-couple).

- Toplam mesaj: **127.343**
- Pencere: **119.688**
- Human review queue: **9.763** (%8.2)
- Yeşil test: **85/85** (13 dosya)
- Bundle: **760KB**

Pattern dağılımı (weak label):
- `warm_ack`: 6.720
- `affection`: 1.185
- `harsh_language`: 1.068
- `apology`: 319
- `neutral_ack`: 190
- `plan_cancel`: 169
- `control_pressure`: 160
- `boundary_setting`: 155
- `care_checkin`: 138
- `passive_aggressive_possible`: 40
- `blame_shift`: 30
- `sarcasm_possible`: 25

Saat dağılımı (warm × time-of-day):
- **day** 2.062 / **night** 1.444 / **morning** 706

Ritüel dağılımı:
- `iyi geceler` 210 (209/210 gece)
- `kolay gelsin` 288 (143 gündüz / 74 gece / 71 sabah)
- `tatlı rüyalar` 132 (131/132 gece)
- `günaydın` 80 (72/80 sabah)

Author affection leaning:
- **A**: 😘 dominant, warm-term `aşkım`
- **B**: 😙 dominant, warm-term `aşkım`

Custom marker: `aşkım × 🐬` (11 co-occurrence) → **özel inside_joke_pattern**.

---

**Sonraki adım:** [§9](#9-hemen-başlanacak-faz-2-sprint-1) — `coupleDialectSummary` util'i. Bu doc tamamlandıktan hemen sonra geliştirilecek.
