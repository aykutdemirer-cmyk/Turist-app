import type { VenueSummaryDTO, VenueType } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearbyVenues } from '../../api/venues';
import { VenueFeedCard } from '../../components/home/VenueFeedCard';
import { DEFAULT_CENTER, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { colors, font, radius, shadow, spacing, venueTypeMeta } from '../../theme';

/** Ana sayfadaki üç temel kategori */
const HOME_CATEGORIES: VenueType[] = ['HOME_COOKING', 'STREET_CART', 'LOCAL_BURGER_WRAP'];

const normalize = (s: string) => s.toLocaleLowerCase('tr').trim();

function matchesSearch(v: VenueSummaryDTO, query: string) {
  if (!query) return true;
  const haystack = [v.name, v.tagline, v.neighborhood, ...v.mustTry.flatMap((d) => [d.localName, d.name])]
    .filter(Boolean)
    .map((s) => normalize(s as string));
  return haystack.some((s) => s.includes(query));
}

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<VenueType | null>(null);

  const location = useUserLocation();
  const center = location.coords ?? (location.status !== 'pending' ? DEFAULT_CENTER : null);
  const nearby = useNearbyVenues(center);

  const query = normalize(search);
  const venues = useMemo(
    () =>
      (nearby.data?.items ?? []).filter(
        (v) => (!category || v.type === category) && matchesSearch(v, query),
      ),
    [nearby.data, category, query],
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

        {/* Kategoriler */}
        <View style={styles.categories}>
          {HOME_CATEGORIES.map((type) => {
            const meta = venueTypeMeta[type];
            const active = category === type;
            return (
              <Pressable
                key={type}
                onPress={() => setCategory(active ? null : type)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.category,
                  { backgroundColor: active ? meta.color : colors.surface, borderColor: active ? meta.color : colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${meta.color}1A` }]}>
                  <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                </View>
                <Text style={[styles.categoryLabel, active && { color: colors.textInverse }]} numberOfLines={2}>
                  {t.categories[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* En yakın gizli lezzetler */}
        <View style={styles.sectionHeader}>
          <Text style={font.title}>{t.home.nearestTitle}</Text>
          {nearby.data && <Text style={font.small}>{t.home.nearestSubtitle(venues.length)}</Text>}
        </View>

        {nearby.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : nearby.isError && !nearby.data ? (
          <Pressable onPress={() => nearby.refetch()} style={styles.empty}>
            <Text style={styles.emptyText}>{t.map.loadError}</Text>
            <Text style={[styles.emptyText, { color: colors.primary }]}>{t.map.retry}</Text>
          </Pressable>
        ) : venues.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{query ? t.home.noResults(search.trim()) : t.home.empty}</Text>
          </View>
        ) : (
          venues.map((v) => <VenueFeedCard key={v.id} venue={v} onPress={openVenue} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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

  categories: { flexDirection: 'row', gap: spacing.sm },
  category: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  categoryIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  categoryEmoji: { fontSize: 30 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },

  sectionHeader: { gap: 2, marginTop: spacing.xs },
  loader: { paddingVertical: spacing.xxl },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19 },
});
