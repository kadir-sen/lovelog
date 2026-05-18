// Snapshot — generates a branded PNG image from an SVG description and
// hands it to the platform share sheet.
//
// Why SVG-as-string instead of html2canvas / dom-to-image?
//   • We control the exact output: fonts, spacing, brand colors, no
//     unwanted UI chrome from the screen the user is currently on.
//   • Zero new dependencies — relies on browser-native canvas + Capacitor
//     Filesystem/Share that are already bundled.
//   • Anonymization is enforced at composition time, not at capture time;
//     you can never accidentally leak DOM content that wasn't masked.
//
// Privacy contract: callers pass in `data` that has already been masked.
// composeSnapshot itself does not look up names, raw text, or evidence
// strings — it just renders the values it's given onto a branded canvas.

export type SnapshotVariant = 'score' | 'insight' | 'streak' | 'wrapped-summary';

export interface SnapshotData {
  /** Variant-specific payload. See variant docs below for shapes. */
  payload: Record<string, unknown>;
  /** Couple names. If anonymize=true, these are replaced with "A" / "B". */
  names?: [string, string];
  /** Default true: render "A & B" instead of real names. */
  anonymize?: boolean;
  /** Optional date range string (e.g. "Mar–Eki 2025"). */
  dateLabel?: string;
}

export interface SnapshotResult {
  /** PNG blob, suitable for sharing or downloading. */
  blob: Blob;
  /** Data URL (base64). Convenient for previewing inside an <img>. */
  dataUrl: string;
}

const OUTPUT_W = 1080;
const OUTPUT_H = 1350; // 4:5 — highest-reach IG feed format

const BRAND = {
  bg1: '#1A0B2E',
  bg2: '#3D1E5E',
  accentPink: '#FF6B9D',
  accentLavender: '#B89CFF',
  accentGold: '#E8B86B',
  fg: '#FFFFFF',
  fgMuted: 'rgba(255,255,255,0.65)',
  serif: '"Fraunces", "Playfair Display", "DM Serif Display", Georgia, serif',
  sans: '"Plus Jakarta Sans", Inter, -apple-system, sans-serif',
};

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const resolveNames = (data: SnapshotData): [string, string] => {
  if (data.anonymize !== false && (data.anonymize ?? true)) return ['A', 'B'];
  const [a, b] = data.names ?? ['A', 'B'];
  return [a ?? 'A', b ?? 'B'];
};

/**
 * Build the SVG body for a given variant. Returns the inner content only;
 * the outer <svg> + background gradient is appended in `wrap()`.
 */
