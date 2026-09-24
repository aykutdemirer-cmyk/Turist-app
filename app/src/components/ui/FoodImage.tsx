import type { VenueType } from '@localbite/shared';
import {
  Bean,
  Beef,
  CakeSlice,
  Carrot,
  Coffee,
  CupSoda,
  Fish,
  Flame,
  Hamburger,
  Milk,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { createElement, useId, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { resolveMediaUrl } from '../../api/config';
import { makeStyles, venueTypeMeta } from '../../theme';

/** Yemek adındaki anahtar kelimeye göre ikon (ilk eşleşen kazanır) */
const DISH_ICONS: [RegExp, LucideIcon][] = [
  [/pilav|mantı|makarna/, Wheat],
  [/fasulye|nohut/, Bean],
  [/çorba|mercimek|yayla|paça/, Soup],
  [/balık|uskumru|midye/, Fish],
  [/burger/, Hamburger],
  [/dürüm|adana|ciğer|kokoreç|köfte|kebap/, Flame],
  [/et |kavurma|kuzu/, Beef],
  [/ayran|süt/, Milk],
  [/dolma|biber|patlıcan|karnıyarık|imam|enginar|zeytinyağlı/, Carrot],
  [/salata|turşu/, Salad],
  [/sütlaç|muhallebi|baklava|tatlı|künefe/, CakeSlice],
  [/şalgam|limonata/, CupSoda],
  [/çay|kahve|salep/, Coffee],
  [/tost|sandviç|simit/, Sandwich],
];

export function dishIcon(name: string | undefined, fallbackType: VenueType): LucideIcon {
  const lower = name?.toLocaleLowerCase('tr') ?? '';
  return DISH_ICONS.find(([re]) => re.test(lower))?.[1] ?? venueTypeMeta[fallbackType].Icon;
}

interface Props {
  uri: string | null | undefined;
  /** Fotoğraf yoksa kapak ikonunun konusu (ör. öne çıkan yemeğin adı) */
  subject?: string;
  type: VenueType;
  isMobile?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Yer tutucu ikonun boyutu */
  emojiSize?: number;
}

/**
 * Mekan/yemek kapağı. Fotoğraf varsa gösterir; yoksa kategori renginde zengin degrade üzerine
 * yemeğe uygun ikon çizer. Mekanı temsil etmeyen stok fotoğraf bilinçli olarak kullanılmıyor.
 */
export function FoodImage({ uri, subject, type, isMobile = false, style, emojiSize = 56 }: Props) {
  const styles = useStyles();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const src = resolveMediaUrl(uri);
  // Yüklenemeyen fotoğraf (ağ/404) sessizce illüstrasyona düşer
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc) {
    return (
      <Image
        source={{ uri: src }}
        style={[styles.base, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
        onError={() => setFailedSrc(src)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const [from, to] = isMobile ? venueTypeMeta.STREET_CART.gradient : venueTypeMeta[type].gradient;
  const ring = Math.round(emojiSize * 1.9);

  return (
    <View style={[styles.base, style]} accessibilityElementsHidden>
      <Svg style={styles.fill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          <RadialGradient id={`h${id}`} cx="0.75" cy="0.2" r="0.7">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#g${id})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#h${id})`} />
        {/* Hafif desen: dağınık halkalar */}
        <Circle cx="12" cy="85" r="22" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="6" />
        <Circle cx="92" cy="12" r="14" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="4" />
      </Svg>
      <View style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2 }]}>
        {createElement(dishIcon(subject, type), { size: emojiSize, color: '#FFFFFF', strokeWidth: 1.6 })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  base: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
}));
