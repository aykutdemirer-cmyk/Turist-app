import type { TrailSummaryDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Footprints, Lock, MapPin, Route, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { usePaywall, useTrails } from '../../api/monetization';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

const GRADIENTS: Record<string, [string, string]> = {
  free: ['#9A3412', '#F97316'],
  premium: ['#1F2937', '#B45309'],
};

/** Ana sayfadaki "Özel Lezzet Rotaları": ücretsiz örnek + kilitli premium rotalar */
export function TrailsSection() {
  const styles = useStyles();
  const t = useT();
  const { data } = useTrails();
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.trails.title}</Text>
        <Text style={styles.subtitle}>{t.trails.subtitle}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((trail) => (
          <TrailCard key={trail.slug} trail={trail} />
        ))}
      </ScrollView>
    </View>
  );
}

function TrailCard({ trail }: { trail: TrailSummaryDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const openPaywall = usePaywall((s) => s.open);
  const [from, to] = GRADIENTS[trail.isPremium ? 'premium' : 'free']!;
  const openTrail = () => router.push({ pathname: '/trail/[slug]', params: { slug: trail.slug } });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        // Kilitliyse satış ekranı; satın alınca rota açılır
        if (trail.locked) openPaywall(openTrail);
        else openTrail();
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`${trail.title}. ${trail.locked ? t.trails.locked : t.trails.start}`}
    >
      <View style={styles.cover}>
        <Svg style={styles.fill} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`trail-${trail.slug}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill={`url(#trail-${trail.slug})`} />
        </Svg>
        <Route size={34} color="rgba(255,255,255,0.9)" />
        <View style={[styles.pill, trail.isPremium ? styles.pillPremium : styles.pillFree]}>
          {trail.isPremium ? <Sparkles size={11} color="#1F2937" /> : null}
          <Text style={[styles.pillText, trail.isPremium && { color: '#1F2937' }]}>
            {trail.isPremium ? t.trails.premium : t.trails.free}
          </Text>
        </View>
        {trail.locked && (
          <View style={styles.lock}>
            <Lock size={16} color="#FFFFFF" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {trail.title}
        </Text>
        <View style={styles.meta}>
          <MapPin size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>{trail.area}</Text>
        </View>
        <View style={styles.meta}>
          <Footprints size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {t.trails.stops(trail.stopCount)} · {t.trails.hours(String(trail.durationMinutes / 60))}
          </Text>
        </View>
        <Text style={[styles.cta, trail.locked && { color: colors.gold }]}>{trail.locked ? t.trails.locked : t.trails.start}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { gap: spacing.sm },
  header: { gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  row: { gap: spacing.md, paddingRight: spacing.lg },
  card: {
    width: 250,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cover: { height: 110, alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pill: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: radius.pill,
  },
  pillFree: { backgroundColor: 'rgba(22,163,74,0.95)' },
  pillPremium: { backgroundColor: '#FACC15' },
  pillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  lock: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: 5 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  cta: { fontSize: 13, fontWeight: '800', color: colors.primary, marginTop: 4 },
}));