const renderVariant = (variant: SnapshotVariant, data: SnapshotData): string => {
  const [nameA, nameB] = resolveNames(data);
  const dateLabel = data.dateLabel ? escapeXml(data.dateLabel) : '';

  switch (variant) {
    case 'score': {
      const score = Number(data.payload.score ?? 0);
      const total = Number(data.payload.totalMessages ?? 0);
      const modeLabel = String(data.payload.modeLabel ?? '');
      return `
        <text x="${OUTPUT_W / 2}" y="160" font-family='${BRAND.sans}'
              font-size="22" font-weight="700" letter-spacing="6"
              text-anchor="middle" fill="${BRAND.accentGold}">LOVELOG</text>

        <text x="${OUTPUT_W / 2}" y="290" font-family='${BRAND.serif}'
              font-style="italic" font-size="60" font-weight="500"
              text-anchor="middle" fill="${BRAND.fg}">
          ${escapeXml(nameA)} &amp; ${escapeXml(nameB)}
        </text>

        <text x="${OUTPUT_W / 2}" y="340" font-family='${BRAND.sans}'
              font-size="22" text-anchor="middle" fill="${BRAND.fgMuted}">
          ${dateLabel}
        </text>

        <text x="${OUTPUT_W / 2}" y="660" font-family='${BRAND.serif}'
              font-size="280" font-weight="600" text-anchor="middle"
              fill="${BRAND.fg}">${score}</text>

        <text x="${OUTPUT_W / 2}" y="740" font-family='${BRAND.sans}'
              font-size="36" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}" letter-spacing="2">
          / 100 ${modeLabel ? '· ' + escapeXml(modeLabel) : ''}
        </text>

        <text x="${OUTPUT_W / 2}" y="900" font-family='${BRAND.sans}'
              font-size="22" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}">
          ${total.toLocaleString('tr-TR')} mesaj analiz edildi
        </text>

        ${privacyBadge(OUTPUT_W / 2, 1200)}
      `;
    }

    case 'insight': {
      const eyebrow = escapeXml(String(data.payload.eyebrow ?? 'İçgörü'));
      const headline = escapeXml(String(data.payload.headline ?? ''));
      const detail = escapeXml(String(data.payload.detail ?? ''));
      return `
        <text x="${OUTPUT_W / 2}" y="140" font-family='${BRAND.sans}'
              font-size="22" font-weight="700" letter-spacing="6"
              text-anchor="middle" fill="${BRAND.accentGold}">LOVELOG</text>

        <text x="${OUTPUT_W / 2}" y="280" font-family='${BRAND.sans}'
              font-size="20" font-weight="700" letter-spacing="4"
              text-anchor="middle" fill="${BRAND.accentLavender}">
          ${eyebrow.toUpperCase()}
        </text>

        ${wrapText(headline, OUTPUT_W / 2, 380, 56, BRAND.serif, BRAND.fg, 940)}

        ${detail ? wrapText(detail, OUTPUT_W / 2, 760, 26, BRAND.sans, BRAND.fgMuted, 880) : ''}

        <text x="${OUTPUT_W / 2}" y="1110" font-family='${BRAND.sans}'
              font-size="20" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}">
          ${escapeXml(nameA)} &amp; ${escapeXml(nameB)} ${dateLabel ? '· ' + dateLabel : ''}
        </text>

        ${privacyBadge(OUTPUT_W / 2, 1220)}
      `;
    }

    case 'streak': {
      const streakDays = Number(data.payload.days ?? 0);
      const ritualName = escapeXml(String(data.payload.ritualName ?? 'ritüel'));
      return `
        <text x="${OUTPUT_W / 2}" y="140" font-family='${BRAND.sans}'
              font-size="22" font-weight="700" letter-spacing="6"
              text-anchor="middle" fill="${BRAND.accentGold}">LOVELOG</text>

        <text x="${OUTPUT_W / 2}" y="340" font-family='${BRAND.sans}'
              font-size="20" font-weight="700" letter-spacing="4"
              text-anchor="middle" fill="${BRAND.accentPink}">RİTÜEL SERİSİ</text>

        <text x="${OUTPUT_W / 2}" y="600" font-family='${BRAND.serif}'
              font-size="220" font-weight="600" text-anchor="middle"
              fill="${BRAND.fg}">${streakDays}</text>

        <text x="${OUTPUT_W / 2}" y="680" font-family='${BRAND.sans}'
              font-size="32" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}">gün üst üste</text>

        ${wrapText(ritualName, OUTPUT_W / 2, 820, 46, BRAND.serif, BRAND.fg, 880)}

        <text x="${OUTPUT_W / 2}" y="1110" font-family='${BRAND.sans}'
              font-size="20" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}">
          ${escapeXml(nameA)} &amp; ${escapeXml(nameB)} ${dateLabel ? '· ' + dateLabel : ''}
        </text>

        ${privacyBadge(OUTPUT_W / 2, 1220)}
      `;
    }

    case 'wrapped-summary': {
      const year = Number(data.payload.year ?? new Date().getFullYear());
      const totalMessages = Number(data.payload.totalMessages ?? 0);
      const topMonth = escapeXml(String(data.payload.topMonth ?? ''));
      const topEmoji = escapeXml(String(data.payload.topEmoji ?? ''));
      return `
        <text x="${OUTPUT_W / 2}" y="140" font-family='${BRAND.sans}'
              font-size="22" font-weight="700" letter-spacing="6"
              text-anchor="middle" fill="${BRAND.accentGold}">LOVELOG</text>

        <text x="${OUTPUT_W / 2}" y="240" font-family='${BRAND.sans}'
              font-size="22" font-weight="700" letter-spacing="6"
              text-anchor="middle" fill="${BRAND.accentLavender}">${year} WRAPPED</text>

        <text x="${OUTPUT_W / 2}" y="380" font-family='${BRAND.serif}'
              font-style="italic" font-size="56" font-weight="500"
              text-anchor="middle" fill="${BRAND.fg}">
          ${escapeXml(nameA)} &amp; ${escapeXml(nameB)}
        </text>

        <text x="${OUTPUT_W / 2}" y="600" font-family='${BRAND.serif}'
              font-size="120" font-weight="600" text-anchor="middle"
              fill="${BRAND.fg}">${totalMessages.toLocaleString('tr-TR')}</text>
        <text x="${OUTPUT_W / 2}" y="660" font-family='${BRAND.sans}'
              font-size="28" font-weight="500" text-anchor="middle"
              fill="${BRAND.fgMuted}">mesaj</text>

        ${topMonth ? `
          <text x="${OUTPUT_W / 2}" y="800" font-family='${BRAND.sans}'
                font-size="18" font-weight="700" letter-spacing="3"
                text-anchor="middle" fill="${BRAND.accentPink}">EN SICAK AY</text>
          <text x="${OUTPUT_W / 2}" y="850" font-family='${BRAND.serif}'
                font-style="italic" font-size="42" font-weight="500"
                text-anchor="middle" fill="${BRAND.fg}">${topMonth}</text>
        ` : ''}

        ${topEmoji ? `
          <text x="${OUTPUT_W / 2}" y="990" font-family='${BRAND.sans}'
                font-size="80" text-anchor="middle">${topEmoji}</text>
          <text x="${OUTPUT_W / 2}" y="1040" font-family='${BRAND.sans}'
                font-size="18" font-weight="500" text-anchor="middle"
                fill="${BRAND.fgMuted}">yılın emojisi</text>
        ` : ''}

        ${privacyBadge(OUTPUT_W / 2, 1220)}
      `;
    }
  }
};

