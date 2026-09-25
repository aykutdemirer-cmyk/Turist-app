import { liveLocationFreshness, type LatLng, type VenueSummaryDTO } from '@localbite/shared';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { LeafletView, type LeafletHandle, type MapPin, type MapUser } from './leaflet/LeafletView';

export interface VenueMapHandle {
  focus: (target: LatLng, zoomedIn?: boolean, fly?: boolean) => void;
  /** Mesafe dairesini ekrana sığdır ("Tümü"de şehir ölçeğine uzaklaş) */
  fitRadius: () => void;
}

interface Props {
  ref?: Ref<VenueMapHandle>;
  initialCenter: LatLng;
  venues: VenueSummaryDTO[];
  selectedId: string | null;
  onSelectVenue: (id: string) => void;
  /** Haritada boş bir yere dokunuldu (seçimi kapatmak için) */
  onMapPress?: () => void;
  /** Kullanıcının avatarı (konum yoksa null) */
  user: MapUser | null;
  /** Üst çipler ve alt kart altında kalan alan; odaklama buna göre yapılır */
  topInset: number;
  bottomInset: number;
  onRegionChangeComplete?: (center: LatLng, isGesture: boolean) => void;
  /** Mesafe filtresi dairesi */
  radius?: (LatLng & { meters: number | null }) | null;
}

const DEFAULT_ZOOM = 15;
const FOCUS_ZOOM = 16;
/** "Tümü" seçilince (daire yok) şehir ölçeği */
const ALL_ZOOM = 12;

export function VenueMap({
  ref,
  initialCenter,
  venues,
  selectedId,
  onSelectVenue,
  onMapPress,
  user,
  topInset,
  bottomInset,
  onRegionChangeComplete,
  radius = null,
}: Props) {
  const mapRef = useRef<LeafletHandle>(null);

  useImperativeHandle(ref, () => ({
    focus: (target, zoomedIn = false, fly = false) => mapRef.current?.focus(target, zoomedIn ? FOCUS_ZOOM : undefined, fly),
    fitRadius: () => mapRef.current?.fitRadius(ALL_ZOOM),
  }));

  const pins = useMemo<MapPin[]>(
    () =>
      venues.map((v) => ({
        id: v.id,
        latitude: v.latitude,
        longitude: v.longitude,
        type: v.type,
        isMobile: v.isMobile,
        isActiveNow: v.isActiveNow,
        live: liveLocationFreshness(v.liveLocation?.updatedAt),
      })),
    [venues],
  );

  return (
    <LeafletView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialCenter={initialCenter}
      initialZoom={DEFAULT_ZOOM}
      pins={pins}
      selectedId={selectedId}
      user={user}
      padding={{ top: topInset, bottom: bottomInset }}
      radius={radius}
      onPinPress={onSelectVenue}
      onMapPress={onMapPress}
      onMoveEnd={(center, { isGesture }) => onRegionChangeComplete?.(center, isGesture)}
    />
  );
}
