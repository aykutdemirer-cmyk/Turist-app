import type { TrailStopDTO } from '@localbite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Footprints, Lock, MapPin } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { usePaywall, useTrail } from '../../api/monetization';
import { FoodImage } from '../../components/ui/FoodImage';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { useGoBack } from '../../hooks/useGoBack';

/** Lezzet rotası: sıralı duraklar, her durakta ipucu ve öne çıkan yemekler */
export default function TrailScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const goBack = useGoBack('/');
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: trail, isPending, error, refetch } = useTrail(slug);
  const openPaywall = usePaywall((s) => s.open);
  const locked = error instanceof ApiError && error.code === 'PREMIUM_REQUIRED';

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => goBack()} hitSlop={12} style={styles.back} accessibilityLabel={t.suggest.close}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={font.heading} numberOfLines={1}>
          {t.trails.title}
        </Text>
      </View>

      {isPending ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : locked ? (
        <View style={styles.center}>
          <Lock size={32} color={colors.gold} />
          <Pressable onPress={() => openPaywall(() => refetch())} style={styles.unlock} accessibilityRole="button">
            <Text style={styles.unlockText}>{t.trails.locked}</Text>
          </Pressable>
        </View>
      ) : !trail ? (
        <Pressable onPress={() => refetch()} style={styles.center}>
          <Text style={font.body}>{t.trails.loadError}</Text>
          <Text style={[font.small, { color: colors.primary }]}>{t.map.retry}</Text>
        </Pressable>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <Text style={font.title}>{trail.title}</Text>
          <View style={styles.meta}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{trail.area}</Text>
            <Footprints size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {t.trails.stops(trail.stopCount)} · {t.trails.hours(String(trail.durationMinutes / 60))}
            </Text>
          </View>
          <Text style={styles.description}>{trail.description}</Text>

          <View style={styles.timeline}>
            {trail.stops.map((stop, i) => (
              <StopRow key={stop.position} stop={stop} last={i === trail.stops.length - 1} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StopRow({ stop, last }: { stop: TrailStopDTO; last: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();

  return (
    <View style={styles.stop}>
      <View style={styles.rail}>
        <View style={styles.number}>
          <Text style={styles.numberText}>{stop.position}</Text>
        </View>
        {!last && <View style={styles.line} />}
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/venue/[id]', params: { id: stop.venue.id } })}
        style={({ pressed }) => [styles.stopCard, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
        accessibilityLabel={`${stop.position}. ${stop.venue.name}, ${t.trails.openVenue}`}
      >
        <FoodImage
          uri={stop.venue.coverImageUrl}
          subject={stop.venue.mustTry[0]}
          type={stop.venue.type}
          isMobile={stop.venue.isMobile}
          style={styles.stopImage}
          emojiSize={24}
        />
        <View style={styles.flex}>
          <Text style={styles.stopName} numberOfLines={2}>
            {stop.venue.name}
          </Text>
          {stop.venue.neighborhood && <Text style={styles.metaText}>{stop.venue.neighborhood}</Text>}
          <Text style={styles.note}>{stop.note}</Text>
          {stop.venue.mustTry.length > 0 && <Text style={styles.mustTry}>{stop.venue.mustTry.join(' · ')}</Text>}
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
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
  content: { padding: spacing.lg, gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: spacing.md },
  timeline: { gap: 0 },
  stop: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 30 },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: colors.textInverse, fontWeight: '800' },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  stopCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopImage: { width: 64, height: 64, borderRadius: radius.sm },
  stopName: { fontSize: 15, fontWeight: '800', color: colors.text },
  note: { fontSize: 13, lineHeight: 19, color: colors.text, marginTop: 4 },
  mustTry: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 4 },
  unlock: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary },
  unlockText: { color: colors.textInverse, fontWeight: '800', fontSize: 15 },
}));
