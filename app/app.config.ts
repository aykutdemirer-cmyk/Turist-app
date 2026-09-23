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
        locationWhenInUsePermission:
          'LocalBite uses your location to show nearby local eateries and to confirm street vendors you spot.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
