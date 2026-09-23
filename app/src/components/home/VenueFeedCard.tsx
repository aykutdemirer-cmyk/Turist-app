import type { VenueSummaryDTO } from '@localbite/shared';
import { MapPin, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatDistance, priceSymbol } from '../../lib/format';
import { colors, radius, shadow, spacing } from '../../theme';
import { FoodImage } from '../ui/FoodImage';

interface Props {
  venue: VenueSummaryDTO;
  onPress: (id: string) => void;
}

/** Ana sayfadaki mekan kartı: görsel + mesafe/puan rozetleri + ad, fiyat, kısa özet */
export const VenueFeedCard = memo(function VenueFeedCard({ venue, onPress }: Props) {
  const t = useT();
  const open = venue.isActiveNow || venue.isScheduledOpen;

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${formatDistance(venue.distanceMeters)}`}
      style={({ pressed }) => [styles.card, shadow.card, pressed && styles.pressed]}
    >
      <View>
        <FoodImage
          uri={venue.coverImageUrl}
          subject={venue.mustTry[0]?.localName}
          type={venue.type}
          isMobile={venue.isMobile}
          style={styles.image}
          emojiSize={64}
        />
        <View style={[styles.badge, styles.distance]}>
          <MapPin size={12} color={colors.textInverse} strokeWidth={2.6} />
          <Text style={styles.badgeTextLight}>{formatDistance(venue.distanceMeters)}</Text>
        </View>
        {venue.rating.average !== null && (
          <View style={[styles.badge, styles.rating]}>
            <Text style={styles.ratingText}>{venue.rating.average.toFixed(1)}</Text>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
          </View>
        )}
        <View style={[styles.badge, styles.status, { backgroundColor: open ? colors.open : 'rgba(31,26,20,0.65)' }]}>
          <Text style={styles.badgeTextLight}>
            {venue.isMobile && venue.isActiveNow ? t.status.activeNow : open ? t.status.openNow : t.status.closed}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
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
          <Text style={styles.tagline} numberOfLines={2}>
            {venue.tagline}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  pressed: { opacity: 0.9 },
  image: { height: 150, width: '100%' },
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  distance: { top: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(31,26,20,0.75)' },
  rating: { top: spacing.sm, right: spacing.sm, backgroundColor: colors.surface },
  status: { bottom: spacing.sm, left: spacing.sm },
  badgeTextLight: { color: colors.textInverse, fontSize: 12, fontWeight: '700' },
  ratingText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  body: { padding: spacing.md, gap: 4 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  price: { color: colors.open, fontWeight: '800' },
  tagline: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
