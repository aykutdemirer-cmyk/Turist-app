import { readFileSync } from 'node:fs';

/**
 * Menüdeki yemeğin görseli (ücretsiz, açık lisanslı):
 * 1. Kendi lisanslı yemek arşivimiz (media/dishes/credits.json) — ad eşleşirse
 * 2. Wikimedia Commons'ta yemeğin adıyla arama (yalnızca CC / kamu malı lisanslı)
 * Görsel temsilidir: o dükkanın tabağı değil, yemeğin kendisidir (arayüzde "Temsili fotoğraf").
 */

export interface DishPhoto {
  imageUrl: string;
  imageCredit: string | null;
  imageSourceUrl: string | null;
}

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
const TIMEOUT_MS = 6_000;
const FREE_LICENSE = /^(cc[ -]by|cc0|public domain|pd)/i;

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const library = Object.entries(
  JSON.parse(readFileSync(new URL('../../media/dishes/credits.json', import.meta.url), 'utf-8')) as Record<
    string,
    { file: string; credit: string; sourceUrl?: string }
  >,
).map(([name, c]) => ({ key: fold(name), photo: { imageUrl: `/media/dishes/${c.file}`, imageCredit: c.credit, imageSourceUrl: c.sourceUrl ?? null } }));

/** Arşivde tam ya da kapsayan ad ("Et Döner Dürüm" ~ "döner dürüm") */
export function libraryDishPhoto(localName: string): DishPhoto | null {
  const q = fold(localName);
  if (!q) return null;
  const exact = library.find((l) => l.key === q);
  if (exact) return exact.photo;
  // Çok kısa adlar ("çay") başka yemeklerin içinde geçip yanlış eşleşmesin
  if (q.length < 4) return null;
  const partial = library.find((l) => l.key.includes(q) || (l.key.length >= 4 && q.includes(l.key)));
  return partial?.photo ?? null;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function commonsDishPhoto(localName: string): Promise<DishPhoto | null> {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8' +
    `&gsrsearch=${encodeURIComponent(`${localName} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          index?: number;
          imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[];
        }
      >;
    };
  };
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const license = info?.extmetadata?.LicenseShortName?.value ?? '';
    if (!info?.thumburl || !FREE_LICENSE.test(license)) continue;
    const artist = info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value) : null;
    return {
      imageUrl: info.thumburl,
      imageCredit: [artist, license].filter(Boolean).join(' · '),
      imageSourceUrl: info.descriptionurl ?? null,
    };
  }
  return null;
}

/** Görsel bulunamazsa null (uygulama yemek illüstrasyonu gösterir) */
export async function findDishPhoto(localName: string): Promise<DishPhoto | null> {
  return libraryDishPhoto(localName) ?? (await commonsDishPhoto(localName).catch(() => null));
}
