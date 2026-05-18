import { RelationshipMode } from './relationshipReport';

export type ZodiacId =
  | 'koc' | 'boga' | 'ikizler' | 'yengec' | 'aslan' | 'basak'
  | 'terazi' | 'akrep' | 'yay' | 'oglak' | 'kova' | 'balik';

export type ZodiacElement = 'ates' | 'toprak' | 'hava' | 'su';

export interface ZodiacInfo {
  id: ZodiacId;
  name: string;
  glyph: string;
  element: ZodiacElement;
  vibe: string;
}

export const ZODIACS: ZodiacInfo[] = [
  { id: 'koc',     name: 'Koç',     glyph: '♈', element: 'ates',   vibe: 'atak' },
  { id: 'boga',    name: 'Boğa',    glyph: '♉', element: 'toprak', vibe: 'sakin' },
  { id: 'ikizler', name: 'İkizler', glyph: '♊', element: 'hava',   vibe: 'meraklı' },
  { id: 'yengec',  name: 'Yengeç',  glyph: '♋', element: 'su',     vibe: 'duygusal' },
  { id: 'aslan',   name: 'Aslan',   glyph: '♌', element: 'ates',   vibe: 'parlak' },
  { id: 'basak',   name: 'Başak',   glyph: '♍', element: 'toprak', vibe: 'titiz' },
  { id: 'terazi',  name: 'Terazi',  glyph: '♎', element: 'hava',   vibe: 'uzlaşmacı' },
  { id: 'akrep',   name: 'Akrep',   glyph: '♏', element: 'su',     vibe: 'derin' },
  { id: 'yay',     name: 'Yay',     glyph: '♐', element: 'ates',   vibe: 'özgür' },
  { id: 'oglak',   name: 'Oğlak',   glyph: '♑', element: 'toprak', vibe: 'kararlı' },
  { id: 'kova',    name: 'Kova',    glyph: '♒', element: 'hava',   vibe: 'sıra dışı' },
  { id: 'balik',   name: 'Balık',   glyph: '♓', element: 'su',     vibe: 'hayalci' },
];

const ZODIAC_BY_ID: Record<ZodiacId, ZodiacInfo> = Object.fromEntries(
  ZODIACS.map(z => [z.id, z])
) as Record<ZodiacId, ZodiacInfo>;

const elementScore = (a: ZodiacElement, b: ZodiacElement): number => {
  if (a === b) return 90;
  // Klasik astroloji: ateş-hava ve su-toprak uyumlu; ateş-su ve hava-toprak gergin.
  const fireAir = (a === 'ates' && b === 'hava') || (a === 'hava' && b === 'ates');
  const waterEarth = (a === 'su' && b === 'toprak') || (a === 'toprak' && b === 'su');
  const fireWater = (a === 'ates' && b === 'su') || (a === 'su' && b === 'ates');
  const airEarth = (a === 'hava' && b === 'toprak') || (a === 'toprak' && b === 'hava');
  if (fireAir) return 84;
  if (waterEarth) return 86;
  if (fireWater) return 64;
  if (airEarth) return 68;
  return 74;
};

interface PairNote {
  score?: number;
  loverNote: string;
  friendNote: string;
}

