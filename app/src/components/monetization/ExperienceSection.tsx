import type { ExperienceDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { ExternalLink, Handshake, Signal, Ticket } from 'lucide-react-native';
import { createElement } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useExperiences } from '../../api/monetization';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

const PARTNER_COLOR: Record<ExperienceDTO['partner'], string> = {
  GetYourGuide: '#FF5533',
  Viator: '#186B6D',
  Airalo: '#1A1A1A',
};

/**
 * "Deneyimler & İpuçları": iş ortaklığı kartları. Her kart "İş Ortaklığı" rozetli; bağlantı harici tarayıcıda açılır.
 * venueId verilirse o mekanın ilçesine uygun deneyimler gösterilir.
 */
export function ExperienceSection({ venueId = null }: { venueId?: string | null }) {
  const styles = useStyles();
  const t = useT();
  const { data } = useExperiences(venueId);
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.experiences.title}</Text>
        <Text style={styles.subtitle}>{t.experiences.subtitle}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((e) => (
          <ExperienceCard key={e.id} item={e} />
        ))}
      </ScrollView>
      <Text style={styles.disclosure}>{t.experiences.disclosure}</Text>
    </View>
  );
}

function ExperienceCard({ item }: { item: ExperienceDTO }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        Linking.openURL(item.url);
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}, ${item.partner}, ${t.experiences.sponsored}`}
    >
      <View style={[styles.cardTop, { backgroundColor: PARTNER_COLOR[item.partner] }]}>
        {createElement(item.kind === 'connectivity' ? Signal : Ticket, { size: 22, color: '#FFFFFF' })}
        <Text style={styles.partner}>{item.partner}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.badge}>
          <Handshake size={11} color={colors.warning} />
          <Text style={styles.badgeText}>{t.experiences.sponsored}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardText} numberOfLines={3}>
          {item.description}
        </Text>
        <View style={styles.open}>
          <ExternalLink size={13} color={colors.primary} />
          <Text style={styles.openText}>{item.partner}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  section: { gap: spacing.sm },
  header: { gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  row: { gap: spacing.md, paddingRight: spacing.lg },
  card: {
    width: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardTop: { height: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  partner: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cardBody: { padding: spacing.md, gap: 6, flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 20 },
  cardText: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: 4 },
  openText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  disclosure: { fontSize: 11, color: colors.textMuted },
}));
