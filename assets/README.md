# Capacitor Assets

Bu klasör mağaza ikonları ve splash screen üretimi için kaynak görüntüleri tutar.

## Gerekli kaynak dosyalar

Yerleştirilmesi gerekenler:

- `assets/icon.png` — **1024×1024 PNG**, kare, alfa **olmadan** (App Store gereksinimi). Marka logosu ortalanmış olsun, kenardan en az 80px boşluk bırak.
- `assets/icon-foreground.png` — 1024×1024 PNG, **şeffaf zemin**, sadece logo (Android adaptive icon foreground katmanı için).
- `assets/icon-background.png` — 1024×1024 PNG, **düz renk** veya basit gradient (Android adaptive icon background katmanı için).
- `assets/splash.png` — 2732×2732 PNG, marka rengi (önerilen: `#1a0b2e`), logo merkezde maks 1200×1200.
- `assets/splash-dark.png` — Aynı boyut, dark mode varyantı (opsiyonel).

## Türetme

İkon/splash dosyaları yerleştirildikten sonra:

```bash
npx capacitor-assets generate --iconBackgroundColor '#1a0b2e' --splashBackgroundColor '#1a0b2e'
```

Bu komut iOS ve Android için tüm gerekli boyutları otomatik türetir:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`
- `android/app/src/main/res/mipmap-*/`
- `android/app/src/main/res/drawable*/splash.png`

Önce `npx cap add ios` ve `npx cap add android` çalıştırılmış olmalı.

## Mağaza ekran görüntüleri

Bu klasörde **tutulmaz** — App Store Connect ve Play Console'a doğrudan yüklenir. Gerekli boyutlar:

**iOS (App Store):**
- 6.7" (iPhone 15 Pro Max): 1290×2796 — **zorunlu**
- 6.5": 1242×2688 (opsiyonel)
- 5.5" (iPhone 8 Plus): 1242×2208 — **zorunlu**

**Android (Play Console):**
- Phone: en az 2 görüntü, 1080×1920 minimum
- 7" tablet: opsiyonel ama uzun kuyruğu açar
- Feature graphic: 1024×500