// 12x12 = 78 unique kombinasyon. Hot pairs için elle-yazılmış notlar.
// Eksik olan kombinasyonlar için element-bazlı şablon kullanılır.
const PAIR_NOTES: Record<string, PairNote> = {
  'koc-koc': { score: 78, loverNote: 'İki ateş — tutku yüksek, rekabet de yüksek. Aynı yöne baktığınızda yenilmez ikilisiniz.', friendNote: 'Spor, macera, hız — birlikte enerjiniz tavan. Egolar çarpışmasın diye sıraya girmeyi öğrenin.' },
  'koc-boga': { score: 64, loverNote: 'Hız ile sabır karşılaşıyor. Koç ileri itiyor, Boğa zemine basıyor; orta yol bulunca güçlü.', friendNote: 'Koç plan açar, Boğa rahat eder. Drama yapmamak için sabırla anlatmak gerek.' },
  'koc-ikizler': { score: 82, loverNote: 'Hareket ve merak iyi anlaşır. Sohbet hızlı, romantizm oyunsal.', friendNote: 'Birlikte hiç sıkılmayan ikili. Plan üstüne plan, gülüş üstüne gülüş.' },
  'koc-yengec': { score: 62, loverNote: 'Ateş ile su — biri çabuk söyler, diğeri hisseder. Anlamak için yavaşlamak gerek.', friendNote: 'Koç direkt konuşur, Yengeç hassas alır. Niyet açıklamak çoğu drama önler.' },
  'koc-aslan': { score: 88, loverNote: 'İki ateş, iki sahne. Tutku ve görünür sevgi yüksek; ego barışı önemli.', friendNote: 'Birlikte sahne çalan ikili. Tartışma da büyük, barışma da gösterişli olur.' },
  'koc-basak': { score: 66, loverNote: 'Hızlı kalp ile düzenli akıl. Koç sürer, Başak hizalar; tamamlayıcı olabilir.', friendNote: 'Plan yapan Başak, harekete geçiren Koç. İyi takım, küçük kontrol gerek.' },
  'koc-terazi': { score: 80, loverNote: 'Karşıt burçlar; biri savaşır, biri uzlaşır. Çekim güçlü, denge çalışmayı gerektirir.', friendNote: 'Birlikte sosyal hayat keyifli; Koç eylemi, Terazi nezaketi getirir.' },
  'koc-akrep': { score: 72, loverNote: 'Yoğun tutku, yoğun mesele. İkisi de pes etmez; çatışma olduğunda derin olur.', friendNote: 'Sırrını saklayan iki dost — güven olduğunda hayatlık.' },
  'koc-yay': { score: 90, loverNote: 'Macera ve özgürlük — birlikte yanan iki ateş. Plan değil keşif.', friendNote: 'En kanka ikiliden biri. Birlikte gülmek bütün hayata yetiyor.' },
  'koc-oglak': { score: 70, loverNote: 'Hız ile disiplin. Koç başlar, Oğlak bitirir; hayat ortağı potansiyeli yüksek.', friendNote: 'Birlikte iş kurar, hedefe yürürsünüz; gevşemek için bilinçli çaba lazım.' },
  'koc-kova': { score: 84, loverNote: 'İlerici ateş ile özgür düşünce. Sıkıcı olmayan, yenilik tutkulu bir bağ.', friendNote: 'Birlikte sıradışı planlar, paylaşım bol; özgürlüğe saygı kilit.' },
  'koc-balik': { score: 68, loverNote: 'Direkt ile hayalci. Koç tartışırken Balık hisleniyor; yumuşak konuşmak gerek.', friendNote: 'Koç savaşır, Balık şefkat verir. Sınır net olursa derin bağ.' },

  'boga-boga': { score: 88, loverNote: 'İki toprak — rahatlık, sadakat ve sıcaklık. Değişime direnç ortak konu.', friendNote: 'Aynı evde uyuyan, aynı kafede oturan kanka enerjisi. Konfor tavan.' },
  'boga-ikizler': { score: 70, loverNote: 'Sabit ile değişken. Boğa süreklilik, İkizler çeşitlilik istiyor; ortak ritim emek ister.', friendNote: 'Birlikte tatil planı uzar ama sohbet hep tatlı.' },
  'boga-yengec': { score: 90, loverNote: 'Sıcak yuva enerjisi. Güven, dokunma, sadakat — duygusal taraf çok güçlü.', friendNote: 'Sırrını saklayacak, yemeğini paylaşacak arkadaşlık. Uzun ömürlü olur.' },
  'boga-aslan': { score: 76, loverNote: 'İkisi de değer veren ama inatçı. Görkemli aşk ama kim hizalanacak meselesi var.', friendNote: 'Birlikte stil, lezzet, sahne — sosyal kompozisyon iyi.' },
  'boga-basak': { score: 92, loverNote: 'İki toprak — kararlı, gerçek, dokunulabilir. Romantizm sade ama derin.', friendNote: 'Hayata aynı pencereden bakan iki dost; küçük lüksler aranızda dil.' },
  'boga-terazi': { score: 82, loverNote: 'Estetik ve uyum; Venüs hatları paralel. Romantik tarafı estetik dolu.', friendNote: 'Birlikte güzel mekân, güzel sohbet; küçük lüksleri sever.' },
  'boga-akrep': { score: 84, loverNote: 'Karşıt burçlar — derin sadakat ve tutkulu çekim. Kıskançlık dengeli olmazsa zorlar.', friendNote: 'Sırrı ölene kadar tutar arkadaşlık; güven sınanırsa kırılır.' },
  'boga-yay': { score: 66, loverNote: 'Yerleşik ile gezgin. Yay özgürlük, Boğa kök istiyor; pazarlık gerekecek.', friendNote: 'Birlikte yolculukta planlanmamış anlar tatlı, ama farklı temponun çatırtısı var.' },
  'boga-oglak': { score: 90, loverNote: 'Sağlam, planlı, sözüne sadık iki toprak. Birlikte hayat kurulur.', friendNote: 'Hayat boyu kanka — ortak iş bile çıkar; güvenilirlik tavan.' },
  'boga-kova': { score: 60, loverNote: 'Gelenek ile sıra dışı. Boğa istikrar, Kova yenilik diyor; çatışma olası.', friendNote: 'Farklı dünyalar — paylaşım için bilinçli zemin aramak gerekir.' },
  'boga-balik': { score: 84, loverNote: 'Şefkat ve hayal birleşiyor. Romantizm narin, dokunaklı.', friendNote: 'Birlikte sessiz, derin bir anlayış arkadaşlığı.' },

  'ikizler-ikizler': { score: 82, loverNote: 'İki hava — sohbet sınırsız, sıkıcı an yok. Derinlik talebi olursa yavaşlamak gerek.', friendNote: 'Saatlerce konuşulur, dakikada üç fikir değişir; en eğlenceli ikiliden biri.' },
  'ikizler-yengec': { score: 68, loverNote: 'Zihin ile kalp. İkizler analiz eder, Yengeç hisseder; köprü kurmak iş.', friendNote: 'Birlikte güzel sohbet ama duygusal beklenti farkı var.' },
  'ikizler-aslan': { score: 86, loverNote: 'Parlak sohbet, sıcak çekim. İkisi de görünür olmayı sever.', friendNote: 'Sahne arkadaşlığı — sosyal hayat birlikte renkleniyor.' },
  'ikizler-basak': { score: 74, loverNote: 'Aynı hava (Merkür ortak) — anlayış var ama Başak detay, İkizler dağınık.', friendNote: 'Birlikte plan iyi, taşıma günü tartışma çıkabilir.' },
  'ikizler-terazi': { score: 92, loverNote: 'Hava-hava: zihinsel uyum tavan, sohbet sevgisi paylaşılıyor. Romantizm hafif ve estetik.', friendNote: 'Birlikte sosyal kelebek; herkes hayran olur.' },
  'ikizler-akrep': { score: 64, loverNote: 'Açık ile gizli. Akrep derin sadakat ister, İkizler hafif kalmayı sever.', friendNote: 'Sırlar konusunda ritim farkı; güven inşası zaman alır.' },
  'ikizler-yay': { score: 88, loverNote: 'Karşıt ama çekici. Birlikte büyür, birlikte gezer; sözü sevgiyle besler.', friendNote: 'Macera + felsefe + kahkaha — özgür arkadaşlık.' },
  'ikizler-oglak': { score: 62, loverNote: 'Hafif ile ağır. İkizler oyun, Oğlak hedef diyor.', friendNote: 'Birlikte iş çıkarır ama gevşeme tarafı zayıf kalır.' },
  'ikizler-kova': { score: 90, loverNote: 'Sıra dışı iki zihin. Arkadaşlık + aşk kombosu en güçlü olduğu çift.', friendNote: 'Kanka aşkı zirvede; hep yeni bir fikir yolda.' },
  'ikizler-balik': { score: 66, loverNote: 'Söz ile sezgi. İkizler tartışır, Balık hisseder; yumuşamak iyi gelir.', friendNote: 'Sanatsal, hayalci paylaşımlar tatlı; pratik konularda farklı.' },

  'yengec-yengec': { score: 90, loverNote: 'İki su — yuva, sezgi, sıcaklık. Küçük dramaya birlikte düşebilirsiniz.', friendNote: 'Birbirinin duygusunu doğrudan okuyan dost; ev arkadaşı potansiyeli yüksek.' },
  'yengec-aslan': { score: 76, loverNote: 'Şefkat ile gurur. Aslan beslenmek, Yengeç korumak istiyor.', friendNote: 'Birlikte sosyal + samimi — Yengeç evi açar, Aslan ortamı parlatır.' },
  'yengec-basak': { score: 82, loverNote: 'İhtimam ve hizmet aşkı. Sessiz ama gerçek bağ.', friendNote: 'Birbirine bakacak, küçük detayda fark edecek dostluk.' },
  'yengec-terazi': { score: 70, loverNote: 'Romantizm tarafı zarif, ama hisli Yengeç vs uzlaşmacı Terazi farklı sıcaklıklar üretir.', friendNote: 'Sosyal denge tatlı, ama derin sohbette ayrılıklar var.' },
  'yengec-akrep': { score: 92, loverNote: 'İki su — derin, sadık, yoğun. Söze ihtiyaç bile duymadan anlaşır.', friendNote: 'Sırların güvende kalacağı arkadaşlık; bağ kurulduğunda kemiklere işler.' },
  'yengec-yay': { score: 60, loverNote: 'Yuva ile özgürlük. İki ihtiyaç ters yöne çekiyor.', friendNote: 'Tatil planı tartışmalı ama gülmek var.' },
  'yengec-oglak': { score: 80, loverNote: 'Karşıt burçlar — şefkat ile sorumluluk birleşiyor. Hayat ortağı potansiyeli.', friendNote: 'Birbirinin yoluna güvenen, hayat boyu sürecek arkadaşlık.' },
  'yengec-kova': { score: 64, loverNote: 'Duygusal ile zihinsel. İletişim dili farklı; çevirmen gerekir.', friendNote: 'Saygılı ama mesafeli arkadaşlık çoğunlukla.' },
  'yengec-balik': { score: 92, loverNote: 'İki su — masalsı, şefkatli, sezgisel. Romantizm tarafı çok güçlü.', friendNote: 'Birlikte sanat, birlikte ağlamak, birlikte gülmek — derin bağ.' },

  'aslan-aslan': { score: 84, loverNote: 'İki sahne ışığı. Tutku tavan, ego pazarlığı şart.', friendNote: 'Birlikte sahne çalan kankalar; herkes onlara döner.' },
  'aslan-basak': { score: 68, loverNote: 'Parlak ile mütevazı. Hayat görüşü farklı ama tamamlayıcı.', friendNote: 'Aslan parlatır, Başak düzenler — iyi proje arkadaşlığı.' },
  'aslan-terazi': { score: 86, loverNote: 'Estetik ve gurur — birlikte sahne sevgilisi. Romantizm sosyal ve parlak.', friendNote: 'Stil ve sosyallik üst sevye.' },
  'aslan-akrep': { score: 72, loverNote: 'İki sabit ateş/su — yoğun çekim, yoğun tartışma. Sadakat sınanıyor.', friendNote: 'Güven kazanılırsa hayatlık; kırılırsa zor toparlanır.' },
  'aslan-yay': { score: 90, loverNote: 'İki ateş — sıcak, cömert, neşeli. Romantizm renkli ve cesur.', friendNote: 'Birlikte parti, birlikte yol; herkes sizi anlatır.' },
  'aslan-oglak': { score: 68, loverNote: 'Sahne ile sessiz başarı. İki güç ama farklı tarz; saygı kazandığında güçlü.', friendNote: 'Birlikte hedef koyar, farklı yollarla ulaşırsınız.' },
  'aslan-kova': { score: 84, loverNote: 'Karşıt burçlar — birey ile özgürlük. Çekim güçlü, alan vermek gerekir.', friendNote: 'Birlikte sıra dışı, parlak; özgürlüğe saygı önemli.' },
  'aslan-balik': { score: 70, loverNote: 'Görkem ile şefkat. Aslan görünür, Balık hissedilir; tamamlanma mümkün.', friendNote: 'Romantik ve şefkatli arkadaşlık — sanatla beslenir.' },

  'basak-basak': { score: 84, loverNote: 'İki toprak/Merkür — düzen, mantık, ihtimam. Romantizm sessiz ama sürekli.', friendNote: 'Birlikte plan, birlikte düzen; küçük detaylarda buluşan kanka.' },
  'basak-terazi': { score: 76, loverNote: 'Estetik ile düzen iyi anlaşır; karar verme tarafı yavaş olabilir.', friendNote: 'Birlikte güzel ortam yaratır.' },
  'basak-akrep': { score: 82, loverNote: 'Detay ve derinlik. İkisi de iz sürmeyi sever; iyi araştırmacılar.', friendNote: 'Birlikte ortak proje, gizli plan — güçlü ittifak.' },
  'basak-yay': { score: 66, loverNote: 'Plan ile macera. Başak detay, Yay özgürlük; ortak orta çizgisi şart.', friendNote: 'Birlikte gezi karışık ama hikâye tatlı olur.' },
  'basak-oglak': { score: 90, loverNote: 'İki toprak — kararlı, hizmet odaklı, gerçek. Romantizm günlük hayata işler.', friendNote: 'Birlikte hayat kuran iki dost; iş ortağı, yoldaş.' },
  'basak-kova': { score: 70, loverNote: 'Mantık ile vizyon. Başak detay, Kova büyük resim; tamamlayıcı.', friendNote: 'Birlikte fikir üretir, başkasının yapamadığı şeyi yaparsınız.' },
  'basak-balik': { score: 78, loverNote: 'Karşıt burçlar — gerçek ile hayal. Şefkat ve düzen birleşince besleyici.', friendNote: 'Birbirini eksiklikten kurtaran arkadaşlık.' },

  'terazi-terazi': { score: 86, loverNote: 'İki Venüs — uyum, estetik, romantizm. Karar verme tarafı zayıf olabilir.', friendNote: 'Birlikte sosyal kelebek; herkesi mutlu etmeye çalışır.' },
  'terazi-akrep': { score: 70, loverNote: 'Yüzey ile derin. Terazi denge ister, Akrep yoğunluk; uzlaşı yavaş.', friendNote: 'Birlikte sosyal hayat keyifli, mahrem konularda mesafe var.' },
  'terazi-yay': { score: 82, loverNote: 'Sosyal ve macera. Birlikte gezer, birlikte parlar.', friendNote: 'Birlikte hep dışarıda; sıkı sosyal ikili.' },
  'terazi-oglak': { score: 68, loverNote: 'Estetik ile sorumluluk. Birlikte güzel hayat kurulur ama tempo farklı.', friendNote: 'Birlikte plan iyi, gevşeme tartışmalı.' },
  'terazi-kova': { score: 90, loverNote: 'Hava-hava — zihinsel uyum çok güçlü. Modern, açık fikirli ilişki.', friendNote: 'Birlikte fikir üretir, hayat boyu sohbet kurar.' },
  'terazi-balik': { score: 80, loverNote: 'Romantik, sanatçı, hayalci. Sınır net olmazsa idealize ederler.', friendNote: 'Birlikte sanata düşkün, samimi ikili.' },

  'akrep-akrep': { score: 88, loverNote: 'İki Akrep — sırlar, sadakat, yoğunluk. Çatışma olduğunda derin.', friendNote: 'Sırrı mezara götüren arkadaşlık; güvenle kuruluyor.' },
  'akrep-yay': { score: 68, loverNote: 'Yoğun ile özgür. Akrep tutkulu, Yay bağsız; uzlaşı sabır ister.', friendNote: 'Birlikte macera + felsefe; mahrem konularda gevşemek gerek.' },
  'akrep-oglak': { score: 84, loverNote: 'Derin sadakat ve kararlılık. Birlikte güçlü, az ama net konuşan ilişki.', friendNote: 'Birlikte güç, birlikte plan; az kişiye açılan kapalı çevre.' },
  'akrep-kova': { score: 70, loverNote: 'Yoğun ile özgür. Akrep yakınlık, Kova alan istiyor; çekim güçlü, sürtüşme olabilir.', friendNote: 'Sıra dışı, sırlı arkadaşlık — özgün ama ritim farklı.' },
  'akrep-balik': { score: 90, loverNote: 'İki su — derin sezgi, romantik bağ. Söz olmadan anlaşma yüksek.', friendNote: 'Birbirinin enerjisini hisseden derin arkadaşlık.' },

  'yay-yay': { score: 86, loverNote: 'İki Yay — özgürlük, macera, kahkaha. Ev kurmak için bilinçli emek gerek.', friendNote: 'En özgür arkadaşlıklardan biri; her şey paylaşılır, hiçbir şey sahiplenilmez.' },
  'yay-oglak': { score: 64, loverNote: 'Macera ile disiplin. İki farklı dünya; birbirini geliştirebilir.', friendNote: 'Birlikte yol uzun olabilir ama farklı bakış güzel.' },
  'yay-kova': { score: 86, loverNote: 'Özgür iki ruh. Yay macera, Kova vizyon; birlikte yenilik üretir.', friendNote: 'Sıra dışı dostluk, hep yeni keşif.' },
  'yay-balik': { score: 72, loverNote: 'İki Jüpiter — büyük hayaller. Sınır netliği zayıf olabilir.', friendNote: 'Birlikte felsefe + sanat + macera; samimi.' },

  'oglak-oglak': { score: 86, loverNote: 'İki toprak — kararlı, planlı, sadık. Romantizm zaman içinde derinleşir.', friendNote: 'Birlikte hayat kuran, iş paylaşan arkadaşlık.' },
  'oglak-kova': { score: 70, loverNote: 'Yapı ile yenilik. Oğlak gelenek, Kova vizyon; tamamlayıcı.', friendNote: 'Birlikte ciddi proje, farklı tarafları örtüşür.' },
  'oglak-balik': { score: 80, loverNote: 'Toprak ile su — koruma ve şefkat. Romantizm sade, derin.', friendNote: 'Birbirine huzur veren arkadaşlık.' },

  'kova-kova': { score: 86, loverNote: 'Sıra dışı iki Kova. Bağımsızlık temel; aşk arkadaşlıktan doğar.', friendNote: 'En özgür kanka enerjisi; iki dahi bir kafa.' },
  'kova-balik': { score: 74, loverNote: 'Vizyon ile hayal. İletişim sevgi dolu, ifade dili farklı.', friendNote: 'Birlikte sanatsal, idealist arkadaşlık.' },

  'balik-balik': { score: 88, loverNote: 'İki Balık — derin, masalsı, sezgisel. Sınır net olmazsa erir.', friendNote: 'Birbirini hisseden, masal anlatan arkadaşlık.' },
};

