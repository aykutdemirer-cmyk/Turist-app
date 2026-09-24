import type { AdminReportDTO, ContentReportReason, DeletionRequestDTO, ReportableContent } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { Check, ChevronLeft, CircleAlert, CircleCheck, Flag, Mail, Trash2, UserX, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminReports, useDeletionRequests, useModerateReport, useProcessDeletion } from '../api/admin';
import { ApiError } from '../api/client';
import { useT } from '../i18n';
import { formatRelative } from '../lib/format';
import { useCurrentUser } from '../store/auth';
import { makeStyles, radius, spacing, useTheme } from '../theme';

type Tab = 'reports' | 'deletions';
type Filter = 'all' | 'comments' | 'posts';

const FILTER_TYPES: Record<Filter, ReportableContent[]> = {
  all: ['POST', 'COMMENT', 'REVIEW'],
  comments: ['COMMENT', 'REVIEW'],
  posts: ['POST'],
};

interface Notice {
  kind: 'success' | 'error';
  text: string;
}

/** Yönetici moderasyonu (web panelindeki /admin ile aynı uç noktalar) */
export default function ModerationScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const [tab, setTab] = useState<Tab>('reports');
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const reports = useAdminReports('PENDING');
  const deletions = useDeletionRequests();
  const pendingDeletions = (deletions.data?.items ?? []).filter((d) => d.status === 'PENDING');

  useEffect(() => () => clearTimeout(timer.current), []);

  // Yalnızca yöneticiler; sunucu da her istekte rolü doğrular
  if (user?.role !== 'ADMIN') return <Redirect href="/profile" />;

  const notify = (n: Notice) => {
    Haptics.notificationAsync(n.kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    setNotice(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 2800);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back} accessibilityLabel={t.suggest.close}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={font.heading}>{t.moderationPanel.title}</Text>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton active={tab === 'reports'} onPress={() => setTab('reports')} label={t.moderationPanel.reports} count={reports.data?.items.length ?? 0} />
        <TabButton active={tab === 'deletions'} onPress={() => setTab('deletions')} label={t.moderationPanel.deletions} count={pendingDeletions.length} />
      </View>

      {tab === 'reports' ? <ReportsTab notify={notify} bottom={insets.bottom} /> : <DeletionsTab notify={notify} bottom={insets.bottom} />}

      {notice && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.notice, notice.kind === 'error' && styles.noticeError, { bottom: insets.bottom + spacing.lg }]}
        >
          {notice.kind === 'success' ? <CircleCheck size={18} color={colors.open} /> : <CircleAlert size={18} color={colors.danger} />}
          <Text style={[styles.noticeText, notice.kind === 'error' && { color: colors.danger }]}>{notice.text}</Text>
        </View>
      )}
    </View>
  );
}

