import type { ExpoConfig } from 'expo/config';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';

/** Paylaşılan mekan bağlantılarının alanı (src/api/config.ts SHARE_BASE_URL ile aynı) */
const SHARE_HOST = new URL(process.env.EXPO_PUBLIC_SHARE_BASE_URL || 'https://uygulama-linki.com').host;

const config: ExpoConfig = {
  name: 'LocalBite',
  slug: 'localbite',
  owner: 'aykutdemirer',
  // EAS Build projesi (expo.dev/accounts/aykutdemirer/projects/localbite)
  extra: {
    eas: { projectId: '00aefeac-6441-483e-b147-403de0841f41' },
    // Anahtar derlemeye verildiyse Keşfet haritası Google Maps (Google Places verisi Google haritasında gösterilir)
    googleMapsEnabled: Boolean(process.env.GOOGLE_MAPS_ANDROID_API_KEY),
  },
  scheme: 'localbite',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.localbite',
    // Universal Links: alanda /.well-known/apple-app-site-association yayınlanmalı
    associatedDomains: [`applinks:${SHARE_HOST}`],
  },
  android: {
    package: 'app.localbite',
    adaptiveIcon: {
      backgroundColor: '#FFF7ED',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // App Links: https://<alan>/place/{id} uygulamada açılır. Doğrulama için alanda
    // /.well-known/assetlinks.json (imza SHA-256 parmak izi ile) yayınlanmalı.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: SHARE_HOST, pathPrefix: '/place' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    // Gerçek GPS (ön plan): kullanıcı konumuna göre yakındaki mekanlar
    permissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    // Yalnızca ön plan konumu. Arka plan konumu mağaza politikası gereği
    // hiçbir bağımlılık tarafından eklenemesin diye açıkça engellenir.
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    // Android Google Maps anahtarı (Maps SDK for Android, sınırsız ücretsiz). EAS/yerel derlemede ortam değişkeninden
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '' }],
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-location',
      {
        // Uygulama içi açıklamayla aynı ifade; "Always" izni hiç istenmez
        locationWhenInUsePermission:
          'LocalBite uses your location only while the app is open, to show the nearest street food and mobile vendors on the map.',
        // false: Info.plist'e hiç yazılmaz (yalnızca "uygulama kullanılırken" izni)
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

/**
 * Yerel ağdaki HTTP API'ye bağlanan test APK'ları için (ör. EXPO_PUBLIC_API_URL=http://192.168.x.x:3001).
 * Android release derlemeleri varsayılan olarak düz HTTP'yi engeller; yalnızca ALLOW_HTTP_API=1 ile açılır.
 * Mağaza derlemelerinde kullanılmaz: API HTTPS olmalı.
 */
const withCleartextTraffic: ConfigPlugin = (cfg) =>
  withAndroidManifest(cfg, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return c;
  });

export default process.env.ALLOW_HTTP_API === '1' ? withCleartextTraffic(config) : config;
