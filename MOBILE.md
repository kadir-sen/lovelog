# Mobil Yayın Rehberi

Bu doküman LoveLog'u iOS App Store ve Google Play'e çıkarmak için yapılması gerekenleri operasyonel sırayla anlatır.

> ✅ **Mevcut durum** (2026-05-09): native projeler (`ios/`, `android/`) eklendi, Capacitor 8 plugin'leri (App, Keyboard, Share, StatusBar) entegre, placeholder ikon/splash üretildi (assets/), Android debug APK lokalde başarılı şekilde build oldu (`app.lovelog`, target SDK 36, sadece INTERNET izni, 6.6MB).
>
> ⚠️ **Yapılması gerekenler**: gerçek tasarım ikon/splash, Apple Developer + Play Console hesapları, **Xcode kurulumu** (iOS build için), API anahtarı rotation, prod backend deploy.

## 1. Önkoşullar

- **macOS** (zaten kullanıyorsun) — iOS build için zorunlu.
- **Xcode 15+**: App Store'dan **interaktif** indirilir (~15GB). Komut satırından kurulamaz.
- **JDK 21**: ✅ kuruldu — `brew install openjdk@21` (Capacitor 8 Java 21 ister, 17 yetmez).
- **Android cmdline-tools**: ✅ kuruldu — `brew install --cask android-commandlinetools`. SDK 34 + build-tools + platform-tools mevcut.
- **CocoaPods gerekmez** — Capacitor 8 Swift Package Manager kullanıyor.
- **Apple Developer hesabı**: $99/yıl. App Store Connect'te `app.lovelog` bundle ID'sini rezerv et.
- **Google Play Console hesabı**: tek seferlik $25. `app.lovelog` paket adını rezerv et.

## 2. Native projeler ✅

`ios/` ve `android/` zaten oluşturuldu (`npx cap add ios && npx cap add android`). Her web build sonrası:

```bash
npm run build
npx cap sync           # web'i + plugin'leri native projelere kopyalar
```

iOS açmak için: `npx cap open ios` → Xcode → Run (Xcode kurulu olmalı).
Android açmak için: `npx cap open android` → Android Studio (opsiyonel) veya `./scripts/build-android.sh` (CLI).

## 3. İkon / Splash ✅ (placeholder)

`assets/` klasöründe placeholder PNG'ler üretildi (kalp logosu + cosmic gradient). Gerçek tasarım:

1. `assets/icon.png`, `assets/icon-foreground.png`, `assets/icon-background.png`, `assets/splash.png`, `assets/splash-dark.png` üzerine yaz (boyutlar: [assets/README.md](assets/README.md)).
2. Tekrar üret:

```bash
npx capacitor-assets generate --iconBackgroundColor '#1a0b2e' --splashBackgroundColor '#1a0b2e'
```

Placeholder'ı yeniden üretmek istersen: `node scripts/generate-placeholder-assets.mjs`.

## 4. iOS Info.plist

`ios/App/App/Info.plist` içine ek anahtarlar (Capacitor cap add varsayılan olarak temel anahtarları koyar; aşağıdakiler mağaza için gerekli):

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
</dict>
```

Mikrofon/kamera/konum gibi izinler **kullanılmıyor** — `NS*UsageDescription` anahtarlarına gerek yok. Bu önemli; gereksiz izin string'leri varsa Apple "neden istediniz?" diye geri çevirir.

## 5. Android manifest

`android/app/src/main/AndroidManifest.xml` içinde **sadece INTERNET izni** olmalı:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES` **olmamalı**. Capacitor varsayılanı bunları eklemez ama ileride bir plugin eklersen kontrol et.

`android/app/build.gradle` içinde `targetSdkVersion 34` (2025+ için zorunlu).

## 6. Backend deploy (mobil submission'dan önce)

Mobil uygulama prod backend'e yöneliyor olmalı. Aksi takdirde reviewer test edemez.

```bash
# Lightsail host'ta:
cd /path/to/lovelog
git pull
docker compose -f docker-compose.lightsail.yml up -d --build api lovelog
sudo cp deploy/nginx-host-lovelog.conf /etc/nginx/sites-available/lovelog-sude.duckdns.org
sudo nginx -t && sudo systemctl reload nginx
curl https://lovelog-sude.duckdns.org/api/llm/generate -X POST \
  -H "X-Device-Id: smoketest1234" -H "Content-Type: application/json" \
  -d '{"prompt":"merhaba"}'  # 200 + Gemini cevabı beklenir
```

⚠️ **API anahtarını rotate et**: Eski anahtar (`AIzaSyD5x...`) frontend bundle'larında public yayınlandı; canlı çıkmadan önce Google AI Studio'da iptal et, yeni anahtarı sadece `server/.env` veya Lightsail compose ortamına koy.

## 7. App Store submission

1. App Store Connect'te yeni app oluştur, bundle ID `app.lovelog`.
2. **Privacy Policy URL**: `https://lovelog-sude.duckdns.org/privacy.html`
3. **App Privacy** formu:
   - "Identifiers > Device ID" → "Linked to user: No, Used for: App Functionality (rate limiting)"
   - "User Content" topluyor mu? **Hayır** (cihazda kalıyor)
4. **Age Rating**: 17+ (Mature/Suggestive Themes — ilişki analizi).
5. **Demo for review**: Review notes kısmına şu metni ekle:
   > LoveLog WhatsApp chat exports analyzer. To test: open the app, tap "Sohbet yükle", upload any plain `.txt` WhatsApp export. A sample file can be provided on request. Login is not required (anonymous device-ID).
6. TestFlight'ta önce internal test (en az 24 saat), sonra prod review.

## 8. Google Play submission

1. Play Console → "Create app".
2. **Data safety** formu (App Store privacy formuyla aynı içerik).
3. **Content rating** anketini doldur → "Mature 17+".
4. **Account deletion** alanı: aynı privacy.html URL'sini ver + Dashboard'daki "Tüm verilerimi sil" butonunu screenshot ile göster.
5. **Internal testing → Closed testing → Production**: Yeni geliştirici hesapları için Google **14 gün, en az 12 closed tester** zorunlu kılıyor (2024+ politikası). Bu takvime ekle.

## 9. Dev döngüsü

```bash
# terminal 1 — backend
cd server && npm run dev

# terminal 2 — frontend (Vite, /api'yi :3001'e proxyler)
npm run dev

# Android APK üret (Xcode olmadan da çalışır):
./scripts/build-android.sh
# çıktı: android/app/build/outputs/apk/debug/app-debug.apk

# iOS (sadece Xcode kuruluysa):
npm run build && npx cap sync && npx cap open ios
```

## 9.1 Cihaza yükleme (Android)

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"

# USB'den cihaz bağla, "USB hata ayıklama" aç. Sonra:
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 10. Smoke test checklist (her release öncesi)

- [ ] `grep -r "AIza\|GEMINI_API_KEY" dist/` → boş çıktı
- [ ] iOS: WhatsApp .txt yükle → Dashboard render → Coach mesaj at, streaming çalışsın
- [ ] Android: aynı + back tuşu Home'a düşürmesin (route stack)
- [ ] Safe area: TabBar home indicator üstünde kalıyor mu?
- [ ] "Tüm verilerimi sil" → confirm → home'a dönüyor + localStorage temiz
- [ ] Privacy URL canlıda erişilebilir mi?
- [ ] 60+ istek atınca rate-limit 429 dönüyor mu?
