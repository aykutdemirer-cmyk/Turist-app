# LocalBite / StreetSpot — Mimari Plan

## Monorepo yapısı (npm workspaces)

```
/
├── package.json                  # workspaces: ["app", "backend", "packages/*"]
├── tsconfig.base.json            # ortak TS ayarları (strict)
├── docs/
│   └── ARCHITECTURE.md
│
├── packages/
│   └── shared/                   # app + backend arasında paylaşılan kod
│       ├── package.json          # "@localbite/shared"
│       └── src/
│           ├── enums.ts          # VenueType, PriceLevel, LocalTip... (Prisma enum'larının aynası)
│           ├── schemas.ts        # zod: VenueQuery, CreateSpotInput, SpotReportInput
│           ├── types.ts          # VenueDTO, VenueDetailDTO, DishDTO
│           └── time.ts           # isOpenNow(schedules, now, tz) — gece yarısını aşan saatler dahil
│
├── backend/                      # Node.js + Fastify + Prisma + PostgreSQL
│   ├── package.json
│   ├── .env.example              # DATABASE_URL, PORT
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts               # İstanbul örnek verisi (13 mekan + 1 bekleyen başvuru)
│   │   └── migrations/
│   └── src/
│       ├── server.ts             # listen + graceful shutdown
│       ├── app.ts                # buildApp(): CORS, rate limit, zod compiler, hata biçimi
│       ├── env.ts                # env doğrulama (zod)
│       ├── db.ts                 # PrismaClient singleton
│       ├── routes/
│       │   └── venues.ts         # /api/v1: GET venues/nearby, GET venues/:id,
│       │                         #          POST venues/:id/report, POST venues/suggest
│       ├── services/
│       │   ├── venue.service.ts  # yakınlık sorgusu (bbox + haversine), isActiveNow, i18n seçimi
│       │   ├── report.service.ts # günlük tekil oy (dayKey), 500 m mesafe kontrolü, sayaçlar
│       │   └── suggest.service.ts # PENDING mekan önerisi
│       └── lib/
│           └── errors.ts, locale.ts, slug.ts  # haversine/bbox: packages/shared/src/geo.ts
│
└── app/                          # Expo SDK 57 + Expo Router + TypeScript (ayrıntı: app/README.md)
    ├── app.config.ts             # izin metinleri, GOOGLE_MAPS_API_KEY (build için)
    └── src/
        ├── app/                  # rotalar: _layout, index (harita), venue/[id] (modal)
        ├── api/                  # fetch istemcisi + React Query hook'ları
        ├── components/           # map/, venue/, filters/, ui/
        ├── hooks/ lib/ store/    # konum, deviceId, format, Zustand
        ├── i18n/                 # en + tr sözlükleri (expo-localization)
        └── theme/                # renk/boşluk token'ları, kategori ikonları
```

## Temel kararlar

| Konu | Karar | Neden |
|---|---|---|
| Monorepo | npm workspaces + `packages/shared` | Enum/zod şemaları ve `isOpenNow` mantığı hem API'de hem app'te aynı olmalı |
| Backend | Fastify + zod | Hafif, TS dostu, şema doğrulama yerleşik |
| Sunucu durumu | TanStack Query | Önbellek, yeniden deneme, optimistic "Spotted" butonu |
| İstemci durumu | Zustand | Filtre çipleri ve seçili mekan için yeterince basit |
| Harita | Leaflet + OpenStreetMap (`react-native-webview`) | Google Maps anahtarı ve Play Services gerekmez; Expo Go dahil her ortamda çalışır |
| Stil | StyleSheet + `src/theme` token'ları | NativeWind kurulum yükü olmadan tutarlı tema; ileride eklenebilir |
| Detay ekranı | Expo Router modal | Ek bağımlılık yok; iOS'ta sheet, Android'de tam ekran |
| Konum sorgusu | lat/lng + bbox index + haversine | MVP için yeterli; ölçeklenince PostGIS'e geçilebilir (şema buna hazır) |
| Kimlik | Anonim `deviceId` (MVP) | Turist hesap açmak istemez; oy tekilliği cihaz başına |
| i18n | Mekan/yemek metinleri çeviri tablolarında | Yeni dil = yeni satır, şema değişikliği yok |
| Pahalı mekan yasağı | `PriceLevel` enum'unda sadece BUDGET / MODERATE | Kural veritabanı seviyesinde garanti |

## "Şu an açık / aktif" mantığı

`isActiveNow` veritabanında saklanmaz, hesaplanır:

1. **Program**: `VendorSchedule` satırlarından biri şu anki gün+dakikayı kapsıyor mu?
   (`closeMinute < openMinute` ise gece yarısını aşıyordur, ör. 19:00–02:00.)
2. **Seyyarlar için topluluk sinyali**: Son 3 saatte `SPOTTED_TODAY` raporu varsa
   → "Az önce görüldü" rozeti; son 24 saatte `NOT_HERE` raporları baskınsa → uyarı.

`Venue.lastSpottedAt` / `spottedCount` alanları, harita listesinde her seferinde
rapor tablosunu taramamak için denormalize tutulur.
