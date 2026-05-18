import { Message } from '../types';

// ============================================================================
// REGEXES — Hem Android hem iOS WhatsApp export formatlarını kapsar.
// ============================================================================

// ANDROID: 13.09.2024 10:08 - Name: Message
//          7.11.2025 10:08 - Name: Message   (tek-haneli gün/ay de OK)
const ANDROID_REGEX = /^(\d{1,2}\.\d{1,2}\.\d{4})[,\s]+(\d{2}:\d{2})\s+-\s+([^:]+):\s+(.+)$/;

// iOS — Eski format:  [27.04.2025 22:57:54] Name: Message
// iOS — Yeni format:  [7.11.2025, 20:05:46] Name : Message
//   - Gün/ay 1 veya 2 haneli olabilir
//   - Tarih ile saat arasında virgül VEYA boşluk olabilir
//   - Author'dan önce/sonra boşluk olabilir, ":" hem "Name:" hem "Name :" desteklenir
const IOS_REGEX = /^\[(\d{1,2}\.\d{1,2}\.\d{4})[,\s]+(\d{2}:\d{2}:\d{2})\]\s+([^:]+):\s+(.+)$/;

// Sistem mesajları (encryption notices vb.) — author yok, sadece tek-blok metin.
const SYSTEM_MESSAGE_ANDROID = /^(\d{1,2}\.\d{1,2}\.\d{4})[,\s]+(\d{2}:\d{2})\s+-\s+([^:]+)$/;
const SYSTEM_MESSAGE_IOS = /^\[(\d{1,2}\.\d{1,2}\.\d{4})[,\s]+(\d{2}:\d{2}:\d{2})\]\s+([^:]+)$/;

// ============================================================================
// PRE-PROCESSING — Mojibake repair + invisible char temizliği
// ============================================================================

/**
 * Mojibake repair: WhatsApp iOS dışa aktarımı bazen UTF-8 byte'larını
 * Windows-1252/Latin-1 olarak yorumlamış halde dosyaya yazar. Sonuç:
 *   "sıktı"     → "sÄ±ktÄ±"
 *   "uyumuştum" → "uyumuÅtum" / "uyumuÅŸtum"
 *   "Mesajlar"  → "Mesajlar" (ASCII korunur)
 *   "‎" (LRM, U+200E) → "â€Ž" (3 char) veya "â" (1 char, kısmi kayıp)
 *
 * Bu fonksiyon mojibake imzalarını tespit eder ve geri-dönüştürme yapar.
 * Dosya zaten temiz UTF-8 ise hiçbir şey yapmaz.
 */
const MOJIBAKE_SIGNATURE = /Ã[-¿]|Ä[±]|Å[œžŸ]|â€[™œŽ\s]/;

// Windows-1252 → byte mapping. CP1252'nin 0x80-0x9F aralığında Ÿ, œ, –,
// ", vb. punctuation karakterler vardır. Mojibake olarak bunlar yüksek
// Unicode code point görünür (örn. Ÿ = U+0178). Repair sırasında geri çevir.
const WIN1252_TO_BYTE: Record<number, number> = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

export const repairMojibake = (text: string): string => {
  if (!text || !MOJIBAKE_SIGNATURE.test(text)) return text;
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i);
      if (c > 0xff) {
        const mapped = WIN1252_TO_BYTE[c];
        if (mapped !== undefined) c = mapped;
        else return text; // Bilinmeyen yüksek code point → güvenli değil, bail.
      }
      bytes[i] = c;
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Decode başarılıysa daha az mojibake imzası içermeli; aksi halde reddet.
    if (
      (decoded.match(MOJIBAKE_SIGNATURE)?.length ?? 0) <
      (text.match(MOJIBAKE_SIGNATURE)?.length ?? 0)
    ) {
      return decoded;
    }
    return text;
  } catch {
    return text;
  }
};

/**
 * "Bu mesaj düzenlendi" / "This message was edited" işaretini içerikten temizler.
 * İşaret kalırsa NLP üzerinde gürültü oluşturur ve isMedia tespit edilirken
 * yanlış pozitife yol açabilir.
 */
const stripEditMarker = (content: string): string =>
  content
    .replace(/\s*<\s*This message was edited\s*>\s*$/iu, '')
    .replace(/\s*<\s*Bu mesaj düzenlendi\s*>\s*$/iu, '')
    .trim();

/**
 * Sadece sistem-bilgisi mesajları (encryption notice gibi). Bunlar iOS yeni
 * formatında YANLIŞLIKLA bir kullanıcı mesajıymış gibi parse'lanabiliyor
 * çünkü WhatsApp `Name : Messages and calls are end-to-end encrypted...`
 * şeklinde format kullanıyor. Bu içerikleri normal mesaj listesinden filtre.
 */
