import type { VenueSummaryDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Award, Navigation2, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { formatDistance, priceSymbol } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { FoodImage } from '../ui/FoodImage';

interface Props {
  venue: VenueSummaryDTO;
  onPress: (id: string) => void;
}

/**
 * Ana sayfa mekan kartı: üstte fotoğraf (mekanın kendi Google fotoğrafı ya da "temsili" yemek görseli; yoksa
 * kategori illüstrasyonu), altta sade bilgi alanı: ad, kategori/semt, açık-kapalı durumu ve yol tarifi.
 */
export const VenueFeedCard = memo(function VenueFeedCard({ venue, onPress }: Props) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const open = venue.isActiveNow || venue.isScheduledOpen;
  const statusLabel = !venue.openStatusKnown
    ? t.status.hoursUnknown
    : open && venue.closesAt
      ? t.status.openUntil(venue.closesAt)
      : !open && venue.opensAt
        ? t.status.closedUntil(venue.opensAt)
        : venue.isMobile && venue.isActiveNow
          ? t.status.activeNow
          : open
            ? t.status.openNow
            : t.status.closed;
  const statusColor = !venue.openStatusKnown ? colors.closed : open ? colors.open : colors.danger;
  const category = venue.liveCategory ? t.liveCategory[venue.liveCategory] : t.venueType[venue.type];

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${formatDistance(venue.distanceMeters)}, ${statusLabel}`}
      style={({ pressed }) => [styles.card, shadow.card, venue.isPromoted && styles.promotedCard, pressed && styles.pressed]}
    >
      <View style={styles.photo}>
        <FoodImage
          uri={venue.coverImageUrl}
          subject={venue.mustTry[0]?.localName}
          type={venue.type}
          isMobile={venue.isMobile}
          style={StyleSheet.absoluteFill}
          emojiSize={36}
        />

        <View style={styles.topRow} pointerEvents="none">
          <View style={styles.pill}>
            <Text style={styles.pillText}>{formatDistance(venue.distanceMeters)}</Text>
          </View>
          <View style={styles.topRight}>
            {/* Ücretli öne çıkarma: "Sponsorlu" ibaresi reklam bildirimi olarak zorunlu */}
            {venue.isPromoted && (
              <View style={[styles.pill, styles.promoPill]} accessibilityLabel={`${t.promoted.badge}, ${t.promoted.sponsored}`}>
                <Award size={12} color="#422006" />
                <Text style={styles.promoText}>
                  {t.promoted.badge} · {t.promoted.sponsored}
                </Text>
              </View>
            )}
            {venue.rating.average !== null && (
              <View style={styles.pill}>
                <Star size={12} color={colors.gold} fill={colors.gold} />
                <Text style={styles.pillText}>{venue.rating.average.toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Görünür atıf: Google fotoğrafı mekanın kendisidir; yemek fotoğrafı ise temsilidir */}
        {venue.coverImageCredit && (
          <Text style={styles.credit} numberOfLines={1}>
            {venue.coverIsRepresentative ? t.detail.photoCredit(venue.coverImageCredit) : t.detail.photoBy(venue.coverImageCredit)}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {venue.priceLevel && <Text style={styles.price}>{`${priceSymbol(venue.priceLevel)}  ·  `}</Text>}
            {category}
            {venue.neighborhood ? `  ·  ${venue.neighborhood}` : ''}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.status, { color: venue.openStatusKnown ? statusColor : colors.textMuted }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
          {venue.tagline && (
            <Text style={styles.tagline} numberOfLines={1}>
              {venue.tagline}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            openDirections(venue.latitude, venue.longitude, venue.name);
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.detail.directions}
        >
          <Navigation2 size={18} color={colors.primary} fill={colors.primary} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles(({ colors }) => ({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 8,
  },
  pressed: { opacity: 0.9 },
  promotedCard: { borderColor: colors.gold, borderWidth: 2 },
  photo: {
    height: 184,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  topRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRight: { alignItems: 'flex-end', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,17,17,0.6)',
  },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  promoPill: { backgroundColor: '#FACC15' },
  promoText: { color: '#422006', fontSize: 11, fontWeight: '800' },
  credit: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '85%',
    fontSize: 10,
    color: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,17,17,0.45)',
    overflow: 'hidden',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  price: { color: colors.open, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13, fontWeight: '700' },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  directions: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
