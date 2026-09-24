import type { AnnouncementType, VendorDishDTO, VendorVenueDTO } from '@localbite/shared';
import * as Location from 'expo-location';
import { Redirect } from 'expo-router';
import { ChevronLeft, Crosshair, MapPinned, Megaphone, Save, Store } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../api/client';
import { useCreateAnnouncement, useSetVendorOpen, useUpdateDish, useUpdateVendorLocation, useVendorVenues } from '../api/vendor';
import { Input, Segmented } from '../components/suggest/FormControls';
import { NoticeBanner, useNotice, type Notify } from '../components/ui/Notice';
import { LiveLocationBadge } from '../components/venue/LiveLocationBadge';
import { LocationPickerModal } from '../components/vendor/LocationPickerModal';
import { getPreciseLocation } from '../hooks/useUserLocation';
import { useT, type Dictionary } from '../i18n';
import { formatRelative } from '../lib/format';
import { useCurrentUser } from '../store/auth';
import { makeStyles, radius, spacing, useTheme, venueTypeMeta } from '../theme';
import { useGoBack } from '../hooks/useGoBack';

/** Sunucu hata kodlarını satıcıya anlaşılır metne çevirir */
function errorText(err: unknown, t: Dictionary): string {
  if (err instanceof ApiError) {
    if (err.code === 'TOO_FAR_FROM_BASE') return t.vendorPanel.tooFar;
    if (err.code === 'TOO_MANY_PENDING') return t.vendorPanel.tooMany;
    if (err.code === 'CONTENT_REJECTED') return t.vendorPanel.rejectedContent;
  }
  return t.vendorPanel.failed;
}

/** Esnaf paneli: yalnızca VENDOR rolü ve yalnızca kendi mekanı (sunucu da doğrular) */
export default function VendorScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const goBack = useGoBack('/profile');
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const venues = useVendorVenues();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, notify] = useNotice();

  if (user?.role !== 'VENDOR') return <Redirect href="/profile" />;

  const items = venues.data?.items ?? [];
  const venue = items.find((v) => v.id === selectedId) ?? items[0];

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => goBack()} hitSlop={12} style={styles.back} accessibilityLabel={t.vendorPanel.cancel}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={font.heading}>{t.vendorPanel.title}</Text>
      </View>

      {venues.isPending ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : venues.isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t.vendorPanel.loadError}</Text>
          <Pressable onPress={() => venues.refetch()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>{t.vendorPanel.retry}</Text>
          </Pressable>
        </View>
      ) : !venue ? (
        <View style={styles.empty}>
          <Store size={36} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t.vendorPanel.noVenue}</Text>
          <Text style={styles.emptyBody}>{t.vendorPanel.noVenueBody}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl * 2 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={<RefreshControl refreshing={venues.isRefetching} onRefresh={() => venues.refetch()} tintColor={colors.primary} />}
        >
          {items.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.venueChips}>
              {items.map((v) => (
                <Pressable key={v.id} onPress={() => setSelectedId(v.id)} style={[styles.venueChip, v.id === venue.id && styles.venueChipActive]}>
                  <Text style={[styles.venueChipText, v.id === venue.id && styles.venueChipTextActive]}>{v.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <VenueHeader venue={venue} />
          <LocationCard venue={venue} notify={notify} />
          <OpenCard venue={venue} notify={notify} />
          <AnnouncementCard venue={venue} notify={notify} />
          <MenuCard venue={venue} notify={notify} />
        </ScrollView>
      )}

      <NoticeBanner notice={notice} bottom={insets.bottom} />
    </View>
  );
}

