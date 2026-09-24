import type { UseQueryResult } from '@tanstack/react-query';
import { Check, CircleAlert } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { useT, type Dictionary } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

export const apiErrorText = (err: unknown, t: Dictionary) => (err instanceof ApiError ? err.message : t.adminCenter.failed);

export function ActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  tone = 'outline',
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  tone?: 'outline' | 'danger' | 'success';
}) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const filled = tone !== 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.action,
        tone === 'outline' && styles.actionOutline,
        tone === 'danger' && { backgroundColor: colors.danger },
        tone === 'success' && { backgroundColor: colors.open },
        (pressed || (disabled && !loading)) && { opacity: 0.6 },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={filled ? '#FFFFFF' : undefined} /> : icon}
      <Text style={[styles.actionText, filled && { color: '#FFFFFF' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  const styles = useCardStyles();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.emptyBody}>{body}</Text>}
    </View>
  );
}

/** Liste boşken: yükleniyor / hata / "hepsi temiz" */
export function ListState({ query, emptyTitle, emptyBody }: { query: UseQueryResult; emptyTitle: string; emptyBody?: string }) {
  const { colors } = useTheme();
  const t = useT();
  if (query.isPending) return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />;
  return (
    <Empty
      icon={query.isError ? <CircleAlert size={32} color={colors.danger} /> : <Check size={32} color={colors.open} />}
      title={query.isError ? t.adminCenter.loadError : emptyTitle}
      body={query.isError ? undefined : emptyBody}
    />
  );
}

/**
 * Aşağı çekip yenile. Bileşen değil öğe döndürür: Android'de ScrollView, refreshControl öğesini kopyalayıp
 * listeyi onun çocuğu yapar; araya giren bir sarmalayıcı bileşen listeyi yutar.
 */
export function useRefreshControl(query: UseQueryResult) {
  const { colors } = useTheme();
  return <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />;
}

export function Tag({ label, color }: { label: string; color: string }) {
  const styles = useCardStyles();
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export const useCardStyles = makeStyles(({ colors }) => ({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  separator: { height: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, flexShrink: 1 },
  sub: { fontSize: 12, color: colors.textMuted },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  actionOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl * 1.5 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
