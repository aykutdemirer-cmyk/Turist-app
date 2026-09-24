# LocalBite

Turistlere yerel halkın gittiği uygun fiyatlı yerleri gösteren İstanbul sokak lezzeti rehberi: esnaf lokantaları,
seyyar tezgahlar, dürümcüler, taş fırınlar. Pahalı mekan bilinçli olarak yok; yalnızca `$` ve `$$`.

Monorepo üç uygulamadan oluşur: **mobil uygulama** (Expo), **API** (Fastify + Prisma) ve **web yönetici paneli** (Vite).
Ortak tipler ve doğrulama şemaları `packages/shared` içindedir.

---

## Özellikler

### Keşif
- **Ana sayfa:** arama, yatay kaydırılan yemek kategorileri (Tencere / Sulu, Döner & Dürüm, Burger & Tost,
  Pizza & Pide, Çorbalar, Seyyar, Zeytinyağlı), küratörlü lezzet rotaları, en yakın mekanlar listesi.
- **Keşfet (harita):** OpenStreetMap + Leaflet (WebView; Google Maps anahtarı gerekmez).
  - SEYYAR / ESNAF katmanları, "Bu bölgede ara"
  - Mesafe filtresi: 500 m · 1 km · 3 km · 5 km · Tümü (Haversine; harita üzerinde kesikli daire)
  - Şu an açık, bütçe dostu `$`, canlı konumlu seyyarlar ve yemek kategorisi filtreleri
- **Canlı seyyar konumu:** satıcının gönderdiği konum haritada gösterilir.
  - ≤ 4 sa: yeşil halka + "Doğrulanmış Canlı Konum"
  - 4–12 sa: "Konum X dk önce satıcı tarafından güncellendi"
  - \> 12 sa: soluk pin, "Son bilinen nokta"
- **Mekan detayı:** öne çıkan yemekler (porsiyon, fiyat, lisanslı fotoğraf, telaffuz rehberi ve sesli okuma),
  kişi başı fiyat aralığı, kültürel ipuçları, çalışma saatleri, yürüyerek yol tarifi, satıcı duyuruları.
- **Paylaşım ve deep link:** "Paylaş" butonu yerel paylaşım menüsünü açar (WhatsApp uyumlu);
  `https://<alan>/place/{id}` ve `localbite://place/{id}` mekan detayını açar. Bağlantıyla gelen kullanıcı
  mekana 3 km'den uzaksa yol tarifi öneren bir kart görür.

### Topluluk
- **Yorumlar:** yıldız + metin, çeviri etiketi (başka dilde yazılan yorumlar), kaynak rozeti ve kaynak filtresi.
  - `APP`: yeşil "LocalBite Üyesi" rozeti
  - `GOOGLE`: "Google Haritalar üzerinden"
  - `SAMPLE`: "örnek yorum" (demo veri; gerçek kişiye ait değildir ve her zaman böyle etiketlenir)
- **Topluluk akışı:** gönderi, yorum, beğeni.
- **"Bugün buradaydı" teyidi:** seyyarın o gün yerinde olduğunu doğrulama (mekana ≤ 500 m).
- **Gizli lezzet bildir:** kullanıcı önerisi, yönetici onayından sonra yayına girer.

### Üyelik ve roller
- Misafir olarak serbestçe gezinme; yorum/gönderi için giriş.
- E-posta + şifre (scrypt), Google ve GitHub ile giriş (sunucu tarafı OAuth, JWT oturum).
- Roller: `USER`, `LOCAL_GUIDE`, `VENDOR`, `SUPER_ADMIN` (rol her istekte veritabanından okunur).

| Rol | Uygulamada | Yetki |
|---|---|---|
| `VENDOR` | Profil → **Tezgahımı / Mekanımı Yönet** | Yalnızca kendi mekanı: GPS'le ya da haritadan canlı konum, Açık/Kapalı anahtarı (12 sa geçerli), onaya giden duyuru/fırsat, menü fiyat ve porsiyonu |
| `SUPER_ADMIN` | Profil → **Yönetim Merkezi** | Şikayetler, hesap silme talepleri, esnaf/mekan başvuruları, duyuru onayı, "Seçilmiş Lezzet" sponsorluğu, canlı konum denetimi (kalıcı yap / sıfırla) |

### Mağaza uyumu
- Kullanıcı içeriği: kullanım şartları onayı, içerik filtresi, şikayet et / engelle, moderasyon.
- Hesap silme: uygulama içinden ve web formundan (`/privacy/delete-account-request`).
- Konum yalnızca ön planda; izinden önce uygulama içi açıklama. Arka plan konumu açıkça engellidir.

### Gelir modeli
- İş ortaklığı kartları (GetYourGuide, Viator, Airalo), "İş Ortaklığı" etiketiyle.
- Küratörlü rotalar: biri ücretsiz, diğerleri **Explorer Pass** ile (şimdilik test satın alması).
- Sponsorlu mekanlar "Sponsorlu / Seçilmiş Lezzet" olarak etiketlenir.

