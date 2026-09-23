import type { PriceLevel } from '@localbite/shared';
import { getT } from '../i18n';

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export const priceSymbol = (p: PriceLevel) => (p === 'BUDGET' ? '$' : '$$');

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
