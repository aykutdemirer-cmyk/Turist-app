import type { LatLng } from '@localbite/shared';
import { Crosshair, MapPin } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { colors, font, radius, spacing } from '../../theme';
import { LeafletView } from '../map/leaflet/LeafletView';

export type LocationSource = 'gps' | 'map';

interface Props {
  location: LatLng | null;
  source: LocationSource | null;
  locating: boolean;
  hasError: boolean;
  onUseMyLocation: () => void;
  onPickOnMap: () => void;
}

const PREVIEW_ZOOM = 17;

/** Formdaki etkileşimsiz mini harita; ayar için tam ekran seçici açılır. */
export function LocationPreview({ location, source, locating, hasError, onUseMyLocation, onPickOnMap }: Props) {
  const t = useT();
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPickOnMap}
        style={[styles.preview, hasError && styles.previewError]}
        accessibilityLabel={location ? t.suggest.adjustOnMap : t.suggest.pickOnMap}
      >
        {location ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LeafletView
              key={`${location.latitude},${location.longitude}`}
              initialCenter={location}
              initialZoom={PREVIEW_ZOOM}
              interactive={false}
            />
            <View style={styles.pinWrap}>
              <MapPin size={34} color={colors.primary} fill={colors.primarySoft} strokeWidth={2.2} />
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <MapPin size={28} color={colors.textMuted} />}
            <Text style={font.small}>{locating ? t.suggest.locating : t.suggest.noLocation}</Text>
          </View>
        )}
      </Pressable>

      {location && source && (
        <Text style={styles.source}>
          {source === 'gps' ? t.suggest.locationFromGps : t.suggest.locationFromMap} · {location.latitude.toFixed(5)},{' '}
          {location.longitude.toFixed(5)}
        </Text>
      )}

      <View style={styles.buttons}>
        <Pressable
          onPress={onUseMyLocation}
          disabled={locating}
          style={({ pressed }) => [styles.button, source === 'gps' && styles.buttonActive, pressed && styles.pressed]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Crosshair size={16} color={colors.primary} />
          )}
          <Text style={styles.buttonText} numberOfLines={1}>
            {locating ? t.suggest.locating : t.suggest.useMyLocation}
          </Text>
        </Pressable>
        <Pressable
          onPress={onPickOnMap}
          style={({ pressed }) => [styles.button, source === 'map' && styles.buttonActive, pressed && styles.pressed]}
        >
          <MapPin size={16} color={colors.primary} />
          <Text style={styles.buttonText} numberOfLines={1}>
            {location ? t.suggest.adjustOnMap : t.suggest.pickOnMap}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  pressed: { opacity: 0.8 },
  preview: {
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  previewError: { borderColor: colors.danger },
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -17 }],
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  source: { ...font.tiny },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  buttonActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.primary, flexShrink: 1 },
});