### Arayüz
- 6 dil: Türkçe, İngilizce, Almanca, Rusça, Arapça, İspanyolca.
- 3 tema: Sokak Sıcaklığı, Gece Keşfi, Temiz Minimalist (seçim cihazda saklanır).

---

## Proje yapısı

```
.
├── app/                 # Expo SDK 57 mobil uygulama (Expo Router, TanStack Query, Zustand)
│   └── src/
│       ├── app/         # Ekranlar: (tabs)/, venue/[id], place/[id], vendor, admin, auth, community/, trail/, legal/
│       ├── api/         # fetch istemcisi + React Query hook'ları
│       ├── components/  # home/, explore/, map/leaflet/, venue/, admin/, vendor/, settings/, ui/ …
│       ├── i18n/        # 6 dil sözlüğü (her dil tüm anahtarları içermek zorunda)
│       ├── store/       # auth, explore (filtreler), profile
│       └── theme/       # paletler, makeStyles, kategori renk/ikonları
├── backend/             # Fastify + Prisma 6 + PostgreSQL API
│   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   ├── media/           # yemek fotoğrafları (Wikimedia Commons, CC atıflı)
│   ├── scripts/         # grant-admin.ts, grant-vendor.ts
│   └── src/             # routes/, services/, lib/ (auth, rol koruması, içerik filtresi)
├── admin/               # Web yönetici paneli (Vite + React Router + Tailwind v4)
├── packages/shared/     # Ortak enum'lar, zod şemaları, DTO tipleri, saat/mesafe yardımcıları
└── docs/ARCHITECTURE.md # Mimari kararlar
```

---

## Kurulum

**Gereksinimler:** Node.js ≥ 20.11, npm. Android için Android Studio emülatörü ya da Expo Go yüklü bir cihaz.

```bash
npm install                              # repo kökünde (tüm workspace'ler)
cp backend/.env.example backend/.env     # JWT_SECRET'ı değiştirin
```

### Veritabanı

Gerçek bir PostgreSQL kullanılabilir. Yoksa Prisma'nın yerel Postgres'i (PGlite):

```bash
cd backend && npx prisma dev --name localbite --detach
```

Çıktıdaki `postgres://…` adresini `backend/.env` içindeki `DATABASE_URL`'e yazın ve sonuna
`&connection_limit=1&pgbouncer=true` ekleyin (PGlite tek bağlantı kabul eder).

```bash
npm run db:migrate      # migration'lar + CHECK kısıtları
npm run db:seed         # 13 örnek İstanbul mekanı, 1 bekleyen başvuru, test hesapları (tekrar çalıştırılabilir)
```

> PGlite tek bağlantı kabul ettiği için `prisma generate` / migration öncesinde API'yi durdurun.
> Sunucu durursa: `cd backend && npx prisma dev stop localbite` ardından `npx prisma dev start localbite`.

### Çalıştırma

```bash
npm run dev:api         # API          → http://localhost:3000 (PORT ile değişir)
npm run dev:admin       # Web paneli   → http://localhost:5173
cd app && npx expo start
```

Android emülatörde API ve Metro'ya erişim için:

```bash
adb reverse tcp:3001 tcp:3001   # API portu (backend/.env içindeki PORT)
adb reverse tcp:8081 tcp:8081   # Metro
```

`app/.env` içindeki `EXPO_PUBLIC_API_URL` API portuyla aynı olmalı (emülatörden host makine: `http://10.0.2.2:<PORT>`).

> Emülatörü `-no-snapshot-save` ile başlatmayın: bir sonraki açılışta uygulama ayarları (tema, dil) sıfırlanır.

### Test hesapları (yalnızca yerel geliştirme)

Seed şu hesapları oluşturur. Üretimde `SEED_ADMIN_PASSWORD` ve `SEED_VENDOR_PASSWORD` verilmezse oluşturulmaz.

| E-posta | Şifre | Rol |
|---|---|---|
| `admin@localbite.app` | `LocalBite-Admin-2026` | `SUPER_ADMIN` |
| `pilavci@localbite.app` | `LocalBite-Pilav-2026` | `VENDOR` (Rıhtım Gece Pilavcısı) |

Mevcut bir üyeye yetki vermek için:

```bash
npm run admin:grant -w @localbite/backend -- kisi@ornek.com              # SUPER_ADMIN (--revoke ile geri al)
npm run vendor:grant -w @localbite/backend -- kisi@ornek.com mekan-slug  # VENDOR + mekan sahipliği
```

---

## Ortam değişkenleri

