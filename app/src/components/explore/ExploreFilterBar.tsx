import * as Haptics from 'expo-haptics';
import { MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import { DEFAULT_DISTANCE, useExploreStore, type MapLayers } from '../../store/explore';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { ExploreFilterSheet } from './ExploreFilterSheet';

type LayerMode = 'all' | 'carts' | 'shops';

const modeOf = (l: MapLayers): LayerMode => (l.carts && !l.shops ? 'carts' : !l.carts && l.shops ? 'shops' : 'all');

/**
 * Keşfet'in tek satırlık filtre çubuğu:
 *   [Tümü] [🟠 Seyyar] [🔵 Esnaf] [🟢 Açık] [📍 Canlı] [⚙️ Filtrele]
 * Mesafe, fiyat ve yemek kategorisi "Filtrele" panelinde; değiştirilmişse sayı rozeti gösterilir.
 */
export function ExploreFilterBar() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { layers, setLayers, filters, setFilter, distance } = useExploreStore(
    useShallow((s) => ({
      layers: s.layers,
      setLayers: s.setLayers,
      filters: s.filters,
      setFilter: s.setFilter,
      distance: s.distance,
    })),
  );
  const mode = modeOf(layers);
  const setMode = (m: LayerMode) => setLayers({ carts: m !== 'shops', shops: m !== 'carts' });
  // Panelde varsayılandan farklı ayar sayısı
  const sheetCount = Number(distance !== DEFAULT_DISTANCE) + Number(filters.budget) + Number(filters.category !== null);

  const dot = (color: string) => <View style={[styles.dot, { backgroundColor: color }]} />;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label={t.exploreFilters.all} active={mode === 'all'} onPress={() => setMode('all')} role="radio" />
        <Chip label={t.exploreFilters.carts} icon={dot(colors.mobile)} active={mode === 'carts'} onPress={() => setMode('carts')} role="radio" />
        <Chip label={t.exploreFilters.shops} icon={dot(colors.shop)} active={mode === 'shops'} onPress={() => setMode('shops')} role="radio" />
        <View style={styles.divider} />
        <Chip
          label={t.exploreFilters.openShort}
          icon={dot(colors.open)}
          active={filters.openNow}
          onPress={() => setFilter('openNow', !filters.openNow)}
          role="switch"
        />
        <Chip
          label={t.exploreFilters.liveShort}
          icon={<MapPin size={13} color={filters.liveOnly ? colors.textInverse : colors.open} strokeWidth={2.6} />}
          active={filters.liveOnly}
          onPress={() => setFilter('liveOnly', !filters.liveOnly)}
          role="switch"
        />
        <Chip
          label={t.exploreFilters.filter}
          icon={<SlidersHorizontal size={13} color={sheetCount ? colors.textInverse : colors.text} strokeWidth={2.4} />}
          active={sheetCount > 0}
          badge={sheetCount}
          onPress={() => setSheetOpen(true)}
          role="button"
        />
      </ScrollView>
      {sheetOpen && <ExploreFilterSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
  role,
  badge = 0,
}: {
  label: string;
  icon?: ReactNode;
  active: boolean;
  onPress: () => void;
  role: 'radio' | 'switch' | 'button';
  badge?: number;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected: active } : role === 'switch' ? { checked: active } : undefined}
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.pin,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipTextActive: { color: colors.textInverse },
  dot: { width: 9, height: 9, borderRadius: 5 },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 2 },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.8 },
}));
