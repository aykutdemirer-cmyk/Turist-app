import type { ExperienceDTO } from '@localbite/shared';
import * as Haptics from 'expo-haptics';
import { ExternalLink, Handshake, Signal, Ticket } from 'lucide-react-native';
import { createElement, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { resolveMediaUrl } from '../../api/config';
import { useExperiences } from '../../api/monetization';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';
import { Scrim } from '../ui/Scrim';

/** Fotoğraf yüklenemezse kullanılan zemin rengi */
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
  const photo = resolveMediaUrl(item.imageUrl);
  const [failed, setFailed] = useState(false);

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
      {/* İstanbul fotoğrafı; ortak adı küçük beyaz rozet (marka logosu kullanılmaz) */}
      <View style={[styles.cardTop, { backgroundColor: PARTNER_COLOR[item.partner] }]}>
        {photo && !failed && (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        )}
        <Scrim from={0.45} opacity={0.6} />
        <View style={styles.partnerBadge}>
          {createElement(item.kind === 'connectivity' ? Signal : Ticket, { size: 12, color: '#111111', strokeWidth: 2.4 })}
          <Text style={styles.partner}>{item.partner}</Text>
        </View>
        {item.imageCredit && photo && !failed && (
          <Text style={styles.credit} numberOfLines={1}>
            {item.imageCredit}
          </Text>
        )}
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
    width: 248,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardTop: { height: 128, overflow: 'hidden' },
  partnerBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  partner: { color: '#111111', fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },
  credit: { position: 'absolute', right: spacing.sm, bottom: 4, left: spacing.sm, textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,0.75)' },
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
