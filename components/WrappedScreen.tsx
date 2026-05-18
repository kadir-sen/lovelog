import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LL } from './lovelog/tokens';
import { ShareButton } from './ShareButton';
import { buildWrappedSlides, type WrappedSlide } from '../services/wrappedCompute';
import { track } from '../services/telemetry';
import { saveLastWrappedYear } from '../services/persistence';
import type { AnalysisResult } from '../types';

interface WrappedScreenProps {
  analysis: AnalysisResult;
  onExit: () => void;
}

/**
 * Mini Wrapped — vertical scroll-snap, one slide per viewport. Each slide
 * is full-bleed gradient + a single big metric or quote. No animation
 * library; just CSS transitions for fade-in.
 *
 * Layout: each slide is exactly 100dvh, scroll-snap-mandatory; the user
 * swipes (or scrolls) through the story. The last slide carries the
 * Share CTA.
 */
export const WrappedScreen: React.FC<WrappedScreenProps> = ({ analysis, onExit }) => {
  const slides = useMemo(() => buildWrappedSlides(analysis), [analysis]);

  // Highlights used by the closing snapshot (one summary card with the
  // top month + top emoji + total). Derived from the same slide stream so
  // they stay consistent with what the user just scrolled through.
  const closingHighlights = useMemo(() => {
    const topMonthSlide = slides.find((s): s is Extract<WrappedSlide, { kind: 'top-month' }> => s.kind === 'top-month');
    const topEmojiSlide = slides.find((s): s is Extract<WrappedSlide, { kind: 'top-emoji' }> => s.kind === 'top-emoji');
    return {
      topMonth: topMonthSlide?.monthLabel ?? '',
      topEmoji: topEmojiSlide?.emoji ?? '',
    };
  }, [slides]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    track('wrapped_opened', { slideCount: slides.length });
    const year = analysis.dateRange.end instanceof Date
      ? analysis.dateRange.end.getFullYear()
      : new Date(analysis.dateRange.end).getFullYear();
    saveLastWrappedYear(year);
  }, [analysis, slides.length]);

  // Track which slide is currently visible via IntersectionObserver — we
  // emit wrapped_slide_viewed exactly once per slide per session.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (Number.isFinite(idx)) {
              setActiveIndex(idx);
              if (!viewedRef.current.has(idx)) {
                viewedRef.current.add(idx);
                track('wrapped_slide_viewed', {
                  index: idx,
                  kind: slides[idx]?.kind ?? 'unknown',
                });
              }
            }
          }
        }
      },
      { root, threshold: 0.6 },
    );
    const children = root.querySelectorAll<HTMLElement>('[data-slide]');
    children.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [slides]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        background: LL.ink,
        color: LL.fg,
        fontFamily: LL.sans,
      }}
    >
      {/* Close button (sticky overlay) */}
      <button
        onClick={onExit}
        aria-label="Kapat"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 110,
          width: 40,
          height: 40,
          borderRadius: 20,
          border: 'none',
          background: 'rgba(0,0,0,0.4)',
          color: LL.fg,
          fontSize: 22,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        ×
      </button>

      {/* Dot indicator (sticky overlay) */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          right: 14,
          transform: 'translateY(-50%)',
          zIndex: 110,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: i === activeIndex ? 18 : 6,
              borderRadius: 2,
              background: i === activeIndex ? LL.gold : 'rgba(255,255,255,0.30)',
              transition: 'all 200ms ease',
            }}
          />
        ))}
      </div>

      {slides.map((slide, idx) => (
        <div
          key={idx}
          data-slide
          data-idx={idx}
          style={{
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 28px',
            textAlign: 'center',
            background: gradientFor(idx, slides.length),
          }}
        >
          <SlideContent slide={slide} analysis={analysis} index={idx} closingHighlights={closingHighlights} />
        </div>
      ))}
    </div>
  );
};

