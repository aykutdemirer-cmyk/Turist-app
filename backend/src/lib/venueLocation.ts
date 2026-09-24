import type { LatLng } from '@localbite/shared';

interface Positioned {
  latitude: number;
  longitude: number;
  isLiveLocation: boolean;
  liveLatitude: number | null;
  liveLongitude: number | null;
}

/** Satıcının canlı konumu varsa o, yoksa kayıtlı (varsayılan) konum */
export function currentPosition(venue: Positioned): LatLng {
  return venue.isLiveLocation && venue.liveLatitude != null && venue.liveLongitude != null
    ? { latitude: venue.liveLatitude, longitude: venue.liveLongitude }
    : { latitude: venue.latitude, longitude: venue.longitude };
}
