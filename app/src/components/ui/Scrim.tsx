import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Fotoğraf üstüne okunabilir metin için aşağı doğru koyulaşan siyah geçiş.
 * from: geçişin başladığı yükseklik (0 = üst, 1 = alt); üst kısım fotoğraf olarak kalır.
 */
export function Scrim({ from = 0.35, opacity = 0.88, style }: { from?: number; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={String(from)} stopColor="#000000" stopOpacity="0" />
            <Stop offset={String(from + (1 - from) * 0.45)} stopColor="#000000" stopOpacity={String(opacity * 0.55)} />
            <Stop offset="1" stopColor="#000000" stopOpacity={String(opacity)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#s${id})`} />
      </Svg>
    </View>
  );
}
