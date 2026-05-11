# iOS Yayın Rehberi (LoveLog)

> **Mevcut durum (2026-05-10):** iOS native projesi (`ios/`) hazır, plugin'ler entegre, ikon+splash üretildi, Info.plist mağaza anahtarları eklendi, Privacy Manifest yazıldı. Build için **Xcode**, dağıtım için **Apple Developer Program** gerekiyor.

---

## 1. Üç dağıtım yolu (hangisi sana uygun?)

| Yol | Maliyet | Kim yükleyebilir? | Süre | App Store görünür mü? |
|---|---|---|---|---|
| **A. Kişisel ücretsiz** (Free Provisioning) | $0 | Sadece kendi cihazların | Sertifika 7 gün, sonra rebuild gerekir | Hayır |
| **B. TestFlight** | $99/yıl | İçeride: 100 kişi (anında); Dışarıda: 10.000 kişi (Apple ~24sa onay) | Build 90 gün geçerli | Hayır (link ile dağıtılır) |
| **C. App Store** | $99/yıl | Herkes (App Store search/install) | Apple review 24sa-3gün | Evet |

**Pragmatik öneri**: Önce A ile kendi iPhone'una kur, çalıştığını gör → sonra B (TestFlight) ile yakın çevreyi ekle → çıkmaya hazırsan C (App Store).

---

## 2. Xcode kurulumu (yapmadıysan, ZORUNLU)

iOS build/test/upload — hepsi Xcode üzerinden. Komut satırı yolu yok.

**Kurulum:**
1. Mac App Store → "Xcode" arat → **Get** (Apple ID gerekir, ücretsiz)
2. ~15GB indirme + ~30GB disk gerekir; süreyle 1-3 saat
3. İlk açılışta: "Install additional components?" → **Install** (CLI tools, simulator runtimes)
4. Terminal'de doğrula:
   ```bash
   xcode-select -p
   # /Applications/Xcode.app/Contents/Developer  ← bu olmalı
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```

---

## 3. Apple ID hazırlığı

**Kişisel kullanım (yol A) için:** istediğin Apple ID yeter.

**TestFlight/App Store (yol B/C) için:**
1. Apple ID'nle https://developer.apple.com'a giriş
2. **Enroll** → "Individual" (bireysel, $99/yıl) veya "Organization" (şirket için, D-U-N-S numarası gerekir)
3. Ödeme + ~24 saat aktivasyon
4. https://appstoreconnect.apple.com'a aynı Apple ID ile giriş yapabilmen gerekir

---

## 4. Projeyi Xcode'da aç

Tek komut:

```bash
cd ~/Desktop/projects/lovelog
npm run build && npx cap sync ios   # web'i son haline getir
npx cap open ios                     # Xcode'da App.xcworkspace açar
```

Xcode açıldığında sol panelde **App** target'ını seç → **Signing & Capabilities** sekmesi.

---

## 5. Code Signing (Yol A — kişisel ücretsiz)

1. **Team** dropdown → "Add an Account..." → Apple ID + parola
2. "Personal Team" otomatik oluşur → Team olarak onu seç
3. **Bundle Identifier** olarak `app.lovelog` zaten ayarlı; Apple ID'ne özel olduğu için Apple "Bu identifier kullanılamaz" derse:
   - `app.lovelog.<senin-adın>` gibi unique bir varyant kullan, örn. `app.lovelog.kadirsen`
   - Sonra App Store'a giderken gerçek `app.lovelog`'a dönüş yapacağız
4. Sol üstte **Device** dropdown → kendi iPhone'unu seç (USB veya WiFi pairing)
5. **▶︎ Run** (Cmd+R)
6. iPhone'da: Settings → General → VPN & Device Management → "Apple Development: <email>" → **Trust**
7. App açılır. **7 gün sonra** sertifika expire olur, tekrar Cmd+R dersen yenilenir.

---

## 6. App Store Connect kurulumu (Yol B/C için)

