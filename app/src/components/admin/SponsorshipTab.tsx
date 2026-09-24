import { Search, Star } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Switch, Text, TextInput, View } from 'react-native';
import { useAdminVenues, useSetPromoted } from '../../api/admin';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import type { Notify } from '../ui/Notice';
import { apiErrorText, ListState, useRefreshControl, useCardStyles } from './parts';

/** ⭐ "Seçilmiş Lezzet" anahtarı: yayındaki her mekan için */
export function SponsorshipTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const { colors } = useTheme();
  const card = useCardStyles();
  const styles = useStyles();
  const t = useT();
  const venues = useAdminVenues({ status: 'ACTIVE' });
  const refresh = useRefreshControl(venues);
  const setPromoted = useSetPromoted();
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    const all = venues.data?.items ?? [];
    return needle ? all.filter((v) => v.name.toLocaleLowerCase('tr').includes(needle)) : all;
  }, [venues.data, q]);

  const toggle = (id: string, isPromoted: boolean) =>
    setPromoted.mutate(
      { id, isPromoted },
      {
        onSuccess: () => notify({ kind: 'success', text: isPromoted ? t.adminCenter.promotedOn : t.adminCenter.promotedOff }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(v) => v.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[card.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListHeaderComponent={
        <View style={styles.search}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t.adminCenter.search}
            placeholderTextColor={colors.closed}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      }
      ListEmptyComponent={<ListState query={venues} emptyTitle={t.adminCenter.noVenues} />}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Star size={18} color={item.isPromoted ? '#F59E0B' : colors.border} fill={item.isPromoted ? '#F59E0B' : 'transparent'} />
          <View style={styles.flex}>
            <Text style={card.title} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={card.sub} numberOfLines={1}>
              {item.isPromoted ? `${t.adminCenter.promotedLabel} · ` : ''}
              {t.venueType[item.type]}
              {item.neighborhood ? ` · ${item.neighborhood}` : ''}
            </Text>
          </View>
          <Switch
            value={item.isPromoted}
            onValueChange={(v) => toggle(item.id, v)}
            disabled={setPromoted.isPending && setPromoted.variables?.id === item.id}
            trackColor={{ true: '#F59E0B', false: colors.border }}
            accessibilityLabel={`${t.adminCenter.promotedLabel}: ${item.name}`}
          />
        </View>
      )}
    />
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { height: 1, backgroundColor: colors.border },
}));
