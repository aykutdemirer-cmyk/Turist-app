# Mağaza yayını — Google Play & App Store

Bu klasör mağaza sayfası için gereken her şeyi toplar: metinler, gizlilik/veri formları, içerik derecelendirmesi,
inceleme ekibine notlar ve ekran görüntüleri. Konsollara buradan kopyalanır.

> Boş bırakılanlar (şimdilik): gerçek iletişim e-postası (`LEGAL_CONTACT_EMAIL`) ve paylaşım alan adı
> (`EXPO_PUBLIC_SHARE_BASE_URL`). Alan adı yokken paylaşımda harita konumu gönderilir; App Links tanımlanmaz.

---

## 1. Hesaplar ve ücretler

| Hesap | Ücret | Not |
|---|---|---|
| Google Play Console | 25 $ (tek sefer) | Kişisel hesapta yayından önce **12 test kullanıcısıyla 14 günlük kapalı test** zorunlu |
| Apple Developer Program | 99 $ / yıl | Mac gerekmez; iOS derlemesi EAS bulutunda |
| Sunucu (Railway Hobby) | ~5 $ / ay | Mağazadaki uygulamanın sunucusu 7/24 açık olmalı |

---

## 2. Derleme ve gönderme

```bash
cd app
npx eas-cli@latest build -p android --profile production   # Play için AAB
npx eas-cli@latest build -p ios --profile production       # App Store (Apple hesabı gerekir)
npx eas-cli@latest submit -p android                        # Play Console'a yükler (ilk seferde servis hesabı JSON'u ister)
npx eas-cli@latest submit -p ios                            # App Store Connect'e yükler
```

- İmza anahtarları EAS'te saklanıyor (Android keystore oluşturuldu).
- Uygulama içi satın alma **kapalı** (`PAYMENTS_ENABLED=false`): tüm rotalar ücretsiz, hiçbir yerde ödeme yok.
  Mağaza ödeme sistemi (Play Billing / StoreKit) bağlanmadan açılmamalı.

---

## 3. Mağaza metinleri

### Türkçe

**Uygulama adı (≤30):** `LocalBite: Yerel Lezzetler`

**Kısa açıklama (Play, ≤80):** `Yakınındaki esnaf lokantaları, sokak lezzetleri ve seyyarlar tek haritada.`

**Alt başlık (App Store, ≤30):** `Esnaf ve sokak lezzetleri`

**Tam açıklama:**

```
LocalBite, bulunduğun yerin çevresindeki gerçek yemek mekanlarını — esnaf lokantalarını, dönercileri,
pideci ve fırınları, sokak seyyarlarını — tek haritada gösterir.

• Yakınındaki mekanlar: konumuna göre mesafeye göre sıralı liste ve harita
• Semt seç: Kadıköy, Beşiktaş, Tarihi Yarımada… istediğin bölgeye geç
• Gerçek saatler: açık mı kapalı mı, kaçta kapanıyor (bilinmiyorsa uydurulmaz)
• Menü ve fiyatlar: esnaf ve kullanıcılar ekler, yemek görselleriyle
• Seyyarların canlı konumu ve "Bugün burada gördüm" teyitleri
• Yorumlar ve topluluk: deneyimini paylaş, lezzetleri keşfet
• Filtreler: kategori, şu an açık, bütçe dostu, mesafe
• Esnafsan "Bu mekan benim" ile mekanını sahiplen; menü, saat ve duyurularını kendin yönet

Bar, pub ve gece kulüpleri listelenmez; odak sokak lezzetleri ve esnaf mutfağıdır.
Harita verisi © OpenStreetMap katkıcıları.
```

**Anahtar kelimeler (App Store, ≤100):** `esnaf lokantası,sokak lezzeti,döner,pide,seyyar,istanbul,yemek,restoran,harita,lezzet`

### English

**App name:** `LocalBite: Local Street Food`

**Short description (≤80):** `Local eateries, street food and vendors near you — on one map.`

**Subtitle (≤30):** `Street food & local eateries`

**Full description:**

```
LocalBite shows the real food places around you — tradesmen's restaurants (esnaf lokantası), kebab and
döner shops, pide ovens and bakeries, and street vendors — on a single map.

• Nearby places sorted by distance, on a list and a map
• Pick an area: Kadıköy, Beşiktaş, the Historic Peninsula…
• Real opening hours: open now or closed, closing time (never guessed)
• Menus and prices added by owners and the community, with dish photos
• Live location of street vendors and "I saw it here today" confirmations
• Reviews and a community feed
• Filters: category, open now, budget, distance
• Own a place? Claim it and manage your menu, hours and announcements

Bars, pubs and nightclubs are not listed; the focus is street food and local home cooking.
Map data © OpenStreetMap contributors.
```

**Keywords:** `street food,local food,doner,kebab,istanbul,restaurant,food map,vendors,turkish food,eat`

**Kategori:** Yiyecek ve İçecek (Food & Drink) · ikincil: Seyahat (Travel)

---

## 4. Bağlantılar

| Alan | Adres |
|---|---|
| Gizlilik politikası | https://localbite-api-production.up.railway.app/legal/privacy |
| Kullanım şartları | https://localbite-api-production.up.railway.app/legal/terms |
| Hesap silme (web) | https://localbite-api-production.up.railway.app/privacy/delete-account-request |
| Destek / iletişim | *(şimdilik boş — gerçek e-posta sonra)* |

