import { haversineMeters, type LatLng } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { LocateFixed, RotateCcw, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { MAX_RADIUS_M, NEARBY_RADIUS_M, useNearbyVenues } from '../../api/venues';
import { NearestCartsCard, SocialReportCallout } from '../../components/explore/ExploreCards';
import { ExploreFilterBar } from '../../components/explore/ExploreFilterBar';
import { AreaButton } from '../../components/location/AreaPicker';
import { VenueMap, type VenueMapHandle } from '../../components/map/VenueMap';
import { DEFAULT_CENTER, useLocationOrigin } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { applyExploreFilters } from '../../lib/exploreFilter';
import { DEFAULT_DISTANCE, useExploreStore } from '../../store/explore';
import { useAreaStore } from '../../store/area';
import { useAvatarFace } from '../../store/profile';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { LoadErrorCard } from '../../components/ui/LoadErrorCard';

/** Üstteki filtre çubuğu ölçülene kadarki tahmini yükseklik */
const TOP_BAR_ESTIMATE = 96;
/** Alt kartın yaklaşık yüksekliği; harita odaklaması bu alanın üstüne yapılır */
const BOTTOM_CARD_HEIGHT = 230;
/** Harita bu kadar kaydırılınca "Bu bölgede ara" görünür */
const SEARCH_HERE_THRESHOLD_M = 800;
const NEAREST_CARTS = 3;
/** "Konumuma git" sonrası taze konum bu kadar farklıysa harita yeniden odaklanır */
const LOCATE_REFOCUS_M = 30;

export default function ExploreScreen() {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<VenueMapHandle>(null);
  const avatarFace = useAvatarFace();

  const location = useLocationOrigin();
  const { isFallback } = location;
  const { layers, toggleLayer, selectedId, select, searchCenter, setSearchCenter, distance, filters, resetFilters } = useExploreStore(
    useShallow((s) => ({
      layers: s.layers,
      toggleLayer: s.toggleLayer,
      selectedId: s.selectedId,
      select: s.select,
      searchCenter: s.searchCenter,
      setSearchCenter: s.setSearchCenter,
      distance: s.distance,
      filters: s.filters,
      resetFilters: s.resetFilters,
    })),
  );
  const [topHeight, setTopHeight] = useState(TOP_BAR_ESTIMATE);

  // Elle seçilen bölge → GPS → varsayılan merkez; yalnızca ilk konum beklenirken null
  const { manual } = location;
  const queryCenter = searchCenter ?? location.origin;
  // 500 m / 1 km da 3 km'lik ortak önbellekten süzülür; 5 km ve "Tümü" için daha geniş çekilir
  const fetchRadius = distance === null ? MAX_RADIUS_M : Math.max(distance, NEARBY_RADIUS_M);
  const nearby = useNearbyVenues(queryCenter, fetchRadius);

  // Mesafe (Haversine, seçili merkeze göre) + kategori/açık/bütçe/canlı filtreleri; mesafeye göre sıralı
  const all = useMemo(
    () => (queryCenter ? applyExploreFilters(nearby.data?.items ?? [], { origin: queryCenter, maxDistance: distance, ...filters }) : []),
    [nearby.data, queryCenter, distance, filters],
  );
  const filtersActive =
    distance !== DEFAULT_DISTANCE || filters.category !== null || filters.openNow || filters.budget || filters.liveOnly;

  const visible = useMemo(
    () => all.filter((v) => (v.isMobile ? layers.carts : layers.shops)),
    [all, layers],
  );
  const nearestCarts = useMemo(() => all.filter((v) => v.isMobile).slice(0, NEAREST_CARTS), [all]);

  // Mesafe değişince harita daireye sığsın (ilk açılışta kullanıcıya odaklanılır)
  const lastDistance = useRef(distance);
  useEffect(() => {
    if (lastDistance.current === distance) return;
    lastDistance.current = distance;
    mapRef.current?.fitRadius();
  }, [distance]);
  const selected = visible.find((v) => v.id === selectedId) ?? null;

  // İlk konum geldiğinde haritayı kullanıcıya odakla (bölge elle seçildiyse GPS merkezi değiştirmez)
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (location.coords && !manual && !centeredOnUser.current) {
      centeredOnUser.current = true;
      mapRef.current?.focus(location.coords);
    }
  }, [location.coords, manual]);

  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);

  // Bölge seçildiğinde (burada ya da Ana Sayfa'da) harita oraya uçar; "Bu bölgede ara" sıfırlanır
  useEffect(() => {
    if (!manual) return;
    centeredOnUser.current = true;
    setSearchCenter(null);
    requestAnimationFrame(() => setMapCenter(null));
    mapRef.current?.focus(manual, true, true);
  }, [manual, setSearchCenter]);
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

  // "Beni bul": bölge seçimi "Mevcut Konum"a döner. Bilinen konuma hemen uç;
  // taze GPS okuması (en fazla ~10 sn) gelince belirgin fark varsa düzelt
  const locateMe = async () => {
    setSearchCenter(null);
    setMapCenter(null);
    const known = location.coords;
    if (known) mapRef.current?.focus(known, true, true);
    const fresh = await location.followGps();
    if (fresh && (!known || haversineMeters(known, fresh) > LOCATE_REFOCUS_M)) mapRef.current?.focus(fresh, true, true);
    else if (!fresh && !known) mapRef.current?.focus(DEFAULT_CENTER, true, true);
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
        initialCenter={location.origin ?? DEFAULT_CENTER}
        venues={visible}
        selectedId={selected?.id ?? null}
        onSelectVenue={focusVenue}
        onMapPress={() => select(null)}
        user={location.coords ? { ...location.coords, face: avatarFace, label: t.map.youAreHere } : null}
        topInset={topHeight}
        bottomInset={BOTTOM_CARD_HEIGHT}
        onRegionChangeComplete={(center, isGesture) => {
          if (isGesture) setMapCenter(center);
        }}
        radius={queryCenter && { ...queryCenter, meters: distance }}
      />

      {/* Üst: katman çipleri + durum */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        {/* Ölçülen yükseklik: harita odaklaması bu alanın altına yapılır */}
        <View pointerEvents="box-none" onLayout={(e) => setTopHeight(insets.top + spacing.sm + e.nativeEvent.layout.height)}>
          <AreaButton
            style={styles.area}
            onPicked={(center) => {
              // GPS seçildiyse (bölge seçimi efektle ele alınır) haritayı anlık konuma getir
              if (center && !useAreaStore.getState().manual) {
                setSearchCenter(null);
                setMapCenter(null);
                mapRef.current?.focus(center, true, true);
              }
            }}
          />
          <ExploreFilterBar />
        </View>
        <View style={styles.topStatus} pointerEvents="box-none">
          {/* İzin yok ya da GPS kapalı: İstanbul merkezi gösteriliyor; dokununca yeniden dener */}
          {isFallback && !searchCenter && (
            <Pressable onPress={locateMe} style={styles.notice} accessibilityRole="button">
              <Text style={styles.noticeText}>{t.map.locationDenied}</Text>
            </Pressable>
          )}
          {nearby.data && all.length === 0 && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{t.exploreFilters.noResults}</Text>
              {filtersActive && (
                <Pressable onPress={resetFilters} hitSlop={8} style={styles.resetRow} accessibilityRole="button">
                  <RotateCcw size={13} color={colors.primary} />
                  <Text style={styles.resetText}>{t.exploreFilters.reset}</Text>
                </Pressable>
              )}
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
          <LocateFixed size={22} color={location.coords ? colors.primary : colors.textMuted} />
        </Pressable>

        {nearby.isError && !nearby.data ? (
          <LoadErrorCard
            error={nearby.error}
            onRetry={() => nearby.refetch()}
            retrying={nearby.isFetching}
            style={[styles.error, shadow.card]}
          />
        ) : selected ? (
          <SocialReportCallout venue={selected} onOpen={openVenue} onClose={() => select(null)} />
        ) : (
          <NearestCartsCard carts={nearestCarts} onPick={focusVenue} emptyText={filtersActive ? t.exploreFilters.noCarts : undefined} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.8 },

  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  area: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  resetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 },
  resetText: { fontSize: 13, fontWeight: '800', color: colors.primary },
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
    backgroundColor: colors.primary,
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
}));
