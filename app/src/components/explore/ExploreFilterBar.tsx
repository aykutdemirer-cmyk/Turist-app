import { FOOD_CATEGORIES } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Clock, Radio, Wallet, type LucideIcon } from 'lucide-react-native';
import { createElement, type ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import { distanceLabel as formatDistanceOption } from '../../lib/format';
import { DISTANCE_OPTIONS, useExploreStore, type DistanceOption } from '../../store/explore';
import { foodCategoryMeta, makeStyles, radius, spacing, useTheme } from '../../theme';

/**
 * Keşfet filtreleri, iki yatay kaydırılan satır:
 *  1) Mesafe: 500 m · 1 km · 3 km · 5 km · Tümü (varsayılan 3 km)
 *  2) Şu an açık · Bütçe · Canlı konum · yemek kategorileri
 */
export function ExploreFilterBar() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const { distance, setDistance, filters, setFilter } = useExploreStore(
    useShallow((s) => ({ distance: s.distance, setDistance: s.setDistance, filters: s.filters, setFilter: s.setFilter })),
  );

  const distanceLabel = (d: DistanceOption) => (d === null ? t.exploreFilters.all : formatDistanceOption(d));

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={t.exploreFilters.distance}>
        {DISTANCE_OPTIONS.map((d) => {
          const active = distance === d;
          return (
            <Pressable
              key={String(d)}
              onPress={() => {
                Haptics.selectionAsync();
                setDistance(d);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.chip, active && styles.distanceActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, active && { color: colors.textInverse }]}>{distanceLabel(d)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Toggle label={t.exploreFilters.openNow} Icon={Clock} color={colors.open} active={filters.openNow} onPress={() => setFilter('openNow', !filters.openNow)} />
        <Toggle label={t.exploreFilters.budget} Icon={Wallet} color={colors.primary} active={filters.budget} onPress={() => setFilter('budget', !filters.budget)} />
        <Toggle label={t.exploreFilters.live} Icon={Radio} color={colors.open} active={filters.liveOnly} onPress={() => setFilter('liveOnly', !filters.liveOnly)} />
        <View style={styles.divider} />
        {FOOD_CATEGORIES.map((c) => {
          const meta = foodCategoryMeta[c];
          const active = filters.category === c;
          return (
            <Toggle
              key={c}
              label={meta.title}
              Icon={meta.Icon}
              color={meta.color}
              active={active}
              onPress={() => setFilter('category', active ? null : c)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function Toggle({
  label,
  Icon,
  color,
  active,
  onPress,
}: {
  label: string;
  Icon: LucideIcon | ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      style={({ pressed }) => [styles.chip, active && { backgroundColor: color, borderColor: color }, pressed && styles.pressed]}
    >
      {createElement(Icon, { size: 14, color: active ? '#FFFFFF' : color, strokeWidth: 2.4 })}
      <Text style={[styles.chipText, active && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  wrap: { gap: spacing.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.pin,
  },
  distanceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },
  pressed: { opacity: 0.8 },
}));
