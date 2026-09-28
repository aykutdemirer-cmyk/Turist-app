import { env } from './env';
import { buildApp } from './app';
import { warmKeywordPhotos } from './lib/keywordPhotos';
import { startOsmImporter } from './services/osm-import.service';

const app = await buildApp({
  corsOrigin: env.CORS_ORIGIN,
  logger: env.NODE_ENV === 'development' ? { level: 'info' } : true,
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  // OSM yemek mekanlarını arka planda veritabanına aktar (liste anlık Overpass'a bağlı kalmaz)
  startOsmImporter(app.log);
  // Addan anlaşılan yemeklerin (falafel, pizza...) Commons görselleri bir kez bulunur
  void warmKeywordPhotos().catch(() => undefined);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