1. https://appstoreconnect.apple.com → **My Apps** → **+** → New App
2. Form:
   - **Platforms**: iOS
   - **Name**: LoveLog
   - **Primary Language**: Turkish
   - **Bundle ID**: `app.lovelog` (Developer Portal'da rezerv edilmeli — App Store Connect bunu otomatik yapar)
   - **SKU**: `lovelog-ios-001` (kendi takip kodun, herhangi bir şey)
   - **User Access**: Full Access
3. **App Information**:
   - Category Primary: **Lifestyle**
   - Category Secondary: **Social Networking** (opsiyonel)
   - Privacy Policy URL: `https://lovelog-sude.duckdns.org/privacy.html` ✅ (zaten canlıda)
4. **Pricing and Availability**: Free, tüm ülkeler
5. **App Privacy** (kritik form, doldurmazsan submission yapamazsın):
   - "Identifiers > Device ID":
     - Linked to user: **No**
     - Used for tracking: **No**
     - Purpose: **App Functionality**
   - "User Content" — "Do you collect..." → **No** (sohbet cihazda kalıyor, biz toplamıyoruz)
   - Diğer kategoriler: hiçbiri (analytics, location, contacts, vs.)
6. **Age Rating**: 17+ → "Mature/Suggestive Themes: Frequent/Intense" (ilişki dinamikleri)
7. **App Review Information**:
   - Demo account: **gerekmiyor** (login yok)
   - Notes for review: bu metni kopyala:
     > LoveLog analyzes WhatsApp chat exports (.txt files) for relationship insights.
     > To test: Open the app → tap "Sohbet yükle" → upload any plain WhatsApp .txt export.
     > A sample export can be provided on request. No login is required (anonymous device-ID).
     > AI features call our backend at https://lovelog-sude.duckdns.org/api/llm/* which forwards anonymized metric summaries to Google Gemini.
8. **Version Information**:
   - Description (4000 karaktere kadar): uygulama özetini Türkçe ve İngilizce yaz
   - Keywords (100 karakter): `whatsapp,sohbet,analiz,ilişki,arkadaşlık,fal,koç`
   - Support URL: GitHub repo veya kişisel blog
   - Marketing URL: opsiyonel

---

## 7. Build → Archive → Upload (Yol B veya C)

Xcode'da:

1. Üstteki cihaz dropdown'ı → **Any iOS Device (arm64)** seç (gerçek cihaz değil)
2. **Product** menüsü → **Archive** (5-10 dk)
3. Archive penceresi otomatik açılır → seçili archive'da **Distribute App**
4. **App Store Connect** → **Upload** → Next → Next (otomatik signing önerilir, kabul et)
5. Apple sunucularına yükleme (5-15 dk) → "Upload Successful"

---

## 8. TestFlight (Yol B)

Yükleme bittikten ~30 dk sonra App Store Connect → **TestFlight**:

1. **Internal Testing** grubu oluştur → kendi Apple ID'ni ekle
2. Build "Processing" → ~15 dk sonra yeşile döner
3. Telefonda **TestFlight** uygulamasını kur (App Store'dan ücretsiz)
4. Davet emaili gelir → "View in TestFlight" → Install
5. **External Testing** istersen: link/email ile en fazla 10.000 kişi; ilk build için Apple "Beta App Review" yapar (~24 saat)

TestFlight build'i 90 gün sonra expire olur — yeni build atınca counter sıfırlanır.

---

## 9. App Store gönderimi (Yol C)

TestFlight'ta her şey çalışıyorsa:

1. App Store Connect → app sayfası → **+ Version** veya 1.0 → **Prepare for Submission**
2. "Build" alanı → TestFlight'ta yeşile dönmüş build'i seç
3. Screenshot'lar (zorunlu, App Store rejection #1 sebebi):
   - **6.7" iPhone** (1290×2796) — 3-10 görüntü, **zorunlu**
   - **6.5"** (1242×2688) — 3-10 görüntü, opsiyonel
   - **5.5"** (1242×2208) — 3-10 görüntü, **zorunlu**
   - iPad screenshot'ları: app iPad universal değilse gerekmez (LoveLog iPad'de de açılır ama portreye optimize, opsiyonel ekleyebilirsin)

   Screenshot üretmek için: TestFlight build'inde simulator (iPhone 15 Pro Max → 6.7") + iPhone 8 Plus simulator (5.5"); Cmd+S (screenshot) ile alıp App Store Connect'e yükle.

4. **Submit for Review** → Apple ~24 saat - 3 gün
5. Reddilirse **Resolution Center**'da konuş → düzeltip resubmit
6. Onaylanınca: "Manually release" seçtiysen sen tetikle, "Automatic" seçtiysen yayınlanır

---

## 10. Sık karşılaşılan App Store red sebepleri ve önlemleri

| Reddedilme nedeni | LoveLog'ta önlemi |
|---|---|
| Privacy Manifest eksik | ✅ `ios/App/App/PrivacyInfo.xcprivacy` eklendi |
| App Privacy form yanlış | ⚠️ Cihaz ID'sini "Identifiers" altında bildirdik (yukarıdaki §6.5) |
| Demo data eksik | ⚠️ Review Notes'a örnek WhatsApp .txt linki ekle |
| Login required ama placeholder | ✅ Login yok (anonim) |
| Privacy URL erişilemez | ✅ https://lovelog-sude.duckdns.org/privacy.html canlıda |
| Yetersiz işlevsellik (Guideline 4.2) | ✅ Dashboard + Coach + Fal — hepsi gerçek değer üretiyor |
| AI içerikli "psychological diagnosis" iddiası | ✅ Prompt'larda "kesin teşhis koyma, sinyal/ritim diliyle yorumla" var |
| API anahtarı bundle'da (Apple binary'i scan ediyor) | ✅ Anahtar yalnızca backend'de |
| Cleartext HTTP (App Transport Security ihlali) | ✅ ATS explicitly enforced (yukarıda eklendi) |
| Crash on launch | ❓ Önce gerçek cihazda test (yol A) zorunlu |

