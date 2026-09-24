import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Clock, Compass, Coffee, Mic, Sparkles, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../api/client';
import { EXPLORER_PASS_PRICE, useMockPurchase, usePaywall, useRestorePurchases } from '../../api/monetization';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

/**
 * Explorer Pass satış ekranı. Mağaza kuralları gereği:
 *  - yalnızca gerçekten çalışan özellikler "dahil" gösterilir, diğerleri "Yakında" etiketlidir
 *  - "Satın alımları geri yükle" ve Şartlar bağlantısı bulunur
 * Mağaza ödemesi bağlanana kadar "Satın Al" test satın alması yapar (sunucu yalnızca geliştirmede izin verir).
 */
export function Paywall() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { visible, close } = usePaywall();
  const requireAuth = useRequireAuth();
  const purchase = useMockPurchase();
  const restore = useRestorePurchases();
  const busy = purchase.isPending || restore.isPending;

  const features: { key: keyof typeof t.paywall.features; Icon: LucideIcon; available: boolean }[] = [
    { key: 'trails', Icon: Compass, available: true },
    { key: 'offline', Icon: WifiOff, available: false },
    { key: 'tea', Icon: Coffee, available: false },
    { key: 'voice', Icon: Mic, available: false },
  ];

  const finish = () => {
    const { onUnlocked } = usePaywall.getState();
    close();
    onUnlocked?.();
  };

  // Satın alma hesaba bağlanır (geri yükleme ve cihaz değişimi için): önce giriş
  const buy = () => {
    const onUnlocked = usePaywall.getState().onUnlocked;
    close();
    requireAuth('profile', () => {
      usePaywall.getState().open(onUnlocked ?? undefined);
      purchase.mutate(undefined, {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t.paywall.success);
          finish();
        },
        onError: () => Alert.alert(t.paywall.failed),
      });
    });
  };

  const restorePurchases = () => {
    const onUnlocked = usePaywall.getState().onUnlocked;
    close();
    requireAuth('profile', () => {
      usePaywall.getState().open(onUnlocked ?? undefined);
      restore.mutate(undefined, {
        onSuccess: (res) => {
          Alert.alert(res.user.isPremium ? t.paywall.restored : t.paywall.nothingToRestore);
          if (res.user.isPremium) finish();
        },
        onError: (err) => Alert.alert(err instanceof ApiError ? err.message : t.paywall.failed),
      });
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Sparkles size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{t.paywall.title}</Text>
            <Text style={styles.subtitle}>{t.paywall.subtitle}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t.paywall.included}</Text>
          <View style={styles.features}>
            {features.map(({ key, Icon, available }) => (
              <View key={key} style={styles.feature}>
                <View style={[styles.featureIcon, !available && styles.featureIconSoon]}>
                  <Icon size={18} color={available ? colors.primary : colors.textMuted} />
                </View>
                <Text style={[styles.featureText, !available && styles.featureTextSoon]}>{t.paywall.features[key]}</Text>
                {!available && (
                  <View style={styles.soon}>
                    <Clock size={11} color={colors.textMuted} />
                    <Text style={styles.soonText}>{t.paywall.soon}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.priceBox}>
            <Text style={styles.price}>{EXPLORER_PASS_PRICE}</Text>
            <Text style={styles.priceNote}>{t.paywall.oneTime}</Text>
          </View>

          <Pressable
            onPress={buy}
            disabled={busy}
            style={({ pressed }) => [styles.buy, (pressed || busy) && styles.pressed]}
            accessibilityRole="button"
          >
            {purchase.isPending ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buyText}>{t.paywall.buy(EXPLORER_PASS_PRICE)}</Text>
            )}
          </Pressable>
          <Pressable onPress={close} style={styles.later} accessibilityRole="button">
            <Text style={styles.laterText}>{t.paywall.later}</Text>
          </Pressable>

          {__DEV__ && <Text style={styles.testMode}>{t.paywall.testMode}</Text>}

          <View style={styles.footer}>
            <Pressable onPress={restorePurchases} disabled={busy} hitSlop={8}>
              <Text style={styles.footerLink}>{t.paywall.restore}</Text>
            </Pressable>
            <Text style={styles.dot}>·</Text>
            <Pressable
              onPress={() => {
                close();
                router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } });
              }}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>{t.legal.terms}</Text>
            </Pressable>
          </View>
          <Text style={styles.legal}>{t.paywall.legal}</Text>
        </ScrollView>

        <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityLabel={t.paywall.later}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  features: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconSoon: { backgroundColor: colors.surfaceMuted },
  featureText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  featureTextSoon: { color: colors.textMuted },
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  soonText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  priceBox: { alignItems: 'center', marginTop: spacing.sm },
  price: { fontSize: 34, fontWeight: '900', color: colors.text },
  priceNote: { fontSize: 13, color: colors.textMuted },
  buy: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  buyText: { color: colors.textInverse, fontWeight: '800', fontSize: 17 },
  later: { alignItems: 'center', paddingVertical: spacing.sm },
  laterText: { color: colors.textMuted, fontWeight: '700', fontSize: 15 },
  testMode: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  footerLink: { fontSize: 13, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  dot: { color: colors.textMuted },
  legal: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  close: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
