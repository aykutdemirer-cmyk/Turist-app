# @localbite/backend

LocalBite API: Fastify + Prisma 6 + PostgreSQL. Varsayılan adres `http://localhost:3001/api/v1`.

Veritabanı kurulumu, migration/seed, ortam değişkenleri (`backend/.env`), test hesapları, rol atama betikleri
(`admin:grant`, `vendor:grant`) ve uç nokta özeti için kök [README.md](../README.md) dosyasına bakın.

Hızlı başlangıç:

```bash
cp .env.example .env    # JWT_SECRET ve DATABASE_URL'i doldurun
npm run db:migrate && npm run db:seed
npm run dev             # tsx watch
```
