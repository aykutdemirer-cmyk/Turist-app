import type { FoodCategory, VenueSummaryDTO } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { LocateOff, Search, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_RADIUS_M, NEARBY_RADIUS_M, useNearbyVenues } from '../../api/venues';
import { CategoryRail } from '../../components/home/CategoryRail';
import { VenueFeedCard } from '../../components/home/VenueFeedCard';
import { AreaButton } from '../../components/location/AreaPicker';
import { ExperienceSection } from '../../components/monetization/ExperienceSection';
import { TrailsSection } from '../../components/monetization/TrailsSection';
import { useLocationOrigin } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { applyExploreFilters } from '../../lib/exploreFilter';
import { distanceLabel } from '../../lib/format';
import { useExploreStore } from '../../store/explore';
import { foodCategoryMeta, makeStyles, radius, spacing, useTheme } from '../../theme';
import { LoadErrorCard } from '../../components/ui/LoadErrorCard';

const normalize = (s: string) => s.toLocaleLowerCase('tr').trim();

function matchesSearch(v: VenueSummaryDTO, query: string) {
  if (!query) return true;
  const haystack = [v.name, v.tagline, v.neighborhood, ...v.mustTry.flatMap((d) => [d.localName, d.name])]
    .filter(Boolean)
    .map((s) => normalize(s as string));
  return haystack.some((s) => s.includes(query));
}

export default function HomeScreen() {
  const { colors, font, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);

  // Elle seçilen bölge, yoksa cihazın anlık GPS konumu; ikisi de yoksa İstanbul merkezi (uyarıyla)
  const { origin, isFallback, refresh } = useLocationOrigin();
  // Keşfet'te seçilen mesafe burada da geçerli (varsayılan 3 km)
  const distance = useExploreStore((s) => s.distance);
  const nearby = useNearbyVenues(origin, distance === null ? MAX_RADIUS_M : Math.max(distance, NEARBY_RADIUS_M));

  const query = normalize(search);
  const venues = useMemo(
    () =>
      // Mesafe cihazdaki konuma göre (Haversine) yeniden hesaplanır ve yakından uzağa sıralanır:
      // kullanıcı yürüdükçe kartlardaki "370 m" yeni istek beklemeden güncellenir
      origin
        ? applyExploreFilters(nearby.data?.items ?? [], {
            origin,
            maxDistance: distance,
            category,
            openNow: false,
            budget: false,
            liveOnly: false,
          }).filter((v) => matchesSearch(v, query))
        : [],
    [nearby.data, origin, distance, category, query],
  );

  const openVenue = (id: string) => router.push({ pathname: '/venue/[id]', params: { id } });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={nearby.isRefetching} onRefresh={() => nearby.refetch()} tintColor={colors.primary} />
        }
      >
        {/* Seçili bölge: dokununca semt seçici / GPS */}
        <AreaButton />

        {/* Arama */}
        <View style={[styles.search, shadow.pin]}>
          <TextInput
            ref={inputRef}
            value={search}
            onChangeText={setSearch}
            placeholder={t.home.searchPlaceholder}
            placeholderTextColor={colors.closed}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel={t.home.clearSearch}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.searchButton} accessibilityLabel={t.home.searchPlaceholder}>
            <Search size={20} color={colors.textInverse} strokeWidth={2.6} />
          </Pressable>
        </View>

        {/* Konum yok: İstanbul merkezine göre listeleniyor; dokununca yeniden dener (izin / GPS) */}
        {isFallback && (
          <Pressable
            onPress={() => refresh()}
            style={({ pressed }) => [styles.locationNotice, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <LocateOff size={16} color={colors.warning} />
            <Text style={styles.locationNoticeText}>{t.map.locationDenied}</Text>
            <Text style={styles.locationRetry}>{t.map.retry}</Text>
          </Pressable>
        )}

        {/* Kategoriler: yatay kaydırılır, seçim listeyi anında süzer */}
        <CategoryRail value={category} onChange={setCategory} />

        {/* En yakın gizli lezzetler */}
        <View style={styles.sectionHeader}>
          <Text style={font.title}>{t.home.nearestTitle}</Text>
          <View style={styles.subtitleRow}>
            {nearby.data && (
              <Text style={font.small}>{t.home.nearestSubtitle(venues.length, distance === null ? null : distanceLabel(distance))}</Text>
            )}
            {category && (
              <Pressable
                onPress={() => setCategory(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${t.foodCategories.clear}: ${foodCategoryMeta[category].title}`}
                style={[styles.filterChip, { borderColor: foodCategoryMeta[category].color }]}
              >
                <Text style={[styles.filterChipText, { color: foodCategoryMeta[category].color }]}>
                  {foodCategoryMeta[category].title}
                </Text>
                <X size={13} color={foodCategoryMeta[category].color} strokeWidth={2.6} />
              </Pressable>
            )}
          </View>
        </View>

        {nearby.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : nearby.isError && !nearby.data ? (
          <LoadErrorCard error={nearby.error} onRetry={() => nearby.refetch()} retrying={nearby.isFetching} />
        ) : venues.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{query ? t.home.noResults(search.trim()) : t.home.empty}</Text>
          </View>
        ) : (
          venues.map((v) => <VenueFeedCard key={v.id} venue={v} onPress={openVenue} />)
        )}

        {/* Rotalar konuma göre değil (şehir geneli): yakındaki mekanlardan sonra */}
        <TrailsSection />

        <ExperienceSection />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, font }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  pressed: { opacity: 0.85 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 5,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: { gap: 2, marginTop: spacing.xs },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  locationNoticeText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.warning },
  locationRetry: { fontSize: 13, fontWeight: '800', color: colors.primary },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '800' },
  loader: { paddingVertical: spacing.xxl },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19 },
}));
