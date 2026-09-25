import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

export interface FormField {
  key: string;
  label: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
}

/**
 * Alttan açılan kısa form: sahiplenme başvurusu, menü önerisi, esnafın yemek eklemesi.
 * Başarıdan sonra teşekkür metni gösterir; hata metnini çağıran belirler.
 */
export function FormSheet({
  title,
  intro,
  fields,
  submitLabel,
  sentText,
  validate,
  onSubmit,
  isPending,
  onClose,
}: {
  title: string;
  intro?: string;
  fields: FormField[];
  submitLabel: string;
  sentText: string;
  validate?: (values: Record<string, string>) => string | null;
  onSubmit: (values: Record<string, string>, done: { onSuccess: () => void; onError: (message: string) => void }) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = () => {
    setError(null);
    const problem = validate?.(values) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(values, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSent(true);
      },
      onError: setError,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.suggest.close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel={t.suggest.close}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {sent ? (
            <View style={styles.body}>
              <Text style={styles.sent}>{sentText}</Text>
              <Pressable onPress={onClose} style={styles.submit} accessibilityRole="button">
                <Text style={styles.submitText}>{t.suggest.close}</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {intro && <Text style={styles.intro}>{intro}</Text>}
              {fields.map((f) => (
                <TextInput
                  key={f.key}
                  value={values[f.key] ?? ''}
                  onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder={f.label}
                  placeholderTextColor={colors.closed}
                  keyboardType={f.keyboardType}
                  multiline={f.multiline}
                  maxLength={f.maxLength}
                  style={[styles.input, f.multiline && styles.multiline]}
                  accessibilityLabel={f.label}
                />
              ))}
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                onPress={submit}
                disabled={isPending}
                style={({ pressed }) => [styles.submit, (pressed || isPending) && { opacity: 0.8 }]}
                accessibilityRole="button"
              >
                {isPending ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.submitText}>{submitLabel}</Text>}
              </Pressable>
            </ScrollView>
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
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.md, paddingBottom: spacing.md },
  intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  multiline: { minHeight: 90, paddingTop: spacing.sm, textAlignVertical: 'top' },
  error: { fontSize: 13, lineHeight: 18, color: colors.danger, fontWeight: '600' },
  submit: { height: 50, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.textInverse, fontSize: 15, fontWeight: '800' },
  sent: { fontSize: 15, lineHeight: 21, color: colors.text, fontWeight: '600' },
}));
