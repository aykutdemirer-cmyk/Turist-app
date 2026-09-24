import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'LocalBite',
  slug: 'localbite',
  scheme: 'localbite',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.localbite',
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
    // Yalnızca ön plan konumu (FINE/COARSE, expo-location ekler). Arka plan konumu mağaza politikası gereği
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

export default config;