/** Render the privacy lock + LOCAL FIRST line at the bottom. */
const privacyBadge = (cx: number, cy: number): string => `
  <g transform="translate(${cx - 130}, ${cy - 26})">
    <rect width="260" height="52" rx="26" fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
    <text x="130" y="33" font-family='${BRAND.sans}' font-size="20"
          font-weight="600" text-anchor="middle" fill="${BRAND.fg}">
      🔒  Local-first analiz
    </text>
  </g>
`;

/**
 * Simple text-wrap helper: splits on words, breaks lines that exceed maxWidth,
 * and emits multiple <text> elements. Approximates character width — good
 * enough for branded snapshots, not a typesetting library.
 */
const wrapText = (
  text: string,
  cx: number,
  startY: number,
  fontSize: number,
  fontFamily: string,
  color: string,
  maxWidth: number,
): string => {
  const approxCharWidth = fontSize * 0.55;
  const maxChars = Math.floor(maxWidth / approxCharWidth);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const trial = current ? current + ' ' + w : w;
    if (trial.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);

  return lines
    .map(
      (line, i) =>
        `<text x="${cx}" y="${startY + i * (fontSize * 1.2)}"
               font-family='${fontFamily}' font-size="${fontSize}"
               font-weight="500" text-anchor="middle" fill="${color}">${line}</text>`,
    )
    .join('\n');
};

const wrap = (innerSvg: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_W}" height="${OUTPUT_H}"
     viewBox="0 0 ${OUTPUT_W} ${OUTPUT_H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.bg1}"/>
      <stop offset="100%" stop-color="${BRAND.bg2}"/>
    </linearGradient>
    <radialGradient id="g1" cx="20%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${BRAND.accentPink}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${BRAND.bg1}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="100%" cy="100%" r="90%">
      <stop offset="0%" stop-color="${BRAND.accentLavender}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${BRAND.bg2}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OUTPUT_W}" height="${OUTPUT_H}" fill="url(#bg)"/>
  <rect width="${OUTPUT_W}" height="${OUTPUT_H}" fill="url(#g1)"/>
  <rect width="${OUTPUT_W}" height="${OUTPUT_H}" fill="url(#g2)"/>
  ${innerSvg}
</svg>`;

/**
 * Rasterize an SVG string to a PNG Blob via a hidden <img> + canvas.
 * Works in any modern browser. The SVG is converted via a data URI rather
 * than an object URL to avoid Capacitor sandbox quirks.
 */
const svgToPng = async (svg: string): Promise<SnapshotResult> => {
  const dataUri =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('snapshot_svg_load_failed'));
    img.src = dataUri;
  });
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('snapshot_canvas_unavailable');
  ctx.drawImage(img, 0, 0, OUTPUT_W, OUTPUT_H);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 0.95),
  );
  if (!blob) throw new Error('snapshot_blob_null');
  const dataUrl = canvas.toDataURL('image/png', 0.95);
  return { blob, dataUrl };
};

/** Public API: compose and rasterize a snapshot. */
export const composeSnapshot = async (
  variant: SnapshotVariant,
  data: SnapshotData,
): Promise<SnapshotResult> => {
  const svg = wrap(renderVariant(variant, data));
  return svgToPng(svg);
};

const isCapacitor = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

/** Convert a Blob to a base64 string (sans data: prefix). */
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Hand the rasterized snapshot to the user's sharing flow.
 * Mobile: writes the PNG to Capacitor Filesystem and opens the native share
 *         sheet with the file attached.
 * Web: tries navigator.share with a File, falls back to download.
 */
export const shareSnapshot = async (
  result: SnapshotResult,
  fileName = `lovelog-${Date.now()}.png`,
  title = 'LoveLog',
): Promise<'shared' | 'downloaded'> => {
  if (isCapacitor()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = await blobToBase64(result.blob);
      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title,
        url: written.uri,
        dialogTitle: title,
      });
      return 'shared';
    } catch (err) {
      console.warn('[snapshot] native share failed, falling back', err);
      /* fall through to web path */
    }
  }

  // Web Share API: file-capable browsers (Safari iOS 15+, Chrome Android).
  if (
    typeof navigator !== 'undefined' &&
    (navigator as any).canShare &&
    typeof File !== 'undefined'
  ) {
    try {
      const file = new File([result.blob], fileName, { type: 'image/png' });
      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title });
        return 'shared';
      }
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        console.warn('[snapshot] web share failed, falling back', err);
      } else {
        return 'shared'; // user cancelled — treat as success-no-op
      }
    }
  }

  // Final fallback: download via anchor.
  const a = document.createElement('a');
  a.href = result.dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return 'downloaded';
};
