import { haversineMeters, type LatLng } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { LocateFixed, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useNearbyVenues } from '../../api/venues';
import { FilterChips } from '../../components/filters/FilterChips';
import { VenueMap, type VenueMapHandle } from '../../components/map/VenueMap';
import { VenueCarousel } from '../../components/venue/VenueCarousel';
import { DEFAULT_CENTER, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { useAvatarFace } from '../../store/profile';
import { colors, font, radius, shadow, spacing } from '../../theme';

const CAROUSEL_HEIGHT = 168;
const TOP_BAR_HEIGHT = 56;
const ACTIONS_HEIGHT = 56;
/** Harita bu kadar kaydırılınca "Bu bölgede ara" görünür */
const SEARCH_HERE_THRESHOLD_M = 800;

export default function MapScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<VenueMapHandle>(null);
  const avatarFace = useAvatarFace();

  const location = useUserLocation();
  const { filters, selectedId, select, searchCenter, setSearchCenter } = useExploreStore(
    useShallow((s) => ({
      filters: s.filters,
      selectedId: s.selectedId,
      select: s.select,
      searchCenter: s.searchCenter,
      setSearchCenter: s.setSearchCenter,
    })),
  );

  // İzin yoksa ya da konum alınamadıysa varsayılan merkez; yalnızca izin cevabı beklenirken null
  const userCenter = location.coords ?? (location.status !== 'pending' ? DEFAULT_CENTER : null);
  const queryCenter = searchCenter ?? userCenter;
  const nearby = useNearbyVenues(queryCenter, filters);
  const venues = useMemo(() => nearby.data?.items ?? [], [nearby.data]);

  // İlk konum geldiğinde haritayı kullanıcıya odakla (izin yoksa varsayılan merkezde kalır)
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (location.coords && !centeredOnUser.current) {
      centeredOnUser.current = true;
      mapRef.current?.focus(location.coords);
    }
  }, [location.coords]);

  // Filtre değişince seçili mekan listeden düştüyse en yakını seç
  useEffect(() => {
    if (!nearby.data) return;
    if (!venues.some((v) => v.id === selectedId)) select(venues[0]?.id ?? null);
  }, [nearby.data, venues, selectedId, select]);

  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const showSearchHere =
    mapCenter !== null && queryCenter !== null && haversineMeters(mapCenter, queryCenter) > SEARCH_HERE_THRESHOLD_M;

  const focusVenue = useCallback(
    (id: string) => {
      const venue = venues.find((v) => v.id === id);
      if (!venue) return;
      select(id);
      mapRef.current?.focus(venue);
    },
    [venues, select],
  );

  const openVenue = useCallback(
    (id: string) => {
      select(id);
      router.push({ pathname: '/venue/[id]', params: { id } });
    },
    [router, select],
  );

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

  const topInset = insets.top + TOP_BAR_HEIGHT;
  // Sekme çubuğu alttaki güvenli alanı zaten kaplıyor
  const bottomInset = CAROUSEL_HEIGHT + ACTIONS_HEIGHT;

  return (
    <View style={styles.screen}>
      <VenueMap
        ref={mapRef}
        initialCenter={location.coords ?? DEFAULT_CENTER}
        venues={venues}
        selectedId={selectedId}
        onSelectVenue={focusVenue}
        user={location.coords ? { ...location.coords, face: avatarFace } : null}
        topInset={topInset}
        bottomInset={bottomInset}
        onRegionChangeComplete={(center, isGesture) => {
          if (isGesture) setMapCenter(center);
        }}
      />

      {/* Üst: filtreler + durum */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <FilterChips />
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

      {/* Alt: konum butonu + kartlar */}
      <View style={[styles.bottom, { paddingBottom: spacing.sm }]} pointerEvents="box-none">
        <Pressable
          onPress={locateMe}
          accessibilityLabel={t.map.locateMe}
          style={({ pressed }) => [styles.locate, pressed && styles.pressed]}
        >
          <LocateFixed size={22} color={location.status === 'granted' ? colors.primary : colors.textMuted} />
        </Pressable>

        {nearby.isError && !nearby.data ? (
          <MessageCard text={t.map.loadError} action={t.map.retry} onAction={() => nearby.refetch()} />
        ) : nearby.data && venues.length === 0 ? (
          <MessageCard text={t.map.empty} />
        ) : (
          <View style={{ height: CAROUSEL_HEIGHT }}>
            <VenueCarousel venues={venues} selectedId={selectedId} onSnapTo={focusVenue} onOpen={openVenue} />
          </View>
        )}
      </View>
    </View>
  );
}

function MessageCard({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[styles.message, shadow.card]}>
      <Text style={styles.messageText}>{text}</Text>
      {action && (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}>
          <Text style={styles.messageButtonText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.8 },

  top: { position: 'absolute', top: 0, left: 0, right: 0 },
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
  loading: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 8,
    ...shadow.pin,
  },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locate: {
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
    marginBottom: spacing.xs,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  message: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  messageText: { ...font.body, color: colors.textMuted },
  messageButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  messageButtonText: { color: colors.textInverse, fontWeight: '700' },
});
