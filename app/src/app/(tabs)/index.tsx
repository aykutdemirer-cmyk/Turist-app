import type { VenueType } from '@localbite/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearbyVenues } from '../../api/venues';
import {
  CanteenRow,
  CategoryShortcuts,
  EmptyNote,
  HomeHeader,
  LiveCartsRow,
  MapCallout,
  SectionHeader,
} from '../../components/home/HomeCards';
import { AvatarPickerModal } from '../../components/ui/Avatar';
import { DEFAULT_CENTER, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { NO_FILTERS, useExploreStore } from '../../store/explore';
import { useAvatarFace } from '../../store/profile';
import { colors, spacing } from '../../theme';

const MAX_CANTEENS = 4;

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const avatarFace = useAvatarFace();
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const showOnlyCategory = useExploreStore((s) => s.showOnlyCategory);

  const location = useUserLocation();
  const center = location.coords ?? (location.status !== 'pending' ? DEFAULT_CENTER : null);
  const nearby = useNearbyVenues(center, NO_FILTERS);

  const { liveCarts, canteens, total } = useMemo(() => {
    const items = nearby.data?.items ?? [];
    return {
      liveCarts: items.filter((v) => v.isMobile && v.isActiveNow),
      // API zaten mesafeye göre sıralı döner
      canteens: items.filter((v) => v.type === 'HOME_COOKING').slice(0, MAX_CANTEENS),
      total: items.length,
    };
  }, [nearby.data]);

  const openMap = () => router.navigate('/map');
  const openVenue = (id: string) => router.push({ pathname: '/venue/[id]', params: { id } });
  const pickCategory = (type: VenueType) => {
    showOnlyCategory(type);
    openMap();
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={nearby.isRefetching} onRefresh={() => nearby.refetch()} tintColor={colors.primary} />
        }
      >
        <View style={styles.padded}>
          <HomeHeader face={avatarFace} onAvatarPress={() => setAvatarPickerOpen(true)} />
          <MapCallout count={total} onPress={openMap} />
        </View>

        <View style={styles.padded}>
          <SectionHeader title={t.home.categoriesTitle} />
          <CategoryShortcuts onPick={pickCategory} />
        </View>

        <View style={styles.section}>
          <View style={styles.padded}>
            <SectionHeader title={t.home.liveTitle} live action={t.home.seeOnMap} onAction={() => pickCategory('STREET_CART')} />
          </View>
          {nearby.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : liveCarts.length > 0 ? (
            <LiveCartsRow venues={liveCarts} onOpen={openVenue} />
          ) : (
            <View style={styles.padded}>
              <EmptyNote text={t.home.liveEmpty} />
            </View>
          )}
        </View>

        <View style={styles.padded}>
          <SectionHeader title={t.home.nearbyTitle} action={t.home.seeOnMap} onAction={() => pickCategory('HOME_COOKING')} />
          {nearby.isPending ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : canteens.length > 0 ? (
            canteens.map((v) => <CanteenRow key={v.id} venue={v} onOpen={openVenue} />)
          ) : (
            <EmptyNote text={t.home.nearbyEmpty} />
          )}
        </View>
      </ScrollView>

      <AvatarPickerModal visible={avatarPickerOpen} onClose={() => setAvatarPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl, gap: spacing.xl },
  padded: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { gap: spacing.xs },
  loader: { paddingVertical: spacing.xl },
});
