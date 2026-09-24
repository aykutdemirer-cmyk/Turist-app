import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3000;

/**
 * API adresi öncelik sırası:
 * 1. EXPO_PUBLIC_API_URL (app/.env) — ör. http://192.168.1.20:3000
 * 2. Expo dev sunucusunun çalıştığı makinenin IP'si (Expo Go / dev build'de fiziksel cihaz dahil çalışır)
 * 3. Android emülatör → 10.0.2.2, iOS simülatör → localhost
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') return `http://${devHost}:${API_PORT}`;

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const API_BASE = `${API_URL}/api/v1`;

/**
 * Harita karoları. Varsayılan: backend'in OSM proxy'si (önbellekli, HTTP; emülatör/kurumsal ağ dostu).
 * Üretimde bir karo sağlayıcısına yönlendirilebilir: EXPO_PUBLIC_TILE_URL=https://.../{z}/{x}/{y}.png
 */
export const TILE_URL = process.env.EXPO_PUBLIC_TILE_URL || `${API_URL}/tiles/{z}/{x}/{y}.png`;

/** Sunucunun verdiği göreli medya yollarını (/media/...) tam adrese çevirir */
export const resolveMediaUrl = (url: string | null | undefined): string | null =>
  !url ? null : url.startsWith('/') ? `${API_URL}${url}` : url;
