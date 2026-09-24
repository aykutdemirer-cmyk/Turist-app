import type { VenueSummaryDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Award, MapPin, Navigation2, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
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
 * Ana sayfa mekan kartı: 16:9 kapak (mesafe, puan ve durum rozetleriyle),
 * altında ad, kategori/semt satırı, tek satır lezzet özeti ve yol tarifi düğmesi.
 */
export const VenueFeedCard = memo(function VenueFeedCard({ venue, onPress }: Props) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const open = venue.isActiveNow || venue.isScheduledOpen;
  const statusLabel = venue.isMobile && venue.isActiveNow ? t.status.activeNow : open ? t.status.openNow : t.status.closed;

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${formatDistance(venue.distanceMeters)}, ${statusLabel}`}
      style={({ pressed }) => [styles.card, shadow.card, venue.isPromoted && styles.promotedCard, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        <FoodImage
          uri={venue.coverImageUrl}
          subject={venue.mustTry[0]?.localName}
          type={venue.type}
          isMobile={venue.isMobile}
          style={styles.image}
          emojiSize={40}
        />

        <View style={[styles.pill, styles.topLeft]}>
          <MapPin size={12} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.pillText}>{formatDistance(venue.distanceMeters)}</Text>
        </View>

        {/* Ücretli öne çıkarma: "Sponsorlu" ibaresi reklam bildirimi olarak zorunlu */}
        {venue.isPromoted && (
          <View style={[styles.pill, styles.topRight, styles.promoPill]} accessibilityLabel={`${t.promoted.badge}, ${t.promoted.sponsored}`}>
            <Award size={12} color="#422006" />
            <Text style={styles.promoText}>
              {t.promoted.badge} · {t.promoted.sponsored}
            </Text>
          </View>
        )}

        {venue.rating.average !== null && (
          <View style={[styles.pill, venue.isPromoted ? styles.bottomRight : styles.topRight]}>
            <Text style={styles.ratingText}>{venue.rating.average.toFixed(1)}</Text>
            <Star size={12} color={colors.gold} fill={colors.gold} />
          </View>
        )}

        <View style={[styles.pill, styles.bottomLeft, open && { backgroundColor: 'rgba(22,163,74,0.92)' }]}>
          <View style={[styles.dot, { backgroundColor: open ? '#BBF7D0' : '#D1D5DB' }]} />
          <Text style={styles.pillText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            <Text style={styles.price}>{priceSymbol(venue.priceLevel)}</Text>
            {'  ·  '}
            {t.venueType[venue.type]}
            {venue.neighborhood ? `  ·  ${venue.neighborhood}` : ''}
          </Text>
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
          <Navigation2 size={18} color={colors.textInverse} fill={colors.textInverse} />
        </Pressable>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles(({ colors }) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg + 2, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.9 },
  cover: { margin: 6, marginBottom: 0, borderRadius: radius.lg - 2, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  topLeft: { top: spacing.sm + 2, left: spacing.sm + 2 },
  topRight: { top: spacing.sm + 2, right: spacing.sm + 2 },
  bottomLeft: { bottom: spacing.sm + 2, left: spacing.sm + 2 },
  bottomRight: { bottom: spacing.sm + 2, right: spacing.sm + 2 },
  promotedCard: { borderColor: colors.gold, borderWidth: 2 },
  promoPill: { backgroundColor: '#FACC15', borderColor: '#EAB308' },
  promoText: { color: '#422006', fontSize: 11, fontWeight: '800' },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  ratingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg - 2 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  price: { color: colors.open, fontWeight: '800' },
  tagline: { fontSize: 14, color: colors.text, opacity: 0.85, marginTop: 1 },
  directions: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
