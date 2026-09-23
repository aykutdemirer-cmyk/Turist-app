import type { LatLng, VenueSummaryDTO } from '@localbite/shared';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet } from 'react-native';
import { LeafletView, type LeafletHandle, type MapPin, type MapUser } from './leaflet/LeafletView';

export interface VenueMapHandle {
  focus: (target: LatLng, zoomedIn?: boolean) => void;
}

interface Props {
  ref?: Ref<VenueMapHandle>;
  initialCenter: LatLng;
  venues: VenueSummaryDTO[];
  selectedId: string | null;
  onSelectVenue: (id: string) => void;
  /** Kullanıcının avatarı (konum yoksa null) */
  user: MapUser | null;
  /** Üst filtre barı ve alt karusel altında kalan alan; odaklama buna göre yapılır */
  topInset: number;
  bottomInset: number;
  onRegionChangeComplete?: (center: LatLng, isGesture: boolean) => void;
}

const DEFAULT_ZOOM = 15;
const FOCUS_ZOOM = 16;

export function VenueMap({
  ref,
  initialCenter,
  venues,
  selectedId,
  onSelectVenue,
  user,
  topInset,
  bottomInset,
  onRegionChangeComplete,
}: Props) {
  const mapRef = useRef<LeafletHandle>(null);

  useImperativeHandle(ref, () => ({
    focus: (target, zoomedIn = false) => mapRef.current?.focus(target, zoomedIn ? FOCUS_ZOOM : undefined),
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
      onPinPress={onSelectVenue}
      onMoveEnd={(center, { isGesture }) => onRegionChangeComplete?.(center, isGesture)}
    />
  );
}
