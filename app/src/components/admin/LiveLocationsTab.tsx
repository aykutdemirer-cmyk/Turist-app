import { haversineMeters, type AdminVenueDTO } from '@localbite/shared';
import { MapPinCheck, MapPinX, Navigation } from 'lucide-react-native';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useAdminVenues, useModerateLiveLocation } from '../../api/admin';
import { useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { formatDistance } from '../../lib/format';
import { spacing, useTheme } from '../../theme';
import type { Notify } from '../ui/Notice';
import { LiveLocationBadge } from '../venue/LiveLocationBadge';
import { ActionButton, apiErrorText, ListState, useRefreshControl, useCardStyles } from './parts';

/** 🗺️ Canlı konum paylaşan seyyarlar (en yeni güncelleme üstte); şüpheli konum sabitlenir ya da sıfırlanır */
export function LiveLocationsTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const styles = useCardStyles();
  const t = useT();
  const venues = useAdminVenues({ live: true });
  const refresh = useRefreshControl(venues);
  const moderate = useModerateLiveLocation();

  const run = (v: AdminVenueDTO, action: 'pin' | 'reset') =>
    moderate.mutate(
      { id: v.id, action },
      {
        onSuccess: () => notify({ kind: 'success', text: action === 'pin' ? t.adminCenter.pinned : t.adminCenter.resetDone }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  const confirm = (v: AdminVenueDTO, action: 'pin' | 'reset') =>
    Alert.alert(
      action === 'pin' ? t.adminCenter.confirmPinTitle : t.adminCenter.confirmResetTitle,
      action === 'pin' ? t.adminCenter.confirmPinBody(v.name) : t.adminCenter.confirmResetBody(v.name),
      [
        { text: t.adminCenter.cancel, style: 'cancel' },
        { text: action === 'pin' ? t.adminCenter.pin : t.adminCenter.reset, style: action === 'reset' ? 'destructive' : 'default', onPress: () => run(v, action) },
      ],
    );

  return (
    <FlatList
      data={venues.data?.items ?? []}
      keyExtractor={(v) => v.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListEmptyComponent={<ListState query={venues} emptyTitle={t.adminCenter.noLive} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <LiveVendorCard venue={item} moderate={moderate} onConfirm={confirm} />}
    />
  );
}

function LiveVendorCard({
  venue,
  moderate,
  onConfirm,
}: {
  venue: AdminVenueDTO;
  moderate: ReturnType<typeof useModerateLiveLocation>;
  onConfirm: (v: AdminVenueDTO, action: 'pin' | 'reset') => void;
}) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const t = useT();
  const live = venue.liveLocation!;
  const busy = moderate.isPending && moderate.variables?.id === venue.id ? moderate.variables.action : null;
  const distance = haversineMeters(venue.baseLocation, live);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{venue.name}</Text>
      </View>
      <LiveLocationBadge updatedAt={live.updatedAt} />
      <Pressable
        onPress={() => openDirections(live.latitude, live.longitude, venue.name)}
        accessibilityRole="link"
        style={({ pressed }) => [styles.quote, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.sub}>
          <Navigation size={11} color={colors.textMuted} /> {live.latitude.toFixed(5)}, {live.longitude.toFixed(5)}
        </Text>
        <Text style={styles.sub}>{t.adminCenter.fromBase(formatDistance(distance))}</Text>
      </Pressable>
      {venue.owner && (
        <Text style={styles.sub}>
          {t.adminCenter.owner}: {venue.owner.name}
        </Text>
      )}
      <View style={styles.actions}>
        <ActionButton
          label={t.adminCenter.reset}
          icon={<MapPinX size={16} color="#FFFFFF" />}
          onPress={() => onConfirm(venue, 'reset')}
          loading={busy === 'reset'}
          disabled={moderate.isPending}
          tone="danger"
        />
        <ActionButton
          label={t.adminCenter.pin}
          icon={<MapPinCheck size={16} color={colors.text} />}
          onPress={() => onConfirm(venue, 'pin')}
          loading={busy === 'pin'}
          disabled={moderate.isPending}
        />
      </View>
    </View>
  );
}
