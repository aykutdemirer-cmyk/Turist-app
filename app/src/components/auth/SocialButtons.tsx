import * as Haptics from 'expo-haptics';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppleSignIn, useOAuthProviders, useStartOAuth, type OAuthProvider } from '../../api/auth';
import { useT } from '../../i18n';
import { makeStyles, radius, spacing, useTheme } from '../../theme';

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * Google ile giriş (tarayıcı) ve iOS'ta Apple ile Giriş (App Store kuralı: başka sosyal giriş varsa Apple da
 * sunulmalı; Apple'ın kendi düğme stili kullanılır). Sunucuda yapılandırılmamış Google pasif gösterilir.
 */
export function SocialButtons({
  disabled = false,
  termsAccepted,
  onNeedTerms,
}: {
  disabled?: boolean;
  /** Yeni hesap açılabileceği için şart onayı olmadan sağlayıcıya gidilmez */
  termsAccepted: boolean;
  onNeedTerms: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const providers = useOAuthProviders();
  const start = useStartOAuth();
  const [pending, setPending] = useState<OAuthProvider | 'apple' | null>(null);
  const appleSignIn = useAppleSignIn();
  const { isDark } = useTheme();
  // Apple ile Giriş yalnızca iOS 13+ cihazlarda
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  const pressApple = async () => {
    if (!termsAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onNeedTerms();
      return;
    }
    setPending('apple');
    try {
      await appleSignIn(termsAccepted);
    } finally {
      setPending(null);
    }
  };

  const buttons: { provider: OAuthProvider; label: string; logo: ReactNode }[] = [
    { provider: 'google', label: t.auth.google, logo: <GoogleLogo /> },
  ];

  const press = async (provider: OAuthProvider) => {
    if (!termsAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onNeedTerms();
      return;
    }
    Haptics.selectionAsync();
    setPending(provider);
    try {
      await start(provider, termsAccepted);
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.list}>
      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            isDark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.md}
          style={[styles.apple, (disabled || pending !== null) && styles.unavailable]}
          onPress={() => {
            if (!disabled && pending === null) void pressApple();
          }}
        />
      )}
      {buttons.map(({ provider, label, logo }) => {
        const available = providers.data?.[provider] ?? false;
        const off = disabled || !available || pending !== null;
        return (
          <Pressable
            key={provider}
            onPress={() => press(provider)}
            disabled={off}
            accessibilityRole="button"
            accessibilityState={{ disabled: off, busy: pending === provider }}
            style={({ pressed }) => [styles.button, !available && styles.unavailable, pressed && styles.pressed]}
          >
            {logo}
            <Text style={styles.label}>{label}</Text>
            {pending === provider ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              !available &&
              !providers.isPending && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.auth.notConfigured}</Text>
                </View>
              )
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { gap: spacing.sm, marginTop: spacing.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unavailable: { opacity: 0.55 },
  apple: { height: 50, width: '100%' },
  pressed: { opacity: 0.8 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  badge: { backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
}));
