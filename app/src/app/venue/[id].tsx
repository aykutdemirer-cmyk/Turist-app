import type { LocalTip, ScheduleDTO, VenueDetailDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Banknote,
  CalendarX,
  CircleCheck,
  Clock,
  Eye,
  Footprints,
  Hourglass,
  Info,
  MapPin,
  Navigation,
  Pointer,
  Receipt,
  Star,
  Sun,
  Users,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { useReportVenue, useVenue } from '../../api/venues';
import { FoodImage } from '../../components/ui/FoodImage';
import { DishRow } from '../../components/venue/DishRow';
import { ReviewsSection } from '../../components/venue/ReviewsSection';
import { SpottedLine } from '../../components/venue/SpottedLine';
import { getPreciseLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { formatTry, priceSymbol } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

const TIP_ICONS: Record<LocalTip, LucideIcon> = {
  CASH_ONLY: Banknote,
  PAY_AT_COUNTER: Receipt,
  NO_RESERVATIONS: CalendarX,
  SELF_SERVICE_TRAY: Utensils,
  SHARED_TABLES: Users,
  POINT_TO_ORDER: Pointer,
  CLOSES_WHEN_SOLD_OUT: Hourglass,
  LUNCH_ONLY: Sun,
  STANDING_ONLY: Footprints,
};

const COVER_HEIGHT = 240;

export default function VenueDetailScreen() {
  const { colors, font, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: venue, isPending, isError, refetch } = useVenue(id);

  return (
    <View style={styles.screen}>
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

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.close, shadow.pin, { top: insets.top + spacing.sm }]}
        accessibilityLabel={t.suggest.close}
      >
        <X size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

function VenueDetail({ venue, bottomInset }: { venue: VenueDetailDTO; bottomInset: number }) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const today = new Date().getDay();
  const open = venue.isActiveNow || venue.isScheduledOpen;
  const statusLabel = venue.isMobile && venue.isActiveNow ? t.status.activeNow : open ? t.status.openNow : t.status.closed;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + spacing.xxl }}>
      {/* Kapak */}
      <View>
        <FoodImage
          uri={venue.coverImageUrl}
          subject={venue.dishes[0]?.localName}
          type={venue.type}
          isMobile={venue.isMobile}
          style={{ height: COVER_HEIGHT, width: '100%' }}
          emojiSize={96}
        />
        <View style={[styles.statusPill, { backgroundColor: open ? colors.open : colors.overlay }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Başlık */}
        <View style={styles.titleBlock}>
          <Text style={font.title}>{venue.name}</Text>
          <Text style={styles.meta}>
            <Text style={styles.price}>{priceSymbol(venue.priceLevel)}</Text>
            {`  ·  ${t.venueType[venue.type]}  ·  ${t.status.local(venue.authenticityScore)}`}
            {venue.neighborhood ? `  ·  ${venue.neighborhood}` : ''}
          </Text>
          {venue.rating.average !== null && (
            <View style={styles.ratingRow}>
              <Star size={15} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingValue}>{venue.rating.average.toFixed(1)}</Text>
              <Text style={font.small}>({t.reviews.count(venue.rating.count)})</Text>
            </View>
          )}
          {venue.pricePerPerson && (
            <View style={styles.perPerson} accessibilityRole="text">
              <Wallet size={15} color={colors.open} />
              <Text style={styles.perPersonText}>
                {t.detail.perPerson(formatTry(venue.pricePerPerson.min), formatTry(venue.pricePerPerson.max))}
              </Text>
            </View>
          )}
          {venue.tagline && <Text style={styles.tagline}>{venue.tagline}</Text>}
        </View>

        {/* Yol tarifi (ana eylem) */}
        <Pressable
          onPress={() => openDirections(venue.latitude, venue.longitude, venue.name)}
          style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
        >
          <Navigation size={18} color={colors.textInverse} />
          <Text style={styles.directionsText}>{t.detail.directions}</Text>
        </Pressable>

        {venue.isMobile && <SpottedAction venue={venue} />}

        {venue.description && <Text style={[font.body, styles.description]}>{venue.description}</Text>}

        {/* Menü / Öne çıkan lezzetler — sipariş yok, yalnızca rehber */}
        {venue.dishes.length > 0 && (
          <Section title={t.detail.mustTry} note={t.detail.menuNote}>
            {venue.dishes.map((dish) => (
              <DishRow key={dish.id} dish={dish} venueType={venue.type} isMobile={venue.isMobile} />
            ))}
          </Section>
        )}

        <ReviewsSection venueId={venue.id} rating={venue.rating} reviews={venue.reviews} />

        {/* Kültürel ipuçları — rehber kartları */}
        {(venue.localTips.length > 0 || venue.customTip) && (
          <Section title={t.detail.tips}>
            {venue.localTips.map((tip) => {
              const Icon = TIP_ICONS[tip];
              return (
                <View key={tip} style={styles.tipCard}>
                  <View style={styles.tipIcon}>
                    <Icon size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.tipTitle}>{t.tips[tip]}</Text>
                    <Text style={styles.tipBody}>{t.guideTips[tip]}</Text>
                  </View>
                </View>
              );
            })}
            {venue.customTip && (
              <View style={[styles.tipCard, styles.tipCardHighlight]}>
                <View style={[styles.tipIcon, { backgroundColor: colors.warningSoft }]}>
                  <Info size={18} color={colors.warning} />
                </View>
                <Text style={[styles.tipBody, styles.flex, { color: colors.text }]}>{venue.customTip}</Text>
              </View>
            )}
          </Section>
        )}

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
      </View>
    </ScrollView>
  );
}

