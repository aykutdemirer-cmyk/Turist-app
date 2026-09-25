import { FOOD_CATEGORIES } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { createElement } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useT } from '../../i18n';
import { distanceLabel } from '../../lib/format';
import { DEFAULT_DISTANCE, DISTANCE_OPTIONS, useExploreStore } from '../../store/explore';
import { foodCategoryMeta, makeStyles, radius, spacing, useTheme } from '../../theme';

/** "Filtrele" paneli: mesafe, fiyat ve yemek kategorisi. Seçimler anında uygulanır. */
export function ExploreFilterSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { distance, setDistance, filters, setFilter } = useExploreStore(
    useShallow((s) => ({ distance: s.distance, setDistance: s.setDistance, filters: s.filters, setFilter: s.setFilter })),
  );
  const tap = (fn: () => void) => () => {
    Haptics.selectionAsync();
    fn();
  };
  const clear = () => {
    setDistance(DEFAULT_DISTANCE);
    setFilter('budget', false);
    setFilter('category', null);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.suggest.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>{t.exploreFilters.sheetTitle}</Text>
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clear}>{t.exploreFilters.clearAll}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t.suggest.close}>
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>{t.exploreFilters.distance}</Text>
          <View style={styles.wrap}>
            {DISTANCE_OPTIONS.map((d) => (
              <Option
                key={String(d)}
                label={d === null ? t.exploreFilters.all : distanceLabel(d)}
                active={distance === d}
                onPress={tap(() => setDistance(d))}
              />
            ))}
          </View>

          <Text style={styles.label}>{t.exploreFilters.price}</Text>
          <View style={styles.wrap}>
            <Option label={t.exploreFilters.all} active={!filters.budget} onPress={tap(() => setFilter('budget', false))} />
            <Option label={t.exploreFilters.budget} active={filters.budget} onPress={tap(() => setFilter('budget', true))} />
          </View>

          <Text style={styles.label}>{t.exploreFilters.categories}</Text>
          <View style={styles.wrap}>
            {FOOD_CATEGORIES.map((c) => {
              const meta = foodCategoryMeta[c];
              const active = filters.category === c;
              return (
                <Option
                  key={c}
                  label={meta.title}
                  icon={createElement(meta.Icon, { size: 15, color: active ? '#FFFFFF' : meta.color, strokeWidth: 2.2 })}
                  color={meta.color}
                  active={active}
                  onPress={tap(() => setFilter('category', active ? null : c))}
                />
              );
            })}
          </View>
        </ScrollView>

        <Pressable onPress={onClose} style={({ pressed }) => [styles.apply, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={styles.applyText}>{t.exploreFilters.apply}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Option({
  label,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const fill = color ?? colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.option, active && { backgroundColor: fill, borderColor: fill }, pressed && { opacity: 0.8 }]}
    >
      {icon}
      <Text style={[styles.optionText, active && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  clear: { fontSize: 14, fontWeight: '700', color: colors.primary },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.sm, paddingBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionText: { fontSize: 14, fontWeight: '700', color: colors.text },
  apply: { height: 50, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  applyText: { color: colors.textInverse, fontSize: 15, fontWeight: '800' },
}));
