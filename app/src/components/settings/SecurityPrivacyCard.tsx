import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, FileText, ShieldCheck, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useDeleteAccount } from '../../api/auth';
import { useBlockedUsers, useUnblockUser } from '../../api/moderation';
import { useT } from '../../i18n';
import { useCurrentUser } from '../../store/auth';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Profil › Güvenlik ve Gizlilik: yasal metinler, engellenenler, hesap silme */
export function SecurityPrivacyCard() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const user = useCurrentUser();
  const deleteAccount = useDeleteAccount();

  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t.privacy.deleteTitle, t.privacy.deleteBody, [
      { text: t.moderation.cancel, style: 'cancel' },
      {
        text: t.privacy.deleteConfirm,
        style: 'destructive',
        onPress: () =>
          deleteAccount.mutate(undefined, {
            onSuccess: () => Alert.alert(t.privacy.deleted),
            onError: () => Alert.alert(t.privacy.deleteFailed),
          }),
      },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ShieldCheck size={18} color={colors.primary} />
        <Text style={styles.title}>{t.privacy.title}</Text>
      </View>

      <LinkRow label={t.legal.terms} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
      <LinkRow label={t.legal.privacy} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />

      {user && (
        <>
          <BlockedUsers />
          <Pressable
            onPress={confirmDelete}
            disabled={deleteAccount.isPending}
            style={({ pressed }) => [styles.delete, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <Trash2 size={18} color={colors.danger} />
                <Text style={styles.deleteText}>{t.privacy.deleteAccount}</Text>
              </>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="link">
      <FileText size={16} color={colors.textMuted} />
      <Text style={styles.rowText}>{label}</Text>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function BlockedUsers() {
  const styles = useStyles();
  const t = useT();
  const { data } = useBlockedUsers();
  const unblock = useUnblockUser();
  const items = data?.items ?? [];

  return (
    <View style={styles.blocked}>
      <Text style={styles.subTitle}>{t.moderation.blockedUsers}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{t.moderation.noBlocked}</Text>
      ) : (
        items.map((b) => (
          <View key={b.id} style={styles.blockedRow}>
            <Text style={styles.rowText}>{b.name}</Text>
            <Pressable
              onPress={() => unblock.mutate(b.id)}
              disabled={unblock.isPending}
              hitSlop={8}
              style={styles.unblock}
              accessibilityRole="button"
            >
              <Text style={styles.unblockText}>{t.moderation.unblock}</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowText: { flex: 1, fontSize: 15, color: colors.text },
  blocked: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  empty: { fontSize: 13, color: colors.textMuted },
  blockedRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  unblock: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  unblockText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
}));
