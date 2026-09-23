import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

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

/** Dokunarak 1–5 puan seçimi */
export function StarPicker({ value, onChange, size = 32 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4} accessibilityLabel={`${i} / 5`}>
          <Star size={size} color={i <= value ? GOLD : EMPTY} fill={i <= value ? GOLD : EMPTY} />
        </Pressable>
      ))}
    </View>
  );
}
