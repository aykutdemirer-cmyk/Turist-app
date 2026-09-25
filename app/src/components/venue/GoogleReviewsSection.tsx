import type { GooglePlaceDTO } from '@localbite/shared';
import { ExternalLink, Star } from 'lucide-react-native';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/**
 * Dış kaynaklı yerin Google Haritalar puanı ve yorumları. Google şartları gereği atıf ve
 * yazar adları görünür; yorumlar uygulamada saklanmaz (API her gün yeniden çeker).
 */
export function GoogleReviewsSection({ google }: { google: GooglePlaceDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t.google.title}</Text>

      {google.rating !== null && (
        <View style={styles.summary} accessibilityRole="text">
          <Text style={styles.score}>{google.rating.toFixed(1)}</Text>
          <View style={styles.flex}>
            <Stars rating={google.rating} size={16} />
            <Text style={styles.count}>{t.google.ratingCount(google.userRatingCount)}</Text>
          </View>
        </View>
      )}

      {google.reviews.length === 0 ? (
        <Text style={styles.muted}>{t.google.noReviews}</Text>
      ) : (
        google.reviews.map((r, i) => (
          <View key={`${r.authorName}-${i}`} style={styles.card}>
            <View style={styles.cardHead}>
              {r.authorPhotoUrl ? (
                <Image source={{ uri: r.authorPhotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{r.authorName.charAt(0).toLocaleUpperCase('tr')}</Text>
                </View>
              )}
              <View style={styles.flex}>
                <Text
                  style={styles.author}
                  numberOfLines={1}
                  onPress={r.authorUrl ? () => Linking.openURL(r.authorUrl!) : undefined}
                >
                  {r.authorName}
                </Text>
                <View style={styles.metaRow}>
                  <Stars rating={r.rating} size={12} />
                  {r.relativeTime && <Text style={styles.meta}>{r.relativeTime}</Text>}
                </View>
              </View>
            </View>
            <Text style={styles.text}>{r.text}</Text>
          </View>
        ))
      )}

      {/* Zorunlu atıf + kaynağa bağlantı */}
      <View style={styles.footer}>
        <Text style={styles.attribution}>{t.google.attribution}</Text>
        {google.mapsUrl && (
          <Pressable
            onPress={() => Linking.openURL(google.mapsUrl!)}
            hitSlop={8}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}
            accessibilityRole="link"
          >
            <ExternalLink size={14} color={colors.primary} />
            <Text style={styles.linkText}>{t.google.openInMaps}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Stars({ rating, size }: { rating: number; size: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          color={colors.gold}
          fill={rating >= n - 0.25 ? colors.gold : 'transparent'}
          strokeWidth={2}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  section: { marginTop: spacing.xl, gap: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  score: { fontSize: 40, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  count: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  muted: { fontSize: 14, color: colors.textMuted },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  author: { fontSize: 14, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted },
  text: { fontSize: 14, lineHeight: 20, color: colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  attribution: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
}));
