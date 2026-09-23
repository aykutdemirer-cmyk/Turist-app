import { MapPinPlus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { colors, font, radius, spacing } from '../../theme';

/**
 * Sekme basışı normalde yakalanıp modal açılır (bkz. (tabs)/_layout.tsx).
 * Bu ekran yalnızca derin bağlantıyla (localbite://spot) gelindiğinde görünür.
 */
export default function SpotScreen() {
  const t = useT();
  const openSuggest = useExploreStore((s) => s.openSuggest);

  return (
    <View style={styles.screen}>
      <MapPinPlus size={48} color={colors.primary} />
      <Text style={[font.title, styles.center]}>{t.suggest.title}</Text>
      <Text style={[font.body, styles.center, { color: colors.textMuted }]}>{t.suggest.subtitle}</Text>
      <Pressable onPress={openSuggest} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
        <Text style={styles.buttonText}>{t.tabs.spot}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.bg },
  center: { textAlign: 'center' },
  button: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, height: 48, borderRadius: radius.md, justifyContent: 'center' },
  buttonText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
});
