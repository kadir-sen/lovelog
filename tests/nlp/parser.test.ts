import { describe, it, expect } from 'vitest';
import { parseChatFile, repairMojibake } from '../../services/parser';

// Tüm fixture'lar sentetiktir. Gerçek WhatsApp transcript'i KULLANILMAZ.

describe('parser — Android format', () => {
  it('parses standard Android date format', () => {
    const text = `13.09.2024 10:08 - Ali: merhaba
13.09.2024 10:09 - Ayşe: nasılsın`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(2);
    expect(msgs[0].author).toBe('Ali');
    expect(msgs[0].content).toBe('merhaba');
    expect(msgs[1].author).toBe('Ayşe');
  });
});

describe('parser — iOS old format (double-digit, space)', () => {
  it('[27.04.2025 22:57:54] Name : Message', () => {
    const text = '[27.04.2025 22:57:54] Ali : selam';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].author).toBe('Ali');
    expect(msgs[0].content).toBe('selam');
  });

  it('[27.04.2025 22:57:54] Name: Message (no space before colon)', () => {
    const text = '[27.04.2025 22:57:54] Ali: selam';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].author).toBe('Ali');
  });
});

describe('parser — iOS NEW format (single-digit + comma)', () => {
  it('[7.11.2025, 20:05:46] Name : Message', () => {
    const text = '[7.11.2025, 20:05:46] Ece : Selam';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].author).toBe('Ece');
    expect(msgs[0].content).toBe('Selam');
    expect(msgs[0].date.getFullYear()).toBe(2025);
    expect(msgs[0].date.getMonth()).toBe(10); // Kasım (0-indexed)
    expect(msgs[0].date.getDate()).toBe(7);
    expect(msgs[0].date.getHours()).toBe(20);
  });

  it('handles single-digit month: [1.1.2026, 09:30:00]', () => {
    const text = '[1.1.2026, 09:30:00] Mervan: yeni yıl';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].date.getMonth()).toBe(0);
    expect(msgs[0].date.getDate()).toBe(1);
  });

  it('handles double-digit day with comma: [27.04.2025, 22:57:54]', () => {
    const text = '[27.04.2025, 22:57:54] Mervan : test';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('test');
  });

  it('parses multiple messages in new format', () => {
    const text = `[7.11.2025, 20:05:46] Mervan: Selam
[7.11.2025, 22:03:52] Mervan: Varinca yaz
[7.11.2025, 23:00:40] Ece : Geldim`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(3);
    expect(msgs[0].author).toBe('Mervan');
    expect(msgs[2].author).toBe('Ece');
    expect(msgs[2].content).toBe('Geldim');
  });
});

describe('parser — encryption notice / system content filtering', () => {
  it('skips end-to-end encryption notice (iOS new format)', () => {
    const text = `[7.11.2025, 20:05:46] Ece : Messages and calls are end-to-end encrypted. Only people in this chat can read.
[7.11.2025, 20:05:46] Mervan: Selam`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].author).toBe('Mervan');
  });

  it('skips Turkish encryption notice', () => {
    const text = `[7.11.2025, 20:05:46] Ece : Mesajlar uçtan uca şifrelenir.
[7.11.2025, 20:06:00] Mervan: selam`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].author).toBe('Mervan');
  });
});

describe('parser — media markers', () => {
  it('detects sticker omitted', () => {
    const text = '[14.11.2025, 17:55:31] Ece : sticker omitted';
    const msgs = parseChatFile(text);
    expect(msgs[0].isMedia).toBe(true);
  });

  it('detects GIF omitted (new in PR)', () => {
    const text = '[28.11.2025, 23:25:08] Mervan: GIF omitted';
    const msgs = parseChatFile(text);
    expect(msgs[0].isMedia).toBe(true);
  });

  it('detects document omitted (new in PR)', () => {
    const text = '[5.01.2026, 01:30:25] Ece : Operations Research 2.pdf • 57 pages document omitted';
    const msgs = parseChatFile(text);
    expect(msgs[0].isMedia).toBe(true);
  });

  it('detects Voice call. marker (new in PR)', () => {
    const text = '[3.12.2025, 18:14:54] Mervan: Voice call. 10 sec';
    const msgs = parseChatFile(text);
    expect(msgs[0].isMedia).toBe(true);
  });
});

