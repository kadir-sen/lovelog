import { AnalysisResult } from '../types';
import { RelationshipMode } from './relationshipReport';
import { generateTarotReading } from './tarotEngine';
import { generateCoffeeReading } from './coffeeEngine';
import { generateZodiacReading, ZodiacId } from './zodiacEngine';

// El falı bu sürümden kaldırıldı — sadece tarot, kahve ve burç.
export type FalMode = 'tarot' | 'kahve' | 'burc';

export interface FalReading {
  title: string;
  reading: string;
  symbols: Array<{ label: string; value: string; note: string }>;
}

export interface ZodiacReadingInput {
  signA: ZodiacId;
  signB: ZodiacId;
}

// Senkron: tüm üretim cihazda yapılıyor, sunucu çağrısı yok.
export const generateFalReading = (
  analysis: AnalysisResult | null,
  mode: FalMode,
  relationMode: RelationshipMode = 'lover',
  nonce = 0,
  zodiacInput?: ZodiacReadingInput
): FalReading => {
  if (mode === 'tarot') {
    const t = generateTarotReading(analysis, relationMode, nonce);
    return { title: t.title, reading: t.reading, symbols: t.symbols };
  }
  if (mode === 'kahve') {
    const c = generateCoffeeReading(analysis, relationMode, nonce);
    return { title: c.title, reading: c.reading, symbols: c.symbols };
  }
  if (mode === 'burc') {
    if (!zodiacInput) {
      return {
        title: 'Uyum Haritası',
        reading: 'Burç uyumluluğunu görmek için iki burç da seçilmeli.',
        symbols: [],
      };
    }
    const z = generateZodiacReading(zodiacInput.signA, zodiacInput.signB, relationMode);
    return { title: z.title, reading: z.reading, symbols: z.symbols };
  }
  throw new Error(`Unknown fal mode: ${mode}`);
};
