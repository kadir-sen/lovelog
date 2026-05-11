#!/usr/bin/env node
// LoveLog için programatik placeholder icon/splash üretici.
// Gerçek tasarım gelene kadar mağaza submission'ı blokelemez bir kaynak seti üretir.
// Tasarım hazır olduğunda assets/icon.png vb. üzerine yazılır, bu script bir daha gerekmez.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '..', 'assets');

await mkdir(ASSETS_DIR, { recursive: true });

// Marka palet (index.html ile aynı):
//   ink:    #1a0b2e (deep purple — bg)
//   violet: #5b1b8a
//   pink:   #c83a86 (hotPink)
//   blush:  #ffd6dc
//   gold:   #f5b942

const ICON_SVG = (size = 1024, withBackground = true) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.45" r="0.7">
      <stop offset="0%" stop-color="#5b1b8a"/>
      <stop offset="55%" stop-color="#2a0f47"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </radialGradient>
    <linearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd6dc"/>
      <stop offset="60%" stop-color="#c83a86"/>
      <stop offset="100%" stop-color="#5b1b8a"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="22" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${withBackground ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}
  ${withBackground ? `
  <!-- yıldızlar -->
  <circle cx="180" cy="200" r="6" fill="#fff5fb" opacity="0.85"/>
  <circle cx="860" cy="160" r="4" fill="#f5b942" opacity="0.9"/>
  <circle cx="780" cy="820" r="5" fill="#ffd6dc" opacity="0.7"/>
  <circle cx="220" cy="780" r="3" fill="#fff5fb" opacity="0.75"/>
  <circle cx="900" cy="540" r="3" fill="#f5b942" opacity="0.6"/>
  ` : ''}
  <!-- kalp (LoveLog brand mark) — orta-üst, kenarlardan ≥80px boşluk -->
  <g filter="url(#glow)">
    <path
      d="M512 780
         C 250 600, 180 400, 320 280
         C 410 205, 480 240, 512 320
         C 544 240, 614 205, 704 280
         C 844 400, 774 600, 512 780 Z"
      fill="url(#heart)"
      stroke="#fff5fb"
      stroke-width="6"
      stroke-opacity="0.45"
    />
  </g>
  <!-- minik sparkle -->
  <path d="M740 320 l8 22 22 8 -22 8 -8 22 -8 -22 -22 -8 22 -8 z" fill="#f5b942" opacity="0.95"/>
</svg>
`;

const SPLASH_SVG = (size = 2732) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.5" r="0.7">
      <stop offset="0%" stop-color="#5b1b8a"/>
      <stop offset="60%" stop-color="#2a0f47"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </radialGradient>
    <linearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd6dc"/>
      <stop offset="60%" stop-color="#c83a86"/>
      <stop offset="100%" stop-color="#5b1b8a"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#bg)"/>
  <g transform="translate(866, 866) scale(1.0)">
    <path
      d="M500 760
         C 240 580, 170 380, 310 260
         C 400 185, 470 220, 500 300
         C 530 220, 600 185, 690 260
         C 830 380, 760 580, 500 760 Z"
      fill="url(#heart)"
      stroke="#fff5fb"
      stroke-width="4"
      stroke-opacity="0.4"
    />
  </g>
  <text
    x="1366" y="2050"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-style="italic"
    font-size="120"
    fill="#fff5fb"
    opacity="0.95"
  >lovelog</text>
</svg>
`;

const SOLID_BG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.45" r="0.7">
      <stop offset="0%" stop-color="#5b1b8a"/>
      <stop offset="55%" stop-color="#2a0f47"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
</svg>
`;

const render = async (svg, outPath, alpha = false) => {
  const pipeline = sharp(Buffer.from(svg), { density: 300 });
  if (!alpha) {
    // App Store ikonu alpha kabul etmiyor; arka planı düz yapıyoruz
    await pipeline.flatten({ background: '#1a0b2e' }).png({ compressionLevel: 9 }).toFile(outPath);
  } else {
    await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
  }
  console.log(`  → ${outPath}`);
};

console.log('LoveLog placeholder asset üretiliyor...');

await render(ICON_SVG(1024, true), join(ASSETS_DIR, 'icon.png'), false);
await render(ICON_SVG(1024, false), join(ASSETS_DIR, 'icon-foreground.png'), true);
await render(SOLID_BG_SVG, join(ASSETS_DIR, 'icon-background.png'), false);
await render(SPLASH_SVG(2732), join(ASSETS_DIR, 'splash.png'), false);
await render(SPLASH_SVG(2732), join(ASSETS_DIR, 'splash-dark.png'), false);

console.log('\nTamamlandı. Şimdi:');
console.log('  npx capacitor-assets generate --iconBackgroundColor "#1a0b2e" --splashBackgroundColor "#1a0b2e"');
