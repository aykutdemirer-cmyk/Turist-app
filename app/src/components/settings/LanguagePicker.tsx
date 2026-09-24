import * as Haptics from 'expo-haptics';
import { Check, ChevronRight, Languages } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_LANGUAGES, useLanguage, useLanguageStore, useT, type AppLanguage } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Profildeki dil satırı; dokununca alttan açılan dil listesi */
export function LanguagePicker() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const language = useLanguage();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const current = APP_LANGUAGES.find((l) => l.code === language) ?? APP_LANGUAGES[0];

  const choose = (code: AppLanguage) => {
    Haptics.selectionAsync();
    if (code !== language) setLanguage(code);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t.language.label}: ${current.name}`}
      >
        <Text style={styles.flag}>{current.flag}</Text>
        <Text style={styles.rowText}>{current.name}</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t.suggest.close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Languages size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{t.language.sheetTitle}</Text>
              <Text style={styles.subtitle}>{t.language.sheetSubtitle}</Text>
            </View>
          </View>

          <View accessibilityRole="radiogroup">
            {APP_LANGUAGES.map((l) => {
              const active = l.code === language;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => choose(l.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                >
                  <Text style={styles.flag}>{l.flag}</Text>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{l.name}</Text>
                  {active && <Check size={20} color={colors.primary} strokeWidth={2.6} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  flag: { fontSize: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.xs },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: '800' },
}));
