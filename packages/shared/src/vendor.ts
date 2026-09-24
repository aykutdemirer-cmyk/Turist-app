/**
 * Seyyar canlı konumunun tazeliği:
 *  LIVE   — son 4 saatte satıcı güncelledi: "Doğrulanmış canlı konum" (yeşil halka)
 *  RECENT — 4–12 saat: normal pin, "X önce güncellendi" rozeti
 *  STALE  — 12 saatten eski: "Son bilinen nokta", soluk pin
 */
export const LIVE_LOCATION_WINDOW_MS = 4 * 3_600_000;
export const LIVE_LOCATION_STALE_MS = 12 * 3_600_000;

export type LiveLocationFreshness = 'LIVE' | 'RECENT' | 'STALE';

export function liveLocationFreshness(
  updatedAt: string | Date | null | undefined,
  now = new Date(),
): LiveLocationFreshness | null {
  if (!updatedAt) return null;
  const age = now.getTime() - new Date(updatedAt).getTime();
  if (Number.isNaN(age)) return null;
  if (age <= LIVE_LOCATION_WINDOW_MS) return 'LIVE';
  if (age <= LIVE_LOCATION_STALE_MS) return 'RECENT';
  return 'STALE';
}

/** Satıcının "Açık/Kapalı" anahtarı bu süre sonra kendiliğinden çalışma saatlerine döner (ertesi güne taşınmasın) */
export const OPEN_OVERRIDE_TTL_MS = 12 * 3_600_000;

export function activeOpenOverride(
  override: boolean | null | undefined,
  setAt: string | Date | null | undefined,
  now = new Date(),
): boolean | null {
  if (override == null || !setAt) return null;
  return now.getTime() - new Date(setAt).getTime() <= OPEN_OVERRIDE_TTL_MS ? override : null;
}

/** Onaylı duyuru onaydan itibaren bu süre yayında kalır ("Bugün 20:00'de lokma" ertesi gün anlamsız) */
export const ANNOUNCEMENT_TTL_MS = 48 * 3_600_000;
