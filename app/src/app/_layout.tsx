import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useSessionRefresh } from '../api/auth';
import { useBlockSync } from '../api/moderation';
import { LocationDisclosure } from '../components/LocationDisclosure';
import { Paywall } from '../components/monetization/Paywall';
import { useTheme, useThemeStore } from '../theme';

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  );
  const themeReady = useThemeStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  // Kayıtlı tema okunana kadar (birkaç ms) çizme: yanlış temanın yanıp sönmesini önler
  if (!themeReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SessionRefresh />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="community/new" options={{ presentation: 'modal' }} />
        {/* Misafir bir yazma eylemi denediğinde açılan giriş / kayıt modalı */}
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legal/[doc]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="trail/[slug]" />
        <Stack.Screen name="admin" />
      </Stack>
      <Paywall />
      {/* Sistem konum izni penceresinden önce gösterilen açıklama (mağaza politikası) */}
      <LocationDisclosure />
    </QueryClientProvider>
  );
}

/** Saklı oturumu açılışta doğrular (QueryClientProvider içinde olmalı) */
function SessionRefresh() {
  useSessionRefresh();
  useBlockSync();
  return null;
}
