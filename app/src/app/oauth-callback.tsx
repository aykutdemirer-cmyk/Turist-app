import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useCompleteOAuth } from '../api/auth';
import { useT } from '../i18n';
import { makeStyles, spacing, useTheme } from '../theme';

/**
 * Google/GitHub dönüş bağlantısı (…/--/oauth-callback?code=…). Kodu oturuma çevirir ve
 * giriş ekranına döner; giriş ekranı oturumu görünce kendini kapatır, hatayı da o gösterir.
 */
export default function OAuthCallbackScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const complete = useCompleteOAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    complete({ code, error }).finally(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });
  }, [code, error, complete, router]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{t.auth.signingIn}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.bg },
  text: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
}));
