// "Raporu indir/paylaş" düğmesi için platform-aware uygulama:
// - Capacitor (iOS/Android): native Share Sheet (metin)
// - Web (modern tarayıcı): Web Share API
// - Fallback: window.print() (PC tarayıcı)

import type { GeminiInsight } from '../types';
import type { RelationshipReport, RelationshipMode } from './relationshipReport';

interface ShareInput {
  report: RelationshipReport;
  score: number;
  relationMode: RelationshipMode;
  viewerName: string | null | undefined;
  aiInsight: GeminiInsight | null;
}

const buildShareText = (input: ShareInput): string => {
  const { report, score, relationMode, aiInsight } = input;
  const isFriend = relationMode === 'friend';
  const lines = [
    isFriend ? `🌟 LoveLog Vibe Raporu` : `💞 LoveLog İlişki Raporu`,
    ``,
    `${isFriend ? 'Vibe skoru' : 'Aşk skoru'}: ${Math.round(score)}/100`,
  ];
  if (aiInsight?.summary) {
    lines.push('', aiInsight.summary);
  } else if (report?.narratives?.funFact) {
    lines.push('', report.narratives.funFact);
  }
  lines.push('', '— LoveLog ile analiz edildi.');
  return lines.join('\n');
};

const isCapacitor = (): boolean => {
  // Capacitor enjekte ediyorsa window.Capacitor mevcut olur.
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
};

export const shareReport = async (input: ShareInput): Promise<void> => {
  const text = buildShareText(input);
  const title = input.relationMode === 'friend' ? 'LoveLog Vibe Raporu' : 'LoveLog İlişki Raporu';

  if (isCapacitor()) {
    try {
      const { Share } = await import('@capacitor/share');
      const { value: canShare } = await Share.canShare();
      if (canShare) {
        await Share.share({ title, text, dialogTitle: title });
        return;
      }
    } catch (e) {
      console.warn('[sharing] capacitor share failed, falling back', e);
    }
  }

  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title, text });
      return;
    } catch (e) {
      // kullanıcı iptal ettiyse e.name === 'AbortError' — sessiz geç
      if ((e as any)?.name !== 'AbortError') {
        console.warn('[sharing] web share failed, falling back to print', e);
      } else {
        return;
      }
    }
  }

  // Klasik masaüstü tarayıcı: tarayıcı yazdır → "Save as PDF" doğal akış.
  if (typeof window !== 'undefined') {
    window.print();
  }
};
