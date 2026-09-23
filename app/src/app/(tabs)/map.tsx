import { haversineMeters, type LatLng } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { LocateFixed, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useNearbyVenues } from '../../api/venues';
import { NearestCartsCard, SocialReportCallout } from '../../components/explore/ExploreCards';
import { VenueMap, type VenueMapHandle } from '../../components/map/VenueMap';
import { DEFAULT_CENTER, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { useExploreStore, type MapLayers } from '../../store/explore';
import { useAvatarFace } from '../../store/profile';
import { colors, radius, shadow, spacing } from '../../theme';

const TOP_BAR_HEIGHT = 56;
/** Alt kartın yaklaşık yüksekliği; harita odaklaması bu alanın üstüne yapılır */
const BOTTOM_CARD_HEIGHT = 230;
/** Harita bu kadar kaydırılınca "Bu bölgede ara" görünür */
const SEARCH_HERE_THRESHOLD_M = 800;
const NEAREST_CARTS = 3;

export default function ExploreScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<VenueMapHandle>(null);
  const avatarFace = useAvatarFace();

  const location = useUserLocation();
  const { layers, toggleLayer, selectedId, select, searchCenter, setSearchCenter } = useExploreStore(
    useShallow((s) => ({
      layers: s.layers,
      toggleLayer: s.toggleLayer,
      selectedId: s.selectedId,
      select: s.select,
      searchCenter: s.searchCenter,
      setSearchCenter: s.setSearchCenter,
    })),
  );

  // İzin yoksa ya da konum alınamadıysa varsayılan merkez; yalnızca izin cevabı beklenirken null
  const userCenter = location.coords ?? (location.status !== 'pending' ? DEFAULT_CENTER : null);
  const queryCenter = searchCenter ?? userCenter;
  const nearby = useNearbyVenues(queryCenter);
  const all = useMemo(() => nearby.data?.items ?? [], [nearby.data]);

  const visible = useMemo(
    () => all.filter((v) => (v.isMobile ? layers.carts : layers.shops)),
    [all, layers],
  );
  // API mesafeye göre sıralı döner
  const nearestCarts = useMemo(() => all.filter((v) => v.isMobile).slice(0, NEAREST_CARTS), [all]);
  const selected = visible.find((v) => v.id === selectedId) ?? null;

  // İlk konum geldiğinde haritayı kullanıcıya odakla
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (location.coords && !centeredOnUser.current) {
      centeredOnUser.current = true;
      mapRef.current?.focus(location.coords);
    }
  }, [location.coords]);

  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const showSearchHere =
    mapCenter !== null && queryCenter !== null && haversineMeters(mapCenter, queryCenter) > SEARCH_HERE_THRESHOLD_M;

  const focusVenue = useCallback(
    (id: string) => {
      const venue = all.find((v) => v.id === id);
      if (!venue) return;
      // Katmanı kapalı bir mekan seçildiyse (ör. listeden seyyar) katmanı aç
      if (venue.isMobile && !layers.carts) toggleLayer('carts');
      if (!venue.isMobile && !layers.shops) toggleLayer('shops');
      select(id);
      mapRef.current?.focus(venue);
    },
    [all, layers, toggleLayer, select],
  );

  const openVenue = (id: string) => router.push({ pathname: '/venue/[id]', params: { id } });

  const locateMe = async () => {
    const coords = await location.refresh();
    setSearchCenter(null);
    setMapCenter(null);
    mapRef.current?.focus(coords ?? DEFAULT_CENTER, true);
  };

  const searchHere = () => {
    if (!mapCenter) return;
    setSearchCenter(mapCenter);
    setMapCenter(null);
  };

  return (
    <View style={styles.screen}>
      <VenueMap
        ref={mapRef}
        initialCenter={location.coords ?? DEFAULT_CENTER}
        venues={visible}
        selectedId={selected?.id ?? null}
        onSelectVenue={focusVenue}
        onMapPress={() => select(null)}
        user={location.coords ? { ...location.coords, face: avatarFace } : null}
        topInset={insets.top + TOP_BAR_HEIGHT}
        bottomInset={BOTTOM_CARD_HEIGHT}
        onRegionChangeComplete={(center, isGesture) => {
          if (isGesture) setMapCenter(center);
        }}
      />

      {/* Üst: katman çipleri + durum */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.chips} pointerEvents="box-none">
          <LayerChip layer="carts" label={t.explore.carts} color={colors.mobile} layers={layers} onToggle={toggleLayer} />
          <LayerChip layer="shops" label={t.explore.shops} color={colors.shop} layers={layers} onToggle={toggleLayer} />
        </View>
        <View style={styles.topStatus} pointerEvents="box-none">
          {location.status === 'denied' && !searchCenter && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t.map.locationDenied}</Text>
            </View>
          )}
          {showSearchHere && (
            <Pressable onPress={searchHere} style={({ pressed }) => [styles.searchHere, pressed && styles.pressed]}>
              <Search size={15} color={colors.textInverse} />
              <Text style={styles.searchHereText}>{t.map.searchHere}</Text>
            </Pressable>
          )}
          {(nearby.isFetching || queryCenter === null) && !showSearchHere && (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
      </View>

      {/* Alt: konum butonu + özet kartı / seçili mekan balonu */}
      <View style={styles.bottom} pointerEvents="box-none">
        <Pressable
          onPress={locateMe}
          accessibilityLabel={t.map.locateMe}
          style={({ pressed }) => [styles.locate, pressed && styles.pressed]}
        >
          <LocateFixed size={22} color={location.status === 'granted' ? colors.primary : colors.textMuted} />
        </Pressable>

        {nearby.isError && !nearby.data ? (
          <Pressable onPress={() => nearby.refetch()} style={[styles.error, shadow.card]}>
            <Text style={styles.errorText}>{t.map.loadError}</Text>
            <Text style={[styles.errorText, { color: colors.primary, fontWeight: '700' }]}>{t.map.retry}</Text>
          </Pressable>
        ) : selected ? (
          <SocialReportCallout venue={selected} onOpen={openVenue} onClose={() => select(null)} />
        ) : (
          <NearestCartsCard carts={nearestCarts} onPick={focusVenue} />
        )}
      </View>
    </View>
  );
}

function LayerChip({
  layer,
  label,
  color,
  layers,
  onToggle,
}: {
  layer: keyof MapLayers;
  label: string;
  color: string;
  layers: MapLayers;
  onToggle: (layer: keyof MapLayers) => void;
}) {
  const active = layers[layer];
  return (
    <Pressable
      onPress={() => onToggle(layer)}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? color : colors.surface, borderColor: color },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: active ? colors.textInverse : color }]} />
      <Text style={[styles.chipText, { color: active ? colors.textInverse : color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.8 },

  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    ...shadow.pin,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  topStatus: { alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  notice: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  noticeText: { fontSize: 13, fontWeight: '600', color: colors.warning },
  searchHere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.lg,
    height: 38,
    borderRadius: radius.pill,
    ...shadow.card,
  },
  searchHereText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },
  loading: { backgroundColor: colors.surface, borderRadius: radius.pill, padding: 8, ...shadow.pin },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locate: {
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
    marginBottom: spacing.sm,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  error: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  errorText: { fontSize: 14, color: colors.textMuted },
});