### `backend/.env`

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantısı |
| `PORT`, `HOST` | Dinleme adresi (varsayılan `3000`, `0.0.0.0`) |
| `CORS_ORIGIN` | Virgülle ayrılmış origin listesi ya da `*` |
| `JWT_SECRET` | En az 32 karakter; `JWT_TTL_DAYS` oturum süresi (varsayılan 30) |
| `PUBLIC_API_URL` | OAuth callback'lerinin kök adresi |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google ile giriş (boşsa kapalı) |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub ile giriş (boşsa kapalı) |
| `OAUTH_APP_SCHEMES` | OAuth dönüşüne izin verilen uygulama şemaları (`exp,exps,localbite`) |
| `OAUTH_WEB_ORIGINS` | Web paneli için izinli dönüş origin'leri |
| `LEGAL_CONTACT_EMAIL` | Yasal sayfalar ve silme talepleri iletişim adresi |
| `GETYOURGUIDE_PARTNER_ID`, `VIATOR_PID`, `AIRALO_REF` | İş ortaklığı kimlikleri |
| `ALLOW_MOCK_PURCHASES` | Test satın alması; üretimde her zaman kapalı |

OAuth callback adresleri: `{PUBLIC_API_URL}/api/v1/auth/oauth/{google|github}/callback`.

### `app/.env`

| Değişken | Açıklama |
|---|---|
| `EXPO_PUBLIC_API_URL` | API adresi (yoksa Expo dev sunucusunun IP'si denenir) |
| `EXPO_PUBLIC_TILE_URL` | Harita karo adresi (varsayılan: API'nin önbellekli OSM proxy'si) |
| `EXPO_PUBLIC_SHARE_BASE_URL` | Paylaşılan mekan bağlantılarının alanı (varsayılan `https://uygulama-linki.com`) |

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run typecheck` | Tüm workspace'lerde TypeScript kontrolü |
| `npm run lint -w @localbite/app` | Mobil uygulama lint (`expo lint`) |
| `npm test -w @localbite/app` / `npm test -w @localbite/shared` | Birim testleri (`node --test`) |
| `npm run db:migrate` / `npm run db:seed` | Migration / örnek veri |
| `npm run db:migrate:dev -w @localbite/backend` | Yeni migration üretir (yalnızca geliştirme) |
| `npm run build -w @localbite/admin` | Web panelinin üretim derlemesi |

---

## API özeti (`/api/v1`)

| Grup | Uç noktalar |
|---|---|
| Mekanlar | `GET /venues/nearby`, `GET /venues/:idOrSlug`, `PUT /venues/:id/review`, `POST /venues/:id/report`, `POST /venues/suggest`, `GET /confirmations/recent` |
| Üyelik | `POST /auth/register`, `POST /auth/login`, `GET/DELETE /auth/me`, `GET /auth/oauth/providers`, `GET /auth/oauth/:provider/start`, `POST /auth/oauth/exchange` |
| Topluluk | `GET/POST /community/posts`, `GET /community/posts/:id`, yorum ve beğeni |
| Moderasyon | `POST /moderation/reports`, `GET/POST/DELETE /moderation/blocks` |
| Gelir | `GET /experiences`, `GET /trails`, `GET /trails/:slug`, `POST /billing/mock-purchase`, `POST /billing/restore` |
| Esnaf (`VENDOR`) | `GET /vendor/venues`, `PUT /vendor/venues/:id/location`, `PUT /vendor/venues/:id/open`, `POST /vendor/venues/:id/announcements`, `PUT /vendor/dishes/:id` |
| Yönetim (`SUPER_ADMIN`) | `/admin/reports`, `/admin/deletion-requests`, `/admin/venues` (onay, sponsorluk, canlı konum), `/admin/announcements` |

Kök düzeyde: `GET /health`, `/legal/terms`, `/legal/privacy`, `/privacy/delete-account-request`, `/media/…`, `/tiles/{z}/{x}/{y}.png`.
Dil seçimi: `?locale=` → `Accept-Language` → `en`. Hatalar `{ error, message, details? }` biçimindedir.

---

## Yayına hazırlık / açık konular

- **Ödeme:** Explorer Pass şimdilik test satın alması; App Store / Google Play ödemesi bağlanmalı.
- **Paylaşılan bağlantılar:** gerçek alan adında `/.well-known/assetlinks.json` (EAS imza SHA-256 ile) ve
  `/.well-known/apple-app-site-association` yayınlanmalı; uygulaması olmayanlar için web karşılama sayfası yok.
- **Google yorumları:** henüz çekilmiyor. Google Places kuralları gereği veritabanına kopyalanmamalı,
  API'den canlı alınıp atıfla gösterilmeli.
- **Esnaf sahiplenme akışı:** mekan sahipliği şimdilik `vendor:grant` komutuyla atanıyor.
- **Kategori ataması:** kullanıcı önerilerine ve yönetim ekranına yemek kategorisi seçimi eklenmedi.
- **Örnek veri:** seed'deki mekanlar gerçek semtlerde ama adları ve yorumları kurgusaldır.
