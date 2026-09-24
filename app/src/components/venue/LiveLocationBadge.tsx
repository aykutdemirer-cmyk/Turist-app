import { liveLocationFreshness } from '@localbite/shared';
import { Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/**
 * Satıcının kendi gönderdiği konumun rozeti (harita balonu ve mekan detayı):
 *  ≤4 sa  → "🟢 Doğrulanmış Canlı Konum" + "📍 Konum 15 dk önce satıcı tarafından güncellendi"
 *  4–12 sa → yalnızca güncelleme satırı
 *  >12 sa → soluk "Son bilinen nokta"
 */
export function LiveLocationBadge({ updatedAt, compact = false }: { updatedAt: string | null | undefined; compact?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const freshness = liveLocationFreshness(updatedAt);
  if (!freshness || !updatedAt) return null;

  const stale = freshness === 'STALE';
  const updated = t.liveLocation.updatedBy(formatRelative(updatedAt));
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="text" accessibilityLabel={`${stale ? t.liveLocation.lastKnown : freshness === 'LIVE' ? t.liveLocation.verified : ''} ${updated}`}>
      {freshness === 'LIVE' && (
        <View style={styles.verified}>
          <View style={[styles.dot, { backgroundColor: colors.open }]} />
          <Text style={styles.verifiedText}>{t.liveLocation.verified}</Text>
        </View>
      )}
      {stale && (
        <View style={styles.stale}>
          <Text style={styles.staleText}>{t.liveLocation.lastKnown}</Text>
        </View>
      )}
      <Text style={[styles.updated, stale && { color: colors.textMuted }]} numberOfLines={2}>
        {updated}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: 4, alignItems: 'flex-start' },
  compact: { gap: 2 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.openSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verifiedText: { fontSize: 12, fontWeight: '800', color: colors.open },
  stale: { backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  staleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  updated: { fontSize: 12, fontWeight: '600', color: colors.text },
}));
