import type { LocalTip, ScheduleDTO, VenueDetailDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
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
  Share2,
  Star,
  Sun,
  Users,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { placeUrl } from '../../api/config';
import { useVenue } from '../../api/venues';
import { FoodImage } from '../../components/ui/FoodImage';
import { ExperienceSection } from '../../components/monetization/ExperienceSection';
import { AnnouncementsSection } from '../../components/venue/AnnouncementsSection';
import { DishRow } from '../../components/venue/DishRow';
import { GoogleReviewsSection } from '../../components/venue/GoogleReviewsSection';
import { HoursEditor } from '../../components/venue/HoursEditor';
import { LinkDistanceCard } from '../../components/venue/LinkDistanceCard';
import { LiveLocationBadge } from '../../components/venue/LiveLocationBadge';
import { LiveSourceCard } from '../../components/venue/LiveSourceCard';
import { ReviewsSection } from '../../components/venue/ReviewsSection';
import { SpottedLine } from '../../components/venue/SpottedLine';
import { useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { formatTry, priceSymbol } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { useGoBack } from '../../hooks/useGoBack';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useSpotConfirm } from '../../hooks/useSpotConfirm';

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
  // via=link: paylaşılan bağlantıyla açıldı (bkz. app/place/[id].tsx)
  const { id, via } = useLocalSearchParams<{ id: string; via?: string }>();
  const goBack = useGoBack('/');
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

      {venue && (
        <Pressable
          onPress={() => shareVenue(venue, t)}
          hitSlop={8}
          style={({ pressed }) => [styles.share, shadow.pin, { top: insets.top + spacing.sm }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.share.button}
        >
          <Share2 size={16} color={colors.text} />
          <Text style={styles.shareText}>{t.share.button}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => goBack()}
        hitSlop={12}
        style={[styles.close, shadow.pin, { top: insets.top + spacing.sm }]}
        accessibilityLabel={t.suggest.close}
      >
        <X size={20} color={colors.text} />
      </Pressable>

      {venue && via === 'link' && <LinkDistanceCard venue={venue} bottom={insets.bottom} />}
    </View>
  );
}

/** Yerel paylaşım menüsü (WhatsApp dahil): ad, kısa açıklama ve mekan bağlantısı tek metinde */
async function shareVenue(venue: VenueDetailDTO, t: ReturnType<typeof useT>) {
  Haptics.selectionAsync();
  try {
    // WhatsApp yalnızca "message" alanını okur; bağlantı metnin içinde olmalı
    await Share.share({
      message: t.share.message(venue.name, venue.tagline, placeUrl(venue.id)),
    });
  } catch {
    // Paylaşım menüsü açılamadı (nadir); sessizce geç
  }
}

function VenueDetail({ venue, bottomInset }: { venue: VenueDetailDTO; bottomInset: number }) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const today = new Date().getDay();
  const open = venue.isActiveNow || venue.isScheduledOpen;
  const external = venue.source !== 'LOCALBITE';
  const requireAuth = useRequireAuth();
  const [editingHours, setEditingHours] = useState(false);
  const { google } = venue;
  // Dış kaynaklı yerde gerçek saatlerden: "Açık · Kapanış 22:00" / "Kapalı · Açılış 09:00"
  const statusLabel = !venue.openStatusKnown
    ? t.status.hoursUnknown
    : open && venue.closesAt
      ? t.status.openUntil(venue.closesAt)
      : !open && venue.opensAt
        ? t.status.closedUntil(venue.opensAt)
        : venue.isMobile && venue.isActiveNow
      ? t.status.activeNow
      : open
        ? t.status.openNow
        : t.status.closed;

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
        {/* Google fotoğrafında yazar atfı zorunlu */}
        {external && venue.coverImageCredit && (
          <Text style={styles.coverCredit} numberOfLines={1}>
            {venue.coverIsRepresentative ? t.detail.photoCredit(venue.coverImageCredit) : t.google.photoBy(venue.coverImageCredit)}
          </Text>
        )}
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
            {venue.priceLevel && <Text style={styles.price}>{`${priceSymbol(venue.priceLevel)}  ·  `}</Text>}
            {venue.liveCategory ? t.liveCategory[venue.liveCategory] : t.venueType[venue.type]}
            {external ? '' : `  ·  ${t.status.local(venue.authenticityScore)}`}
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
          {venue.liveLocation && <LiveLocationBadge updatedAt={venue.liveLocation.updatedAt} />}
        </View>

        <AnnouncementsSection items={venue.announcements} />

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

        {/* Dış kaynaklı yer: yorum kabul etmez; kaynağa atıf ve bağlantı */}
        {google ? (
          <GoogleReviewsSection google={google} />
        ) : venue.source !== 'LOCALBITE' ? (
          <LiveSourceCard source={venue.source} url={venue.sourceUrl} />
        ) : (
          <ReviewsSection venueId={venue.id} rating={venue.rating} reviews={venue.reviews} />
        )}

        <ExperienceSection venueId={venue.id} />

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

        {/* Saatler & konum (dış kaynaklı yerlerde çoğu zaman boş: o zaman hiç gösterilmez) */}
        {(external || venue.locationNote || venue.address || venue.schedules.length > 0) && (
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
            {/* Dış kaynaklı yerin haftalık saatleri ("Pazartesi: 09:00–22:00") */}
            {venue.weeklyHours.map((line) => (
              <View key={line} style={styles.infoRow}>
                <Clock size={14} color={colors.textMuted} />
                <Text style={[font.small, styles.flex]}>{line}</Text>
              </View>
            ))}
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
            {/* Haritadaki yerin saatini topluluk ekler/düzeltir; kaynağı her zaman görünür */}
            {external && (
              <View style={styles.hoursFooter}>
                <Text style={styles.hoursSource}>
                  {venue.hoursSource ? t.hours.source[venue.hoursSource] : t.hours.unknownHint}
                </Text>
                <Pressable
                  onPress={() => requireAuth('hours', () => setEditingHours(true))}
                  style={({ pressed }) => [styles.hoursEdit, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Clock size={15} color={colors.primary} />
                  <Text style={styles.hoursEditText}>{venue.openStatusKnown ? t.hours.edit : t.hours.add}</Text>
                </Pressable>
              </View>
            )}
          </Section>
        )}
        {editingHours && <HoursEditor venueId={venue.id} onClose={() => setEditingHours(false)} />}
      </View>
    </ScrollView>
  );
}

/** Seyyarlar için topluluk teyidi: "Bugün burada gördüm" (konum doğrulamalı) */
function SpottedAction({ venue }: { venue: VenueDetailDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const { confirm: onReport, busy, done, message } = useSpotConfirm(venue.id);

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

  share: {
    position: 'absolute',
    right: spacing.lg + 36 + spacing.sm,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  shareText: { fontSize: 14, fontWeight: '700', color: colors.text },
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
  coverCredit: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    maxWidth: '60%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    color: '#FFFFFF',
    fontSize: 11,
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
  hoursFooter: { gap: spacing.sm, marginTop: spacing.xs },
  hoursSource: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  hoursEdit: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  hoursEditText: { fontSize: 13, fontWeight: '800', color: colors.primary },
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
