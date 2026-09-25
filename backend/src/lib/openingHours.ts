import OpeningHours from 'opening_hours';
import type { Locale } from '@localbite/shared';

/**
 * OpenStreetMap `opening_hours` etiketini (ör. "Mo-Su 10:00-02:00") İstanbul saatiyle yorumlar.
 * Açık kaynak opening_hours.js kütüphanesi; ayrıştırılamayan değerde null (saat bilinmiyor).
 */

/** Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati yok) */
const ISTANBUL_OFFSET_MIN = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ParsedHours {
  openNow: boolean;
  /** Açıksa kapanış, kapalıysa açılış ("22:00"); 24/7 ya da bilinmiyorsa null */
  closesAt: string | null;
  opensAt: string | null;
  /** Pazartesiden başlayarak 7 satır: "Pazartesi: 10:00–02:00" / "Pazar: Kapalı" */
  weeklyHours: string[];
}

/**
 * Kütüphane Date'lerin yerel saatiyle çalışır; sunucu UTC'de olabilir. İstanbul duvar saatini
 * sunucunun yerel saatiymiş gibi gösteren "kaydırılmış" Date kullanırız (dönen saatler de aynı çerçevede).
 */
function toIstanbulFrame(date: Date) {
  const serverOffsetMin = -date.getTimezoneOffset();
  return new Date(date.getTime() + (ISTANBUL_OFFSET_MIN - serverOffsetMin) * 60_000);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Resmi/okul tatili kuralları: kütüphanede Türkiye tatil takvimi yok (hata verir); bu kuralları yok sayarız */
const HOLIDAY_RULE = /(^|;)\s*(PH|SH)\b[^;]*/g;

const WEEKDAY_LABELS: Record<Locale, string[]> = {
  tr: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
const CLOSED_LABEL: Record<Locale, string> = { tr: 'Kapalı', en: 'Closed' };
const ALL_DAY_LABEL: Record<Locale, string> = { tr: '24 saat açık', en: 'Open 24 hours' };

export function parseOpeningHours(value: string | undefined, locale: Locale, now = new Date()): ParsedHours | null {
  const cleaned = value?.replace(HOLIDAY_RULE, '').replace(/^\s*;\s*/, '').trim();
  if (!cleaned) return null;

  let oh: OpeningHours;
  try {
    oh = new OpeningHours(cleaned, null, { mode: 0, tag_key: 'opening_hours', map_value: true, warnings_severity: 4, locale: 'en' });
  } catch {
    return null;
  }

  try {
    const at = toIstanbulFrame(now);
    // "Bilinmiyor" (ör. "Mo-Fr 09:00-18:00 open "telefonla sorun"") durumunu açık saymayız
    if (oh.getUnknown(at)) return null;
    const openNow = oh.getState(at);
    const next = oh.getNextChange(at, new Date(at.getTime() + 8 * DAY_MS));

    return {
      openNow,
      closesAt: openNow && next ? hhmm(next) : null,
      opensAt: !openNow && next ? hhmm(next) : null,
      weeklyHours: weekLines(oh, at, locale),
    };
  } catch {
    return null;
  }
}

/** Bu haftanın (Pazartesi–Pazar) açık aralıkları; gece yarısını aşan aralık başladığı güne yazılır */
function weekLines(oh: OpeningHours, at: Date, locale: Locale): string[] {
  const monday = new Date(at);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return WEEKDAY_LABELS[locale].map((label, i) => {
    const dayStart = new Date(monday.getTime() + i * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    // Ertesi güne sarkan kapanışı görebilmek için aralıkları iki gün boyunca alıyoruz
    const raw = oh.getOpenIntervals(dayStart, new Date(dayEnd.getTime() + DAY_MS)).filter(([, , unknown]) => !unknown);
    if (raw.some(([from, to]) => from <= dayStart && to >= dayEnd)) return `${label}: ${ALL_DAY_LABEL[locale]}`;
    // Önceki günden gece yarısını aşarak gelen aralık (gün başında kesilmiş) o güne aittir; burada gösterilmez
    const continuesFromYesterday = oh.getState(new Date(dayStart.getTime() - 60_000));
    const intervals = raw.filter(
      ([from]) => from >= dayStart && from < dayEnd && !(continuesFromYesterday && from.getTime() === dayStart.getTime()),
    );
    if (!intervals.length) return `${label}: ${CLOSED_LABEL[locale]}`;
    return `${label}: ${intervals.map(([from, to]) => `${hhmm(from)}–${hhmm(to)}`).join(', ')}`;
  });
}
