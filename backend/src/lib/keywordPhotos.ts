import { findDishPhoto, libraryDishPhoto } from './dishPhotos';
import type { OpenPhoto } from './openPhotos';

/**
 * Mekanın adından/mutfak etiketinden anlaşılan yemeğin temsili görseli ("Yalla Falafel" → falafel,
 * "Unkapanı Pilavcısı" → pilav). Hiçbir ipucu yoksa null: uygulama sade tür ikonu gösterir; türüne göre
 * tahmini (yanıltıcı olabilecek) yemek fotoğrafı konmaz.
 *
 * Görsel önce lisanslı arşivden (media/dishes), yoksa Wikimedia Commons'tan (CC/kamu malı) gelir. Commons
 * görselleri sunucu açılışında bir kez bulunup bellekte tutulur; liste isteği ağ beklemez.
 */

/** Sıra önemli: özel olan genelden önce ("çiğ köfte" → "köfte"den, "balık ekmek" → "ekmek"ten önce) */
const KEYWORDS: [RegExp, string][] = [
  [/falafel/, 'Falafel'],
  [/[çc]i[ğg][ _-]?k[öo]fte|cig_kofte/, 'Çiğ köfte'],
  [/kokore[çc]/, 'Kokoreç'],
  [/midye|mussel/, 'Midye Tava'],
  [/bal[ıi]k|fish|seafood/, 'Balık Ekmek'],
  [/lahmacun/, 'Lahmacun'],
  [/pide|turkish_pizza/, 'Kıymalı Pide'],
  [/pizza/, 'Pizza'],
  [/tantuni/, 'Tantuni'],
  [/d[öo]ner|shawarma|gyros/, 'Et Döner Dürüm'],
  [/adana|ocakba[şs][ıi]|kebap|kebab|[şs]i[şs]\b/, 'Adana Dürüm'],
  [/k[öo]fte|meatball/, 'Köfte Ekmek'],
  [/[çc]orba|soup|i[şs]kembe|kelle/, 'Mercimek Çorbası'],
  [/mant[ıi]/, 'Mantı'],
  [/pilav/, 'Nohutlu Pilav'],
  [/burger/, 'Islak Burger'],
  [/kumpir/, 'Kumpir'],
  [/b[öo]rek/, 'Börek'],
  [/simit/, 'Simit'],
  [/baklava/, 'Baklava'],
  [/k[üu]nefe/, 'Künefe'],
  [/lokma/, 'Lokma'],
  [/s[üu]tla[çc]|muhallebi|pudding/, 'Fırın Sütlaç'],
  [/dondurma|ice_cream|gelato/, 'Dondurma'],
  [/waffle/, 'Waffle'],
  [/kestane/, 'Közde Kestane'],
  [/tost|toast|sandvi[çc]|sandwich/, 'Kaşarlı tost'],
  [/zeytinya[ğg]/, 'Zeytinyağlı Enginar'],
  [/lokanta|esnaf|ev yemek|ev_yemek|sulu yemek|home_cooking/, 'Kuru Fasulye'],
];

const commonsCache = new Map<string, OpenPhoto | null>();

function toOpenPhoto(p: { imageUrl: string; imageCredit: string | null }): OpenPhoto {
  return { url: p.imageUrl, attribution: p.imageCredit, representative: true };
}

/** Adda/mutfakta geçen ilk yemeğin görseli; ipucu yoksa ya da görsel henüz bulunamadıysa null */
export function keywordPhoto(text: string): OpenPhoto | null {
  const lower = text.toLocaleLowerCase('tr');
  const match = KEYWORDS.find(([re]) => re.test(lower));
  if (!match) return null;
  const dish = match[1];
  const library = libraryDishPhoto(dish);
  if (library) return toOpenPhoto(library);
  return commonsCache.get(dish) ?? null;
}

/** Arşivde olmayan yemeklerin Commons görsellerini bir kez bulur (sunucu açılışında, arka planda) */
export async function warmKeywordPhotos() {
  for (const [, dish] of KEYWORDS) {
    if (libraryDishPhoto(dish) || commonsCache.has(dish)) continue;
    const photo = await findDishPhoto(dish).catch(() => null);
    // Bulunamayan tekrar denenebilsin diye önbelleğe yalnızca bulunan yazılır
    if (photo) commonsCache.set(dish, toOpenPhoto(photo));
  }
}
