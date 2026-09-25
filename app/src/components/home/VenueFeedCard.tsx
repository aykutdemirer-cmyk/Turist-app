import type { VenueSummaryDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Award, MapPin, Navigation2, Star } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { formatDistance, priceSymbol } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { FoodImage } from '../ui/FoodImage';
import { Scrim } from '../ui/Scrim';

interface Props {
  venue: VenueSummaryDTO;
  onPress: (id: string) => void;
}

/** Yol tarifi düğmesi + kenar boşluğu: metin bu genişlikte kesilir, düğmenin altına girmez */
const ACTION_SPACE = 44 + spacing.md;

/**
 * Ana sayfa mekan kartı: fotoğraf kartın tamamını kaplar (öne çıkan yemeğin lisanslı fotoğrafı;
 * yoksa illüstrasyon). Alttaki koyu geçiş üstünde ad, kategori/semt ve tek satır özet; sağ altta yol tarifi.
 */
export const VenueFeedCard = memo(function VenueFeedCard({ venue, onPress }: Props) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const open = venue.isActiveNow || venue.isScheduledOpen;
  const statusLabel = !venue.openStatusKnown
    ? t.status.hoursUnknown
    : venue.isMobile && venue.isActiveNow
      ? t.status.activeNow
      : open
        ? t.status.openNow
        : t.status.closed;

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${formatDistance(venue.distanceMeters)}, ${statusLabel}`}
      style={({ pressed }) => [styles.card, shadow.card, venue.isPromoted && styles.promotedCard, pressed && styles.pressed]}
    >
      <FoodImage
        uri={venue.coverImageUrl}
        subject={venue.mustTry[0]?.localName}
        type={venue.type}
        isMobile={venue.isMobile}
        style={StyleSheet.absoluteFill}
        emojiSize={44}
      />
      <Scrim from={0.3} />

      {/* Üst rozetler */}
      <View style={styles.topRow} pointerEvents="none">
        <View style={styles.pill}>
          <MapPin size={12} color="#FFFFFF" strokeWidth={2.6} />
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
              <Text style={styles.ratingText}>{venue.rating.average.toFixed(1)}</Text>
              <Star size={12} color={colors.gold} fill={colors.gold} />
            </View>
          )}
        </View>
      </View>

      {/* Alt bilgi: sağda yol tarifi düğmesine yer bırakılır */}
      <View style={styles.bottom}>
        <View style={[styles.info, { paddingRight: ACTION_SPACE }]}>
          <View style={[styles.status, open && styles.statusOpen]}>
            <View style={[styles.dot, { backgroundColor: open ? '#BBF7D0' : '#D1D5DB' }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {venue.priceLevel && <Text style={styles.price}>{`${priceSymbol(venue.priceLevel)}  ·  `}</Text>}
            {venue.liveCategory ? t.liveCategory[venue.liveCategory] : t.venueType[venue.type]}
            {venue.neighborhood ? `  ·  ${venue.neighborhood}` : ''}
          </Text>
          {venue.tagline && (
            <Text style={styles.tagline} numberOfLines={1}>
              {venue.tagline}
            </Text>
          )}
          {/* CC lisansı görünür atıf ister; fotoğraf temsilidir (mekanın kendisi değil, yemeği) */}
          {venue.source !== 'LOCALBITE' && (
            <Text style={styles.credit} numberOfLines={1}>
              {t.liveSource[venue.source]}
            </Text>
          )}
          {venue.coverImageCredit && (
            <Text style={styles.credit} numberOfLines={1}>
              {/* Google fotoğrafı mekanın kendisidir; yemek fotoğrafı ise temsilidir */}
              {venue.source === 'LOCALBITE' ? t.detail.photoCredit(venue.coverImageCredit) : t.google.photoBy(venue.coverImageCredit)}
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
  card: {
    height: 272,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.92 },
  promotedCard: { borderColor: colors.gold, borderWidth: 2 },
  topRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRight: { alignItems: 'flex-end', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,17,17,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  promoPill: { backgroundColor: '#FACC15', borderColor: '#EAB308' },
  promoText: { color: '#422006', fontSize: 11, fontWeight: '800' },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  ratingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: 0 },
  info: { gap: 3 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(17,17,17,0.55)',
    marginBottom: 4,
  },
  statusOpen: { backgroundColor: 'rgba(22,163,74,0.92)' },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  name: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  meta: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  price: { color: '#86EFAC', fontWeight: '800' },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 1 },
  credit: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  directions: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
