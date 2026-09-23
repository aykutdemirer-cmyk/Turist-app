import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useSessionRefresh } from '../api/auth';
import { colors } from '../theme';

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <SessionRefresh />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="venue/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="community/[id]" />
        <Stack.Screen name="community/new" options={{ presentation: 'modal' }} />
        {/* Misafir bir yazma eylemi denediğinde açılan giriş / kayıt modalı */}
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}

/** Saklı oturumu açılışta doğrular (QueryClientProvider içinde olmalı) */
function SessionRefresh() {
  useSessionRefresh();
  return null;
}
