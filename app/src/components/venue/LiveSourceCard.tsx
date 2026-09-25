import type { VenueSource } from '@localbite/shared';
import { ExternalLink, Globe } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Canlı dış kaynaktan (OSM/Google) gelen yer için atıf kartı: lisans gereği kaynak görünür ve bağlantılı */
export function LiveSourceCard({ source, url }: { source: Exclude<VenueSource, 'LOCALBITE'>; url: string | null }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Globe size={18} color={colors.textMuted} />
        <Text style={styles.source}>{t.liveSource[source]}</Text>
      </View>
      <Text style={styles.note}>{t.liveSource.note}</Text>
      {url && (
        <Pressable
          onPress={() => Linking.openURL(url)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          accessibilityRole="link"
        >
          <ExternalLink size={15} color={colors.primary} />
          <Text style={styles.linkText}>{t.liveSource.open}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  source: { fontSize: 14, fontWeight: '700', color: colors.text },
  note: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  linkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.8 },
}));
