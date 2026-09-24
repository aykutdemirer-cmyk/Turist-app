import Svg, { Path } from 'react-native-svg';

/**
 * Döner şişi silüeti: lucide ikonlarıyla aynı çizgi dili (24×24, yuvarlak uçlu kontur).
 * Lucide'da döner yok; "drumstick" tavuk budu olduğu için yanıltıcı olurdu.
 */
export function DonerIcon({ size = 24, color = 'currentColor', strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* şiş */}
      <Path d="M12 2v3M12 18v3" />
      {/* yukarıda geniş, aşağı daralan et kulesi */}
      <Path d="M6.5 5h11l-2.5 13h-6Z" />
      {/* et katmanları */}
      <Path d="M7.4 9.5h9.2M8.3 14h7.4" />
      {/* altlık */}
      <Path d="M8 21h8" />
    </Svg>
  );
}
