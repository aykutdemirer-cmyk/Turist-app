import type { RatingSummary, ReviewDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { BadgeCheck, CircleCheck, ExternalLink, FlaskConical, Languages, PencilLine } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ApiError } from '../../api/client';
import { useIsBlocked } from '../../api/moderation';
import { useSubmitReview } from '../../api/venues';
import { ContentMenu } from '../moderation/ContentMenu';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useLocale, useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { useCurrentUser } from '../../store/auth';
import { authorColor, makeStyles, radius, spacing, useTheme } from '../../theme';
import { Input } from '../suggest/FormControls';
import { StarPicker, Stars } from '../ui/Stars';

/** Kaynak filtresi: Tümü · Uygulama İncelemeleri · Google */
type SourceFilter = 'ALL' | 'APP' | 'GOOGLE';
const SOURCE_FILTERS: SourceFilter[] = ['ALL', 'APP', 'GOOGLE'];

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
  const [filter, setFilter] = useState<SourceFilter>('ALL');
  const isBlocked = useIsBlocked();
  const visible = reviews.filter((r) => !isBlocked(r.userId));
  const shown = filter === 'ALL' ? visible : visible.filter((r) => r.source === filter);
  const countFor = (f: SourceFilter) => (f === 'ALL' ? visible.length : visible.filter((r) => r.source === f).length);
  const filterLabel = { ALL: t.reviewSource.all, APP: t.reviewSource.app, GOOGLE: t.reviewSource.google };
  // Uyarı yalnızca listede örnek yorum görünüyorsa
  const hasSample = shown.some((r) => r.source === 'SAMPLE');
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

      {visible.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityRole="tablist"
          accessibilityLabel={t.reviewSource.filterLabel}
        >
          {SOURCE_FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filterLabel[f]} · {countFor(f)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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
            // Yeni yorum başka bir kaynak filtresinin arkasında kalmasın
            setFilter('ALL');
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

      {visible.length === 0 ? (
        <Text style={font.small}>{t.reviews.empty}</Text>
      ) : shown.length === 0 ? (
        <Text style={font.small}>{t.reviewSource.emptyFiltered}</Text>
      ) : (
        shown.map((r) => <ReviewCard key={r.id} review={r} isMine={r.userId !== null && r.userId === user?.id} />)
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
          setError(
            err instanceof ApiError && err.code === 'CONTENT_REJECTED'
              ? t.moderation.contentRejected
              : err instanceof ApiError && err.code === 'NETWORK_ERROR'
                ? t.suggest.errors.network
                : t.suggest.errors.failed,
          ),
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
          <View style={styles.authorRow}>
            <Text style={styles.author} numberOfLines={1}>
              {review.authorName}
              {isMine && <Text style={styles.you}>{`  · ${t.reviews.you}`}</Text>}
            </Text>
            {/* Uygulama üyesi: dikkat çekici yeşil rozet */}
            {review.source === 'APP' && (
              <View style={styles.memberBadge}>
                <BadgeCheck size={12} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.memberText}>{t.reviewSource.member}</Text>
              </View>
            )}
          </View>
          <SourceLine review={review} />
          <View style={styles.metaRow}>
            <Stars rating={review.rating} size={12} />
            <Text style={styles.date}>{formatRelative(review.publishedAt)}</Text>
          </View>
        </View>
        <ContentMenu contentType="REVIEW" contentId={review.id} authorId={review.userId} authorName={review.authorName} />
      </View>

      <Text style={styles.text}>{review.text}</Text>

      <View style={styles.footer}>
        {review.isTranslated && (
          <View style={styles.tag}>
            <Languages size={12} color={colors.textMuted} />
            <Text style={styles.tagText}>{t.reviews.translated}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Dış kaynak ve örnek yorumlar: yazarın altında nötr satır (Google'da kaynağa bağlantı, atıf kuralı) */
function SourceLine({ review }: { review: ReviewDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  if (review.source === 'APP') return null;
  const label =
    review.source === 'GOOGLE' ? t.reviewSource.viaGoogle : review.source === 'SAMPLE' ? t.reviews.sampleTag : t.reviewSource.other;
  const link = review.source === 'GOOGLE' && review.sourceUrl;
  return (
    <Pressable
      onPress={link ? () => Linking.openURL(review.sourceUrl!) : undefined}
      disabled={!link}
      hitSlop={6}
      accessibilityRole={link ? 'link' : 'text'}
      style={styles.sourceLine}
    >
      {review.source === 'SAMPLE' ? <FlaskConical size={11} color={colors.textMuted} /> : null}
      <Text style={[styles.sourceText, link && styles.sourceLink]}>{label}</Text>
      {link ? <ExternalLink size={11} color={colors.textMuted} /> : null}
    </Pressable>
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
  author: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.open,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  memberText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  sourceLine: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 1 },
  sourceText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  sourceLink: { textDecorationLine: 'underline' },
  filters: { gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary, fontWeight: '800' },
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
