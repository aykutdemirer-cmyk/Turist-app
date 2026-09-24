import type { VenueSummaryDTO } from '@localbite/shared';
import { ChevronRight, Eye, MapPin, Quote, Truck, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useT, type Dictionary } from '../../i18n';
import { formatDistance, formatRelative } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme, venueTypeMeta } from '../../theme';
import { Stars } from '../ui/Stars';

/** Seyyarın teyit durumu: "1 dk önce teyit edildi" / "Bugün henüz teyit edilmedi" */
export function confirmationLabel(v: VenueSummaryDTO, t: Dictionary) {
  if (v.spottedTodayCount > 0 && v.lastSpottedAt) return t.spotted.ago(formatRelative(v.lastSpottedAt));
  return t.spotted.never;
}

/** Alt kart: bana en yakın 3 seyyar */
export function NearestCartsCard({ carts, onPick }: { carts: VenueSummaryDTO[]; onPick: (id: string) => void }) {
  const { colors, font, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: colors.mobile }]} />
        <Text style={font.heading}>{t.explore.nearestCarts}</Text>
      </View>
      {carts.length === 0 ? (
        <Text style={styles.muted}>{t.explore.noCarts}</Text>
      ) : (
        carts.map((v, i) => (
          <Pressable
            key={v.id}
            onPress={() => onPick(v.id)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
          >
            <View style={styles.cartIcon}>
              <Truck size={16} color={colors.textInverse} strokeWidth={2.6} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowName} numberOfLines={1}>
                {v.name}
              </Text>
              <Text style={[styles.rowSub, v.spottedTodayCount > 0 && { color: colors.open }]} numberOfLines={1}>
                {confirmationLabel(v, t)}
              </Text>
            </View>
            <Text style={styles.distance}>{formatDistance(v.distanceMeters)}</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        ))
      )}
    </View>
  );
}

/** Pin'e dokununca açılan "Social Lezzet Report" balonu */
export function SocialReportCallout({
  venue,
  onOpen,
  onClose,
}: {
  venue: VenueSummaryDTO;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const accent = venue.isMobile ? colors.mobile : colors.shop;
  const TypeIcon = venueTypeMeta[venue.type].Icon;
  const open = venue.isActiveNow || venue.isScheduledOpen;

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.calloutTop}>
        <View style={[styles.typeIcon, { backgroundColor: accent }]}>
          <TypeIcon size={18} color={colors.textInverse} strokeWidth={2.4} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t.explore.socialReport}</Text>
          <Text style={styles.calloutName} numberOfLines={1}>
            {venue.name}
          </Text>
          <View style={styles.metaRow}>
            <MapPin size={12} color={colors.textMuted} />
            <Text style={styles.rowSub}>{formatDistance(venue.distanceMeters)}</Text>
            <View style={[styles.dot, { backgroundColor: open ? colors.open : colors.closed }]} />
            <Text style={[styles.rowSub, { color: open ? colors.open : colors.textMuted }]}>
              {open ? t.status.openNow : t.status.closed}
            </Text>
          </View>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t.suggest.close}>
          <X size={16} color={colors.text} />
        </Pressable>
      </View>

      {venue.topReview ? (
        <View style={styles.quote}>
          <Quote size={14} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.quoteText} numberOfLines={3}>
              {venue.topReview.text}
            </Text>
            <View style={styles.metaRow}>
              <Stars rating={venue.topReview.rating} size={11} />
              <Text style={styles.rowSub}>
                {venue.topReview.authorName}
                {venue.topReview.source === 'SAMPLE' ? ` · ${t.reviews.sampleTag}` : ''}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.muted}>{t.explore.noReviewYet}</Text>
      )}

      <View style={styles.calloutFooter}>
        <View style={styles.metaRow}>
          <Eye size={14} color={venue.spottedTodayCount > 0 ? colors.open : colors.textMuted} />
          <Text style={styles.rowSub}>{t.explore.confirmations(venue.spottedTodayCount, venue.spottedCount)}</Text>
        </View>
        <Pressable onPress={() => onOpen(venue.id)} style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}>
          <Text style={styles.detailText}>{t.explore.details}</Text>
          <ChevronRight size={16} color={colors.textInverse} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, font }) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  muted: { ...font.small, fontWeight: '500' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  cartIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mobile,
    borderWidth: 2,
    borderColor: colors.mobileAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  distance: { fontSize: 13, fontWeight: '800', color: colors.text },

  calloutTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  calloutName: { fontSize: 16, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quote: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  quoteText: { fontSize: 13, lineHeight: 19, color: colors.text, fontStyle: 'italic' },
  calloutFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primary,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    height: 34,
    borderRadius: radius.pill,
  },
  detailText: { color: colors.textInverse, fontWeight: '700', fontSize: 13 },
}));
