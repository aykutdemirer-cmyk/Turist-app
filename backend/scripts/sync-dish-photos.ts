/**
 * media/dishes/credits.json'a sonradan eklenen lisanslı fotoğrafları, fotoğrafı olmayan yemeklere eşler
 * (yemek adına göre). Mevcut fotoğraflara ve diğer verilere dokunmaz; her açılışta güvenle çalışır.
 *   npx tsx scripts/sync-dish-photos.ts
 */
import { readFileSync } from 'node:fs';
import { prisma } from '../src/db';

const photos: Record<string, { file: string; credit: string; sourceUrl: string }> = JSON.parse(
  readFileSync(new URL('../media/dishes/credits.json', import.meta.url), 'utf-8'),
);

let updated = 0;
for (const [localName, photo] of Object.entries(photos)) {
  const { count } = await prisma.dish.updateMany({
    where: { localName, imageUrl: null },
    data: { imageUrl: `/media/dishes/${photo.file}`, imageCredit: photo.credit, imageSourceUrl: photo.sourceUrl },
  });
  updated += count;
}
await prisma.$disconnect();
console.log(`[sync-dish-photos] ${updated} yemeğe fotoğraf eklendi.`);
