import type { RatingSummary, ReviewDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { CircleCheck, FlaskConical, Languages, PencilLine } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { useSubmitReview } from '../../api/venues';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useLocale, useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { useCurrentUser } from '../../store/auth';
import { authorColor, makeStyles, radius, spacing, useTheme } from '../../theme';
import { Input } from '../suggest/FormControls';
import { StarPicker, Stars } from '../ui/Stars';

interface Props {
  venueId: string;
  rating: RatingSummary;
  reviews: ReviewDTO[];
}

export function ReviewsSection({ venueId, rating, reviews }: Props) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const user = useCurrentUser();
  const requireAuth = useRequireAuth();
  const [composing, setComposing] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasSample = reviews.some((r) => r.source === 'SAMPLE');
  const mine = user ? reviews.find((r) => r.userId === user.id) : undefined;

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

      {composing ? (
        <ReviewComposer
          venueId={venueId}
          initial={mine}
          onCancel={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            setSaved(true);
          }}
        />
      ) : (
        <Pressable
          onPress={() =>
            requireAuth('review', () => {
              setSaved(false);
              setComposing(true);
            })
          }
          style={({ pressed }) => [styles.writeButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <PencilLine size={16} color={colors.primary} />
          <Text style={styles.writeText}>{mine ? t.reviews.edit : t.reviews.write}</Text>
        </Pressable>
      )}

      {saved && !composing && (
        <View style={styles.savedRow}>
          <CircleCheck size={16} color={colors.open} />
          <Text style={styles.savedText}>{t.reviews.saved}</Text>
        </View>
      )}

      {reviews.length === 0 ? (
        <Text style={font.small}>{t.reviews.empty}</Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} isMine={r.userId !== null && r.userId === user?.id} />)
      )}
    </View>
  );
}

const MIN_REVIEW_LENGTH = 10;

function ReviewComposer({
  venueId,
  initial,
  onCancel,
  onSaved,
}: {
  venueId: string;
  initial?: ReviewDTO;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const locale = useLocale();
  const submit = useSubmitReview(venueId);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [text, setText] = useState(initial?.text ?? '');
  const [error, setError] = useState<string>();

  const send = () => {
    if (rating === 0) return setError(t.reviews.needRating);
    if (text.trim().length < MIN_REVIEW_LENGTH) return setError(t.reviews.tooShort);
    setError(undefined);
    submit.mutate(
      { rating, text: text.trim(), locale },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onSaved();
        },
        onError: (err) =>
          setError(err instanceof ApiError && err.code === 'NETWORK_ERROR' ? t.suggest.errors.network : t.suggest.errors.failed),
      },
    );
  };

  return (
    <View style={styles.composer}>
      <Text style={styles.composerLabel}>{t.reviews.yourRating}</Text>
      <StarPicker value={rating} onChange={setRating} />
      <Input
        value={text}
        onChangeText={setText}
        placeholder={t.reviews.placeholder}
        multiline
        maxLength={1000}
        style={styles.textArea}
        textAlignVertical="top"
        invalid={!!error && text.trim().length < MIN_REVIEW_LENGTH}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.composerActions}>
        <Pressable onPress={onCancel} hitSlop={8} style={styles.cancel}>
          <Text style={styles.cancelText}>{t.reviews.cancel}</Text>
        </Pressable>
        <Pressable
          onPress={send}
          disabled={submit.isPending}
          style={({ pressed }) => [styles.submit, (pressed || submit.isPending) && styles.pressed]}
        >
          {submit.isPending ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={styles.submitText}>{t.reviews.submit}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ReviewCard({ review, isMine }: { review: ReviewDTO; isMine: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.initial, { backgroundColor: authorColor(review.authorName) }]}>
          <Text style={styles.initialText}>{review.authorName.charAt(0)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.author}>
            {review.authorName}
            {isMine && <Text style={styles.you}>{`  · ${t.reviews.you}`}</Text>}
          </Text>
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

const useStyles = makeStyles(({ colors }) => ({
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
  you: { fontSize: 12, fontWeight: '700', color: colors.primary },

  pressed: { opacity: 0.85 },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  writeText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedText: { fontSize: 13, fontWeight: '600', color: colors.open },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  composerLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  textArea: { minHeight: 96, paddingTop: spacing.sm },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  composerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
  cancel: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  cancelText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  submit: {
    minWidth: 130,
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: colors.textInverse, fontWeight: '700', fontSize: 14 },
}));
