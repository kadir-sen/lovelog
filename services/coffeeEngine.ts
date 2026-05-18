import { AnalysisResult } from '../types';
import { RelationshipMode } from './relationshipReport';

export type CoffeePosition = 'rim' | 'middle' | 'bottom';

export interface CoffeeSymbol {
  id: string;
  glyph: string;
  name: string;
  interpretations: Record<CoffeePosition, string[]>;
}

export interface CoffeeReading {
  title: string;
  reading: string;
  symbols: Array<{ label: string; value: string; note: string }>;
}

const POSITION_LABEL: Record<CoffeePosition, string> = {
  rim: 'fincanın kenarında',
  middle: 'ortada',
  bottom: 'fincanın dibinde',
};

export const COFFEE_SYMBOLS: CoffeeSymbol[] = [
  {
    id: 'heart', glyph: '♥', name: 'Kalp',
    interpretations: {
      rim: [
        'Kalbin yakın zamanda hareketlenecek; biri kapıyı çalıyor.',
        'Sıcak bir haber kalbe değecek.',
      ],
      middle: [
        'Şu an kalbinden geçen şey net görülüyor.',
        'İçten gelen bir bağ tam ortada duruyor.',
      ],
      bottom: [
        'Geçmişten kalan bir kalp izi hâlâ etkide.',
        'Eski bir his hafifçe konuşuyor.',
      ],
    },
  },
  {
    id: 'star', glyph: '★', name: 'Yıldız',
    interpretations: {
      rim: [
        'Bir umut işareti yakında parlayacak.',
        'Hayalini kurduğun şey biraz daha yaklaşıyor.',
      ],
      middle: [
        'Şu an doğru yolda olduğuna dair bir işaret var.',
        'Niyetin parlak görünüyor.',
      ],
      bottom: [
        'Geçmişteki bir dilek hâlâ etkisini sürdürüyor.',
        'Eski bir umut yeniden filizlenmek istiyor.',
      ],
    },
  },
  {
    id: 'bird', glyph: '🕊', name: 'Kuş',
    interpretations: {
      rim: [
        'Yakında bir haber gelecek; uzaktan ses olabilir.',
        'Bir mesaj, beklediğin tarafı hareketlendirecek.',
      ],
      middle: [
        'Şu an dolaşımda bir konuşma var; söz havada.',
        'Bir haber tam zamanında düşecek.',
      ],
      bottom: [
        'Geçmişten gelen bir haber hâlâ konuşuluyor.',
        'Eski bir mektup ya da konuşmanın izi var.',
      ],
    },
  },
  {
    id: 'road', glyph: '〰', name: 'Yol',
    interpretations: {
      rim: [
        'Önünde yeni bir yol açılacak.',
        'Yakın zamanda bir yolculuk veya yön değişikliği görünüyor.',
      ],
      middle: [
        'Şu anda iki seçenek arasında ilerliyorsun.',
        'Yol berrak; sadece adımları sayman kalıyor.',
      ],
      bottom: [
        'Geçmişten kalan bir yol seni şekillendirdi.',
        'Eski bir patika hâlâ anılarda.',
      ],
    },
  },
  {
    id: 'key', glyph: '🗝', name: 'Anahtar',
    interpretations: {
      rim: [
        'Yakında bir kapı sana açılacak; fırsat seni çağırıyor.',
        'Bir çözüm yakın; elinde anahtarın olduğunu unutma.',
      ],
      middle: [
        'Şu an bir konuyu çözecek anahtar tam elinde.',
        'Bir sırrın kapısı seni ortada bekliyor.',
      ],
      bottom: [
        'Geçmişte kullanmayı unuttuğun bir anahtar var.',
        'Eski bir cevap yeniden gündeme gelebilir.',
      ],
    },
  },
  {
    id: 'moon', glyph: '☽', name: 'Ay',
    interpretations: {
      rim: [
        'Yakında duygular yüzeye çıkacak; rüya gibi bir dönem geliyor.',
        'Bir his keskinleşecek; sezgine güven.',
      ],
      middle: [
        'Şu an sezgin sözden daha doğru konuşuyor.',
        'Belirsiz bir konu gece netleşecek.',
      ],
      bottom: [
        'Geçmişten gelen bir duygu hâlâ saklı.',
        'Eski bir his uykunda hâlâ konuşuyor.',
      ],
    },
  },
  {
    id: 'sun', glyph: '☀', name: 'Güneş',
    interpretations: {
      rim: [
        'Aydınlık bir dönem kapıda.',
        'Yakında bir başarı veya kutlama var.',
      ],
      middle: [
        'Şu an enerjin parlak; başkaları seni fark ediyor.',
        'Sıcak bir dönemin tam ortasındasın.',
      ],
      bottom: [
        'Geçmişteki bir aydınlık seni hâlâ besliyor.',
        'Eski bir mutluluk anısı dipte hâlâ ışıyor.',
      ],
    },
  },
  {
    id: 'circle', glyph: '○', name: 'Daire',
    interpretations: {
      rim: [
        'Yakında bir konu tamamlanacak; döngü kapanıyor.',
        'Bir karar yuvarlanacak.',
      ],
      middle: [
        'Şu an bir döngü içindesin; sabırlı olmak iyi gelir.',
        'Tekrar eden bir örüntü ortada.',
      ],
      bottom: [
        'Geçmişten kalan bir döngü hâlâ dönüyor.',
        'Eski bir alışkanlığın izi var.',
      ],
    },
  },
  {
    id: 'triangle', glyph: '△', name: 'Üçgen',
    interpretations: {
      rim: [
        'Yakında olumlu bir denge kurulacak.',
        'Yön bulduğunu gösteren bir işaret görünüyor.',
      ],
      middle: [
        'Şu an üç farklı güç arasında denge kuruyorsun.',
        'Karar netleşmek üzere.',
      ],
      bottom: [
        'Geçmişten kalan bir üçleme — kişi, his, karar — hâlâ etkide.',
        'Eski bir denge hâlâ konuşuluyor.',
      ],
    },
  },
  {
    id: 'bridge', glyph: '⌒', name: 'Köprü',
    interpretations: {
      rim: [
        'Yakında bir bağ kurulacak; eski bir köprü onarılabilir.',
        'Birini birine bağlayan bir adım atacaksın.',
      ],
      middle: [
        'Şu an iki tarafı birbirine bağlayan sen olabilirsin.',
        'Bir uzlaşı köprüsü görünüyor.',
      ],
      bottom: [
        'Geçmişte kurulup yıkılmış bir köprü hâlâ akılda.',
        'Eski bir bağ tamir bekliyor.',
      ],
    },
  },
  {
    id: 'flower', glyph: '✿', name: 'Çiçek',
    interpretations: {
      rim: [
        'Yakında küçük bir güzellik kapıya bırakılacak.',
        'Bir şeyin tomurcuklandığını fark edeceksin.',
      ],
      middle: [
        'Şu an bir filiz veriyor; nazikçe besle.',
        'Sıcak bir şey büyüme aşamasında.',
      ],
      bottom: [
        'Geçmişten kalan bir incelik hâlâ kokuyor.',
        'Eski bir hediye anlamını koruyor.',
      ],
    },
  },
  {
    id: 'cup', glyph: '⌶', name: 'Fincan',
    interpretations: {
      rim: [
        'Yakında bir konuşma fincanı dolduracak; davet olabilir.',
        'Yeni bir buluşma ihtimali kıyıda.',
      ],
      middle: [
        'Şu an birinin sana ayırdığı zaman tam burada.',
        'Bir sohbet kalbi besliyor.',
      ],
      bottom: [
        'Geçmişten kalan bir buluşma hâlâ kalpte.',
        'Eski bir sohbet izini bırakmış.',
      ],
    },
  },
];

