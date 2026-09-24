import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { BadgeCheck, ChevronRight, Info, LogIn, LogOut, MapPinPlus, ShieldCheck, Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminReports } from '../../api/admin';
import { useSignOut } from '../../api/auth';
import { AvatarBadge } from '../../components/ui/Avatar';
import { LanguagePicker } from '../../components/settings/LanguagePicker';
import { SecurityPrivacyCard } from '../../components/settings/SecurityPrivacyCard';
import { ThemePicker } from '../../components/settings/ThemePicker';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { useCurrentUser } from '../../store/auth';
import { useExploreStore } from '../../store/explore';
import { AVATARS, useProfileStore } from '../../store/profile';
import { authorColor, makeStyles, radius, spacing, useTheme } from '../../theme';

export default function ProfileScreen() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const insets = useSafeAreaInsets();
  const openSuggest = useExploreStore((s) => s.openSuggest);
  const avatarId = useProfileStore((s) => s.avatarId);
  const setAvatar = useProfileStore((s) => s.setAvatar);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
      <Text style={font.title}>{t.profile.title}</Text>

      <AccountCard />

      <ModerationCard />

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

      <Card title={t.appearance.title} subtitle={t.appearance.subtitle}>
        <ThemePicker />
      </Card>

      <Card title={t.profile.language}>
        <LanguagePicker />
      </Card>

      <Card title={t.profile.contribute}>
        <Pressable onPress={openSuggest} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <MapPinPlus size={20} color={colors.textInverse} />
          <Text style={styles.ctaText}>{t.profile.spotCta}</Text>
        </Pressable>
      </Card>

      <SecurityPrivacyCard />

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

/** Misafir → giriş/kayıt çağrısı; üye → ad, e-posta, rol ve çıkış */
function AccountCard() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const user = useCurrentUser();
  const requireAuth = useRequireAuth();
  const signOut = useSignOut();

  if (!user) {
    return (
      <Card title={t.account.guest} subtitle={t.account.guestBody}>
        <Pressable onPress={() => requireAuth('profile')} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <LogIn size={20} color={colors.textInverse} />
          <Text style={styles.ctaText}>{t.account.signIn}</Text>
        </Pressable>
      </Card>
    );
  }

  const name = user.fullName ?? user.email ?? '';
  return (
    <Card title={t.account.title}>
      <View style={styles.accountRow}>
        <View style={[styles.accountInitial, { backgroundColor: authorColor(name) }]}>
          <Text style={styles.accountInitialText}>{name.charAt(0).toLocaleUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.accountName} numberOfLines={1}>
            {name}
          </Text>
          {user.email && (
            <Text style={font.small} numberOfLines={1}>
              {user.email}
            </Text>
          )}
          <View style={styles.badges}>
            <View style={styles.roleBadge}>
              <BadgeCheck size={12} color={colors.open} />
              <Text style={styles.roleText}>{t.account.roles[user.role]}</Text>
            </View>
            {user.isPremium && (
              <View style={[styles.roleBadge, styles.premiumBadge]}>
                <Sparkles size={12} color="#422006" />
                <Text style={[styles.roleText, { color: '#422006' }]}>{t.paywall.member}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          signOut();
        }}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}
      >
        <LogOut size={18} color={colors.danger} />
        <Text style={styles.signOutText}>{t.account.signOut}</Text>
      </Pressable>
    </Card>
  );
}

/** Yalnızca yöneticilere: bekleyen şikayet sayısıyla moderasyon ekranına geçiş */
function ModerationCard() {
  const user = useCurrentUser();
  if (user?.role !== 'ADMIN') return null;
  return <ModerationCardInner />;
}

function ModerationCardInner() {
  const { colors, font } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const pending = useAdminReports('PENDING').data?.items.length ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/admin')}
      style={({ pressed }) => [styles.card, styles.modCard, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${t.moderationPanel.open}${pending ? `, ${pending}` : ''}`}
    >
      <View style={styles.modIcon}>
        <ShieldCheck size={22} color={colors.textInverse} />
      </View>
      <View style={styles.flex}>
        <Text style={font.heading}>{t.moderationPanel.card}</Text>
        <Text style={styles.modBody}>{t.moderationPanel.cardBody}</Text>
      </View>
      {pending > 0 && (
        <View style={styles.modCount}>
          <Text style={styles.modCountText}>{pending}</Text>
        </View>
      )}
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { font } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={font.heading}>{title}</Text>
      {subtitle && <Text style={[font.small, { fontWeight: '400' }]}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  accountInitial: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  accountInitialText: { color: colors.textInverse, fontWeight: '800', fontSize: 22 },
  accountName: { fontSize: 16, fontWeight: '700', color: colors.text },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 4,
    backgroundColor: colors.openSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  roleText: { fontSize: 11, fontWeight: '700', color: colors.open },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  premiumBadge: { backgroundColor: '#FACC15' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  modCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.primary, borderWidth: 1.5 },
  modIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  modBody: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  modCount: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  modCountText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  about: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  aboutTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  aboutBody: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 2 },
}));