---

## 11. iOS-spesifik kalan ufak işler (kod tarafı)

✅ Tamamlanmış:
- iOS native projesi (`npx cap add ios`)
- Capacitor 8 plugin'leri SwiftPM ile entegre
- AppIcon + Splash assets üretildi (`npx capacitor-assets generate`)
- Info.plist: ITSAppUsesNonExemptEncryption=false, NSAppTransportSecurity, LSApplicationCategoryType, arm64-only
- PrivacyInfo.xcprivacy
- Dashboard'a "Tüm verilerimi sil" + Privacy Policy linki

⚠️ Xcode'da elle yapılacaklar (5 dk):
1. **PrivacyInfo.xcprivacy'yi target'a ekle**: Xcode → Project Navigator → App klasörüne sağ tık → "Add Files to 'App'..." → `PrivacyInfo.xcprivacy` seç → **Copy items if needed** = işaretsiz, **Add to targets: App** = işaretli → Add. Aksi takdirde dosya proje ağacında ama bundle'a girmez.
2. **Display name doğrulama**: Project → App → General → Display Name = `LoveLog` (zaten Info.plist'te ama UI'dan da onayla)
3. **Marketing Version + Build**: Önce 1.0 / 1, her release'te +1
4. **Capabilities**: ekleme YOK (Push, In-App Purchase, Sign-in with Apple — hiçbiri kullanmıyoruz)

---

## 12. Hızlı başlangıç komutu özetli

```bash
# Bir kerelik:
# 1) Mac App Store → Xcode kur
# 2) developer.apple.com → enroll ($99/yıl) [TestFlight/App Store için]

# Her release için:
cd ~/Desktop/projects/lovelog
VITE_API_BASE_URL=https://lovelog-sude.duckdns.org/api npm run build
npx cap sync ios
npx cap open ios
# Xcode → Any iOS Device → Product → Archive → Distribute → App Store Connect
```

---

## 13. Maliyet ve takvim özeti

| Kalem | Maliyet | Süre |
|---|---|---|
| Apple Developer Program | $99/yıl | Aktivasyon ~24 saat |
| Xcode | $0 | İndirme 1-3 saat |
| App Store inceleme | $0 | İlk submission 24sa-3gün, sonrakiler genelde 24sa |
| Reddilme döngüsü | $0 | Her round 24sa-3gün |
| Screenshot tasarımı | $0 (kendin) | 1-2 saat |

**Realist takvim**: Xcode kuruldu + dev hesabı aktif olduktan sonra **~1 hafta** içinde TestFlight'tan ilk build dağıtılır, **~2 hafta** içinde App Store'da olur (ilk submission'da reddedilirse +3-5 gün ekle).
