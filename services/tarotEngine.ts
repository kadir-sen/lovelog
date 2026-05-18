import { AnalysisResult } from '../types';
import { RelationshipMode } from './relationshipReport';

export type TarotPosition = 'past' | 'present' | 'future';

export interface TarotCard {
  id: string;
  name: string;
  glyph: string;
  upright: Record<TarotPosition, string>;
  reversed: Record<TarotPosition, string>;
  keywords: string[];
}

export interface DrawnCard {
  card: TarotCard;
  position: TarotPosition;
  reversed: boolean;
  meaning: string;
}

export interface TarotReading {
  title: string;
  reading: string;
  drawn: DrawnCard[];
  symbols: Array<{ label: string; value: string; note: string }>;
}

// 22 Major Arcana. Her kartın geçmiş/şimdi/gelecek pozisyonu için düz ve ters anlamı tanımlı.
export const TAROT_DECK: TarotCard[] = [
  {
    id: 'fool', name: 'Joker', glyph: '☉',
    upright: {
      past: 'Geçmişte cesurca atılmış, hesapsız ama saf bir adım var.',
      present: 'Şu anda yeni bir başlangıcın eşiğindesin; içgüdünü dinle.',
      future: 'Yakında alışılmadık bir teklif veya beklenmedik bir kapı açılabilir.',
    },
    reversed: {
      past: 'Geçmişte aceleyle alınmış bir karar hâlâ konuşuyor.',
      present: 'Şu an risk almakta tereddütlü; küçük bir adım yetiyor.',
      future: 'Yaklaşan bir başlangıç için biraz daha hazırlık gerekecek.',
    },
    keywords: ['başlangıç', 'cesaret', 'saflık'],
  },
  {
    id: 'magician', name: 'Büyücü', glyph: '✦',
    upright: {
      past: 'Geçmişte bir yetenek veya cazibe sayesinde dengeleri çevirdin.',
      present: 'Şu anda elinde gerekli her şey var; niyetini netleştirmen yeterli.',
      future: 'Yakında bir fırsatı kendi elinle şekillendireceksin.',
    },
    reversed: {
      past: 'Geçmişte küçük bir oyun veya yarım bir niyet hâlâ etkide.',
      present: 'Şu an söz ve eylem arasında küçük bir boşluk var.',
      future: 'Yakında niyetini netleştirmeden ilerlersen yanlış sinyal verebilirsin.',
    },
    keywords: ['niyet', 'yetenek', 'eylem'],
  },
  {
    id: 'priestess', name: 'Yüksek Rahibe', glyph: '☽',
    upright: {
      past: 'Geçmişte sezgini dinledin ve görünmeyeni gördün.',
      present: 'Şu an dışarıya gösterilmeyen bir şey kalbinde duruyor.',
      future: 'Yakında bir sır veya saklı bir gerçek açığa çıkacak.',
    },
    reversed: {
      past: 'Geçmişte sezginin sesine kulak tıkadın, bedelini şimdi anlıyorsun.',
      present: 'Şu an iç sesinle dış gürültü çatışıyor.',
      future: 'Yakında saklanan bir his daha çok bastıracak; konuşmak gerekecek.',
    },
    keywords: ['sezgi', 'sır', 'iç ses'],
  },
  {
    id: 'empress', name: 'İmparatoriçe', glyph: '♀',
    upright: {
      past: 'Geçmişte besleyici, sıcak bir bağ vardı; izleri hâlâ duyulur.',
      present: 'Şu anda şefkat, üretkenlik ve sıcaklık öne çıkıyor.',
      future: 'Yakında bir büyüme — duygusal, yaratıcı veya pratik — kapıda.',
    },
    reversed: {
      past: 'Geçmişte fazla verdiğin, az aldığın bir dönem etkisini sürdürüyor.',
      present: 'Şu an kendine bakma ile bakım verme dengesi sarsılmış.',
      future: 'Yakında öncelikleri yeniden hizalamak gerekecek.',
    },
    keywords: ['şefkat', 'üretkenlik', 'bolluk'],
  },
  {
    id: 'emperor', name: 'İmparator', glyph: '♂',
    upright: {
      past: 'Geçmişte sağlam bir yapı, net bir karar koymuştun.',
      present: 'Şu anda netlik, sınır ve disiplin baskın.',
      future: 'Yakında bir konuda söz sahibi olacak, çerçeveyi sen çizeceksin.',
    },
    reversed: {
      past: 'Geçmişte bir otorite veya katı bir tavır iz bıraktı.',
      present: 'Şu an esneklik ile kontrol arasında sıkışma var.',
      future: 'Yakında yumuşamayı seçmek seni özgürleştirecek.',
    },
    keywords: ['düzen', 'otorite', 'sınır'],
  },
  {
    id: 'hierophant', name: 'Aziz', glyph: '✝',
    upright: {
      past: 'Geçmişte bir gelenek veya bir yol gösterici izini bıraktı.',
      present: 'Şu an alışılmış değerlerle yeni hisler arasında bir köprü kuruyorsun.',
      future: 'Yakında bir bağı resmileştirmek veya bir kuralı netleştirmek gündeme gelecek.',
    },
    reversed: {
      past: 'Geçmişteki bir kalıp seni hâlâ tekrara çağırıyor.',
      present: 'Şu an kendi yolunu çizmek, klasik beklentilerden ayrışmak gerekiyor.',
      future: 'Yakında kuraldan saparak öğreneceğin bir şey olacak.',
    },
    keywords: ['gelenek', 'değer', 'köprü'],
  },
  {
    id: 'lovers', name: 'Aşıklar', glyph: '♡',
    upright: {
      past: 'Geçmişte güçlü bir bağ ve kalpten bir seçim yapmıştın.',
      present: 'Şu an iki yol arasında, kalbinin sesi belirleyici.',
      future: 'Yakında derin bir uyum ya da önemli bir karar seni bekliyor.',
    },
    reversed: {
      past: 'Geçmişte yapılamamış bir seçim hâlâ asılı duruyor.',
      present: 'Şu an iki tarafın değerleri tam örtüşmüyor; konuşulması gerek.',
      future: 'Yakında bir seçim ertelenirse maliyet artacak.',
    },
    keywords: ['seçim', 'aşk', 'uyum'],
  },
  {
    id: 'chariot', name: 'Savaş Arabası', glyph: '⛓',
    upright: {
      past: 'Geçmişte istediğin yöne doğru kararlı bir hamle yaptın.',
      present: 'Şu an iki farklı arzu seni iki yöne çekiyor; dümeni sen tutuyorsun.',
      future: 'Yakında kararlılıkla bir hedefe varacaksın.',
    },
    reversed: {
      past: 'Geçmişte yarım kalan bir mücadele hâlâ enerjini meşgul ediyor.',
      present: 'Şu an yön karışıklığı var; öncelik belirlemek gerek.',
      future: 'Yakında durmak ve yeniden hizalanmak ilerlemekten önemli olacak.',
    },
    keywords: ['kararlılık', 'yön', 'irade'],
  },
  {
    id: 'strength', name: 'Güç', glyph: '♌',
    upright: {
      past: 'Geçmişte sabırla bir vahşi hisi evcilleştirdin.',
      present: 'Şu an yumuşak güçle ilerliyorsun; zorlamak gerekmiyor.',
      future: 'Yakında bir gerilim sabır ve şefkatle çözülecek.',
    },
    reversed: {
      past: 'Geçmişte güç gösterisiyle kazanılmış ama ısı bırakmış bir konu var.',
      present: 'Şu an dürtüler kontrolün önüne geçiyor.',
      future: 'Yakında bir an için duraklamak en güçlü hamle olacak.',
    },
    keywords: ['sabır', 'şefkat', 'içsel güç'],
  },
  {
    id: 'hermit', name: 'Ermiş', glyph: '☄',
    upright: {
      past: 'Geçmişte yalnız geçen bir dönem sana çok şey öğretti.',
      present: 'Şu an içe dönmek, sessizlikte yön bulmak gerekiyor.',
      future: 'Yakında bir cevap dışarıdan değil, içeriden gelecek.',
    },
    reversed: {
      past: 'Geçmişte fazla içe çekilmenin getirdiği uzaklık etkide.',
      present: 'Şu an inziva değil, hafif bir köprü kurmak iyi gelir.',
      future: 'Yakında biriyle paylaşmak çok daha çözücü olacak.',
    },
    keywords: ['içe dönme', 'sessizlik', 'rehberlik'],
  },
  {
    id: 'wheel', name: 'Kader Çarkı', glyph: '☸',
    upright: {
      past: 'Geçmişte bir döngünün dönüş anına tanıklık ettin.',
      present: 'Şu an bir devir değişiyor; tutmaya değil akmaya gel.',
      future: 'Yakında beklenmedik bir döneme girilecek.',
    },
    reversed: {
      past: 'Geçmişte talihsiz bir tekrar seni hâlâ yoruyor.',
      present: 'Şu an aynı kalıbı kırmak için küçük bir karar yeter.',
      future: 'Yakında döngüyü dışarıdan görmek için bir ipucu çıkacak.',
    },
    keywords: ['döngü', 'değişim', 'şans'],
  },
  {
    id: 'justice', name: 'Adalet', glyph: '⚖',
    upright: {
      past: 'Geçmişte hak ettiğin bir sonucu aldın.',
      present: 'Şu an doğru, dürüst ve dengeli olmak özellikle önemli.',
      future: 'Yakında bir karar dengelenecek; ne ekildiyse o biçilecek.',
    },
    reversed: {
      past: 'Geçmişte adaletsiz hissedilen bir konunun izi sürüyor.',
      present: 'Şu an yargılamaktan değil anlamaktan başlamak iyi olur.',
      future: 'Yakında bir hata kabulü dengeyi geri getirecek.',
    },
    keywords: ['denge', 'sorumluluk', 'dürüstlük'],
  },
  {
    id: 'hanged', name: 'Asılan Adam', glyph: '☥',
    upright: {
      past: 'Geçmişte bir adımı askıya almak işe yaradı.',
      present: 'Şu an perspektif değiştirmek için durmak gerekiyor.',
      future: 'Yakında bekleyişten doğan bir farkındalık gelecek.',
    },
    reversed: {
      past: 'Geçmişte aşırı uzun süren bir bekleyiş enerjini düşürdü.',
      present: 'Şu an hareket etmemek bir tür kayıp.',
      future: 'Yakında karar erteleme maliyetli olabilir.',
    },
    keywords: ['askıda kalma', 'perspektif', 'feragat'],
  },
  {
    id: 'death', name: 'Ölüm', glyph: '☠',
    upright: {
      past: 'Geçmişte bir bölüm kapandı ve seni yeni biri yaptı.',
      present: 'Şu an bir şeyin sonu ile yeni bir başlangıç iç içe.',
      future: 'Yakında biten bir döngü temiz bir sayfa açacak.',
    },
    reversed: {
      past: 'Geçmişte bitirilemeyen bir konu yarım kaldı.',
      present: 'Şu an bir vedanın geciktiğini hissediyorsun.',
      future: 'Yakında bir kapanış ihtimal; cesaret işine yarar.',
    },
    keywords: ['dönüşüm', 'son', 'yeniden doğuş'],
  },
  {
    id: 'temperance', name: 'Denge', glyph: '☯',
    upright: {
      past: 'Geçmişte zıtlıkları sabırla harmanladın.',
      present: 'Şu an aşırılıklardan kaçınmak, akışkan kalmak gerekiyor.',
      future: 'Yakında bir uzlaşı veya ılımlı bir orta yol bulunacak.',
    },
    reversed: {
      past: 'Geçmişte aşırıya kaçılan bir konu hâlâ ses veriyor.',
      present: 'Şu an iç dengeyi bozan bir alışkanlık tetikleyici.',
      future: 'Yakında küçük bir adımı küçük tutmak önemli olacak.',
    },
    keywords: ['ölçü', 'uzlaşı', 'akış'],
  },
  {
    id: 'devil', name: 'Şeytan', glyph: '☿',
    upright: {
      past: 'Geçmişte bir bağımlılık veya saplantı yön belirledi.',
      present: 'Şu an kendi zincirlerini kendin tutuyorsun; anahtar elinde.',
      future: 'Yakında bir kalıbı kırmak için fırsat doğacak.',
    },
    reversed: {
      past: 'Geçmişte kırılan bir zincirin çatlağı hâlâ duyulur.',
      present: 'Şu an çözülmenin başında, ışık görünüyor.',
      future: 'Yakında daha hafif bir hâl alacaksın.',
    },
    keywords: ['saplantı', 'gölge', 'özgürleşme'],
  },
  {
    id: 'tower', name: 'Kule', glyph: '⚡',
    upright: {
      past: 'Geçmişte ani bir kırılma bazı yapıları sarstı.',
      present: 'Şu an temeldeki bir çatlağı görmezden gelmek zor.',
      future: 'Yakında ani bir farkındalık planı değiştirecek.',
    },
    reversed: {
      past: 'Geçmişte yıkımdan kaçınılan ama tam çözülmemiş bir konu var.',
      present: 'Şu an küçük sarsıntılar, büyük gerçeği gösteriyor.',
      future: 'Yakında bir sarsıntı geç de olsa temizleyici olacak.',
    },
    keywords: ['sarsıntı', 'gerçek', 'yıkım'],
  },
  {
    id: 'star', name: 'Yıldız', glyph: '✶',
    upright: {
      past: 'Geçmişte bir umut, karanlık bir dönemde rehber oldu.',
      present: 'Şu an umut ve iyileşme döngüsüne girdin.',
      future: 'Yakında dilekler ile gerçeklik birbirine yaklaşacak.',
    },
    reversed: {
      past: 'Geçmişte sönmüş bir umut hâlâ acıtıyor.',
      present: 'Şu an inanç biraz kırılgan; nefes almak iyi gelir.',
      future: 'Yakında küçük bir işaret yeniden umut verecek.',
    },
    keywords: ['umut', 'iyileşme', 'aydınlık'],
  },
  {
    id: 'moon', name: 'Ay', glyph: '☾',
    upright: {
      past: 'Geçmişte belirsizliklerle yüzleştin ve sezgin keskinleşti.',
      present: 'Şu an her şey göründüğü gibi değil; rüya ve gerçek iç içe.',
      future: 'Yakında saklı bir duygu yüzeye çıkacak.',
    },
    reversed: {
      past: 'Geçmişte yanlış anlaşılan bir his etkisini sürdürüyor.',
      present: 'Şu an sis dağılıyor, netlik geliyor.',
      future: 'Yakında bir korku adının doğru konmasıyla küçülecek.',
    },
    keywords: ['belirsizlik', 'sezgi', 'rüya'],
  },
  {
    id: 'sun', name: 'Güneş', glyph: '☀',
    upright: {
      past: 'Geçmişte gerçek ve mutlu bir an seni ısıttı.',
      present: 'Şu an sıcaklık, neşe ve net bir görünürlük var.',
      future: 'Yakında bir başarı, bir kutlama veya bir aydınlık geliyor.',
    },
    reversed: {
      past: 'Geçmişte fazla parlak göründüğü için yanıltıcı olan bir dönem var.',
      present: 'Şu an gerçek mutluluk ile gösterişli mutluluk birbirine karışıyor.',
      future: 'Yakında daha sade bir sevinç daha çok ısıtacak.',
    },
    keywords: ['neşe', 'başarı', 'aydınlık'],
  },
  {
    id: 'judgement', name: 'Mahşer', glyph: '⚜',
    upright: {
      past: 'Geçmişte bir uyanış seni yeniden hizaladı.',
      present: 'Şu an bir çağrıyı duyuyorsun; cevap vermenin zamanı.',
      future: 'Yakında bir geçmiş hesabı kapanacak.',
    },
    reversed: {
      past: 'Geçmişte duyulmamış bir çağrı hâlâ bekliyor.',
      present: 'Şu an kendine fazla sert davranıyorsun.',
      future: 'Yakında af, sürpriz biçimde kendinden gelecek.',
    },
    keywords: ['uyanış', 'çağrı', 'hesap'],
  },
  {
    id: 'world', name: 'Dünya', glyph: '⊕',
    upright: {
      past: 'Geçmişte bir döngü tamamlandı ve sana genişlik kattı.',
      present: 'Şu an tamamlanma duygusu güçlü; bir bölüm kapanıyor.',
      future: 'Yakında yeni bir döngü, daha büyük bir sahnede başlayacak.',
    },
    reversed: {
      past: 'Geçmişte yarım kalan bir tamamlanma seni meşgul ediyor.',
      present: 'Şu an son adımı atmak için cesaret gerek.',
      future: 'Yakında küçük bir kapatma büyük bir özgürlük açacak.',
    },
    keywords: ['tamamlanma', 'bütünlük', 'döngü'],
  },
];