const gradientFor = (idx: number, total: number): string => {
  // Cycle through 4 palettes that fit the LoveLog brand.
  const palettes = [
    [LL.ink, LL.amethyst],
    [LL.amethyst, LL.hotPink],
    [LL.violet, LL.ink2],
    [LL.ink2, LL.lavender],
  ];
  // Intro + closing get a richer palette
  if (idx === 0) return `linear-gradient(135deg, ${LL.hotPink}, ${LL.amethyst})`;
  if (idx === total - 1) return `linear-gradient(180deg, ${LL.amethyst}, ${LL.violet})`;
  const p = palettes[idx % palettes.length];
  return `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
};

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = LL.gold }) => (
  <div
    style={{
      fontSize: 11,
      color,
      fontWeight: 800,
      letterSpacing: 3,
      textTransform: 'uppercase',
      marginBottom: 16,
    }}
  >
    {children}
  </div>
);

const BigNumber: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="ll-serif"
    style={{
      fontSize: 'clamp(80px, 22vw, 160px)',
      fontWeight: 600,
      lineHeight: 1,
      marginBottom: 16,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="ll-serif"
    style={{
      fontSize: 'clamp(28px, 6vw, 40px)',
      fontStyle: 'italic',
      fontWeight: 500,
      lineHeight: 1.2,
      marginBottom: 16,
      maxWidth: 460,
    }}
  >
    {children}
  </div>
);

const Subtext: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 15, color: LL.fgMuted, lineHeight: 1.6, maxWidth: 380 }}>
    {children}
  </div>
);

interface SlideContentProps {
  slide: WrappedSlide;
  analysis: AnalysisResult;
  index: number;
  closingHighlights: { topMonth: string; topEmoji: string };
}

const SlideContent: React.FC<SlideContentProps> = ({ slide, analysis, closingHighlights }) => {
  const fmt = (n: number): string => Math.round(n).toLocaleString('tr-TR');
  const aName = analysis.participants[0]?.name ?? 'A';
  const bName = analysis.participants[1]?.name ?? 'B';

  switch (slide.kind) {
    case 'intro':
      return (
        <>
          <Eyebrow>{slide.year} Wrapped</Eyebrow>
          <Headline>
            {slide.coupleNames[0]} &amp; {slide.coupleNames[1]}<br />
            işte ilişkinizin haritası
          </Headline>
          <Subtext>Aşağı kaydır, yıl boyunca neler olduğunu birlikte görelim.</Subtext>
        </>
      );

    case 'total':
      return (
        <>
          <Eyebrow>Yıl boyunca</Eyebrow>
          <BigNumber>{fmt(slide.messageCount)}</BigNumber>
          <Headline>mesaj yazıştınız</Headline>
          <Subtext>
            {slide.daysSpan} gün boyunca, günde ortalama {fmt(slide.dailyAvg)} mesaj.
          </Subtext>
        </>
      );

    case 'top-month':
      return (
        <>
          <Eyebrow>En sıcak ay</Eyebrow>
          <Headline>{slide.monthLabel}</Headline>
          <BigNumber>{fmt(slide.messageCount)}</BigNumber>
          <Subtext>O ay konuşmaktan yorulmadınız.</Subtext>
        </>
      );

    case 'top-emoji':
      return (
        <>
          <Eyebrow>Yılın emojisi</Eyebrow>
          <div style={{ fontSize: 180, lineHeight: 1, marginBottom: 8 }}>{slide.emoji}</div>
          <Headline>{fmt(slide.count)} kez</Headline>
          <Subtext>Bu emoji aranızda kendi anlamını kazandı.</Subtext>
        </>
      );

    case 'top-ritual':
      return (
        <>
          <Eyebrow>İlişkinin ritmi</Eyebrow>
          <Headline>{slide.ritualName}</Headline>
          <div style={{ display: 'flex', gap: 28, marginTop: 12, marginBottom: 14 }}>
            <div>
              <div className="ll-serif" style={{ fontSize: 56, fontWeight: 600 }}>{fmt(slide.nightCount)}</div>
              <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2 }}>gece</div>
            </div>
            <div>
              <div className="ll-serif" style={{ fontSize: 56, fontWeight: 600 }}>{fmt(slide.morningCount)}</div>
              <div style={{ fontSize: 12, color: LL.fgMuted, marginTop: 2 }}>sabah</div>
            </div>
          </div>
          <Subtext>Bu küçük tekrar sizi siz yapan şeylerden biri.</Subtext>
        </>
      );

    case 'longest-silence':
      return (
        <>
          <Eyebrow>En uzun sessizlik</Eyebrow>
          <BigNumber>{slide.days}</BigNumber>
          <Headline>gün konuşmadığınız oldu</Headline>
          <Subtext>
            {slide.from.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} → {slide.to.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}<br />
            Sonra geri döndünüz. Önemli olan o.
          </Subtext>
        </>
      );

    case 'repair-balance': {
      const total = slide.aRepairs + slide.bRepairs;
      const aPct = total > 0 ? Math.round((slide.aRepairs / total) * 100) : 50;
      return (
        <>
          <Eyebrow>Onarım dengesi</Eyebrow>
          <Headline>Tartışmadan sonra ilk kim adım attı?</Headline>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: 12, marginBottom: 18 }}>
            <div>
              <div className="ll-serif" style={{ fontSize: 56, fontWeight: 600 }}>{slide.aRepairs}</div>
              <div style={{ fontSize: 12, color: LL.fgMuted }}>{slide.aName}</div>
            </div>
            <div style={{ fontSize: 22, color: LL.fgDim, paddingBottom: 14 }}>·</div>
            <div>
              <div className="ll-serif" style={{ fontSize: 56, fontWeight: 600 }}>{slide.bRepairs}</div>
              <div style={{ fontSize: 12, color: LL.fgMuted }}>{slide.bName}</div>
            </div>
          </div>
          <Subtext>
            Bu yıl onarımın %{aPct}'i {slide.aName}, %{100 - aPct}'i {slide.bName} tarafından geldi.
          </Subtext>
        </>
      );
    }

    case 'love-words':
      return (
        <>
          <Eyebrow>İlişkinizin sözlüğü</Eyebrow>
          <Headline>En çok kullandığınız sevgi sözcükleri</Headline>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              marginTop: 14,
              maxWidth: 360,
            }}
          >
            {slide.words.map((w, i) => (
              <div
                key={w.word}
                style={{
                  padding: '10px 16px',
                  borderRadius: 999,
                  background: i === 0 ? LL.hotPink : 'rgba(255,255,255,0.10)',
                  fontSize: 14 + Math.max(0, 6 - i * 1.5),
                  fontWeight: i === 0 ? 800 : 600,
                  color: i === 0 ? '#fff' : LL.fg,
                }}
              >
                {w.word} <span style={{ opacity: 0.7, fontSize: 12 }}>× {w.count}</span>
              </div>
            ))}
          </div>
        </>
      );

    case 'closing': {
      const topMonthSlide = slide; // alias for clarity
      return (
        <>
          <Eyebrow>{slide.year}</Eyebrow>
          <Headline>
            {slide.coupleNames[0]} &amp; {slide.coupleNames[1]}<br />
            ritminiz vardı.
          </Headline>
          <Subtext>Bunu birinin daha görmesini ister misin?</Subtext>
          <div style={{ marginTop: 24 }}>
            <ShareButton
              variant="wrapped-summary"
              surface="wrapped_closing"
              pillar={4}
              data={{
                names: slide.coupleNames,
                anonymize: true,
                payload: {
                  year: topMonthSlide.year,
                  totalMessages: topMonthSlide.messageCount,
                  topMonth: closingHighlights.topMonth,
                  topEmoji: closingHighlights.topEmoji,
                },
              }}
            />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: LL.fgDim, maxWidth: 320 }}>
            İsimler "A &amp; B" olarak gizlenir, yalnız genel rakamlar paylaşılır.
          </div>
        </>
      );
    }
  }
};

void Eyebrow;
void BigNumber;
void Headline;
void Subtext;
