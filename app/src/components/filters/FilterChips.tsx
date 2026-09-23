import { VENUE_TYPES, type VenueType } from '@localbite/shared';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { colors, radius, shadow, spacing, venueTypeMeta } from '../../theme';

export function FilterChips() {
  const t = useT();
  const { filters, toggleFilter, toggleCategory } = useExploreStore(
    useShallow((s) => ({ filters: s.filters, toggleFilter: s.toggleFilter, toggleCategory: s.toggleCategory })),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <Chip emoji="🟢" label={t.filters.openNow} active={filters.openNow} onPress={() => toggleFilter('openNow')} />
      {VENUE_TYPES.map((type: VenueType) => (
        <Chip
          key={type}
          emoji={venueTypeMeta[type].emoji}
          label={t.categories[type]}
          active={filters.categories.includes(type)}
          onPress={() => toggleCategory(type)}
        />
      ))}
      <Chip emoji="💵" label={t.filters.budget} active={filters.budget} onPress={() => toggleFilter('budget')} />
    </ScrollView>
  );
}

function Chip({ emoji, label, active, onPress }: { emoji: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.pin,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { opacity: 0.8 },
  emoji: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  labelActive: { color: colors.textInverse },
});
