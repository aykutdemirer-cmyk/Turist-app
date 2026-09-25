import { Check, Store, UtensilsCrossed, X } from 'lucide-react-native';
import { FlatList, Text, View } from 'react-native';
import { useAdminClaims, useAdminDishSuggestions, useDecideClaim, useDecideDishSuggestion } from '../../api/admin';
import { useT } from '../../i18n';
import { formatRelative, formatTry } from '../../lib/format';
import { spacing, useTheme } from '../../theme';
import type { Notify } from '../ui/Notice';
import { ActionButton, apiErrorText, ListState, useCardStyles, useRefreshControl } from './parts';

/** 🏪 "Bu mekan benim" başvuruları: onaylanınca üye mekanın esnafı olur (VENDOR) */
export function ClaimsTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const t = useT();
  const claims = useAdminClaims();
  const refresh = useRefreshControl(claims);
  const decide = useDecideClaim();

  const run = (id: string, decision: 'approve' | 'reject') =>
    decide.mutate(
      { id, decision },
      {
        onSuccess: () =>
          notify({ kind: 'success', text: decision === 'approve' ? t.adminCenter.claimApproved : t.adminCenter.claimRejected }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  return (
    <FlatList
      data={claims.data?.items ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListEmptyComponent={<ListState query={claims} emptyTitle={t.adminCenter.noClaims} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const busy = decide.isPending && decide.variables?.id === item.id ? decide.variables.decision : null;
        return (
          <View style={styles.card}>
            <View style={styles.header}>
              <Store size={16} color={colors.primary} />
              <Text style={styles.title}>{item.venue.name}</Text>
            </View>
            {item.venue.address && <Text style={styles.sub}>{item.venue.address}</Text>}
            <Text style={styles.sub}>
              {t.adminCenter.applicant}: {item.user.name}
              {item.user.email ? ` · ${item.user.email}` : ''}
              {item.phone ? ` · ${item.phone}` : ''} · {formatRelative(item.createdAt)}
            </Text>
            {item.note && (
              <View style={styles.quote}>
                <Text style={styles.body}>{item.note}</Text>
              </View>
            )}
            <View style={styles.actions}>
              <ActionButton
                label={t.adminCenter.reject}
                icon={<X size={16} color={colors.text} />}
                onPress={() => run(item.id, 'reject')}
                loading={busy === 'reject'}
                disabled={decide.isPending}
              />
              <ActionButton
                label={t.adminCenter.approve}
                icon={<Check size={16} color="#FFFFFF" />}
                onPress={() => run(item.id, 'approve')}
                loading={busy === 'approve'}
                disabled={decide.isPending}
                tone="success"
              />
            </View>
          </View>
        );
      }}
    />
  );
}

/** 🍲 Üyelerin menü önerileri: onaylanınca görseliyle mekanın menüsüne eklenir */
export function DishSuggestionsTab({ notify, bottom }: { notify: Notify; bottom: number }) {
  const { colors } = useTheme();
  const styles = useCardStyles();
  const t = useT();
  const suggestions = useAdminDishSuggestions();
  const refresh = useRefreshControl(suggestions);
  const decide = useDecideDishSuggestion();

  const run = (id: string, decision: 'approve' | 'reject') =>
    decide.mutate(
      { id, decision },
      {
        onSuccess: () =>
          notify({ kind: 'success', text: decision === 'approve' ? t.adminCenter.dishApproved : t.adminCenter.dishRejected }),
        onError: (err) => notify({ kind: 'error', text: apiErrorText(err, t) }),
      },
    );

  return (
    <FlatList
      data={suggestions.data?.items ?? []}
      keyExtractor={(s) => s.id}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + spacing.xxl * 2 }]}
      refreshControl={refresh}
      ListEmptyComponent={<ListState query={suggestions} emptyTitle={t.adminCenter.noDishSuggestions} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const busy = decide.isPending && decide.variables?.id === item.id ? decide.variables.decision : null;
        return (
          <View style={styles.card}>
            <View style={styles.header}>
              <UtensilsCrossed size={16} color={colors.primary} />
              <Text style={styles.title}>{item.localName}</Text>
            </View>
            <Text style={styles.sub}>
              {item.venue.name}
              {item.priceTry !== null ? ` · ${formatTry(item.priceTry)}` : ''}
              {item.portion ? ` · ${item.portion}` : ''}
            </Text>
            <Text style={styles.sub}>
              {item.userName ? `${t.adminCenter.suggestedBy(item.userName)} · ` : ''}
              {formatRelative(item.createdAt)}
            </Text>
            <View style={styles.actions}>
              <ActionButton
                label={t.adminCenter.reject}
                icon={<X size={16} color={colors.text} />}
                onPress={() => run(item.id, 'reject')}
                loading={busy === 'reject'}
                disabled={decide.isPending}
              />
              <ActionButton
                label={t.adminCenter.approve}
                icon={<Check size={16} color="#FFFFFF" />}
                onPress={() => run(item.id, 'approve')}
                loading={busy === 'approve'}
                disabled={decide.isPending}
                tone="success"
              />
            </View>
          </View>
        );
      }}
    />
  );
}
