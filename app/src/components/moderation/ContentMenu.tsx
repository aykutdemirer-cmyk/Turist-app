import { CONTENT_REPORT_REASONS, type ContentReportReason, type ReportableContent } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Ban, CircleCheck, EllipsisVertical, Flag } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlockUser, useReportContent } from '../../api/moderation';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { useCurrentUser } from '../../store/auth';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

interface Props {
  contentType: ReportableContent;
  contentId: string;
  /** Yazar üyeyse kimliği (engelleme için); örnek içerikte null */
  authorId: string | null;
  authorName: string;
}

type Step = 'menu' | 'reasons' | 'done';

/**
 * Gönderi, yanıt ve yorum kartlarındaki "…" menüsü: Şikayet et / Kullanıcıyı engelle.
 * Kendi içeriğinde gösterilmez. Misafir önce giriş yapar (şikayet kötüye kullanımını önlemek için).
 */
export function ContentMenu({ contentType, contentId, authorId, authorName }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const requireAuth = useRequireAuth();
  const report = useReportContent();
  const block = useBlockUser();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ContentReportReason | null>(null);
  const [note, setNote] = useState('');

  if (me && authorId === me.id) return null;

  const close = () => {
    setOpen(false);
    setStep('menu');
    setReason(null);
    setNote('');
    report.reset();
  };

  const openMenu = () => {
    Haptics.selectionAsync();
    setOpen(true);
  };

  const startReport = () => {
    setOpen(false);
    requireAuth('moderate', () => {
      setStep('reasons');
      setOpen(true);
    });
  };

  const sendReport = () => {
    if (!reason) return;
    report.mutate(
      { contentType, contentId, reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStep('done');
        },
      },
    );
  };

  const confirmBlock = () => {
    if (!authorId) return;
    setOpen(false);
    requireAuth('moderate', () =>
      Alert.alert(t.moderation.blockTitle(authorName), t.moderation.blockBody, [
        { text: t.moderation.cancel, style: 'cancel' },
        {
          text: t.moderation.blockAction,
          style: 'destructive',
          onPress: () =>
            block.mutate(authorId, {
              onSuccess: () => Alert.alert(t.moderation.blocked(authorName)),
              onError: () => Alert.alert(t.moderation.failed),
            }),
        },
      ]),
    );
  };

  return (
    <>
      <Pressable
        onPress={openMenu}
        hitSlop={10}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={t.moderation.menu}
      >
        <EllipsisVertical size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t.moderation.cancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />

          {step === 'menu' && (
            <>
              <SheetAction icon={<Flag size={20} color={colors.danger} />} label={t.moderation.report} onPress={startReport} danger />
              {authorId && (
                <SheetAction icon={<Ban size={20} color={colors.danger} />} label={t.moderation.block} onPress={confirmBlock} danger />
              )}
              <SheetAction label={t.moderation.cancel} onPress={close} />
            </>
          )}

          {step === 'reasons' && (
            <>
              <Text style={styles.title}>{t.moderation.reportTitle}</Text>
              <View accessibilityRole="radiogroup" style={styles.reasons}>
                {CONTENT_REPORT_REASONS.map((r) => {
                  const active = r === reason;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setReason(r)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[styles.reason, active && styles.reasonActive]}
                    >
                      <View style={[styles.radio, active && styles.radioActive]} />
                      <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{t.moderation.reasons[r]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t.moderation.notePlaceholder}
                placeholderTextColor={colors.closed}
                maxLength={500}
                multiline
                style={styles.note}
              />
              {report.isError && <Text style={styles.error}>{t.moderation.failed}</Text>}
              <Pressable
                onPress={sendReport}
                disabled={!reason || report.isPending}
                style={[styles.submit, (!reason || report.isPending) && styles.disabled]}
                accessibilityRole="button"
              >
                {report.isPending ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.submitText}>{t.moderation.submit}</Text>
                )}
              </Pressable>
              <SheetAction label={t.moderation.cancel} onPress={close} />
            </>
          )}

          {step === 'done' && (
            <View style={styles.done}>
              <CircleCheck size={40} color={colors.open} />
              <Text style={styles.doneText}>{t.moderation.reported}</Text>
              <SheetAction label="OK" onPress={close} />
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

function SheetAction({ icon, label, onPress, danger }: { icon?: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      {icon}
      <Text style={[styles.actionText, danger && styles.actionDanger]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  trigger: { padding: 4, borderRadius: radius.pill },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 52, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 16, fontWeight: '600', color: colors.text },
  actionDanger: { color: colors.danger },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  reasons: { gap: spacing.xs },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reasonActive: { borderColor: colors.danger, backgroundColor: colors.surfaceMuted },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.danger, backgroundColor: colors.danger },
  reasonText: { flex: 1, fontSize: 15, color: colors.text },
  reasonTextActive: { fontWeight: '700' },
  note: {
    minHeight: 60,
    maxHeight: 120,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  submit: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.45 },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  done: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  doneText: { fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center' },
}));
