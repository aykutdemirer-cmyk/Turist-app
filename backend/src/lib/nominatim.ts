/**
 * OpenStreetMap Nominatim ters coğrafi kodlama: OSM'de adres etiketi olmayan dükkanın konumundan
 * sokak/mahalle adresi. Ücretsiz; kullanım kuralı: saniyede en fazla 1 istek ve tanımlayıcı User-Agent.
 * Sonuç mekan kaydına bir kez yazılır (her açılışta tekrar sorulmaz) ve "yaklaşık adres" diye işaretlenir.
 */

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
const MIN_INTERVAL_MS = 1_100;
const TIMEOUT_MS = 6_000;

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** İstekleri sıraya koyar: aynı anda en fazla bir tane, aralarında ≥ 1,1 sn */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  town?: string;
  county?: string;
}

/**
 * "Caferağa, Kadıköy": yalnızca mahalle + ilçe. Konumdan tahmin edilen sokak/kapı numarası aynı nokta için
 * farklı sonuç verebiliyor (yanlış bilgi riski); kesin konum zaten koordinatla (yol tarifi) veriliyor.
 */
export function formatAddress(a: NominatimAddress): string | null {
  const area = a.neighbourhood ?? a.quarter ?? a.suburb;
  const district = a.city_district ?? a.town ?? a.county;
  if (!area || !district) return null;
  return area === district ? district : `${area}, ${district}`;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  return throttled(async () => {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=tr` +
      `&lat=${latitude.toFixed(6)}&lon=${longitude.toFixed(6)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress };
    return data.address ? formatAddress(data.address) : null;
  }).catch(() => null);
}