Uygulama içinde hesap silme: **Profil → Güvenlik ve Gizlilik → Hesabımı ve Tüm Verilerimi Sil** (Play ve App Store zorunluluğu).

---

## 5. Google Play — Veri güvenliği formu

**Veri şifreleme (aktarım):** Evet (HTTPS) · **Kullanıcı silme talebi:** Evet (uygulama içi + web adresi)
· **Veri üçüncü taraflarla paylaşılıyor mu:** Hayır · **Reklam:** Yok

| Veri türü | Toplanıyor | Amaç | Zorunlu mu | Not |
|---|---|---|---|---|
| Yaklaşık konum | Evet | Uygulama işlevi | Hayır (izinle) | Yakındaki mekanlar; sunucuda saklanmaz |
| Kesin konum | Evet | Uygulama işlevi | Hayır (izinle) | Yalnızca uygulama açıkken; "Bugün burada gördüm" teyidi mekana yakınlık için anlık kullanılır |
| Ad | Evet | Hesap yönetimi | Hayır (üyelik isteğe bağlı) | |
| E-posta adresi | Evet | Hesap yönetimi | Hayır | |
| Kullanıcı içeriği (yorum, gönderi, öneri) | Evet | Uygulama işlevi | Hayır | Herkese açık; şikayet/engelleme ve moderasyon var |
| Cihaz kimliği (uygulamanın ürettiği anonim kimlik) | Evet | Uygulama işlevi, kötüye kullanım önleme | Evet | Reklam kimliği DEĞİL |
| Uygulama etkinliği (teyitler, şikayetler) | Evet | Uygulama işlevi | Hayır | |

Toplanmayanlar: ödeme bilgisi, rehber, fotoğraf/video galerisi, sağlık, mesajlar, tarama geçmişi, reklam kimliği.

## 6. App Store — Gizlilik etiketleri (App Privacy)

- **Data Linked to You:** Contact Info (Name, Email), User Content (reviews, posts), Identifiers (User ID)
- **Data Not Linked to You:** Location (Precise, Coarse) — App Functionality
- **Tracking:** Hayır (ATT istemi gerekmez)

---

## 7. İçerik derecelendirmesi (IARC / App Store yaş)

- Şiddet, cinsellik, küfür, kumar, uyuşturucu: **Yok**
- Alkol: **Yok** (bar/pub/meyhane listelenmez)
- Kullanıcıların birbiriyle etkileşimi (yorum, topluluk): **Evet** — moderasyon, şikayet ve engelleme var
- Kullanıcının konumunu başkalarıyla paylaşma: **Hayır** (yalnızca esnafın kendi seyyar konumu mekanda görünür)
- Dijital satın alma: **Yok**

Beklenen sonuç: Play **PEGI 3 / Herkes**, App Store **4+** (kullanıcı içeriği nedeniyle 12+ da seçilebilir).

---

## 8. İnceleme ekibine notlar (App Review / Play test talimatı)

Test hesabı: uygulamada **Profil → Giriş yap → Hesap oluştur** ile bir hesap açın ve bilgilerini konsoldaki
"Sign-in required" alanına girin (uygulama misafir olarak da tamamen kullanılabilir).

```
LocalBite lists real food places (from OpenStreetMap) around the user's location.

- No sign-in is required to browse. Sign-in (email, Google, or Sign in with Apple) is only needed to post
  reviews, community posts, opening hours or menu suggestions.
- Location permission is requested only while the app is in use, with an in-app explanation first.
  If denied, the user can pick an area manually (top of the Home/Explore screens).
- User-generated content can be reported and users can be blocked from every post, comment and review.
  Reports are reviewed by our moderators within 24 hours (in-app admin center).
- There are no in-app purchases in this version.
- Account deletion: Profile → Security & Privacy → "Delete my account and all data" (also available on the web).
```

---

## 9. Ekran görüntüleri

`screenshots/` klasöründe Android telefon görüntüleri (1080×2400). Play için yeterli (en az 2, en çok 8).
App Store için iPhone boyutları gerekir (6.7": 1290×2796, 6.5": 1242×2688) — iOS derlemesi alındığında
simülatörden ya da cihazdan çekilmelidir.

| Dosya | Ekran |
|---|---|
| `01-home.png` | Ana sayfa: konum, kategoriler, ücretsiz rotalar |
| `02-explore.png` | Keşfet haritası (açık mekanlar yeşil halkalı) |
| `03-list.png` | Yakındaki gerçek mekanlar: saat durumu ve yemek görselleri |
| `04-area.png` | Semt seçici |
| `05-trail.png` | Lezzet rotası |
| `06-venue.png` | Mekan detayı: menü ekleme, yorumlar |

Görüntüler Beşiktaş konumuyla ve sade durum çubuğuyla (12:00, tam şarj) çekildi.

**Uygulama ikonu:** `app/assets/icon.png` (1024×1024). Play için 512×512 yüksek çözünürlüklü ikon ve
1024×500 öne çıkan görsel (feature graphic) gerekir.
