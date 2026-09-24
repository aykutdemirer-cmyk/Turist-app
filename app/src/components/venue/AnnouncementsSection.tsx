import type { PublicAnnouncementDTO } from '@localbite/shared';
import { Megaphone, Tag } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useT } from '../../i18n';
import { formatRelative } from '../../lib/format';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/** Satıcının onaylı duyuruları; yalnızca yayında olan varsa görünür */
export function AnnouncementsSection({ items }: { items: PublicAnnouncementDTO[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {items.map((a) => {
        const promo = a.type === 'PROMOTION';
        const Icon = promo ? Tag : Megaphone;
        return (
          <View key={a.id} style={[styles.card, promo && styles.promo]}>
            <View style={[styles.icon, { backgroundColor: promo ? colors.warning : colors.primary }]}>
              <Icon size={16} color={colors.textInverse} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.kicker}>
                {t.liveLocation.fromVendor} · {t.liveLocation[`type${a.type}`]} · {formatRelative(a.publishedAt)}
              </Text>
              <Text style={styles.title}>{a.title}</Text>
              <Text style={styles.body}>{a.content}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  promo: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
}));
