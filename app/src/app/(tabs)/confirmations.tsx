import type { RecentConfirmationDTO } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { ChevronRight, CircleCheck, Eye, MapPinPlus, Truck } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecentConfirmations } from '../../api/venues';
import { LoadErrorCard } from '../../components/ui/LoadErrorCard';
import { useLocationOrigin } from '../../hooks/useUserLocation';
import { useSpotConfirm } from '../../hooks/useSpotConfirm';
import { useT } from '../../i18n';
import { formatDistance, formatRelative } from '../../lib/format';
import { useExploreStore } from '../../store/explore';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Aynı seyyarın birden çok teyidi tek kartta: en yenisi + toplam sayı */
interface VendorSightings {
  latest: RecentConfirmationDTO;
  count: number;
}

function groupByVenue(items: RecentConfirmationDTO[]): VendorSightings[] {
  const byVenue = new Map<string, VendorSightings>();
  for (const c of items) {
    const g = byVenue.get(c.venueId);
    if (!g) byVenue.set(c.venueId, { latest: c, count: 1 });
    else g.count += 1; // API en yeniden eskiye sıralı döner
  }
  return [...byVenue.values()];
}

export default function ConfirmationsScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const openSuggest = useExploreStore((s) => s.openSuggest);

  const { origin } = useLocationOrigin();
  const feed = useRecentConfirmations(origin);
  const groups = useMemo(() => groupByVenue(feed.data?.items ?? []), [feed.data]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.latest.venueId}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={font.title}>{t.confirmations.title}</Text>
            <Text style={[font.small, styles.subtitle]}>{t.confirmations.subtitle}</Text>
            {/* Kompakt "yeni yer bildir" düğmesi */}
            <Pressable onPress={openSuggest} style={({ pressed }) => [styles.suggest, pressed && styles.pressed]} accessibilityRole="button">
              <MapPinPlus size={16} color={colors.primary} />
              <Text style={styles.suggestText}>{t.confirmations.spotShort}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : feed.isError ? (
            <LoadErrorCard error={feed.error} onRetry={() => feed.refetch()} retrying={feed.isFetching} />
          ) : (
            <View style={styles.empty}>
              <Eye size={28} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t.confirmations.empty}</Text>
            </View>
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => <SightingCard group={item} />}
      />
    </View>
  );
}

function SightingCard({ group }: { group: VendorSightings }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const { latest, count } = group;
  const spot = useSpotConfirm(latest.venueId);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: '/venue/[id]', params: { id: latest.venueId } })}
        style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <View style={styles.icon}>
          <Truck size={18} color={colors.textInverse} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>
            {latest.venueName}
          </Text>
          <Text style={styles.sub}>
            {t.confirmations.seen(formatRelative(latest.createdAt))} · {formatDistance(latest.distanceMeters)}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.cardBottom}>
        <View style={styles.count}>
          <Eye size={13} color={colors.open} />
          <Text style={styles.countText}>{t.confirmations.count(count)}</Text>
        </View>
        {/* Hızlı aksiyon: konum doğrulanarak (≤ 500 m) teyit */}
        <Pressable
          onPress={spot.confirm}
          disabled={spot.busy || spot.done}
          accessibilityRole="button"
          accessibilityState={{ busy: spot.busy, disabled: spot.done }}
          style={({ pressed }) => [styles.confirm, spot.done && styles.confirmDone, (pressed || spot.busy) && styles.pressed]}
        >
          {spot.busy ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : spot.done ? (
            <CircleCheck size={16} color={colors.open} />
          ) : (
            <Eye size={16} color={colors.textInverse} />
          )}
          <Text style={[styles.confirmText, spot.done && { color: colors.open }]}>
            {spot.done ? t.confirmations.confirmDone : t.confirmations.confirmCta}
          </Text>
        </Pressable>
      </View>
      {spot.message && <Text style={styles.message}>{spot.message}</Text>}
    </View>
  );
}

const Separator = () => <View style={{ height: spacing.md }} />;

const useStyles = makeStyles(({ colors, font }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  subtitle: { fontWeight: '400', lineHeight: 19 },
  suggest: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  suggestText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  loader: { paddingVertical: spacing.xxl },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19, textAlign: 'center' },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mobile,
    borderWidth: 2,
    borderColor: colors.mobileAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.openSoft,
  },
  countText: { fontSize: 12, fontWeight: '800', color: colors.open },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.mobile,
  },
  confirmDone: { backgroundColor: colors.openSoft },
  confirmText: { color: colors.textInverse, fontWeight: '800', fontSize: 13 },
  message: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
}));
