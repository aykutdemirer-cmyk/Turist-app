import type { CommentDTO } from '@localbite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, SendHorizontal } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useAddComment, usePost } from '../../api/community';
import { useIsBlocked } from '../../api/moderation';
import { ContentMenu } from '../../components/moderation/ContentMenu';
import { AuthorLine, PostCard } from '../../components/community/PostCard';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { useCurrentUser } from '../../store/auth';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { useGoBack } from '../../hooks/useGoBack';

export default function PostDetailScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const goBack = useGoBack('/community');
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: post, isPending, isError, refetch } = usePost(id);
  const isBlocked = useIsBlocked();
  const authorBlocked = !!post && isBlocked(post.author.id);

  // Yazarı buradan engellendiyse gönderi artık gösterilmez
  useEffect(() => {
    if (authorBlocked && router.canGoBack()) router.back();
  }, [authorBlocked, router]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => goBack()} hitSlop={12} style={styles.back} accessibilityLabel={t.suggest.close}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={font.heading}>{t.community.title}</Text>
      </View>

      {isPending ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : isError || !post ? (
        <Pressable onPress={() => refetch()} style={styles.center}>
          <Text style={font.body}>{t.community.postLoadError}</Text>
          <Text style={[font.small, { color: colors.primary }]}>{t.map.retry}</Text>
        </Pressable>
      ) : (
        <>
          <FlatList
            data={post.comments.filter((c) => !isBlocked(c.author.id))}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={styles.header}>
                <PostCard post={post} full />
                <Text style={[font.heading, styles.repliesTitle]}>
                  {t.community.replies} · {post.commentCount}
                </Text>
              </View>
            }
            ListEmptyComponent={<Text style={[font.small, styles.noReplies]}>{t.community.noReplies}</Text>}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => <CommentRow comment={item} />}
          />
          <ReplyBar postId={post.id} bottomInset={insets.bottom} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function CommentRow({ comment }: { comment: CommentDTO }) {
  const styles = useStyles();
  return (
    <View style={styles.comment}>
      <AuthorLine
        author={comment.author}
        createdAt={comment.createdAt}
        size={30}
        menu={
          <ContentMenu contentType="COMMENT" contentId={comment.id} authorId={comment.author.id} authorName={comment.author.name} />
        }
      />
      <Text style={styles.commentText}>{comment.content}</Text>
    </View>
  );
}

/** Misafire giriş düğmesi, üyeye yanıt kutusu */
function ReplyBar({ postId, bottomInset }: { postId: string; bottomInset: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const user = useCurrentUser();
  const requireAuth = useRequireAuth();
  const addComment = useAddComment(postId);
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !addComment.isPending;

  const send = () => {
    if (!canSend) return;
    addComment.mutate(text.trim(), { onSuccess: () => setText('') });
  };

  return (
    <View style={[styles.replyBar, { paddingBottom: bottomInset + spacing.sm }]}>
      {user ? (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.community.replyPlaceholder}
            placeholderTextColor={colors.closed}
            multiline
            maxLength={1000}
            style={styles.replyInput}
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            accessibilityLabel={t.community.send}
          >
            {addComment.isPending ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <SendHorizontal size={18} color={colors.textInverse} />
            )}
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => requireAuth('comment')} style={({ pressed }) => [styles.guestReply, pressed && { opacity: 0.85 }]}>
          <Text style={styles.guestReplyText}>{t.community.replyAsGuest}</Text>
        </Pressable>
      )}
      {addComment.isError && (
        <Text style={styles.error}>
          {addComment.error instanceof ApiError && addComment.error.code === 'CONTENT_REJECTED'
            ? t.moderation.contentRejected
            : t.suggest.errors.failed}
        </Text>
      )}
    </View>
  );
}

const Separator = () => <View style={{ height: spacing.sm }} />;

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  back: { padding: spacing.xs },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: { gap: spacing.lg, marginBottom: spacing.md },
  repliesTitle: { fontSize: 15 },
  noReplies: { fontWeight: '400' },
  comment: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentText: { fontSize: 14, lineHeight: 20, color: colors.text },
  replyBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  replyInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  guestReply: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestReplyText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  error: { width: '100%', color: colors.danger, fontSize: 12, fontWeight: '600' },
}));
