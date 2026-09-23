import type { ReportType, ScheduleDTO, VenueDetailDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, Clock, Eye, Info, Leaf, MapPin, Navigation, ThumbsUp, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useReportVenue, useVenue } from '../../api/venues';
import { Badge } from '../../components/ui/Badge';
import { SpottedLine } from '../../components/venue/SpottedLine';
import { getPreciseLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { ReviewsSection } from '../../components/venue/ReviewsSection';
import { openDirections } from '../../lib/directions';
import { priceSymbol } from '../../lib/format';
import { colors, font, radius, spacing, venueTypeMeta } from '../../theme';

export default function VenueDetailScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: venue, isPending, isError, refetch } = useVenue(id);

  return (
    // iOS'ta modal sayfa (sheet) olarak açılır, Android'de tam ekran → durum çubuğu kadar boşluk
    <View style={[styles.screen, { paddingTop: Platform.OS === 'ios' ? spacing.sm : insets.top }]}>
      <View style={styles.topBar}>
        <View style={styles.grabber} />
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Close">
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      {isPending ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : isError || !venue ? (
        <Pressable onPress={() => refetch()} style={styles.center}>
          <Text style={font.body}>{t.detail.loadError}</Text>
          <Text style={[font.small, { color: colors.primary }]}>{t.map.retry}</Text>
        </Pressable>
      ) : (
        <VenueDetail venue={venue} bottomInset={insets.bottom} />
      )}
    </View>
  );
}

