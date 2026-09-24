import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

export interface Notice {
  kind: 'success' | 'error';
  text: string;
}

export type Notify = (notice: Notice) => void;

/** Kısa süreli sonuç bildirimi (titreşimli); ekranın altında gösterilir */
export function useNotice(durationMs = 2800) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const notify = useCallback<Notify>(
    (n) => {
      Haptics.notificationAsync(n.kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      setNotice(n);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), durationMs);
    },
    [durationMs],
  );
  return [notice, notify] as const;
}

export function NoticeBanner({ notice, bottom }: { notice: Notice | null; bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (!notice) return null;
  const error = notice.kind === 'error';
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, error && styles.noticeError, { bottom: bottom + spacing.lg }]}>
      {error ? <CircleAlert size={18} color={colors.danger} /> : <CircleCheck size={18} color={colors.open} />}
      <Text style={[styles.noticeText, error && { color: colors.danger }]}>{notice.text}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  notice: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.openSoft,
    borderWidth: 1,
    borderColor: colors.open,
  },
  noticeError: { backgroundColor: colors.surface, borderColor: colors.danger },
  noticeText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.open },
}));
