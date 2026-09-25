# LocalBite API — Railway (ve diğer Docker ortamları) için.
# Derleme bağlamı repo kökü olmalı: yalnızca backend + packages/shared kurulur, Expo uygulaması ve web paneli kurulmaz.
FROM node:24-bookworm-slim

# Prisma sorgu motoru OpenSSL ister; OSM karo/OAuth istekleri için güncel CA sertifikaları
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Önce yalnızca bildirimler: bağımlılık katmanı kod değişikliklerinde önbellekten gelir.
# app/ ve admin/ bildirimleri npm workspaces çözümlemesi için gerekli; bağımlılıkları kurulmaz.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY app/package.json app/
COPY admin/package.json admin/
RUN npm ci --workspace=backend --workspace=packages/shared --no-audit --no-fund

COPY packages/shared packages/shared
COPY backend backend

WORKDIR /app/backend
RUN npx prisma generate

ENV NODE_ENV=production
# Railway PORT'u kendisi verir; sunucu 0.0.0.0'da dinler (env.ts varsayılanı)
EXPOSE 3000

# Her açılışta: bekleyen migration'lar, boşsa örnek veri (bir kez), fotoğrafsız yemeklere yeni lisanslı fotoğraflar
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/seed-if-empty.ts && npx tsx scripts/sync-dish-photos.ts && exec npx tsx src/server.ts"]
