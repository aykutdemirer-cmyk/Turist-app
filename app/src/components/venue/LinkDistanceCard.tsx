import { haversineMeters, type LatLng, type VenueDetailDTO } from '@localbite/shared';
import { Navigation, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getPreciseLocation, useUserLocation } from '../../hooks/useUserLocation';
import { useLanguage, useT } from '../../i18n';
import { openDirections } from '../../lib/directions';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Paylaşılan bağlantıyla açılan mekan bu mesafeden uzaktaysa yol tarifi önerilir */
export const FAR_FROM_LINK_M = 3_000;

/**
 * Paylaşılan bağlantıyla gelen kullanıcıya: mekan uzaktaysa kibar bir bilgi kartı ve "Yol Tarifi Al".
 * Konum zaten biliniyorsa onu kullanır; değilse (bağlantı uygulamayı soğuk açtıysa) bir kez ister.
 */
export function LinkDistanceCard({ venue, bottom }: { venue: VenueDetailDTO; bottom: number }) {
  const { colors, shadow } = useTheme();
  const styles = useStyles();
  const t = useT();
  const language = useLanguage();
  const known = useUserLocation().coords;
  const [fetched, setFetched] = useState<LatLng | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (known) return;
    let alive = true;
    getPreciseLocation().then((c) => {
      if (alive) setFetched(c);
    });
    return () => {
      alive = false;
    };
  }, [known]);

  const origin = known ?? fetched;
  if (!origin || dismissed) return null;
  const meters = haversineMeters(origin, venue);
  if (meters <= FAR_FROM_LINK_M) return null;

  const km = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(meters / 1_000);
  const area = venue.neighborhood ?? venue.district;

  return (
    <View style={[styles.card, shadow.card, { bottom: bottom + spacing.lg }]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{t.linkDistance.far(venue.name, area, km)}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={() => openDirections(venue.latitude, venue.longitude, venue.name)}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Navigation size={16} color={colors.textInverse} />
          <Text style={styles.primaryText}>{t.linkDistance.directions}</Text>
        </Pressable>
        <Pressable
          onPress={() => setDismissed(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.linkDistance.dismiss}
        >
          <X size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryText: { color: colors.textInverse, fontWeight: '800', fontSize: 14 },
  close: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
}));