/** Seyyarlar için topluluk teyidi: "Bugün burada gördüm" (konum doğrulamalı) */
function SpottedAction({ venue }: { venue: VenueDetailDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const report = useReportVenue(venue.id);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const onReport = async () => {
    setMessage(null);
    setLocating(true);
    const coords = await getPreciseLocation().catch(() => null);
    setLocating(false);
    if (!coords) {
      setMessage(t.report.needLocation);
      return;
    }

    report.mutate(
      { type: 'SPOTTED_TODAY', ...coords },
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

  return (
    <View style={styles.spotted}>
      <SpottedLine {...venue} />
      <Pressable
        onPress={onReport}
        disabled={busy || done}
        style={({ pressed }) => [styles.spottedButton, done && styles.spottedDone, (pressed || busy) && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={colors.mobile} size="small" />
        ) : done ? (
          <CircleCheck size={18} color={colors.open} />
        ) : (
          <Eye size={18} color={colors.mobile} />
        )}
        <Text style={[styles.spottedText, done && { color: colors.open }]}>
          {done ? t.detail.spottedDone : t.detail.spottedToday}
        </Text>
      </Pressable>
      {message && <Text style={styles.actionMessage}>{message}</Text>}
    </View>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const { font } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View>
        <Text style={font.heading}>{title}</Text>
        {note && <Text style={styles.sectionNote}>{note}</Text>}
      </View>
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

const useStyles = makeStyles(({ colors, font }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pressed: { opacity: 0.8 },

  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textInverse },
  statusText: { color: colors.textInverse, fontWeight: '800', fontSize: 13 },

  content: { padding: spacing.lg, gap: spacing.xl },
  titleBlock: { gap: 6 },
  meta: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  price: { color: colors.open, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  tagline: { fontSize: 15, color: colors.text, lineHeight: 21 },
  perPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.openSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  perPersonText: { fontSize: 13, fontWeight: '800', color: colors.open },
  description: { lineHeight: 22, color: colors.textMuted },

  directions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  directionsText: { color: colors.textInverse, fontWeight: '800', fontSize: 16 },

  spotted: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spottedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.mobile,
  },
  spottedDone: { borderColor: colors.open, backgroundColor: colors.openSoft },
  spottedText: { color: colors.mobile, fontWeight: '700', fontSize: 15 },
  actionMessage: { ...font.small, color: colors.warning },

  section: { gap: spacing.md },
  sectionNote: { ...font.small, fontWeight: '400', marginTop: 2 },


  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipCardHighlight: { borderColor: colors.warningSoft, backgroundColor: '#FFFBEB' },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  tipBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 2 },

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
}));
