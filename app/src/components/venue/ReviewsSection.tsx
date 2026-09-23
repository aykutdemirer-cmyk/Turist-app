import type { RatingSummary, ReviewDTO } from '@localbite/shared';
import { FlaskConical, Languages } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { colors, font, radius, spacing } from '../../theme';
import { Stars } from '../ui/Stars';

const AVATAR_COLORS = ['#C2410C', '#7C3AED', '#0F766E', '#B45309', '#DB2777', '#1D4ED8'];

/** Yazar adından sabit bir renk (aynı kişi hep aynı renkte) */
function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ReviewsSection({ rating, reviews }: { rating: RatingSummary; reviews: ReviewDTO[] }) {
  const t = useT();
  const hasSample = reviews.some((r) => r.source === 'SAMPLE');

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[font.heading, styles.flex]}>{t.reviews.title}</Text>
        {rating.average !== null && (
          <View style={styles.summary}>
            <Text style={styles.average}>{rating.average.toFixed(1)}</Text>
            <View>
              <Stars rating={rating.average} size={12} />
              <Text style={styles.count}>{t.reviews.count(rating.count)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Örnek veri gerçek yorum gibi sunulmaz */}
      {hasSample && (
        <View style={styles.notice}>
          <FlaskConical size={14} color={colors.warning} />
          <Text style={styles.noticeText}>{t.reviews.sampleNotice}</Text>
        </View>
      )}

      {reviews.length === 0 ? (
        <Text style={font.small}>{t.reviews.empty}</Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} />)
      )}
    </View>
  );
}

function ReviewCard({ review }: { review: ReviewDTO }) {
  const t = useT();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.initial, { backgroundColor: colorFor(review.authorName) }]}>
          <Text style={styles.initialText}>{review.authorName.charAt(0)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.author}>{review.authorName}</Text>
          <View style={styles.metaRow}>
            <Stars rating={review.rating} size={12} />
            <Text style={styles.date}>{formatRelative(review.publishedAt)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.text}>{review.text}</Text>

      <View style={styles.footer}>
        {review.isTranslated && (
          <View style={styles.tag}>
            <Languages size={12} color={colors.textMuted} />
            <Text style={styles.tagText}>{t.reviews.translated}</Text>
          </View>
        )}
        {review.source === 'GOOGLE' && review.sourceUrl && (
          <Pressable onPress={() => Linking.openURL(review.sourceUrl!)} hitSlop={6}>
            <Text style={styles.attribution}>Google</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  average: { fontSize: 24, fontWeight: '800', color: colors.text },
  count: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.warning, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  initial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.textInverse, fontWeight: '800', fontSize: 15 },
  author: { fontSize: 14, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  date: { fontSize: 12, color: colors.textMuted },
  text: { fontSize: 14, lineHeight: 21, color: colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tagText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  attribution: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'underline' },
});
