import { FOOD_CATEGORIES, type FoodCategory } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { createElement } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { foodCategoryMeta, makeStyles, spacing, useTheme } from '../../theme';

/**
 * Yatay kaydırılan kompakt kategori kartları. Başlık yerel ad, alt başlık kullanıcının dilinde.
 * Seçili karta yeniden dokunmak filtreyi kaldırır.
 */
export function CategoryRail({ value, onChange }: { value: FoodCategory | null; onChange: (next: FoodCategory | null) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Ekran kenarına kadar kaysın; ilk/son kart içerik hizasında dursun
      style={styles.rail}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
      accessibilityLabel={t.foodCategories.label}
    >
      {FOOD_CATEGORIES.map((category) => {
        const meta = foodCategoryMeta[category];
        const active = value === category;
        const subtitle = t.foodCategories[category];
        return (
          <Pressable
            key={category}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(active ? null : category);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${meta.title}, ${subtitle}`}
            style={({ pressed }) => [
              styles.card,
              active ? { backgroundColor: `${meta.color}1A`, borderColor: meta.color } : { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.icon, { backgroundColor: active ? meta.color : `${meta.color}1A` }]}>
              {createElement(meta.Icon, { size: 22, color: active ? '#FFFFFF' : meta.color, strokeWidth: 2.2 })}
            </View>
            <View style={styles.text}>
              <Text style={[styles.title, active && { color: meta.color }]} numberOfLines={1}>
                {meta.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  rail: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 60,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.8 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  text: { maxWidth: 170 },
  title: { fontSize: 14, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
}));
