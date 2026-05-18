import React from 'react';
import { LL, Glass } from './lovelog/tokens';
import { ShareButton } from './ShareButton';
import type { AttachmentStyle } from '../services/quizService';

const STYLE_COPY: Record<AttachmentStyle, {
  title: string;
  eyebrow: string;
  description: string;
  color: string;
}> = {
  secure: {
    title: 'Güvenli bağ',
    eyebrow: 'Sıcak ve dengeli',
    description:
      'Yakınlığı isterken kendi alanına da değer veriyorsun. Tartışma sonrası onarım dilini doğal kuruyorsun; partnerin sana bir şey söylediğinde "sen yanlışsın" demeden dinleyebiliyorsun.',
    color: LL.mint,
  },
  anxious: {
    title: 'Endişeli bağ',
    eyebrow: 'Yakınlık aç',
    description:
      'Bağı korumak için elinden geleni yapıyorsun ama bazen "geri dönmezse?" hissi ön plana çıkıyor. Hızlı mesajlaşma, "ne oldu canım?" sorusu, ufak kontroller — bunlar seni güvende hissettiriyor. Bunu utanılacak değil, gözlenebilir bir örüntü olarak görmek faydalı.',
    color: LL.hotPink,
  },
  avoidant: {
    title: 'Kaçınmacı bağ',
    eyebrow: 'Alan sever',
    description:
      'Bağı kuruyorsun ama nefes alacak alanın daralırsa içe çekiliyorsun. Çok soru, çok plan, çok ayrıntı bazen ağır geliyor. Bu bir kusur değil — sadece yakınlığı işleme tempon farklı.',
    color: LL.lavender,
  },
  disorganized: {
    title: 'Karışık bağ',
    eyebrow: 'İki uçlu',
    description:
      'Bazı günler yakın olmak istiyorsun, bazı günler tam tersi. Bu salınım rahatsız edici hissedebilir ama aslında geçmişteki bağ deneyimlerinin işaret ettiği gözlenebilir bir örüntü. Etiket değil, bir başlangıç notu.',
    color: LL.gold,
  },
};

interface QuizResultCardProps {
  result: AttachmentStyle;
  onTryFullAnalysis: () => void;
}

export const QuizResultCard: React.FC<QuizResultCardProps> = ({ result, onTryFullAnalysis }) => {
  const copy = STYLE_COPY[result];
  return (
    <div style={{ padding: 20 }}>
      <Glass
        strong
        style={{
          padding: 24,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${copy.color}20, ${LL.violet}18)`,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, color: copy.color, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {copy.eyebrow}
        </div>
        <div className="ll-serif" style={{ fontSize: 36, fontStyle: 'italic', marginTop: 6, lineHeight: 1.1 }}>
          {copy.title}
        </div>
        <div style={{ fontSize: 13.5, color: LL.fgMuted, lineHeight: 1.6, marginTop: 14 }}>
          {copy.description}
        </div>
        <div style={{ fontSize: 11, color: LL.fgDim, marginTop: 14, lineHeight: 1.5 }}>
          Bu bir teşhis değil. Bowlby ve Bartholomew'un bağlanma araştırmasındaki dört kategoriden hangisine
          eğildiğine dair bir göstergedir.
        </div>
      </Glass>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <ShareButton
          variant="insight"
          surface="quiz_result"
          pillar={5}
          data={{
            anonymize: false,
            payload: {
              eyebrow: 'Bağlanma stilim',
              headline: copy.title,
              detail: copy.description,
            },
          }}
        />
        <button
          onClick={onTryFullAnalysis}
          style={{
            padding: '12px 18px',
            borderRadius: 999,
            border: 'none',
            background: LL.hotPink,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: LL.sans,
            cursor: 'pointer',
          }}
        >
          Tam analizimi yap →
        </button>
      </div>

      <Glass style={{ padding: 14, borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: LL.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          Sonraki adım
        </div>
        <div style={{ fontSize: 12.5, color: LL.fgMuted, lineHeight: 1.55 }}>
          Bu stilin günlük mesajlaşmana nasıl yansıdığını görmek istersen WhatsApp sohbetini LoveLog'a yükle. Mesajlar
          telefondan çıkmıyor — analiz tamamen senin cihazında çalışır.
        </div>
      </Glass>
    </div>
  );
};
