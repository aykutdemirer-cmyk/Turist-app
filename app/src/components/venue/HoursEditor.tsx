import type { PlaceHoursInput } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Copy, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubmitHours } from '../../api/venues';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

interface DayForm {
  closed: boolean;
  open: string;
  close: string;
}

const DEFAULT_DAY: DayForm = { closed: false, open: '09:00', close: '22:00' };
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_CLOCK = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** "930" / "0930" / "9:30" → "09:30"; anlaşılamazsa olduğu gibi (doğrulama yakalar) */
function normalizeClock(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  if (digits.length <= 2 && digits) return `${digits.padStart(2, '0')}:00`;
  return raw;
}

/** Haritadaki (OSM/Google) yer için haftalık saat formu: Pazartesi → Pazar */
export function HoursEditor({ venueId, onClose }: { venueId: string; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const submit = useSubmitHours(venueId);
  const [days, setDays] = useState<DayForm[]>(() => Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY })));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // t.days Pazar'dan başlar; form Pazartesiden
  const dayLabel = (i: number) => t.days[(i + 1) % 7];
  const update = (i: number, patch: Partial<DayForm>) =>
    setDays((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const copyMonday = () => {
    Haptics.selectionAsync();
    setDays((prev) => prev.map(() => ({ ...prev[0]! })));
  };

  const save = () => {
    setError(null);
    const valid = days.every((d) => d.closed || (CLOCK.test(d.open) && CLOSE_CLOCK.test(d.close) && d.open !== d.close));
    if (!valid) {
      setError(t.hours.invalid);
      return;
    }
    const body: PlaceHoursInput = {
      days: days.map((d) => (d.closed ? { closed: true as const } : { closed: false as const, open: d.open, close: d.close })),
    };
    submit.mutate(body, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaved(true);
      },
      onError: () => setError(t.hours.failed),
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.suggest.close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{t.hours.title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t.suggest.close}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {saved ? (
            <View style={styles.done}>
              <Text style={styles.doneText}>{t.hours.saved}</Text>
              <Pressable onPress={onClose} style={styles.save} accessibilityRole="button">
                <Text style={styles.saveText}>{t.suggest.close}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                <Text style={styles.hint}>{t.hours.hint}</Text>
                {days.map((d, i) => (
                  <View key={i} style={styles.row}>
                    <Text style={styles.day}>{dayLabel(i)}</Text>
                    <Switch
                      value={!d.closed}
                      onValueChange={(open) => update(i, { closed: !open })}
                      trackColor={{ true: colors.open, false: colors.border }}
                      accessibilityLabel={`${dayLabel(i)}: ${d.closed ? t.hours.closed : t.hours.open}`}
                    />
                    {d.closed ? (
                      <Text style={styles.closedText}>{t.hours.closed}</Text>
                    ) : (
                      <View style={styles.times}>
                        <TextInput
                          value={d.open}
                          onChangeText={(v) => update(i, { open: v })}
                          onBlur={() => update(i, { open: normalizeClock(d.open) })}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.time}
                          accessibilityLabel={`${dayLabel(i)} ${t.hours.opens}`}
                        />
                        <Text style={styles.dash}>–</Text>
                        <TextInput
                          value={d.close}
                          onChangeText={(v) => update(i, { close: v })}
                          onBlur={() => update(i, { close: normalizeClock(d.close) })}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                          style={styles.time}
                          accessibilityLabel={`${dayLabel(i)} ${t.hours.closes}`}
                        />
                      </View>
                    )}
                  </View>
                ))}
                <Pressable onPress={copyMonday} style={styles.copy} accessibilityRole="button">
                  <Copy size={15} color={colors.primary} />
                  <Text style={styles.copyText}>{t.hours.copyAll}</Text>
                </Pressable>
              </ScrollView>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                onPress={save}
                disabled={submit.isPending}
                style={({ pressed }) => [styles.save, (pressed || submit.isPending) && { opacity: 0.8 }]}
                accessibilityRole="button"
              >
                {submit.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveText}>{t.hours.save}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    maxHeight: '90%',
    gap: spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.sm, paddingBottom: spacing.sm },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  day: { width: 44, fontSize: 15, fontWeight: '800', color: colors.text },
  closedText: { flex: 1, fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  times: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  time: {
    width: 72,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  dash: { fontSize: 16, color: colors.textMuted },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: spacing.sm },
  copyText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  error: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: '600' },
  save: { height: 50, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  saveText: { color: colors.textInverse, fontSize: 15, fontWeight: '800' },
  done: { gap: spacing.md, paddingVertical: spacing.lg },
  doneText: { fontSize: 15, lineHeight: 21, color: colors.text, fontWeight: '600' },
}));