function TabButton({ active, onPress, label, count }: { active: boolean; onPress: () => void; label: string; count: number }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {count > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// Şikayetler
// ─────────────────────────────────────────────

function ReportsTab({ notify, bottom }: { notify: (n: Notice) => void; bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const [filter, setFilter] = useState<Filter>('all');
  const reports = useAdminReports('PENDING');
  const moderate = useModerateReport();
  const all = reports.data?.items ?? [];
  const items = all.filter((r) => FILTER_TYPES[filter].includes(r.contentType));

  const run = (id: string, action: 'remove' | 'dismiss') =>
    moderate.mutate(
      { id, action },
      {
        onSuccess: () => notify({ kind: 'success', text: action === 'remove' ? t.moderationPanel.removed : t.moderationPanel.dismissed }),
        onError: (err) => notify({ kind: 'error', text: err instanceof ApiError ? err.message : t.moderationPanel.failed }),
      },
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={<RefreshControl refreshing={reports.isRefetching} onRefresh={() => reports.refetch()} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={styles.filters} accessibilityRole="radiogroup">
          {(['all', 'comments', 'posts'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="radio"
              accessibilityState={{ selected: filter === f }}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {t.moderationPanel[f]} · {all.filter((r) => FILTER_TYPES[f].includes(r.contentType)).length}
              </Text>
            </Pressable>
          ))}
        </View>
      }
      ListEmptyComponent={
        reports.isPending ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Empty
            icon={reports.isError ? <CircleAlert size={32} color={colors.danger} /> : <Check size={32} color={colors.open} />}
            title={reports.isError ? t.moderationPanel.loadError : t.moderationPanel.noReports}
            body={reports.isError ? undefined : t.moderationPanel.noReportsBody}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => (
        <ReportCard
          report={item}
          busy={moderate.isPending && moderate.variables?.id === item.id ? moderate.variables.action : null}
          disabled={moderate.isPending}
          onRemove={() => run(item.id, 'remove')}
          onDismiss={() => run(item.id, 'dismiss')}
        />
      )}
    />
  );
}

function ReportCard({
  report,
  busy,
  disabled,
  onRemove,
  onDismiss,
}: {
  report: AdminReportDTO;
  busy: 'remove' | 'dismiss' | null;
  disabled: boolean;
  onRemove: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const typeLabel = { POST: t.moderationPanel.post, COMMENT: t.moderationPanel.comment, REVIEW: t.moderationPanel.review }[report.contentType];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{typeLabel}</Text>
        <Text style={styles.cardDate}>{formatRelative(report.firstReportedAt)}</Text>
        <View style={styles.reportCount}>
          <Flag size={11} color={colors.danger} />
          <Text style={styles.reportCountText}>{t.moderationPanel.reportCount(report.reportCount)}</Text>
        </View>
      </View>

      <View style={styles.reasons}>
        {(Object.entries(report.reasons) as [ContentReportReason, number][]).map(([reason, n]) => (
          <View key={reason} style={styles.reason}>
            <Text style={styles.reasonText}>
              {t.moderation.reasons[reason]}
              {n > 1 ? ` ×${n}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {report.content ? (
        <View style={styles.quote}>
          <Text style={styles.quoteAuthor}>
            {report.content.authorName}
            {report.content.removed ? ` · ${t.moderationPanel.removedTag}` : ''}
          </Text>
          <Text style={styles.quoteText} numberOfLines={8}>
            {report.content.text}
          </Text>
        </View>
      ) : (
        <Text style={styles.gone}>{t.moderationPanel.contentGone}</Text>
      )}

      {report.notes.length > 0 && (
        <View style={styles.notes}>
          <Text style={styles.notesTitle}>{t.moderationPanel.notes}</Text>
          {report.notes.map((n, i) => (
            <Text key={i} style={styles.note}>
              • {n}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <ActionButton label={t.moderationPanel.dismiss} icon={<Check size={16} color={colors.text} />} onPress={onDismiss} loading={busy === 'dismiss'} disabled={disabled} />
        <ActionButton
          label={t.moderationPanel.remove}
          icon={<Trash2 size={16} color="#FFFFFF" />}
          onPress={onRemove}
          loading={busy === 'remove'}
          disabled={disabled}
          danger
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Silme talepleri
// ─────────────────────────────────────────────

function DeletionsTab({ notify, bottom }: { notify: (n: Notice) => void; bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const requests = useDeletionRequests();
  const processDeletion = useProcessDeletion();
  const items = (requests.data?.items ?? []).filter((r) => r.status === 'PENDING');

  const run = (r: DeletionRequestDTO, action: 'complete' | 'reject') =>
    processDeletion.mutate(
      { id: r.id, action },
      {
        onSuccess: (res) =>
          notify({
            kind: 'success',
            text:
              action === 'reject'
                ? t.moderationPanel.rejected
                : res.accountDeleted
                  ? t.moderationPanel.completed
                  : t.moderationPanel.completedNoAccount,
          }),
        onError: (err) => notify({ kind: 'error', text: err instanceof ApiError ? err.message : t.moderationPanel.failed }),
      },
    );

  const confirmComplete = (r: DeletionRequestDTO) =>
    Alert.alert(t.moderationPanel.confirmTitle, t.moderationPanel.confirmBody(r.email), [
      { text: t.moderation.cancel, style: 'cancel' },
      { text: t.moderationPanel.confirmAction, style: 'destructive', onPress: () => run(r, 'complete') },
    ]);

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={<RefreshControl refreshing={requests.isRefetching} onRefresh={() => requests.refetch()} tintColor={colors.primary} />}
      ListEmptyComponent={
        requests.isPending ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : (
          <Empty
            icon={requests.isError ? <CircleAlert size={32} color={colors.danger} /> : <Check size={32} color={colors.open} />}
            title={requests.isError ? t.moderationPanel.loadError : t.moderationPanel.noDeletions}
          />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => {
        const busy = processDeletion.isPending && processDeletion.variables?.id === item.id ? processDeletion.variables.action : null;
        return (
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <Mail size={16} color={colors.primary} />
              <Text style={styles.email} selectable>
                {item.email}
              </Text>
            </View>
            <Text style={styles.cardDate}>{formatRelative(item.createdAt)}</Text>
            <Text style={[styles.accountLine, { color: item.accountExists ? colors.open : colors.textMuted }]}>
              {item.accountExists ? t.moderationPanel.accountExists : t.moderationPanel.noAccount}
            </Text>
            {item.note && <Text style={styles.deletionNote}>{item.note}</Text>}
            <View style={styles.actions}>
              <ActionButton
                label={t.moderationPanel.reject}
                icon={<X size={16} color={colors.text} />}
                onPress={() => run(item, 'reject')}
                loading={busy === 'reject'}
                disabled={processDeletion.isPending}
              />
              <ActionButton
                label={t.moderationPanel.complete}
                icon={<UserX size={16} color="#FFFFFF" />}
                onPress={() => confirmComplete(item)}
                loading={busy === 'complete'}
                disabled={processDeletion.isPending}
                danger
              />
            </View>
          </View>
        );
      }}
    />
  );
}

// ─────────────────────────────────────────────
// Ortak parçalar
// ─────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  danger,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  danger?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [styles.action, danger ? styles.actionDanger : styles.actionOutline, (pressed || (disabled && !loading)) && { opacity: 0.6 }]}
    >
      {loading ? <ActivityIndicator size="small" color={danger ? '#FFFFFF' : undefined} /> : icon}
      <Text style={[styles.actionText, danger && { color: '#FFFFFF' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Empty({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.emptyBody}>{body}</Text>}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { padding: spacing.xs },
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.textInverse },
  count: { minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.primary, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cardType: { fontSize: 14, fontWeight: '800', color: colors.text },
  cardDate: { fontSize: 12, color: colors.textMuted },
  reportCount: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  reportCountText: { fontSize: 11, fontWeight: '800', color: colors.danger },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  reasonText: { fontSize: 12, fontWeight: '700', color: colors.warning },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.sm, gap: 4 },
  quoteAuthor: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  quoteText: { fontSize: 14, lineHeight: 20, color: colors.text },
  gone: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  notes: { gap: 2 },
  notesTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  note: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  actionOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionDanger: { backgroundColor: colors.danger },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  email: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  accountLine: { fontSize: 13, fontWeight: '600' },
  deletionNote: { fontSize: 13, color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl * 1.5 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted },
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