const CONNECTORS = [
  'Bu enerji şu an',
  'Bu zemin üzerinde',
  'Bu izden hareketle',
  'Bu sinyalin üstüne',
];

const FUTURE_CONNECTORS = [
  'Geleceğe doğru ise',
  'Önündeki günlerde',
  'Sıradaki kapı',
  'Yaklaşan dönem',
];

const seededRandom = (seed: number) => {
  let s = Math.abs(Math.floor(seed)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const drawThree = (nonce: number): DrawnCard[] => {
  const rng = seededRandom(nonce + Date.now() % 1000);
  const positions: TarotPosition[] = ['past', 'present', 'future'];
  const deck = [...TAROT_DECK];
  const drawn: DrawnCard[] = [];
  for (const pos of positions) {
    const idx = Math.floor(rng() * deck.length);
    const card = deck.splice(idx, 1)[0];
    const reversed = rng() < 0.5;
    drawn.push({
      card,
      position: pos,
      reversed,
      meaning: reversed ? card.reversed[pos] : card.upright[pos],
    });
  }
  return drawn;
};

const computeLoveScore = (analysis: AnalysisResult): number => {
  const total = analysis.totalMessages || 1;
  const love = analysis.nlpSignals.totals.loveAdjusted || 0;
  const tension = analysis.nlpSignals.totals.tensionAdjusted || 0;
  const positive = (love / total) * 600;
  const negative = (tension / total) * 200;
  return Math.max(20, Math.min(99, Math.round(60 + positive - negative)));
};

const closingForScore = (score: number, mode: RelationshipMode): string => {
  const isFriend = mode === 'friend';
  if (score >= 80) {
    return isFriend
      ? 'Falda da görünüyor: bu arkadaşlığın enerjisi besleyici, ortak ritminizi koruyun.'
      : 'Falda da görünen şu: ikinizin sıcaklığı şu an birbirini gerçekten besliyor.';
  }
  if (score >= 60) {
    return isFriend
      ? 'İniş çıkışlar var ama ortak vibe sağlam — küçük dramaları büyütmemek yetiyor.'
      : 'İniş çıkışlar olağan; sıcaklık ile küçük pürüzler aynı anda görünüyor.';
  }
  if (score >= 40) {
    return isFriend
      ? 'Bağ var ama yıpranma da var — açık bir konuşma çoğu sinyali çözebilir.'
      : 'İlişki tarafı biraz mesafeli görünüyor; net bir konuşma çoğu kartı yumuşatır.';
  }
  return isFriend
    ? 'Arkadaşlığın tarafı çok yorulmuş görünüyor; küçük bir mola ya da samimi bir konuşma iyi gelir.'
    : 'İlişki tarafı yorgun; karta da yansıyan sertliği tek tek isimlendirmek gerek.';
};

export const generateTarotReading = (
  analysis: AnalysisResult | null,
  relationMode: RelationshipMode,
  nonce = 0
): TarotReading => {
  const drawn = drawThree(nonce);
  const positionNames: Record<TarotPosition, string> = { past: 'Geçmiş', present: 'Şimdi', future: 'Gelecek' };
  const rng = seededRandom(nonce + drawn[0].card.id.length);
  const connector = CONNECTORS[Math.floor(rng() * CONNECTORS.length)];
  const futureConnector = FUTURE_CONNECTORS[Math.floor(rng() * FUTURE_CONNECTORS.length)];

  const past = drawn[0].meaning;
  const present = drawn[1].meaning;
  const future = drawn[2].meaning;
  const closing = analysis ? closingForScore(computeLoveScore(analysis), relationMode) : '';

  const reading = `${past} ${connector} ${present.charAt(0).toLowerCase() + present.slice(1)} ${futureConnector} ${future.charAt(0).toLowerCase() + future.slice(1)} ${closing}`.trim();

  return {
    title: 'Üç Kart Açılımı',
    reading,
    drawn,
    symbols: drawn.map(d => ({
      label: positionNames[d.position],
      value: `${d.card.glyph} ${d.card.name}${d.reversed ? ' (ters)' : ''}`,
      note: d.card.keywords.join(' · '),
    })),
  };
};
