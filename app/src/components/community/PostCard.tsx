import type { PostDTO, PublicAuthorDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { BadgeCheck, MapPin, MessageCircle, ThumbsUp } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToggleLike } from '../../api/community';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { authorColor, colors, radius, spacing } from '../../theme';

export function AuthorLine({ author, createdAt, size = 36 }: { author: PublicAuthorDTO; createdAt: string; size?: number }) {
  const t = useT();
  return (
    <View style={styles.authorRow}>
      <View style={[styles.initial, { width: size, height: size, borderRadius: size / 2, backgroundColor: authorColor(author.name) }]}>
        <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{author.name.charAt(0)}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={styles.author} numberOfLines={1}>
            {author.name}
          </Text>
          {author.role !== 'USER' && (
            <View style={styles.roleBadge}>
              <BadgeCheck size={12} color={colors.open} />
              <Text style={styles.roleText}>{t.account.roles[author.role]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.date}>{formatRelative(createdAt)}</Text>
      </View>
    </View>
  );
}

/** Gönderi kartı: akışta özet (satır sınırlı), detay ekranında tam metin */
export function PostCard({ post, onPress, full = false }: { post: PostDTO; onPress?: () => void; full?: boolean }) {
  const t = useT();
  const requireAuth = useRequireAuth();
  const like = useToggleLike();

  const toggleLike = () =>
    requireAuth('like', () => {
      Haptics.selectionAsync();
      like.mutate({ id: post.id, liked: !post.likedByMe });
    });

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <AuthorLine author={post.author} createdAt={post.createdAt} />

      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.content} numberOfLines={full ? undefined : 4}>
        {post.content}
      </Text>

      {post.venue && (
        <View style={styles.venueTag}>
          <MapPin size={12} color={colors.primary} />
          <Text style={styles.venueText} numberOfLines={1}>
            {post.venue.name}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable
          onPress={toggleLike}
          hitSlop={8}
          style={[styles.action, post.likedByMe && styles.actionActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
        >
          <ThumbsUp
            size={15}
            color={post.likedByMe ? colors.primary : colors.textMuted}
            fill={post.likedByMe ? colors.primarySoft : 'transparent'}
          />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>
            {t.community.agree} · {post.likeCount}
          </Text>
        </Pressable>
        <View style={styles.action}>
          <MessageCircle size={15} color={colors.textMuted} />
          <Text style={styles.actionText}>{t.community.comments(post.commentCount)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.9 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.textInverse, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  author: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.openSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  roleText: { fontSize: 10, fontWeight: '700', color: colors.open },
  date: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22, marginTop: spacing.xs },
  content: { fontSize: 14, lineHeight: 21, color: colors.text },
  venueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  venueText: { fontSize: 12, fontWeight: '600', color: colors.primary, flexShrink: 1 },
  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  actionActive: { backgroundColor: colors.primarySoft },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  actionTextActive: { color: colors.primary },
});
