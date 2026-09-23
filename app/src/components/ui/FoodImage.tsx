import type { VenueType } from '@localbite/shared';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { colors, venueTypeMeta } from '../../theme';

/** Yemek adındaki anahtar kelimeye göre illüstrasyon emojisi (ilk eşleşen kazanır) */
const DISH_EMOJI: [RegExp, string][] = [
  [/pilav/, '🍚'],
  [/fasulye|nohut/, '🫘'],
  [/çorba|mercimek|yayla/, '🥣'],
  [/balık|uskumru/, '🐟'],
  [/kestane/, '🌰'],
  [/mısır/, '🌽'],
  [/burger/, '🍔'],
  [/dürüm|adana|ciğer/, '🌯'],
  [/köfte/, '🥙'],
  [/ayran/, '🥛'],
  [/mantı/, '🥟'],
  [/dolma|biber/, '🫑'],
  [/sütlaç|muhallebi/, '🍮'],
  [/şalgam/, '🥤'],
  [/turşu/, '🥒'],
  [/patates/, '🍟'],
  [/karnıyarık|imam|hünkar|patlıcan/, '🍆'],
  [/enginar/, '🥬'],
  [/baklava|tatlı/, '🍯'],
  [/çay|kahve/, '☕'],
];

export function dishEmoji(name: string | undefined, fallbackType: VenueType): string {
  const lower = name?.toLocaleLowerCase('tr') ?? '';
  return DISH_EMOJI.find(([re]) => re.test(lower))?.[1] ?? venueTypeMeta[fallbackType].emoji;
}

interface Props {
  uri: string | null | undefined;
  /** Fotoğraf yoksa illüstrasyonun konusu (ör. öne çıkan yemeğin adı) */
  subject?: string;
  type: VenueType;
  isMobile?: boolean;
  style?: StyleProp<ViewStyle>;
  emojiSize?: number;
}

/**
 * Mekan/yemek görseli. Fotoğraf varsa gösterir; yoksa yemeğe uygun emoji ve
 * kategori renginde zeminle illüstrasyon çizer (sahte fotoğraf kullanmıyoruz).
 */
export function FoodImage({ uri, subject, type, isMobile = false, style, emojiSize = 56 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        // Boyut/kenar stilleri görsele aynen uygulanır
        style={[styles.base, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const tint = isMobile ? colors.mobile : venueTypeMeta[type].color;
  return (
    <View style={[styles.base, { backgroundColor: `${tint}1F` }, style]} accessibilityElementsHidden>
      <View style={[styles.blob, styles.blobA, { backgroundColor: `${tint}26` }]} />
      <View style={[styles.blob, styles.blobB, { backgroundColor: `${tint}1A` }]} />
      <Text style={{ fontSize: emojiSize }}>{dishEmoji(subject, type)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  blob: { position: 'absolute', borderRadius: 999 },
  blobA: { width: '70%', aspectRatio: 1, top: '-25%', right: '-15%' },
  blobB: { width: '55%', aspectRatio: 1, bottom: '-25%', left: '-10%' },
});
