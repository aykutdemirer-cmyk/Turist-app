/**
 * Bir üyeye genel yönetici (SUPER_ADMIN) yetkisi verir ya da geri alır.
 *   npm run admin:grant -w @localbite/backend -- kisi@ornek.com
 *   npm run admin:grant -w @localbite/backend -- kisi@ornek.com --revoke
 */
import { prisma } from '../src/db';

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error('Kullanım: admin:grant <email> [--revoke]');
  process.exit(1);
}
const role = flag === '--revoke' ? 'USER' : 'SUPER_ADMIN';
const { count } = await prisma.user.updateMany({ where: { email: email.toLowerCase() }, data: { role } });
console.log(count ? `${email} → ${role}` : `Üye bulunamadı: ${email}`);
await prisma.$disconnect();
