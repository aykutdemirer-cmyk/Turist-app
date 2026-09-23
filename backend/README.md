# @localbite/backend

Fastify + Prisma 6 + PostgreSQL API.

## Kurulum

```bash
npm install                     # repo kökünde (workspaces)
cp backend/.env.example backend/.env
```

Veritabanı yoksa Prisma'nın yerel Postgres'i (PGlite) kullanılabilir:

```bash
cd backend && npx prisma dev --name localbite --detach
```

Çıktıdaki `postgres://...` URL'ini `.env` içine yazın ve sonuna
`&connection_limit=1&pgbouncer=true` ekleyin (PGlite tek bağlantı kabul eder, prepared statement'ları desteklemez).
Gerçek PostgreSQL'de bu eklere gerek yok.

```bash
npm run db:migrate -w @localbite/backend   # migration + CHECK kısıtları
npm run db:seed -w @localbite/backend      # 10 İstanbul mekanı (tekrar çalıştırılabilir)
npm run dev:api                            # http://localhost:3000
```

## Uç noktalar (`/api/v1`)

| Metot | Yol | Not |
|---|---|---|
| GET | `/venues/nearby?lat&lng&radius&category&openNowOnly&maxPrice&locale&limit` | `category` virgülle ayrılır; `radius` metre (100–20000, varsayılan 2000) |
| GET | `/venues/:idOrSlug?locale=tr` | Yemekler, program, çeviriler |
| POST | `/venues/:id/report` | Header `x-device-id`; `SPOTTED_TODAY`/`NOT_HERE` için konum zorunlu ve ≤ 500 m |
| POST | `/venues/suggest` | Header `x-device-id`; `status: PENDING` olarak kaydedilir |
| GET | `/health` | DB bağlantısı dahil |

Dil: `?locale=` → `Accept-Language` → `en`.

## Hızlı test

```bash
B=http://localhost:3000/api/v1

# Kadıköy çevresi, sadece şu an açık seyyarlar
curl "$B/venues/nearby?lat=40.99&lng=29.026&radius=2000&category=STREET_CART&openNowOnly=true"

# Detay (Türkçe)
curl "$B/venues/kadikoy-seyyar-kofteci?locale=tr"

# "Bugün burada gördüm" — ikinci kez 409, 500 m dışından 422
curl -X POST "$B/venues/<ID>/report" -H "content-type: application/json" -H "x-device-id: my-test-device" \
  -d '{"type":"SPOTTED_TODAY","latitude":40.9925,"longitude":29.0235}'
```

> Windows'ta Türkçe karakterli gövdeleri `-d` yerine `--data-binary @dosya.json` ile gönderin;
> aksi halde curl yanlış Content-Length hesaplar.

## Hata biçimi

```json
{ "error": "TOO_FAR", "message": "...", "details": { "distanceMeters": 4626 } }
```

`VALIDATION_ERROR` (400), `NOT_FOUND` (404), `ALREADY_REPORTED` (409), `TOO_FAR` (422), `INTERNAL_ERROR` (500).
