import { useRouter } from 'expo-router';
import { PenSquare } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunityFeed } from '../../api/community';
import { useIsBlocked } from '../../api/moderation';
import { PostCard } from '../../components/community/PostCard';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

export default function CommunityScreen() {
  const { colors, font, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const requireAuth = useRequireAuth();
  const feed = useCommunityFeed();
  const isBlocked = useIsBlocked();
  const posts = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => !isBlocked(p.author.id));

  const compose = () => requireAuth('post', () => router.push('/community/new'));

  return (
    <View style={styles.screen}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()} tintColor={colors.primary} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={font.title}>{t.community.title}</Text>
            <Text style={[font.small, styles.subtitle]}>{t.community.subtitle}</Text>
            {/* Girdi alanı görünümünde: dokununca yazma ekranı açılır (misafire önce giriş) */}
            <Pressable
              onPress={compose}
              style={({ pressed }) => [styles.composer, shadow.pin, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t.community.newPost}
            >
              <View style={styles.composerIcon}>
                <PenSquare size={16} color={colors.primary} />
              </View>
              <Text style={styles.composerText} numberOfLines={1}>
                {t.community.composePlaceholder}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          feed.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <Pressable onPress={() => feed.refetch()} style={styles.empty}>
              <Text style={styles.emptyText}>{feed.isError ? t.community.loadError : t.community.empty}</Text>
              {feed.isError && <Text style={[font.small, { color: colors.primary }]}>{t.map.retry}</Text>}
            </Pressable>
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) => (
          <PostCard post={item} onPress={() => router.push({ pathname: '/community/[id]', params: { id: item.id } })} />
        )}
      />
    </View>
  );
}

const Separator = () => <View style={{ height: spacing.md }} />;

const useStyles = makeStyles(({ colors, font }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  subtitle: { fontWeight: '400', lineHeight: 19 },
  composer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    paddingLeft: 8,
    paddingRight: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  composerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerText: { flex: 1, fontSize: 15, color: colors.closed },
  loader: { paddingVertical: spacing.xl },
  empty: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  emptyText: { ...font.small, fontWeight: '500', lineHeight: 19 },
}));
