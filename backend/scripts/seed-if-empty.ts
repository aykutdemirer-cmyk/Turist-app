/**
 * Yalnızca hiç mekan yoksa (ilk kurulum) örnek veriyi yükler. Seed, kendi mekanlarını silip yeniden oluşturduğu
 * için her açılışta çalıştırılmamalı: kullanıcı yorumları ve satıcı güncellemeleri silinirdi.
 * Üretimde test hesapları yalnızca SEED_ADMIN_PASSWORD ve SEED_VENDOR_PASSWORD verilirse oluşur (bkz. seed.ts).
 */
import { execSync } from 'node:child_process';
import { prisma } from '../src/db';

const venues = await prisma.venue.count();
await prisma.$disconnect();

if (venues > 0) {
  console.log(`[seed-if-empty] ${venues} mekan var, örnek veri atlandı.`);
} else {
  console.log('[seed-if-empty] Veritabanı boş, örnek veri yükleniyor…');
  execSync('npx prisma db seed', { stdio: 'inherit' });
}
