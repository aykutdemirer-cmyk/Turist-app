import { haversineMeters, liveLocationFreshness, type LatLng, type VenueSummaryDTO } from '@localbite/shared';

export interface ExploreFilterInput {
  /** Mesafenin ölçüldüğü nokta: "Bu bölgede ara" merkezi ya da kullanıcının konumu */
  origin: LatLng;
  /** Metre; null = mesafe sınırı yok ("Tümü") */
  maxDistance: number | null;
  category: VenueSummaryDTO['categories'][number] | null;
  openNow: boolean;
  budget: boolean;
  liveOnly: boolean;
}

/** Keşfet filtreleri: mesafe (Haversine), kategori, açık, bütçe, canlı konum. Mesafeye göre sıralı döner. */
export function applyExploreFilters(venues: VenueSummaryDTO[], f: ExploreFilterInput, now = new Date()) {
  return venues
    .map((v) => ({ venue: v, distance: haversineMeters(f.origin, v) }))
    .filter(({ venue: v, distance }) => {
      if (f.maxDistance !== null && distance > f.maxDistance) return false;
      if (f.category && !v.categories.includes(f.category)) return false;
      if (f.openNow && !(v.isActiveNow || v.isScheduledOpen)) return false;
      if (f.budget && v.priceLevel !== 'BUDGET') return false;
      if (f.liveOnly && liveLocationFreshness(v.liveLocation?.updatedAt, now) !== 'LIVE') return false;
      return true;
    })
    .sort((a, b) => a.distance - b.distance)
    // Kartlarda görünen mesafe de seçilen merkeze göre olsun
    .map(({ venue, distance }) => ({ ...venue, distanceMeters: Math.round(distance) }));
}