function VenueHeader({ venue }: { venue: VendorVenueDTO }) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const TypeIcon = venueTypeMeta[venue.type].Icon;
  const statusColor = venue.status === 'ACTIVE' ? colors.open : venue.status === 'PENDING_APPROVAL' ? colors.warning : colors.danger;
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: venue.locationType === 'DYNAMIC_STREET' ? colors.mobile : colors.shop }]}>
        <TypeIcon size={24} color={colors.textInverse} />
      </View>
      <View style={styles.flex}>
        <Text style={font.heading} numberOfLines={2}>
          {venue.name}
        </Text>
        <View style={styles.row}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.headerSub, { color: statusColor }]}>{t.vendorPanel[`status${venue.status}`]}</Text>
          <Text style={styles.headerSub}>· {t.venueType[venue.type]}</Text>
        </View>
      </View>
    </View>
  );
}

function Card({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  const { font } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={font.heading}>{title}</Text>
      {body && <Text style={styles.cardBody}>{body}</Text>}
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────
// 📍 Anlık canlı konum
// ─────────────────────────────────────────────

function LocationCard({ venue, notify }: { venue: VendorVenueDTO; notify: Notify }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const update = useUpdateVendorLocation();
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (venue.locationType !== 'DYNAMIC_STREET') {
    return (
      <Card title={t.vendorPanel.locationTitle}>
        <Text style={styles.cardBody}>{t.vendorPanel.staticNote}</Text>
      </Card>
    );
  }

  const save = (point: { latitude: number; longitude: number }, source: 'GPS' | 'MAP') =>
    update.mutate(
      { venueId: venue.id, ...point, source },
      {
        onSuccess: () => {
          setPickerOpen(false);
          notify({ kind: 'success', text: t.vendorPanel.locationSaved });
        },
        onError: (err) => notify({ kind: 'error', text: errorText(err, t) }),
      },
    );

  const sendGps = async () => {
    setLocating(true);
    try {
      const coords = await getPreciseLocation();
      if (coords) return save(coords, 'GPS');
      const { granted } = await Location.getForegroundPermissionsAsync();
      notify({ kind: 'error', text: granted ? t.vendorPanel.gpsFailed : t.vendorPanel.gpsDenied });
    } finally {
      setLocating(false);
    }
  };

  const busyGps = locating || (update.isPending && update.variables?.source === 'GPS');
  return (
    <Card title={t.vendorPanel.locationTitle} body={t.vendorPanel.locationBody}>
      {venue.liveLocation ? (
        <View style={styles.liveBox}>
          <LiveLocationBadge updatedAt={venue.liveLocation.updatedAt} />
        </View>
      ) : (
        <Text style={styles.muted}>{t.vendorPanel.noLive}</Text>
      )}
      <Pressable
        onPress={sendGps}
        disabled={busyGps || update.isPending}
        accessibilityState={{ busy: busyGps }}
        style={({ pressed }) => [styles.primaryButton, (pressed || busyGps) && styles.pressed]}
      >
        {busyGps ? <ActivityIndicator color={colors.textInverse} /> : <Crosshair size={20} color={colors.textInverse} />}
        <Text style={styles.primaryText}>{t.vendorPanel.sendGps}</Text>
      </Pressable>
      <Pressable onPress={() => setPickerOpen(true)} disabled={update.isPending} style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
        <MapPinned size={20} color={colors.primary} />
        <Text style={styles.outlineText}>{t.vendorPanel.pickOnMap}</Text>
      </Pressable>

      {pickerOpen && (
        <LocationPickerModal
          visible
          initial={venue.liveLocation ?? venue.baseLocation}
          saving={update.isPending}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(point) => save(point, 'MAP')}
        />
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// 🟢 Açık / Kapalı
// ─────────────────────────────────────────────

type OpenMode = 'open' | 'closed' | 'auto';

function OpenCard({ venue, notify }: { venue: VendorVenueDTO; notify: Notify }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const setOpen = useSetVendorOpen();
  const mode: OpenMode = venue.openOverride === null ? 'auto' : venue.openOverride ? 'open' : 'closed';
  const pendingMode: OpenMode | null = setOpen.isPending
    ? setOpen.variables.isOpen === null
      ? 'auto'
      : setOpen.variables.isOpen
        ? 'open'
        : 'closed'
    : null;

  const change = (next: OpenMode) =>
    setOpen.mutate(
      { venueId: venue.id, isOpen: next === 'auto' ? null : next === 'open' },
      { onError: (err) => notify({ kind: 'error', text: errorText(err, t) }) },
    );

  return (
    <Card title={t.vendorPanel.openTitle} body={t.vendorPanel.openBody}>
      <View style={styles.openRow}>
        <View style={[styles.statusDot, styles.bigDot, { backgroundColor: venue.isOpenNow ? colors.open : colors.closed }]} />
        <Text style={[styles.openState, { color: venue.isOpenNow ? colors.open : colors.textMuted }]}>
          {venue.isOpenNow ? t.vendorPanel.nowOpen : t.vendorPanel.nowClosed}
        </Text>
        {/* Hızlı anahtar: açık ↔ kapalı */}
        <Switch
          value={venue.isOpenNow}
          onValueChange={(v) => change(v ? 'open' : 'closed')}
          disabled={setOpen.isPending}
          trackColor={{ true: colors.open, false: colors.border }}
          accessibilityLabel={t.vendorPanel.openTitle}
        />
      </View>
      <Segmented<OpenMode>
        value={pendingMode ?? mode}
        onChange={(v) => v !== mode && change(v)}
        options={[
          { value: 'open', label: t.vendorPanel.open },
          { value: 'closed', label: t.vendorPanel.closed },
          { value: 'auto', label: t.vendorPanel.auto },
        ]}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────
// 📢 Duyuru / Fırsat
// ─────────────────────────────────────────────

function AnnouncementCard({ venue, notify }: { venue: VendorVenueDTO; notify: Notify }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const create = useCreateAnnouncement();
  const [type, setType] = useState<AnnouncementType>('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const valid = title.trim().length >= 3 && content.trim().length >= 3;

  const submit = () =>
    create.mutate(
      { venueId: venue.id, type, title: title.trim(), content: content.trim() },
      {
        onSuccess: () => {
          setTitle('');
          setContent('');
          notify({ kind: 'success', text: t.vendorPanel.submitted });
        },
        onError: (err) => notify({ kind: 'error', text: errorText(err, t) }),
      },
    );

  const statusColor = { PENDING: colors.warning, APPROVED: colors.open, REJECTED: colors.danger } as const;
  return (
    <Card title={t.vendorPanel.annTitle} body={t.vendorPanel.annBody}>
      <Segmented<AnnouncementType>
        value={type}
        onChange={setType}
        options={[
          { value: 'ANNOUNCEMENT', label: t.liveLocation.typeANNOUNCEMENT },
          { value: 'PROMOTION', label: t.liveLocation.typePROMOTION },
        ]}
      />
      <Input value={title} onChangeText={setTitle} placeholder={t.vendorPanel.titlePlaceholder} maxLength={80} />
      <Input
        value={content}
        onChangeText={setContent}
        placeholder={t.vendorPanel.contentPlaceholder}
        maxLength={500}
        multiline
        style={styles.multiline}
      />
      <Pressable
        onPress={submit}
        disabled={!valid || create.isPending}
        accessibilityState={{ disabled: !valid, busy: create.isPending }}
        style={({ pressed }) => [styles.primaryButton, (!valid || pressed || create.isPending) && styles.pressed]}
      >
        {create.isPending ? <ActivityIndicator color={colors.textInverse} /> : <Megaphone size={18} color={colors.textInverse} />}
        <Text style={styles.primaryText}>{t.vendorPanel.submit}</Text>
      </Pressable>

      {venue.announcements.length > 0 && (
        <View style={styles.annList}>
          <Text style={styles.sectionLabel}>{t.vendorPanel.myAnnouncements}</Text>
          {venue.announcements.map((a) => (
            <View key={a.id} style={styles.annRow}>
              <View style={styles.flex}>
                <Text style={styles.annTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.muted}>
                  {t.liveLocation[`type${a.type}`]} · {formatRelative(a.createdAt)}
                </Text>
              </View>
              <View style={[styles.statusPill, { borderColor: statusColor[a.status] }]}>
                <Text style={[styles.statusPillText, { color: statusColor[a.status] }]}>{t.vendorPanel[`ann${a.status}`]}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// 🍲 Menü & fiyat
// ─────────────────────────────────────────────

function MenuCard({ venue, notify }: { venue: VendorVenueDTO; notify: Notify }) {
  const t = useT();
  return (
    <Card title={t.vendorPanel.menuTitle} body={t.vendorPanel.menuBody}>
      {venue.dishes.map((d) => (
        // Sunucudan yeni değer gelince taslak sıfırlansın
        <DishEditor key={`${d.id}:${d.priceTry}:${d.portion}`} dish={d} notify={notify} />
      ))}
    </Card>
  );
}

/** "135", "135,50" ya da boş (fiyatı kaldır) */
function parsePrice(text: string): number | null | undefined {
  const v = text.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n * 100) / 100 : undefined;
}

function DishEditor({ dish, notify }: { dish: VendorDishDTO; notify: Notify }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const update = useUpdateDish();
  const [price, setPrice] = useState(dish.priceTry === null ? '' : String(dish.priceTry));
  const [portion, setPortion] = useState(dish.portion ?? '');
  const parsed = parsePrice(price);
  const dirty = parsed !== dish.priceTry || portion.trim() !== (dish.portion ?? '');

  const save = () => {
    if (parsed === undefined) return notify({ kind: 'error', text: t.vendorPanel.invalidPrice });
    update.mutate(
      { dishId: dish.id, priceTry: parsed, portion: portion.trim() || null },
      {
        onSuccess: () => notify({ kind: 'success', text: t.vendorPanel.saved }),
        onError: (err) => notify({ kind: 'error', text: errorText(err, t) }),
      },
    );
  };

  return (
    <View style={styles.dish}>
      <Text style={styles.dishName}>
        {dish.localName}
        {dish.name !== dish.localName ? <Text style={styles.muted}>{`  ·  ${dish.name}`}</Text> : null}
      </Text>
      <View style={styles.dishFields}>
        <View style={styles.priceField}>
          <Text style={styles.fieldLabel}>{t.vendorPanel.price}</Text>
          <Input value={price} onChangeText={setPrice} keyboardType="decimal-pad" invalid={parsed === undefined} placeholder="0" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.fieldLabel}>{t.vendorPanel.portion}</Text>
          <Input value={portion} onChangeText={setPortion} placeholder={t.vendorPanel.portionPlaceholder} maxLength={60} />
        </View>
      </View>
      {dirty && (
        <Pressable
          onPress={save}
          disabled={update.isPending}
          style={({ pressed }) => [styles.saveButton, (pressed || update.isPending) && styles.pressed]}
        >
          {update.isPending ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Save size={16} color={colors.textInverse} />}
          <Text style={styles.saveText}>{t.vendorPanel.save}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  pressed: { opacity: 0.6 },
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
  content: { padding: spacing.lg, gap: spacing.lg },
  venueChips: { gap: spacing.sm },
  venueChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  venueChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  venueChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  venueChipTextActive: { color: colors.primary, fontWeight: '800' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  headerSub: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  bigDot: { width: 12, height: 12, borderRadius: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  cardBody: { fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: -spacing.xs },
  muted: { fontSize: 12, color: colors.textMuted },
  liveBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  primaryText: { color: colors.textInverse, fontWeight: '800', fontSize: 15 },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  openState: { flex: 1, fontSize: 14, fontWeight: '800' },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  annList: { gap: spacing.sm, marginTop: spacing.xs },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  annRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  annTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  statusPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  dish: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  dishName: { fontSize: 15, fontWeight: '800', color: colors.text },
  dishFields: { flexDirection: 'row', gap: spacing.sm },
  priceField: { width: 110 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.open,
  },
  saveText: { color: colors.textInverse, fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
