import { Megaphone, Send, Tag as TagIcon, X } from 'lucide-react-native';
import { FlatList, Text, View } from 'react-native';
import { useAdminAnnouncements, useReviewAnnouncement } from '../../api/admin';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { spacing, useTheme } from '../../theme';
import type { Notify } from '../ui/Notice';
import { ActionButton, apiErrorText, ListState, useRefreshControl, Tag, useCardStyles } from './parts';

/** 📢 Satıcı duyuruları: "Yayına Al" ile mekan sayfasında 48 saat görünür */
export function AnnouncementsTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const t = useT();
  const announcements = useAdminAnnouncements('PENDING');
  const refresh = useRefreshControl(announcements);
  const review = useReviewAnnouncement();

  const run = (id: string, decision: 'approve' | 'reject') =>
    review.mutate(
      { id, decision },
      {
        onSuccess: () => notify({ kind: 'success', text: decision === 'approve' ? t.adminCenter.annPublished : t.adminCenter.annRejected }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  return (
    <FlatList
      data={announcements.data?.items ?? []}
      keyExtractor={(a) => a.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListEmptyComponent={<ListState query={announcements} emptyTitle={t.adminCenter.noAnnouncements} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const promo = item.type === 'PROMOTION';
        const busy = review.isPending && review.variables?.id === item.id ? review.variables.decision : null;
        return (
          <View style={styles.card}>
            <View style={styles.header}>
              {promo ? <TagIcon size={16} color={colors.warning} /> : <Megaphone size={16} color={colors.primary} />}
              <Text style={styles.title}>{item.venue.name}</Text>
              <Tag
                label={promo ? t.adminCenter.typePromotion : t.adminCenter.typeAnnouncement}
                color={promo ? colors.warning : colors.primary}
              />
            </View>
            <Text style={styles.sub}>{formatRelative(item.createdAt)}</Text>
            <View style={styles.quote}>
              <Text style={[styles.body, { fontWeight: '800' }]}>{item.title}</Text>
              <Text style={styles.body}>{item.content}</Text>
            </View>
            <View style={styles.actions}>
              <ActionButton
                label={t.adminCenter.reject}
                icon={<X size={16} color={colors.text} />}
                onPress={() => run(item.id, 'reject')}
                loading={busy === 'reject'}
                disabled={review.isPending}
              />
              <ActionButton
                label={t.adminCenter.publish}
                icon={<Send size={16} color="#FFFFFF" />}
                onPress={() => run(item.id, 'approve')}
                loading={busy === 'approve'}
                disabled={review.isPending}
                tone="success"
              />
            </View>
          </View>
        );
      }}
    />
  );
}
