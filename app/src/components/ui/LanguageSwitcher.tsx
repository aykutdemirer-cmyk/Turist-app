import { LOCALES, type Locale } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocaleStore, useT } from '../../i18n';
import { colors, radius } from '../../theme';

/** Kompakt TR | EN anahtarı. Seçim SecureStore'a yazılır; arayüz ve API dili anında değişir. */
export function LanguageSwitcher() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const choose = (next: Locale) => {
    if (next === locale) return;
    Haptics.selectionAsync();
    setLocale(next);
  };

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel={t.language.label}>
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <Pressable
            key={l}
            onPress={() => choose(l)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            hitSlop={6}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{l.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: { paddingHorizontal: 12, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  optionActive: { backgroundColor: colors.text },
  text: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  textActive: { color: colors.textInverse },
});
