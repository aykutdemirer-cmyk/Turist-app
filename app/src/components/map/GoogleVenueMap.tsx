import { boundingBox, type LatLng } from '@localbite/shared';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type MapStyleElement } from 'react-native-maps';
import { useTheme, venueTypeMeta } from '../../theme';
import type { MapPin, MapUser } from './leaflet/LeafletView';

/**
 * Google Maps (Android: Maps SDK, sınırsız ücretsiz). Google Places verisi Google şartları gereği Google
 * haritası üzerinde gösterilir. Leaflet sürümüyle aynı arayüz (VenueMap iki sürümü de kullanabilir).
 */

export interface GoogleMapHandle {
  focus: (target: LatLng, zoom?: number, fly?: boolean) => void;
  fitRadius: (fallbackZoom?: number) => void;
}

interface Props {
  ref?: Ref<GoogleMapHandle>;
  initialCenter: LatLng;
  initialZoom: number;
  pins: MapPin[];
  selectedId: string | null;
  user: MapUser | null;
  padding: { top: number; bottom: number };
  radius: (LatLng & { meters: number | null }) | null;
  onPinPress: (id: string) => void;
  onMapPress?: () => void;
  onMoveEnd?: (center: LatLng, isGesture: boolean) => void;
}

/** Google'ın kendi işletme simgeleri bizim pinlerimizle karışmasın */
const MAP_STYLE: MapStyleElement[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/**
 * Android'de özel işaretçi görünümü ilk çizimden önce anlık görüntüye alınırsa boş kalır; görünüm oturana
 * kadar izlenir, sonra performans için izleme kapatılır.
 */
function useSettledTracking(key: string) {
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(key), 1500);
    return () => clearTimeout(timer);
  }, [key]);
  return settledKey !== key;
}

export function GoogleVenueMap({
  ref,
  initialCenter,
  initialZoom,
  pins,
  selectedId,
  user,
  padding,
  radius,
  onPinPress,
  onMapPress,
  onMoveEnd,
}: Props) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  // react-native-maps (Android, yeni mimari): harita hazır olmadan mapPadding verilirse GoogleMap null → çökme
  const [ready, setReady] = useState(false);
  const tracksViewChanges = useSettledTracking(`${pins.length}:${selectedId}:${colors.surface}`);

  useImperativeHandle(ref, () => ({
    focus: (target, zoom, fly = false) =>
      mapRef.current?.animateCamera(
        { center: target, ...(zoom !== undefined && { zoom }) },
        { duration: fly ? 800 : 300 },
      ),
    fitRadius: (fallbackZoom = 12) => {
      if (radius?.meters) {
        const b = boundingBox(radius, radius.meters);
        mapRef.current?.fitToCoordinates(
          [
            { latitude: b.minLat, longitude: b.minLng },
            { latitude: b.maxLat, longitude: b.maxLng },
          ],
          { edgePadding: { top: 24, bottom: 24, left: 24, right: 24 }, animated: true },
        );
      } else if (radius) {
        mapRef.current?.animateCamera({ center: radius, zoom: fallbackZoom }, { duration: 400 });
      }
    },
  }));

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialCamera={{ center: initialCenter, zoom: initialZoom, heading: 0, pitch: 0 }}
      onMapReady={() => setReady(true)}
      {...(ready && { mapPadding: { top: padding.top, bottom: padding.bottom, left: 0, right: 0 } })}
      customMapStyle={MAP_STYLE}
      showsCompass={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onPress={(e) => {
        // İşaretçiye dokunuş haritaya da düşer; yalnızca boş alana dokunuşta seçimi kapat
        if (e.nativeEvent.action !== 'marker-press') onMapPress?.();
      }}
      onRegionChangeComplete={(region, details) =>
        onMoveEnd?.({ latitude: region.latitude, longitude: region.longitude }, details?.isGesture ?? false)
      }
    >
      {radius?.meters ? (
        <Circle
          center={radius}
          radius={radius.meters}
          strokeColor={colors.primary}
          strokeWidth={2}
          lineDashPattern={[12, 8]}
          fillColor="rgba(194, 65, 12, 0.06)"
        />
      ) : null}

      {pins.map((pin) => (
        <Marker
          key={`${pin.id}:${pin.id === selectedId}`}
          identifier={pin.id}
          coordinate={pin}
          onPress={() => onPinPress(pin.id)}
          tracksViewChanges={tracksViewChanges}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={pin.id === selectedId ? 3 : pin.external ? 1 : 2}
        >
          <PinView pin={pin} selected={pin.id === selectedId} />
        </Marker>
      ))}

      {user && (
        <Marker coordinate={user} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges} zIndex={5}>
          <View collapsable={false} style={styles.userWrap}>
            <View style={styles.userDot} />
          </View>
        </Marker>
      )}
    </MapView>
  );
}

function PinView({ pin, selected }: { pin: MapPin; selected: boolean }) {
  const { colors } = useTheme();
  const meta = venueTypeMeta[pin.type];
  const Icon = meta.Icon;
  const size = selected ? 44 : pin.external ? 30 : 36;
  const active = pin.isActiveNow || pin.live === 'LIVE';
  const border = pin.isMobile ? colors.mobileAccent : pin.external && !selected ? '#9CA3AF' : colors.shop;
  return (
    // collapsable={false}: işaretçi görüntüsü alınırken iç görünümler düzleştirilip kaybolmasın
    <View collapsable={false} style={[styles.ring, active && { borderColor: colors.open, borderWidth: 3 }, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
      <View
        collapsable={false}
        style={[
          styles.pin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: pin.isMobile ? colors.mobile : colors.surface,
            borderColor: border,
            opacity: pin.live === 'STALE' ? 0.5 : 1,
          },
        ]}
      >
        <Icon size={size * 0.5} color={pin.isMobile ? '#FFFFFF' : pin.external && !selected ? '#6B7280' : meta.color} strokeWidth={2.4} />
      </View>
      {pin.live === 'LIVE' && <Text style={styles.liveDot}>●</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 0, borderColor: 'transparent' },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  liveDot: { position: 'absolute', top: -2, right: -2, color: '#22C55E', fontSize: 14 },
  userWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFFFFF', backgroundColor: '#2563EB' },
});
