import { RotateCcw, ServerCrash, WifiOff } from 'lucide-react-native';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { isConnectionError } from '../../api/client';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/**
 * Liste yüklenemediğinde sonsuz spinner yerine: bağlantı hatasında "Sunucuya bağlanılamadı",
 * sunucu hatasında genel mesaj; "Tekrar Dene" sorguyu yeniden çalıştırır.
 */
export function LoadErrorCard({
  error,
  onRetry,
  retrying,
  style,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const offline = isConnectionError(error);
  const Icon = offline ? WifiOff : ServerCrash;

  return (
    <View style={[styles.card, style]} accessibilityRole="alert">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{offline ? t.network.offlineTitle : t.network.serverTitle}</Text>
          <Text style={styles.body}>{offline ? t.network.offlineBody : t.network.serverBody}</Text>
        </View>
      </View>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityState={{ busy: retrying }}
        style={({ pressed }) => [styles.button, (pressed || retrying) && { opacity: 0.7 }]}
      >
        {retrying ? <ActivityIndicator size="small" color={colors.textInverse} /> : <RotateCcw size={16} color={colors.textInverse} />}
        <Text style={styles.buttonText}>{t.network.retry}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.textInverse, fontWeight: '800', fontSize: 14 },
}));
