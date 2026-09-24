import { pronunciationGuide, type DishDTO, type VenueType } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Leaf, Volume2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatTry } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { FoodImage } from '../ui/FoodImage';

/** Aynı anda tek yemek konuşur; başka birine basılınca öncekinin göstergesi söner */
let current: { reset: () => void } | null = null;

/** Cihazda Türkçe ses var mı (bir kez sorulur) */
let hasTurkishVoice: Promise<boolean> | undefined;
const turkishVoiceAvailable = () =>
  (hasTurkishVoice ??= Speech.getAvailableVoicesAsync()
    .then((voices) => voices.some((v) => v.language.toLowerCase().startsWith('tr')))
    .catch(() => false));

/** Yemeğin Türkçe adını Türkçe sesle okur (esnafa sipariş verirken taklit etmek için) */
function SpeakButton({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const [speaking, setSpeaking] = useState(false);
  const self = useRef({ reset: () => setSpeaking(false) });

  // Ekrandan çıkarken kendi konuşmasını keser
  useEffect(() => {
    const me = self.current;
    return () => {
      if (current === me) {
        current = null;
        Speech.stop();
      }
    };
  }, []);

  const speak = () => {
    Haptics.selectionAsync();
    current?.reset();
    Speech.stop();
    const me = self.current;
    current = me;
    setSpeaking(true);
    const done = () => {
      if (current === me) current = null;
      setSpeaking(false);
    };
    // Yavaşça: turist tekrar edebilsin. Türkçe ses paketi yoksa okunuş rehberini İngilizce sesle oku
    turkishVoiceAvailable().then((turkish) =>
      Speech.speak(turkish ? text : pronunciationGuide(text), {
        language: turkish ? 'tr-TR' : 'en-US',
        rate: 0.8,
        onDone: done,
        onStopped: done,
        onError: done,
      }),
    );
  };

  return (
    <Pressable
      onPress={speak}
      hitSlop={10}
      style={[styles.speak, speaking && styles.speakActive]}
      accessibilityRole="button"
      accessibilityLabel={t.detail.pronounce(text)}
    >
      <Volume2 size={16} color={speaking ? colors.textInverse : colors.primary} />
    </Pressable>
  );
}

/** Menü satırı: fotoğraf, Türkçe ad + sesli telaffuz + okunuş, çeviri, açıklama, porsiyon fiyatı */
export function DishRow({ dish, venueType, isMobile }: { dish: DishDTO; venueType: VenueType; isMobile: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();

  return (
    <View style={styles.row}>
      <View>
        <FoodImage
          uri={dish.imageUrl}
          subject={dish.localName}
          type={venueType}
          isMobile={isMobile}
          style={styles.image}
          emojiSize={28}
        />
      </View>

      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{dish.localName}</Text>
          <SpeakButton text={dish.localName} />
          {dish.isVegetarian && <Leaf size={14} color={colors.open} accessibilityLabel={t.detail.vegetarian} />}
        </View>
        <Text style={styles.phonetic} accessibilityLabel={`${t.detail.sayIt}: ${pronunciationGuide(dish.localName)}`}>
          ({pronunciationGuide(dish.localName)})
        </Text>
        {dish.name !== dish.localName && <Text style={styles.translated}>{dish.name}</Text>}
        {dish.description && <Text style={styles.description}>{dish.description}</Text>}

        <View style={styles.footer}>
          {dish.priceTry !== null && (
            <View style={styles.price}>
              <Text style={styles.priceText}>{t.detail.portion(formatTry(dish.priceTry))}</Text>
            </View>
          )}
          {dish.portion && <Text style={styles.portionText}>{dish.portion}</Text>}
        </View>
        {/* CC lisansı atfın tam ve görünür olmasını ister; dokununca kaynak sayfa açılır */}
        {dish.imageCredit && (
          <Pressable
            onPress={() => dish.imageSourceUrl && Linking.openURL(dish.imageSourceUrl)}
            disabled={!dish.imageSourceUrl}
            hitSlop={6}
            accessibilityRole="link"
          >
            <Text style={styles.credit}>{t.detail.photoCredit(dish.imageCredit)}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  image: { width: 84, height: 84, borderRadius: radius.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  speak: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  speakActive: { backgroundColor: colors.primary },
  phonetic: { fontSize: 13, color: colors.primary, fontStyle: 'italic', marginTop: 1 },
  translated: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  description: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  price: {
    backgroundColor: colors.openSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  priceText: { fontSize: 12, fontWeight: '800', color: colors.open },
  portionText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  credit: { fontSize: 10, color: colors.textMuted, marginTop: 6, textDecorationLine: 'underline' },
}));
