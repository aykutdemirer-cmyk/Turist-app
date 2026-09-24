import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { THEME_NAMES, makeStyles, radius, spacing, themePreview, useTheme, useThemeStore, type ThemeName } from '../../theme';

/** Tema seçici: her seçenek kendi paletiyle küçük bir önizleme çizer */
export function ThemePicker() {
  const { name: current } = useTheme();
  const styles = useStyles();
  const t = useT();
  const setTheme = useThemeStore((s) => s.setTheme);

  const choose = (name: ThemeName) => {
    if (name === current) return;
    Haptics.selectionAsync();
    setTheme(name);
  };

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {THEME_NAMES.map((name) => {
        const p = themePreview(name);
        const active = name === current;
        const label = t.appearance.themes[name];
        return (
          <Pressable
            key={name}
            onPress={() => choose(name)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label.name}
            style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.85 }]}
          >
            {/* Mini önizleme: zemin, kart ve vurgu rengi */}
            <View style={[styles.preview, { backgroundColor: p.bg, borderColor: p.border }]}>
              <View style={[styles.previewCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                <View style={[styles.previewLine, { backgroundColor: p.text, width: '70%' }]} />
                <View style={[styles.previewLine, { backgroundColor: p.textMuted, width: '45%' }]} />
              </View>
              <View style={styles.previewDots}>
                <View style={[styles.dot, { backgroundColor: p.primary }]} />
                <View style={[styles.dot, { backgroundColor: p.gold }]} />
              </View>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{label.name}</Text>
              <Text style={styles.description} numberOfLines={2}>
                {label.description}
              </Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>{active && <Check size={14} color="#FFFFFF" strokeWidth={3} />}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  list: { gap: spacing.sm, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  preview: {
    width: 64,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    justifyContent: 'space-between',
  },
  previewCard: { borderRadius: 5, borderWidth: 1, padding: 4, gap: 3 },
  previewLine: { height: 3, borderRadius: 2 },
  previewDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