function VenueDetail({ venue, bottomInset }: { venue: VenueDetailDTO; bottomInset: number }) {
  const t = useT();
  const { Icon, color } = venueTypeMeta[venue.type];
  const accent = venue.isMobile ? colors.mobile : color;
  const today = new Date().getDay();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xxl }]}>
      {/* Başlık */}
      <View style={styles.titleRow}>
        <View style={[styles.typeIcon, { backgroundColor: accent }]}>
          <Icon size={22} color={colors.textInverse} strokeWidth={2.4} />
        </View>
        <View style={styles.flex}>
          <Text style={font.title}>{venue.name}</Text>
          {venue.tagline && <Text style={[font.small, styles.tagline]}>{venue.tagline}</Text>}
        </View>
      </View>

      <View style={styles.badges}>
        <Badge label={t.venueType[venue.type]} color={accent} background={`${accent}1A`} />
        <Badge label={`${priceSymbol(venue.priceLevel)} · ${t.price[venue.priceLevel]}`} color={colors.text} />
        <Badge label={t.status.local(venue.authenticityScore)} color={colors.open} background={colors.openSoft} />
        {venue.isMobile && <Badge label={t.status.mobile} color={colors.mobile} background={colors.primarySoft} />}
      </View>

      <SpottedLine {...venue} />

      <Actions venue={venue} />

      {venue.description && <Text style={[font.body, styles.description]}>{venue.description}</Text>}

      {venue.customTip && (
        <View style={styles.tipBox}>
          <Info size={16} color={colors.warning} />
          <Text style={styles.tipText}>{venue.customTip}</Text>
        </View>
      )}

      {/* Mutlaka dene */}
      {venue.dishes.length > 0 && (
        <Section title={t.detail.mustTry}>
          {venue.dishes.map((dish, i) => (
            <View key={dish.id} style={styles.dish}>
              <Text style={styles.dishIndex}>{i + 1}</Text>
              <View style={styles.flex}>
                <View style={styles.dishTitleRow}>
                  <Text style={styles.dishName}>{dish.localName}</Text>
                  {dish.isVegetarian && <Leaf size={14} color={colors.open} accessibilityLabel={t.detail.vegetarian} />}
                </View>
                {dish.name !== dish.localName && <Text style={styles.dishTranslated}>{dish.name}</Text>}
                {dish.description && <Text style={font.small}>{dish.description}</Text>}
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* Yerel ipuçları */}
      {venue.localTips.length > 0 && (
        <Section title={t.detail.tips}>
          <View style={styles.badges}>
            {venue.localTips.map((tip) => (
              <Badge
                key={tip}
                label={t.tips[tip]}
                color={colors.text}
                background={colors.surfaceMuted}
                style={styles.tipBadge}
              />
            ))}
          </View>
        </Section>
      )}

      <ReviewsSection rating={venue.rating} reviews={venue.reviews} />

      {/* Saatler & konum */}
      <Section title={t.detail.hours}>
        {venue.locationNote && (
          <View style={styles.infoRow}>
            <MapPin size={16} color={colors.textMuted} />
            <Text style={[font.body, styles.flex]}>{venue.locationNote}</Text>
          </View>
        )}
        {venue.address && (
          <View style={styles.infoRow}>
            <MapPin size={16} color="transparent" />
            <Text style={[font.small, styles.flex]}>{venue.address}</Text>
          </View>
        )}
        {groupByDay(venue.schedules).map(([day, slots]) => (
          <View key={day} style={[styles.hoursRow, day === today && styles.hoursToday]}>
            <Clock size={14} color={day === today ? colors.primary : colors.textMuted} />
            <Text style={[styles.hoursDay, day === today && { color: colors.primary }]}>
              {day === today ? t.detail.today : t.days[day]}
            </Text>
            <View style={styles.flex}>
              {slots.map((s) => (
                <Text key={`${s.openMinute}-${s.closeMinute}`} style={font.body}>
                  {s.opensAt}–{s.closesAt}
                  {s.locationNote ? <Text style={font.small}>{`  ·  ${s.locationNote}`}</Text> : null}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

/** "Bugün buradaydı" (seyyar) veya "Tavsiye et" (dükkan) + yol tarifi */
function Actions({ venue }: { venue: VenueDetailDTO }) {
  const t = useT();
  const report = useReportVenue(venue.id);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const reportType: ReportType = venue.isMobile ? 'SPOTTED_TODAY' : 'UPVOTE';

  const onReport = async () => {
    setMessage(null);
    let coords: { latitude: number; longitude: number } | null = null;

    if (reportType === 'SPOTTED_TODAY') {
      setLocating(true);
      coords = await getPreciseLocation().catch(() => null);
      setLocating(false);
      if (!coords) {
        setMessage(t.report.needLocation);
        return;
      }
    }

    report.mutate(
      { type: reportType, ...coords },
      {
        onSuccess: () => {
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'ALREADY_REPORTED') {
            setDone(true);
            setMessage(t.report.already);
          } else if (err instanceof ApiError && err.code === 'TOO_FAR') {
            const distance = (err.details as { distanceMeters?: number } | undefined)?.distanceMeters ?? 0;
            setMessage(t.report.tooFar(distance));
          } else {
            setMessage(t.report.failed);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    );
  };

  const busy = locating || report.isPending;
  const PrimaryIcon = done ? CircleCheck : venue.isMobile ? Eye : ThumbsUp;
  const primaryLabel = venue.isMobile
    ? done
      ? t.detail.spottedDone
      : t.detail.spottedToday
    : done
      ? t.detail.recommended
      : t.detail.recommend;

  return (
    <View style={styles.actions}>
      <View style={styles.actionRow}>
        <Pressable
          onPress={onReport}
          disabled={busy || done}
          style={({ pressed }) => [
            styles.primaryButton,
            done && styles.primaryDone,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <PrimaryIcon size={18} color={done ? colors.open : colors.textInverse} />
          )}
          <Text style={[styles.primaryText, done && { color: colors.open }]} numberOfLines={1}>
            {primaryLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => openDirections(venue.latitude, venue.longitude, venue.name)}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          accessibilityLabel={t.detail.directions}
        >
          <Navigation size={18} color={colors.primary} />
          <Text style={styles.secondaryText}>{t.detail.directions}</Text>
        </Pressable>
      </View>
      {message && <Text style={styles.actionMessage}>{message}</Text>}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={font.heading}>{title}</Text>
      {children}
    </View>
  );
}

/** Pazartesiden başlayan gün sırası */
function groupByDay(schedules: ScheduleDTO[]): [number, ScheduleDTO[]][] {
  const byDay = new Map<number, ScheduleDTO[]>();
  for (const s of schedules) byDay.set(s.dayOfWeek, [...(byDay.get(s.dayOfWeek) ?? []), s]);
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => byDay.has(d)).map((d) => [d, byDay.get(d)!]);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pressed: { opacity: 0.75 },

  topBar: { height: 36, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: spacing.lg, gap: spacing.lg },
  titleRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tagline: { marginTop: 4, fontSize: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  description: { lineHeight: 22 },

  tipBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  tipText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  tipBadge: { paddingHorizontal: 10, paddingVertical: 6 },

  actions: { gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  primaryDone: { backgroundColor: colors.openSoft },
  primaryText: { color: colors.textInverse, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  actionMessage: { ...font.small, color: colors.warning },

  section: { gap: spacing.md },
  dish: { flexDirection: 'row', gap: spacing.md },
  dishIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '700',
    overflow: 'hidden',
  },
  dishTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dishName: { fontSize: 16, fontWeight: '700', color: colors.text },
  dishTranslated: { fontSize: 14, color: colors.text, marginTop: 1 },

  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  hoursToday: { backgroundColor: colors.primarySoft },
  hoursDay: { width: 52, fontWeight: '700', color: colors.textMuted, fontSize: 14, lineHeight: 22 },
});
