import type { VenueSummaryDTO } from '@localbite/shared';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatDistance, priceSymbol } from '../../lib/format';
import { colors, font, radius, shadow, spacing, venueTypeMeta } from '../../theme';
import { Badge } from '../ui/Badge';
import { SpottedLine } from './SpottedLine';

interface Props {
  venue: VenueSummaryDTO;
  width: number;
  selected: boolean;
  onPress: (id: string) => void;
}

export const VenueCard = memo(function VenueCard({ venue, width, selected, onPress }: Props) {
  const t = useT();
  const { Icon, color } = venueTypeMeta[venue.type];
  const accent = venue.isMobile ? colors.mobile : color;

  return (
    <Pressable
      onPress={() => onPress(venue.id)}
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${t.venueType[venue.type]}, ${formatDistance(venue.distanceMeters)}`}
      style={({ pressed }) => [
        styles.card,
        shadow.card,
        { width, borderColor: selected ? accent : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: accent }]}>
          <Icon size={18} color={colors.textInverse} strokeWidth={2.4} />
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {venue.name}
        </Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>

      <View style={styles.badges}>
        <Badge label={t.venueType[venue.type]} color={accent} background={`${accent}1A`} />
        <Badge label={priceSymbol(venue.priceLevel)} color={colors.text} />
        <Badge
          label={formatDistance(venue.distanceMeters)}
          icon={<MapPin size={12} color={colors.textMuted} />}
        />
      </View>

      <SpottedLine {...venue} />

      {venue.mustTry.length > 0 && (
        <Text style={styles.mustTry} numberOfLines={1}>
          {venue.mustTry
            .slice(0, 2)
            .map((d) => d.localName)
            .join(' · ')}
        </Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 2,
  },
  pressed: { opacity: 0.92 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { ...font.heading, flex: 1, fontSize: 16 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mustTry: { ...font.small, fontStyle: 'italic' },
});
