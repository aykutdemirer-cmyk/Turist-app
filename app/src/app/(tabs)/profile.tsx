import * as Haptics from 'expo-haptics';
import { Info, MapPinPlus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarBadge } from '../../components/ui/Avatar';
import { LanguageSwitcher } from '../../components/ui/LanguageSwitcher';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { AVATARS, useProfileStore } from '../../store/profile';
import { colors, font, radius, spacing } from '../../theme';

export default function ProfileScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const openSuggest = useExploreStore((s) => s.openSuggest);
  const avatarId = useProfileStore((s) => s.avatarId);
  const setAvatar = useProfileStore((s) => s.setAvatar);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
      <Text style={font.title}>{t.profile.title}</Text>

      <Card title={t.profile.avatar} subtitle={t.avatar.subtitle}>
        <View style={styles.avatars}>
          {AVATARS.map((a) => {
            const active = a.id === avatarId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAvatar(a.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.avatarOption, active && styles.avatarActive]}
              >
                <AvatarBadge face={a.face} size={48} />
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title={t.profile.language}>
        <View style={styles.languageRow}>
          <Text style={[font.body, styles.flex]}>{t.language.label}</Text>
          <LanguageSwitcher />
        </View>
      </Card>

      <Card title={t.profile.contribute}>
        <Pressable onPress={openSuggest} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <MapPinPlus size={20} color={colors.textInverse} />
          <Text style={styles.ctaText}>{t.profile.spotCta}</Text>
        </Pressable>
      </Card>

      <View style={styles.about}>
        <Info size={16} color={colors.textMuted} />
        <View style={styles.flex}>
          <Text style={styles.aboutTitle}>{t.profile.about}</Text>
          <Text style={styles.aboutBody}>{t.profile.aboutBody}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={font.heading}>{title}</Text>
      {subtitle && <Text style={[font.small, { fontWeight: '400' }]}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  avatarOption: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  languageRow: { flexDirection: 'row', alignItems: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },
  about: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  aboutTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  aboutBody: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
});
