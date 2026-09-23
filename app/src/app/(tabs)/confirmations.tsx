import { useRouter } from 'expo-router';
import { ChevronRight, Eye, MapPinPlus } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecentConfirmations } from '../../api/venues';
import { DEFAULT_CENTER, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { formatDistance, formatRelative } from '../../lib/format';
import { useExploreStore } from '../../store/explore';
import { colors, font, radius, shadow, spacing } from '../../theme';

export default function ConfirmationsScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const openSuggest = useExploreStore((s) => s.openSuggest);

  const location = useUserLocation();
  const center = location.coords ?? (location.status !== 'pending' ? DEFAULT_CENTER : null);
  const feed = useRecentConfirmations(center);
  const items = feed.data?.items ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={font.title}>{t.confirmations.title}</Text>
            <Text style={[font.small, styles.subtitle]}>{t.confirmations.subtitle}</Text>
            <Pressable onPress={openSuggest} style={({ pressed }) => [styles.cta, shadow.card, pressed && styles.pressed]}>
              <MapPinPlus size={20} color={colors.textInverse} />
              <Text style={styles.ctaText}>{t.confirmations.spotCta}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{feed.isError ? t.map.loadError : t.confirmations.empty}</Text>
            </View>
          )
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/venue/[id]', params: { id: item.venueId } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Eye size={18} color={colors.textInverse} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {t.confirmations.item(item.venueName)}
              </Text>
              <Text style={styles.rowSub}>
                {formatRelative(item.createdAt)} · {formatDistance(item.distanceMeters)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const Separator = () => <View style={{ height: spacing.sm }} />;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  subtitle: { fontWeight: '400', lineHeight: 19 },
  cta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaText: { flex: 1, color: colors.textInverse, fontWeight: '700', fontSize: 14 },
  loader: { paddingVertical: spacing.xxl },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mobile,
    borderWidth: 2,
    borderColor: colors.mobileAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
});
