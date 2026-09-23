import { randomBytes } from 'node:crypto';

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' };

export function slugify(input: string): string {
  return input
    .replace(/[çğıİöşü]/gi, (ch) => TR_MAP[ch] ?? TR_MAP[ch.toLowerCase()] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Kullanıcı önerileri için çakışmayan slug: "seyyar-midyeci-3f9a1c" */
export const uniqueSlug = (name: string) => `${slugify(name) || 'spot'}-${randomBytes(3).toString('hex')}`;
