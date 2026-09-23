import type { VenueSummaryDTO } from '@localbite/shared';
import { useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { spacing } from '../../theme';
import { VenueCard } from './VenueCard';

interface Props {
  venues: VenueSummaryDTO[];
  selectedId: string | null;
  /** Kullanıcı kaydırarak başka karta geçtiğinde */
  onSnapTo: (id: string) => void;
  onOpen: (id: string) => void;
}

const GAP = spacing.md;

export function VenueCarousel({ venues, selectedId, onSnapTo, onOpen }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 360);
  const interval = cardWidth + GAP;
  const sidePadding = (screenWidth - cardWidth) / 2;

  const listRef = useRef<FlatList<VenueSummaryDTO>>(null);
  const currentIndex = useRef(0);

  // Pin'e basıldığında ilgili karta kay
  useEffect(() => {
    const index = venues.findIndex((v) => v.id === selectedId);
    if (index >= 0 && index !== currentIndex.current) {
      currentIndex.current = index;
      listRef.current?.scrollToOffset({ offset: index * interval, animated: true });
    }
  }, [selectedId, venues, interval]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / interval);
    const venue = venues[Math.max(0, Math.min(index, venues.length - 1))];
    if (!venue) return;
    currentIndex.current = index;
    if (venue.id !== selectedId) onSnapTo(venue.id);
  };

  return (
    <FlatList
      ref={listRef}
      data={venues}
      keyExtractor={(v) => v.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={interval}
      snapToAlignment="start"
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={[styles.content, { paddingHorizontal: sidePadding }]}
      ItemSeparatorComponent={Separator}
      onMomentumScrollEnd={onMomentumEnd}
      renderItem={({ item }) => (
        <VenueCard venue={item} width={cardWidth} selected={item.id === selectedId} onPress={onOpen} />
      )}
    />
  );
}

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.sm, alignItems: 'flex-end' },
  separator: { width: GAP },
});
