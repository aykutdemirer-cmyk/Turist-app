import { VENUE_TYPES, type VenueSummaryDTO, type VenueType } from '@localbite/shared';
import { ArrowRight, ChevronRight, Compass, MapPin, Star } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatDistance, priceSymbol } from '../../lib/format';
import { colors, font, radius, shadow, spacing, venueTypeMeta } from '../../theme';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { AvatarBadge } from '../ui/Avatar';
import { SpottedLine } from '../venue/SpottedLine';

export function HomeHeader({ face, onAvatarPress }: { face: string; onAvatarPress: () => void }) {
  const t = useT();
  return (
    <View style={styles.header}>
      <Pressable onPress={onAvatarPress} accessibilityLabel={t.home.changeAvatar} hitSlop={6}>
        <AvatarBadge face={face} size={52} />
      </Pressable>
      <View style={styles.flex}>
        <Text style={font.title}>{t.home.greeting}</Text>
        <Text style={[font.small, styles.subtitle]}>{t.home.subtitle}</Text>
      </View>
      <LanguageSwitcher />
    </View>
  );
}

export function MapCallout({ count, onPress }: { count: number; onPress: () => void }) {
  const t = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.callout, shadow.card, pressed && styles.pressed]}>
      <View style={styles.calloutIcon}>
        <Compass size={28} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.calloutTitle}>{t.home.mapCardTitle}</Text>
        <Text style={styles.calloutBody}>{t.home.mapCardBody(count)}</Text>
      </View>
      <ArrowRight size={22} color={colors.textInverse} />
    </Pressable>
  );
}

export function CategoryShortcuts({ onPick }: { onPick: (type: VenueType) => void }) {
  const t = useT();
  return (
    <View style={styles.categories}>
      {VENUE_TYPES.map((type) => {
        const meta = venueTypeMeta[type];
        return (
          <Pressable
            key={type}
            onPress={() => onPick(type)}
            style={({ pressed }) => [styles.category, pressed && styles.pressed]}
          >
            <View style={[styles.categoryEmoji, { backgroundColor: `${meta.color}1F` }]}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
            </View>
            <Text style={styles.categoryLabel} numberOfLines={2}>
              {t.categories[type]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, live, action, onAction }: { title: string; live?: boolean; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      {live && <View style={styles.liveDot} />}
      <Text style={[font.heading, styles.flex]}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

export function LiveCartsRow({ venues, onOpen }: { venues: VenueSummaryDTO[]; onOpen: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveRow}>
      {venues.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => onOpen(v.id)}
          style={({ pressed }) => [styles.liveCard, shadow.card, pressed && styles.pressed]}
        >
          <View style={styles.liveTop}>
            <View style={styles.liveIcon}>
              <venueTypeMeta.STREET_CART.Icon size={20} color={colors.textInverse} strokeWidth={2.4} />
            </View>
            <View style={styles.distancePill}>
              <MapPin size={11} color={colors.textMuted} />
              <Text style={styles.distanceText}>{formatDistance(v.distanceMeters)}</Text>
            </View>
          </View>
          <Text style={styles.liveName} numberOfLines={2}>
            {v.name}
          </Text>
          {v.mustTry[0] && (
            <Text style={styles.liveDish} numberOfLines={1}>
              {v.mustTry[0].localName}
            </Text>
          )}
          <SpottedLine {...v} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CanteenRow({ venue, onOpen }: { venue: VenueSummaryDTO; onOpen: (id: string) => void }) {
  const t = useT();
  const meta = venueTypeMeta[venue.type];
  return (
    <Pressable onPress={() => onOpen(venue.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.rowIcon, { backgroundColor: meta.color }]}>
        <meta.Icon size={20} color={colors.textInverse} strokeWidth={2.4} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowName} numberOfLines={1}>
          {venue.name}
        </Text>
        <View style={styles.rowMeta}>
          {venue.rating.average !== null && (
            <>
              <Star size={13} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.rowMetaStrong}>{venue.rating.average.toFixed(1)}</Text>
              <Text style={styles.rowMetaText}>({venue.rating.count})</Text>
              <Text style={styles.rowMetaText}>·</Text>
            </>
          )}
          <Text style={styles.rowMetaText}>{priceSymbol(venue.priceLevel)}</Text>
          <Text style={styles.rowMetaText}>·</Text>
          <Text style={styles.rowMetaText}>{formatDistance(venue.distanceMeters)}</Text>
        </View>
        <Text style={styles.rowDish} numberOfLines={1}>
          {venue.mustTry.map((d) => d.localName).join(' · ')}
        </Text>
      </View>
      <View style={[styles.openBadge, { backgroundColor: venue.isActiveNow ? colors.openSoft : colors.surfaceMuted }]}>
        <Text style={[styles.openText, { color: venue.isActiveNow ? colors.open : colors.textMuted }]}>
          {venue.isActiveNow ? t.status.openNow : t.status.closed}
        </Text>
      </View>
    </Pressable>
  );
}

export function EmptyNote({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  emoji: { fontSize: 24 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  subtitle: { fontWeight: '400', marginTop: 2 },

  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calloutIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTitle: { color: colors.textInverse, fontSize: 17, fontWeight: '800' },
  calloutBody: { color: colors.primarySoft, fontSize: 13, fontWeight: '600', marginTop: 2 },

  categories: { flexDirection: 'row', gap: spacing.sm },
  category: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryEmoji: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center', paddingHorizontal: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.open },
  sectionAction: { flexDirection: 'row', alignItems: 'center' },
  sectionActionText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  liveRow: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  liveCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.openSoft,
  },
  liveTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mobile,
    borderWidth: 2,
    borderColor: colors.mobileAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  distanceText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  liveName: { fontSize: 15, fontWeight: '700', color: colors.text },
  liveDish: { ...font.small, fontStyle: 'italic' },

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
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowMetaStrong: { fontSize: 13, fontWeight: '700', color: colors.text },
  rowMetaText: { fontSize: 13, color: colors.textMuted },
  rowDish: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  openBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  openText: { fontSize: 11, fontWeight: '700' },

  empty: {
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19 },
});
