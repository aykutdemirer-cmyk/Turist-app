// Saat hesapları "gece yarısından itibaren dakika" üzerinden yapılır: 19:00 = 1140.
// closeMinute < openMinute ise dilim gece yarısını aşar (19:00–02:00 → 1140–120).
// openMinute === closeMinute ise o gün 24 saat açık kabul edilir.

export const DEFAULT_TIMEZONE = 'Europe/Istanbul';

/** Bir "Spotted Today" teyidi seyyarı bu kadar dakika boyunca aktif gösterir. */
export const SPOTTED_WINDOW_MINUTES = 180;

export const MINUTES_PER_DAY = 1440;

export interface ScheduleSlot {
  dayOfWeek: number; // 0 = Pazar … 6 = Cumartesi (dilimin başladığı gün)
  openMinute: number;
  closeMinute: number;
}

export interface LocalClock {
  dayOfWeek: number;
  minuteOfDay: number;
  /** Yerel tarih, YYYY-MM-DD */
  dayKey: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function getLocalClock(now: Date = new Date(), timeZone = DEFAULT_TIMEZONE): LocalClock {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(now)) parts[p.type] = p.value;
  return {
    dayOfWeek: WEEKDAYS.indexOf(parts.weekday ?? ''),
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Şu an geçerli olan program dilimini döner (seyyarın o anki köşesini bulmak için de kullanılır). */
export function findActiveSlot<T extends ScheduleSlot>(
  schedules: readonly T[],
  now: Date = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): T | undefined {
  const { dayOfWeek: today, minuteOfDay: m } = getLocalClock(now, timeZone);
  const yesterday = (today + 6) % 7;

  return schedules.find(({ dayOfWeek, openMinute, closeMinute }) => {
    if (openMinute === closeMinute) return dayOfWeek === today;
    if (openMinute < closeMinute) return dayOfWeek === today && m >= openMinute && m < closeMinute;
    // Gece yarısını aşan dilim: bugün açılıştan sonrası VEYA dünden devreden kısım
    return (dayOfWeek === today && m >= openMinute) || (dayOfWeek === yesterday && m < closeMinute);
  });
}

export function isRecentlySpotted(
  lastSpottedAt: Date | string | null | undefined,
  now: Date = new Date(),
  windowMinutes = SPOTTED_WINDOW_MINUTES,
): boolean {
  if (!lastSpottedAt) return false;
  const spotted = typeof lastSpottedAt === 'string' ? new Date(lastSpottedAt) : lastSpottedAt;
  const diff = now.getTime() - spotted.getTime();
  return diff >= 0 && diff <= windowMinutes * 60_000;
}

/**
 * Mekan şu an açık/aktif mi?
 * Program dilimi açıksa VEYA son SPOTTED_WINDOW_MINUTES içinde "Bugün burada gördüm" teyidi varsa true.
 * Sabit dükkanlar için lastSpottedAt yerine null geçmek, sonucu yalnızca programa bağlar.
 */
export function isOpenNow(
  schedules: readonly ScheduleSlot[],
  lastSpottedAt: Date | string | null | undefined,
  now: Date = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  return findActiveSlot(schedules, now, timeZone) !== undefined || isRecentlySpotted(lastSpottedAt, now);
}

export function toMinutes(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutes(minutes: number): string {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
