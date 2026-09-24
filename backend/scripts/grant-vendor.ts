/**
 * Bir üyeyi mekanın sahibi (VENDOR) yapar ya da sahipliği geri alır.
 *   npm run vendor:grant -w @localbite/backend -- kisi@ornek.com rihtim-gece-pilavcisi
 *   npm run vendor:grant -w @localbite/backend -- kisi@ornek.com rihtim-gece-pilavcisi --revoke
 * Başka mekanı kalmayan satıcı --revoke ile USER rolüne döner. SUPER_ADMIN'in rolü değiştirilmez.
 */
import { prisma } from '../src/db';

const [rawEmail, slug, flag] = process.argv.slice(2);
if (!rawEmail || !slug) {
  console.error('Kullanım: vendor:grant <email> <mekan-slug> [--revoke]');
  process.exit(1);
}
const email = rawEmail.toLowerCase();

const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
const venue = await prisma.venue.findUnique({ where: { slug }, select: { id: true, name: true, ownerId: true } });
if (!user || !venue) {
  console.error(!user ? `Üye bulunamadı: ${email}` : `Mekan bulunamadı: ${slug}`);
  process.exit(1);
}
if (user.role === 'SUPER_ADMIN') {
  console.error('SUPER_ADMIN hesabı satıcı yapılamaz; ayrı bir hesap kullanın.');
  process.exit(1);
}

if (flag === '--revoke') {
  await prisma.venue.updateMany({ where: { id: venue.id, ownerId: user.id }, data: { ownerId: null } });
  const remaining = await prisma.venue.count({ where: { ownerId: user.id } });
  if (!remaining) await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
  console.log(`${email} artık ${venue.name} mekanını yönetmiyor${remaining ? '' : ' (rol: USER)'}`);
} else {
  if (venue.ownerId && venue.ownerId !== user.id) console.warn('Uyarı: mekanın önceki sahibi değiştiriliyor.');
  await prisma.$transaction([
    prisma.venue.update({ where: { id: venue.id }, data: { ownerId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { role: 'VENDOR' } }),
  ]);
  console.log(`${email} → VENDOR · ${venue.name}`);
}
await prisma.$disconnect();
