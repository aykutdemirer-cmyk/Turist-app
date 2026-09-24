import type { AdminVenueDTO } from '@localbite/shared';
import { Check, MapPin, X } from 'lucide-react-native';
import { FlatList, Text, View } from 'react-native';
import { useAdminVenues, useReviewVenue } from '../../api/admin';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { spacing, useTheme } from '../../theme';
import type { Notify } from '../ui/Notice';
import { ActionButton, apiErrorText, ListState, useRefreshControl, Tag, useCardStyles } from './parts';

/** 🏪 Esnaf & mekan başvuruları: onaylanan haritada yayına girer */
export function VenueApprovalsTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const styles = useCardStyles();
  const t = useT();
  const venues = useAdminVenues({ status: 'PENDING_APPROVAL' });
  const refresh = useRefreshControl(venues);
  const review = useReviewVenue();

  const run = (v: AdminVenueDTO, decision: 'approve' | 'reject') =>
    review.mutate(
      { id: v.id, decision },
      {
        onSuccess: () =>
          notify({ kind: 'success', text: decision === 'approve' ? t.adminCenter.venueApproved : t.adminCenter.venueRejected }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  return (
    <FlatList
      data={venues.data?.items ?? []}
      keyExtractor={(v) => v.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListEmptyComponent={
        <ListState query={venues} emptyTitle={t.adminCenter.noPendingVenues} emptyBody={t.adminCenter.noPendingVenuesBody} />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <VenueApplicationCard
          venue={item}
          busy={review.isPending && review.variables?.id === item.id ? review.variables.decision : null}
          disabled={review.isPending}
          onApprove={() => run(item, 'approve')}
          onReject={() => run(item, 'reject')}
        />
      )}
    />
  );
}

function VenueApplicationCard({
  venue,
  busy,
  disabled,
  onApprove,
  onReject,
}: {
  venue: AdminVenueDTO;
  busy: 'approve' | 'reject' | null;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const t = useT();
  const street = venue.locationType === 'DYNAMIC_STREET';
  const place = [venue.neighborhood, venue.district].filter(Boolean).join(', ');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{venue.name}</Text>
        <Tag label={street ? t.adminCenter.street : t.adminCenter.static} color={street ? colors.mobile : colors.shop} />
      </View>
      <Text style={styles.sub}>
        {t.venueType[venue.type]} · {t.adminCenter.applied(formatRelative(venue.createdAt))}
      </Text>
      {venue.tagline && <Text style={styles.body}>{venue.tagline}</Text>}
      {(place || venue.locationNote) && (
        <View style={styles.quote}>
          <Text style={styles.sub}>
            <MapPin size={11} color={colors.textMuted} /> {[place, venue.locationNote].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}
      {venue.mustTry.length > 0 && (
        <Text style={styles.sub}>
          {t.adminCenter.mustTry}: {venue.mustTry.join(', ')}
        </Text>
      )}
      {venue.owner && (
        <Text style={styles.sub}>
          {t.adminCenter.owner}: {venue.owner.name}
          {venue.owner.email ? ` · ${venue.owner.email}` : ''}
        </Text>
      )}
      <View style={styles.actions}>
        <ActionButton label={t.adminCenter.reject} icon={<X size={16} color={colors.text} />} onPress={onReject} loading={busy === 'reject'} disabled={disabled} />
        <ActionButton
          label={t.adminCenter.approve}
          icon={<Check size={16} color="#FFFFFF" />}
          onPress={onApprove}
          loading={busy === 'approve'}
          disabled={disabled}
          tone="success"
        />
      </View>
    </View>
  );
}
