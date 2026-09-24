import type { LatLng } from '@localbite/shared';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { LeafletView } from '../map/leaflet/LeafletView';

const PICKER_ZOOM = 17;

/** "Haritadan Konum Seç": pin sürüklenerek ya da haritaya dokunarak yer belirlenir */
export function LocationPickerModal({
  visible,
  initial,
  saving,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: LatLng;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (point: LatLng) => void;
}) {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<LatLng>(initial);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.screen}>
        {/* Her açılışta yeni harita: seçim önceki denemeden kalmasın */}
        {visible && (
          <LeafletView
            initialCenter={initial}
            initialZoom={PICKER_ZOOM}
            picker={initial}
            onPick={setPoint}
            style={styles.map}
          />
        )}

        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View style={styles.titlePill}>
            <Text style={font.heading}>{t.vendorPanel.pickerTitle}</Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.hint}>{t.vendorPanel.pickerHint}</Text>
          <Text style={styles.coords} selectable>
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
          </Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} disabled={saving} style={({ pressed }) => [styles.button, styles.outline, pressed && styles.pressed]}>
              <X size={18} color={colors.text} />
              <Text style={styles.outlineText}>{t.vendorPanel.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(point)}
              disabled={saving}
              accessibilityState={{ busy: saving }}
              style={({ pressed }) => [styles.button, styles.primary, (pressed || saving) && styles.pressed]}
            >
              {saving ? <ActivityIndicator color={colors.textInverse} /> : <Check size={18} color={colors.textInverse} />}
              <Text style={styles.primaryText}>{t.vendorPanel.pickerConfirm}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  titlePill: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, ...shadow.card },
  bottom: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  hint: { fontSize: 14, color: colors.text, fontWeight: '600' },
  coords: { fontSize: 12, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: radius.md, paddingHorizontal: spacing.md },
  outline: { borderWidth: 1, borderColor: colors.border },
  outlineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  primary: { flex: 1, backgroundColor: colors.primary },
  primaryText: { fontSize: 14, fontWeight: '800', color: colors.textInverse },
  pressed: { opacity: 0.7 },
}));