const SYSTEM_CONTENT_PATTERNS: readonly RegExp[] = [
  /messages?\s+and\s+calls?\s+are\s+end[- ]to[- ]end\s+encrypt/iu,
  /uçtan\s+uca\s+şifreli/iu,
  /uçtan\s+uca\s+şifrelenir/iu,
  /security\s+code\s+changed/iu,
  /güvenlik\s+kodu\s+değişti/iu,
];

const isSystemContent = (content: string): boolean =>
  SYSTEM_CONTENT_PATTERNS.some(p => p.test(content));

// ============================================================================
// MAIN PARSER
// ============================================================================

export const parseChatFile = (text: string): Message[] => {
  // 1) Mojibake repair — dosyanın tamamında bir kez.
  const repaired = repairMojibake(text);

  const lines = repaired.split('\n');
  const messages: Message[] = [];
  let currentMessage: Message | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Görünmez işaretleri temizle:
    //   ‎ (LRM), ‏ (RLM), ‪-‮ (BIDI control),
    //   ﻿ (BOM), ⁦-⁩ (Isolates). WhatsApp iOS dışa aktarımı
    //   bunları cömertçe serpiştirir.
    //
    // Ek olarak: kısmi mojibake (LRM byte sequence'ının ilk byte'ı 'â'
    // olarak kalmış) line başında, sonrasında '[' geliyorsa strip et.
    // 'â' Türkçede legitimate karakter (rüzgâr, hâlâ) olabildiği için
    // sadece "'â' ardından '['" desenini hedefleriz.
    const cleanLine = trimmedLine
      .replace(/^[‎‏‪-‮⁦-⁩﻿]+/, '')
      // Line başında Latin-1 supplement range (-ÿ) char varsa
      // ve sonrasında '[' geliyorsa, bu büyük olasılıkla mojibake LRM
      // kalıntısıdır — strip et. Türkçe 'â' içeren legitimate content
      // line başında '[' ile başlayamayacağı için bu güvenli.
      .replace(/^[-�]+(?=\[)/, '')
      .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '');

    let dateObj: Date | null = null;
    let author = '';
    let content = '';

    // --- Android format dene ---
    let match = cleanLine.match(ANDROID_REGEX);
    if (match) {
      const dateStr = match[1];
      const timeStr = match[2];
      author = match[3].trim();
      content = match[4];

      const [day, month, year] = dateStr.split('.').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      dateObj = new Date(year, month - 1, day, hours, minutes);
    }

    // --- Android olmadıysa iOS dene ---
    if (!match) {
      match = cleanLine.match(IOS_REGEX);
      if (match) {
        const dateStr = match[1];
        const timeStr = match[2];
        author = match[3].trim(); // "Ece " → "Ece"
        content = match[4];

        const [day, month, year] = dateStr.split('.').map(Number);
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }

    if (match && dateObj) {
      // Content cleanup: edit marker'ı çıkar, trim et.
      content = stripEditMarker(content);

      // Sistem mesajları (encryption notice) artık genellikle "Name : ..." olarak
      // kullanıcının mesajı gibi gelir — bunları filtrele.
      if (isSystemContent(content)) {
        currentMessage = null;
        continue;
      }

      currentMessage = {
        date: dateObj,
        author,
        content,
        isMedia: checkIsMedia(content),
      };
      messages.push(currentMessage);
    } else {
      // Sistem mesajı mı yoksa devam satırı mı?
      const isSystemAndroid = SYSTEM_MESSAGE_ANDROID.test(cleanLine);
      const isSystemIOS = SYSTEM_MESSAGE_IOS.test(cleanLine);

      if (isSystemAndroid || isSystemIOS) {
        currentMessage = null;
      } else if (currentMessage) {
        // Multi-line mesaj devamı.
        currentMessage.content += `\n${cleanLine}`;
        // Edit marker append edildikten sonra strip et.
        currentMessage.content = stripEditMarker(currentMessage.content);
        if (!currentMessage.isMedia) {
          currentMessage.isMedia = checkIsMedia(currentMessage.content);
        }
      }
    }
  }

  return messages;
};

const checkIsMedia = (content: string): boolean => {
  const lower = content.toLowerCase();
  const mediaKeywords = [
    // TR
    '<medya dahil edilmedi>',
    'medya dahil edilmedi',
    'görsel dahil edilmedi',
    'fotoğraf dahil edilmedi',
    'video dahil edilmedi',
    'ses dahil edilmedi',
    'belge dahil edilmedi',
    'çıkartma dahil edilmedi',
    'gif dahil edilmedi',
    // EN
    '<media omitted>',
    'media omitted',
    'image omitted',
    'video omitted',
    'audio omitted',
    'sticker omitted',
    'gif omitted',
    'document omitted',
    'photo omitted',
    'contact card omitted',
    // Voice/Video call notices — analiz dışında tut.
    'voice call. ',
    'voice call,',
    'video call. ',
    'video call,',
    'sesli arama. ',
    'görüntülü arama. ',
  ];

  return mediaKeywords.some(keyword => lower.includes(keyword));
};