const seededRandom = (seed: number) => {
  let s = Math.abs(Math.floor(seed)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const computeLoveScore = (analysis: AnalysisResult): number => {
  const total = analysis.totalMessages || 1;
  const love = analysis.nlpSignals.totals.loveAdjusted || 0;
  const tension = analysis.nlpSignals.totals.tensionAdjusted || 0;
  return Math.max(20, Math.min(99, Math.round(60 + (love / total) * 600 - (tension / total) * 200)));
};

const closingForScore = (score: number, mode: RelationshipMode): string => {
  const isFriend = mode === 'friend';
  if (score >= 80) {
    return isFriend
      ? 'Fincan da gösteriyor: bu arkadaşlığın enerjisi besleyici.'
      : 'Fincan da gösteriyor: ikinizin tortusu sıcaklığa doğru çekiyor.';
  }
  if (score >= 60) {
    return isFriend
      ? 'Tortuda iniş çıkışlar var ama sevgi yine de dipte.'
      : 'Tortuda iniş çıkışlar var ama sıcaklık dipte korunmuş.';
  }
  if (score >= 40) {
    return isFriend
      ? 'Bağ var ama yorgunluk da görünüyor; bir mola iyi gelebilir.'
      : 'Aranızda mesafe var; küçük bir konuşma çoğu sembolü yumuşatır.';
  }
  return isFriend
    ? 'Fincan biraz dumanlı; eski bağ hâlâ aranıyor ama yeniden ısıtmak gerek.'
    : 'Fincan dumanlı; ilişki tarafında sertlik birikmiş, isimlendirmek gerek.';
};

export const generateCoffeeReading = (
  analysis: AnalysisResult | null,
  relationMode: RelationshipMode,
  nonce = 0
): CoffeeReading => {
  const rng = seededRandom(nonce + Date.now() % 1000);
  const symbolCount = 5 + Math.floor(rng() * 3); // 5..7
  const positions: CoffeePosition[] = ['rim', 'middle', 'bottom'];
  const pool = [...COFFEE_SYMBOLS];
  const picks: Array<{ symbol: CoffeeSymbol; position: CoffeePosition; text: string }> = [];

  for (let i = 0; i < symbolCount && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const symbol = pool.splice(idx, 1)[0];
    const position = positions[Math.floor(rng() * positions.length)];
    const lines = symbol.interpretations[position];
    const text = lines[Math.floor(rng() * lines.length)];
    picks.push({ symbol, position, text });
  }

  const sentences = picks.map(p => `**${p.symbol.name}** ${POSITION_LABEL[p.position]} — ${p.text}`);
  const closing = analysis ? ' ' + closingForScore(computeLoveScore(analysis), relationMode) : '';

  return {
    title: 'Fincan Yorumu',
    reading: sentences.join(' ') + closing,
    symbols: picks.slice(0, 4).map(p => ({
      label: p.symbol.name,
      value: p.symbol.glyph,
      note: POSITION_LABEL[p.position],
    })),
  };
};
