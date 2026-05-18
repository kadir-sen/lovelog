import React, { useState } from 'react';
import { LL, Glass } from './lovelog/tokens';
import { Screen } from './lovelog/Screen';
import { QuizResultCard } from './QuizResultCard';
import { submitQuiz, type AttachmentStyle, type QuizResponse } from '../services/quizService';
import { track } from '../services/telemetry';

interface QuizScreenProps {
  onExit: () => void;
  onUpload: () => void;
}

// 8 sorular: her cevap 4 stilin birinden birine puan verir.
// Skorlama: sayısal değil — en çok seçilen tag bağlanma stili olur.
interface Question {
  q: string;
  options: { label: string; tag: AttachmentStyle }[];
}

const QUESTIONS: Question[] = [
  {
    q: 'Partnerin sana 3 saat dönmeyince ne hissedersin?',
    options: [
      { label: 'Sakin kalırım, "meşguldür" der işime dönerim.', tag: 'secure' },
      { label: 'Aklımda hep o soru: "bir şey mi oldu?"', tag: 'anxious' },
      { label: 'Pek umursamam, ben de mesafeli dururum.', tag: 'avoidant' },
      { label: 'Bir an sakinim, sonra ani bir endişe gelir.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Tartışma sonrası ilk hareketi kim yapar?',
    options: [
      { label: 'Kim soğuduysa o; konu dengeli akar.', tag: 'secure' },
      { label: 'Ben yaparım, beklemeye dayanamam.', tag: 'anxious' },
      { label: 'Genelde ben uzun süre bekletirim, alan istiyorum.', tag: 'avoidant' },
      { label: 'Bazen ben hızlı, bazen ben kayıp giderim.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Partnerin "bence şu davranışın canımı sıkıyor" derse?',
    options: [
      { label: 'Dinlerim, anladığımı söylerim, gerekirse özür dilerim.', tag: 'secure' },
      { label: 'Hemen düzeltmek isterim, bazen aşırı özür dilerim.', tag: 'anxious' },
      { label: 'Savunmaya geçerim, "abartıyorsun" deme eğilimim var.', tag: 'avoidant' },
      { label: 'Önce öfke, sonra kendimi suçlama.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Yakınlık seni nasıl hissettirir?',
    options: [
      { label: 'Güvende; özlerim ama yakınlık beni boğmaz.', tag: 'secure' },
      { label: 'Çok seviyorum ama "kaybedersem?" hissi de hep var.', tag: 'anxious' },
      { label: 'Bir noktadan sonra boğucu gelmeye başlar.', tag: 'avoidant' },
      { label: 'İsterim ama yaklaşınca kaçma dürtüsü gelebilir.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Mesaj atma sıklığın ne kadar?',
    options: [
      { label: 'Akışına bırakırım, hem yazar hem alır.', tag: 'secure' },
      { label: 'Çoğu zaman ben başlatırım, dönüş bekledikçe artar.', tag: 'anxious' },
      { label: 'Yazıyorsa cevap veririm, kendim çok başlatmam.', tag: 'avoidant' },
      { label: 'Bazen yağmur gibi, bazen aniden sessizlik.', tag: 'disorganized' },
    ],
  },
  {
    q: '"Seni özledim" demek sana nasıl gelir?',
    options: [
      { label: 'Söylerim, duymak da güzel.', tag: 'secure' },
      { label: 'Sık söylerim, karşılığını duymak çok önemli.', tag: 'anxious' },
      { label: 'Söylemem zor; benim için fazla "açık" hissettiriyor.', tag: 'avoidant' },
      { label: 'Bazen kolay, bazen söyleyemiyorum.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Plan değişikliği oldu (son dakika iptal) — tepkin?',
    options: [
      { label: 'Sebebini sorarım, alternatif düşünürüz.', tag: 'secure' },
      { label: 'Açıklayamadığı bir an varsa kafamda büyür.', tag: 'anxious' },
      { label: 'Aslında biraz rahatlarım, kendi alanım açılıyor.', tag: 'avoidant' },
      { label: 'Önce hayal kırıklığı, sonra "iyi ki" hissi.', tag: 'disorganized' },
    ],
  },
  {
    q: 'Geçmiş ilişkilerinin sana hatırlattığı bir şey?',
    options: [
      { label: 'Hatırlıyorum ama bu ilişki ondan farklı.', tag: 'secure' },
      { label: 'Aynı acıyı yaşamamak için fazla dikkatliyim.', tag: 'anxious' },
      { label: 'Genelde geri dönüp düşünmemeye çalışırım.', tag: 'avoidant' },
      { label: 'Tetikleyici şeyler beni hâlâ ani sallar.', tag: 'disorganized' },
    ],
  },
];

function computeResult(answers: AttachmentStyle[]): AttachmentStyle {
  const counts: Record<AttachmentStyle, number> = { secure: 0, anxious: 0, avoidant: 0, disorganized: 0 };
  for (const a of answers) counts[a]++;
  let best: AttachmentStyle = 'secure';
  let bestVal = -1;
  for (const k of Object.keys(counts) as AttachmentStyle[]) {
    if (counts[k] > bestVal) {
      bestVal = counts[k];
      best = k;
    }
  }
  return best;
}

type Stage =
  | { kind: 'questions'; index: number; answers: AttachmentStyle[] }
  | { kind: 'email'; answers: AttachmentStyle[]; result: AttachmentStyle }
  | { kind: 'submitting' }
  | { kind: 'done'; result: AttachmentStyle }
  | { kind: 'error'; reason: string; result: AttachmentStyle; answers: AttachmentStyle[] };

const isValidEmail = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export const QuizScreen: React.FC<QuizScreenProps> = ({ onExit, onUpload }) => {
  const [stage, setStage] = useState<Stage>({ kind: 'questions', index: 0, answers: [] });
  const [email, setEmail] = useState('');

  // Telemetry: only fire quiz_started on the first answer to avoid noise
  // from users just opening the screen.
  const trackStartOnce = React.useRef(false);

  const handleAnswer = (tag: AttachmentStyle) => {
    if (stage.kind !== 'questions') return;
    if (!trackStartOnce.current) {
      track('quiz_started');
      trackStartOnce.current = true;
    }
    const answers = [...stage.answers, tag];
    if (answers.length >= QUESTIONS.length) {
      setStage({ kind: 'email', answers, result: computeResult(answers) });
    } else {
      setStage({ kind: 'questions', index: stage.index + 1, answers });
    }
  };

  const handleSubmit = async () => {
    if (stage.kind !== 'email') return;
    if (!isValidEmail(email)) return;
    const responses: QuizResponse[] = stage.answers.map((tag, i) => ({
      q: QUESTIONS[i].q,
      a: tag,
    }));
    setStage({ kind: 'submitting' });
    try {
      await submitQuiz({ email, responses, result: stage.result, source: 'app' });
      track('quiz_completed', { result: stage.result });
      setStage({ kind: 'done', result: stage.result });
    } catch (e: any) {
      setStage({ kind: 'error', reason: e?.message ?? 'failed', result: stage.result, answers: stage.answers });
    }
  };

  if (stage.kind === 'done') {
    return (
      <Screen>
        <QuizResultCard result={stage.result} onTryFullAnalysis={onUpload} />
        <div style={{ textAlign: 'center', padding: '8px 20px 24px' }}>
          <button
            onClick={onExit}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: `1px solid ${LL.glassBorder}`,
              background: 'transparent',
              color: LL.fgMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ‹ Ana sayfaya dön
          </button>
        </div>
      </Screen>
    );
  }

  if (stage.kind === 'submitting') {
    return (
      <Screen>
        <div style={{ padding: 40, textAlign: 'center', color: LL.fgMuted, fontSize: 13 }}>
          Gönderiliyor…
        </div>
      </Screen>
    );
  }

  if (stage.kind === 'error') {
    return (
      <Screen>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', marginBottom: 8 }}>
            Bir şey ters gitti
          </div>
          <div style={{ color: LL.fgMuted, fontSize: 13, marginBottom: 16 }}>{stage.reason}</div>
          <button
            onClick={() => setStage({ kind: 'email', answers: stage.answers, result: stage.result })}
            style={{
              padding: '12px 18px', borderRadius: 999, border: 'none',
              background: LL.hotPink, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Tekrar dene
          </button>
        </div>
      </Screen>
    );
  }

  if (stage.kind === 'email') {
    const emailValid = isValidEmail(email);
    return (
      <Screen>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button
              onClick={onExit}
              style={{
                width: 36, height: 36, borderRadius: 18, border: 'none',
                background: 'rgba(255,255,255,0.10)', color: LL.fg, fontSize: 18, cursor: 'pointer',
              }}
              aria-label="Geri"
            >‹</button>
            <div style={{ fontSize: 11, color: LL.fgMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Son adım
            </div>
            <div style={{ width: 36 }} />
          </div>
          <div className="ll-serif" style={{ fontSize: 28, fontStyle: 'italic', marginBottom: 12, lineHeight: 1.2 }}>
            Sonuçlarını e-mail ile gönderelim mi?
          </div>
          <div style={{ fontSize: 13, color: LL.fgMuted, lineHeight: 1.55, marginBottom: 18 }}>
            Bağlanma stilin için kısa bir özet ve sonraki ilişki içgörülerimizi atalım. İstemediğinde tek tıkla
            listeden çıkabilirsin.
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="senin@email.com"
            inputMode="email"
            autoComplete="email"
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${LL.glassBorder}`,
              background: 'rgba(255,255,255,0.06)',
              color: LL.fg,
              fontSize: 15,
              fontFamily: LL.sans,
              marginBottom: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={!emailValid}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 14,
              border: 'none',
              background: emailValid ? LL.hotPink : 'rgba(255,255,255,0.08)',
              color: emailValid ? '#fff' : LL.fgDim,
              fontSize: 14,
              fontWeight: 800,
              fontFamily: LL.sans,
              cursor: emailValid ? 'pointer' : 'default',
            }}
          >
            Sonucumu göster
          </button>
          <div style={{ fontSize: 11, color: LL.fgDim, marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
            E-mail adresin sadece sonucu ve sonraki içgörüleri göndermek için kullanılır. WhatsApp sohbetinle ilgisi yoktur.
          </div>
        </div>
      </Screen>
    );
  }

  // questions
  const q = QUESTIONS[stage.index];
  const progress = ((stage.index) / QUESTIONS.length) * 100;
  return (
    <Screen>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={onExit}
            style={{
              width: 36, height: 36, borderRadius: 18, border: 'none',
              background: 'rgba(255,255,255,0.10)', color: LL.fg, fontSize: 18, cursor: 'pointer',
            }}
            aria-label="Geri"
          >‹</button>
          <div style={{ fontSize: 11, color: LL.fgMuted, fontWeight: 700 }}>
            {stage.index + 1} / {QUESTIONS.length}
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.10)', marginBottom: 24 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: LL.hotPink, borderRadius: 2, transition: 'width 200ms ease' }} />
        </div>
        <div style={{ fontSize: 10, color: LL.gold, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
          Bağlanma quizi
        </div>
        <div className="ll-serif" style={{ fontSize: 22, fontStyle: 'italic', lineHeight: 1.3, marginBottom: 18 }}>
          {q.q}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {q.options.map((opt) => (
            <Glass
              key={opt.tag + opt.label}
              hover
              onClick={() => handleAnswer(opt.tag)}
              style={{
                padding: 14,
                borderRadius: 14,
                cursor: 'pointer',
                fontSize: 13.5,
                lineHeight: 1.5,
                color: LL.fg,
              }}
            >
              {opt.label}
            </Glass>
          ))}
        </div>
      </div>
    </Screen>
  );
};
