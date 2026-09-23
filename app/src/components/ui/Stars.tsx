import { Star } from 'lucide-react-native';
import { View } from 'react-native';

const GOLD = '#F59E0B';
const EMPTY = '#E5DED3';

/** 1–5 yıldız (tam sayı; yarım yıldız gösterilmez) */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= full ? GOLD : EMPTY} fill={i <= full ? GOLD : EMPTY} />
      ))}
    </View>
  );
}
