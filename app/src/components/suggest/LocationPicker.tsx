import type { LatLng } from '@localbite/shared';
import { MapPin, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors, radius, shadow, spacing } from '../../theme';
import { LeafletView, type MapUser } from '../map/leaflet/LeafletView';

interface Props {
  initial: LatLng;
  user: MapUser | null;
  bottomInset: number;
  onConfirm: (location: LatLng) => void;
  onCancel: () => void;
}

const PICKER_ZOOM = 17; // sokak seviyesi

/** Pin ekranın ortasında sabit; kullanıcı haritayı kaydırarak yeri ayarlar. */
export function LocationPicker({ initial, user, bottomInset, onConfirm, onCancel }: Props) {
  const t = useT();
  const [center, setCenter] = useState<LatLng>(initial);

  return (
    <View style={styles.container}>
      <LeafletView
        style={StyleSheet.absoluteFill}
        initialCenter={initial}
        initialZoom={PICKER_ZOOM}
        user={user}
        onMoveEnd={setCenter}
      />

      {/* İğne ucu tam merkezde olsun diye ikon yüksekliğinin yarısı kadar yukarı */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <MapPin size={44} color={colors.primary} fill={colors.primarySoft} strokeWidth={2.2} />
        <View style={styles.pinShadow} />
      </View>

      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>{t.suggest.pickerHint}</Text>
      </View>

      <Pressable onPress={onCancel} style={styles.cancel} accessibilityLabel={t.suggest.close} hitSlop={8}>
        <X size={20} color={colors.text} />
      </Pressable>

      <View style={[styles.footer, { paddingBottom: bottomInset + spacing.lg }]}>
        <Pressable
          onPress={() => onConfirm(center)}
          style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}
        >
          <MapPin size={18} color={colors.textInverse} />
          <Text style={styles.confirmText}>{t.suggest.confirmLocation}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pressed: { opacity: 0.8 },
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -22 }],
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: -2,
  },
  hint: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xxl + spacing.xl,
    right: spacing.xxl + spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...shadow.pin,
  },
  hintText: { textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.text },
  cancel: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.pin,
  },
  footer: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0 },
  confirm: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  confirmText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
});