const normalizeKey = (a: ZodiacId, b: ZodiacId): string => {
  const sorted = [a, b].sort();
  return `${sorted[0]}-${sorted[1]}`;
};

export interface ZodiacReading {
  title: string;
  reading: string;
  drawn: {
    signA: ZodiacInfo;
    signB: ZodiacInfo;
    score: number;
  };
  symbols: Array<{ label: string; value: string; note: string }>;
}

export const getCompatibility = (
  a: ZodiacId,
  b: ZodiacId,
  mode: RelationshipMode
): { score: number; headline: string; detail: string } => {
  const infoA = ZODIAC_BY_ID[a];
  const infoB = ZODIAC_BY_ID[b];
  const key = normalizeKey(a, b);
  const note = PAIR_NOTES[key];
  const baseScore = elementScore(infoA.element, infoB.element);

  if (note) {
    const score = note.score ?? baseScore;
    const text = mode === 'friend' ? note.friendNote : note.loverNote;
    const headline = `${infoA.name} ile ${infoB.name}: ${score}% uyum`;
    return { score, headline, detail: text };
  }

  // Şablonlu fallback (her olası kombinasyon kapsanmış olsa da güvenli yedek).
  const headline = `${infoA.name} ile ${infoB.name}: ${baseScore}% uyum`;
  const detail = mode === 'friend'
    ? `${infoA.vibe} ${infoA.name} ile ${infoB.vibe} ${infoB.name}: ortak dil bulunduğunda iyi bir kanka ritmi çıkıyor.`
    : `${infoA.vibe} ${infoA.name} ile ${infoB.vibe} ${infoB.name}: ${infoA.element}-${infoB.element} elementleri uyum için kendi tarzında bir köprü kuruyor.`;
  return { score: baseScore, headline, detail };
};

export const generateZodiacReading = (
  signA: ZodiacId,
  signB: ZodiacId,
  mode: RelationshipMode
): ZodiacReading => {
  const infoA = ZODIAC_BY_ID[signA];
  const infoB = ZODIAC_BY_ID[signB];
  const compat = getCompatibility(signA, signB, mode);
  return {
    title: 'Uyum Haritası',
    reading: `${compat.headline}. ${compat.detail}`,
    drawn: { signA: infoA, signB: infoB, score: compat.score },
    symbols: [
      { label: infoA.name, value: infoA.glyph, note: `${infoA.element} · ${infoA.vibe}` },
      { label: infoB.name, value: infoB.glyph, note: `${infoB.element} · ${infoB.vibe}` },
      { label: 'Uyum', value: `${compat.score}%`, note: 'element ve karakter dengesine göre' },
    ],
  };
};

export const findZodiac = (id: ZodiacId): ZodiacInfo => ZODIAC_BY_ID[id];