describe('parser — edit marker stripping', () => {
  it('strips <This message was edited> suffix', () => {
    const text = '[15.11.2025, 18:17:21] Mervan: Sen naptin <This message was edited>';
    const msgs = parseChatFile(text);
    expect(msgs[0].content).toBe('Sen naptin');
    expect(msgs[0].isMedia).toBe(false);
  });

  it('strips Turkish <Bu mesaj düzenlendi>', () => {
    const text = '[15.11.2025, 18:17:21] Mervan: yarın gel <Bu mesaj düzenlendi>';
    const msgs = parseChatFile(text);
    expect(msgs[0].content).toBe('yarın gel');
  });
});

describe('parser — mojibake repair', () => {
  it('repairMojibake returns input unchanged when clean', () => {
    expect(repairMojibake('temiz UTF-8 ışık')).toBe('temiz UTF-8 ışık');
  });

  it('repairMojibake fixes Turkish characters: sÄ±ktÄ± → sıktı', () => {
    // "sıktı" UTF-8 bytes: 73 C4 B1 6B 74 C4 B1 → Latin-1 decoded: sÄ±ktÄ±
    const mojibake = 'sÄ±ktÄ±';
    const repaired = repairMojibake(mojibake);
    expect(repaired).toBe('sıktı');
  });

  it('repairMojibake fixes Å → ş family', () => {
    // "uyumuştum" mojibake: "uyumuÅŸtum"
    const mojibake = 'uyumuÅŸtum';
    const repaired = repairMojibake(mojibake);
    expect(repaired).toBe('uyumuştum');
  });

  it('parseChatFile auto-repairs mojibake in iOS new format', () => {
    // "[7.11.2025, 20:05:46] Ece : sÄ±ktÄ±" should parse as content "sıktı"
    const text = '[7.11.2025, 20:05:46] Ece : sÄ±ktÄ±';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].content).toBe('sıktı');
  });
});

describe('parser — invisible char stripping', () => {
  it('strips LRM/RLM marks', () => {
    const text = '‎[7.11.2025, 20:05:46] Ece : ‎sticker omitted';
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(1);
    expect(msgs[0].isMedia).toBe(true);
    expect(msgs[0].content).toBe('sticker omitted');
  });

  it('strips partial-mojibake "â" before "[" (does not consume legitimate Turkish â)', () => {
    // Mojibake LRM artığı: "â[date]" → strip "â", parse normally
    const text = `â[7.11.2025, 20:05:46] Ece : merhaba
â[7.11.2025, 20:06:00] Mervan: rüzgâr esiyor`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(2);
    expect(msgs[1].content).toBe('rüzgâr esiyor'); // 'â' inside content korunur
  });
});

describe('parser — multi-line continuation (iOS new format)', () => {
  it('appends continuation lines to previous message', () => {
    const text = `[7.11.2025, 20:05:46] Ece : İlk satır
devam satırı
[7.11.2025, 20:06:00] Mervan: ikinci mesaj`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(2);
    expect(msgs[0].content).toContain('devam satırı');
    expect(msgs[1].content).toBe('ikinci mesaj');
  });
});

describe('parser — regression: original Android format still works', () => {
  it('parses the Sude-style format (Android)', () => {
    const text = `13.09.2024 10:08 - Ali: merhaba aşkım
13.09.2024 10:09 - Ayşe: ben de seni özledim canım`;
    const msgs = parseChatFile(text);
    expect(msgs.length).toBe(2);
    expect(msgs[0].author).toBe('Ali');
    expect(msgs[1].content).toBe('ben de seni özledim canım');
  });
});
