import type { PriceLevel } from '@localbite/shared';
import { getT } from '../i18n';

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/** Mesafe filtresi etiketi: 500 → "500 m", 1000 → "1 km" (formatDistance "1.0 km" yazardı) */
export const distanceLabel = (meters: number) => (meters < 1_000 ? `${meters} m` : `${meters / 1_000} km`);

/** Dış kaynaklı yerlerde fiyat bilinmeyebilir → null */
export const priceSymbol = (p: PriceLevel | null) => (p === null ? null : p === 'BUDGET' ? '$' : '$$');

/** Türk lirası tutarı: 1500 → "₺1.500" (binlik ayırıcı dilden bağımsız, Türkiye'deki gibi nokta) */
export const formatTry = (amount: number) => `₺${Math.round(amount).toLocaleString('tr-TR')}`;

/** Render sırasında çağrılır; bileşen useT() ile dile abone olduğu için dil değişince güncellenir. */
export function formatRelative(iso: string, now = Date.now()): string {
  const t = getT();
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t.time.justNow;
  if (minutes < 60) return t.time.minutesAgo(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.time.hoursAgo(hours);
  const days = Math.round(hours / 24);
  if (days < 30) return t.time.daysAgo(days);
  return t.time.monthsAgo(Math.round(days / 30));
}
