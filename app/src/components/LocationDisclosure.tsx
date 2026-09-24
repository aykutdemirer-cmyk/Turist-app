import { EyeOff, MapPin, ShieldCheck } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { answerLocationDisclosure, useLocationDisclosureStore } from '../hooks/useUserLocation';
import { useT } from '../i18n';
import { makeStyles, radius, spacing, useTheme } from '../theme';

/**
 * Konum izni öncesi açıklama (prominent disclosure). Sistem penceresi yalnızca "Devam Et" sonrası açılır.
 * Geri tuşu / dışarı dokunma "Şimdi değil" sayılır.
 */
export function LocationDisclosure() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const visible = useLocationDisclosureStore((s) => s.visible);
  const d = t.locationDisclosure;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => answerLocationDisclosure(false)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
          <View style={styles.icon}>
            <MapPin size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.body}>{d.body}</Text>

          <View style={styles.points}>
            {d.points.map((point, i) => (
              <View key={point} style={styles.point}>
                {i === 0 ? <EyeOff size={16} color={colors.open} /> : <ShieldCheck size={16} color={colors.open} />}
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => answerLocationDisclosure(true)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{d.continue}</Text>
          </Pressable>
          <Pressable onPress={() => answerLocationDisclosure(false)} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>{d.notNow}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  points: { gap: spacing.sm, marginVertical: spacing.xs },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  primary: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  pressed: { opacity: 0.85 },
  primaryText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
}));
