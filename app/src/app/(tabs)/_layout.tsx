import { Tabs } from 'expo-router';
import { Bell, Compass, House, MessagesSquare, User } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { SuggestSpotModal } from '../../components/suggest/SuggestSpotModal';
import { DEFAULT_CENTER, useLocationTracker, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { useTheme } from '../../theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  // Konum bir kez burada alınır ve canlı takip edilir; tüm sekmeler aynı konumu paylaşır
  useLocationTracker();
  const location = useUserLocation();
  const { suggestOpen, closeSuggest } = useExploreStore(
    useShallow((s) => ({ suggestOpen: s.suggestOpen, closeSuggest: s.closeSuggest })),
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t.tabs.home, tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="map"
          options={{ title: t.tabs.explore, tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="confirmations"
          options={{ title: t.tabs.confirmations, tabBarIcon: ({ color, size }) => <Bell color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="community"
          options={{ title: t.tabs.community, tabBarIcon: ({ color, size }) => <MessagesSquare color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t.tabs.profile, tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
        />
      </Tabs>

      {/* Durum çubuğu zemini: kaydırılan içerik saat/pil simgelerinin altına girmesin */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.bg }} />

      {/* "Gizli lezzet bildir": Teyitler ve Profil sekmelerinden açılır */}
      <SuggestSpotModal
        visible={suggestOpen}
        onClose={closeSuggest}
        userLocation={location.coords}
        fallbackCenter={location.coords ?? DEFAULT_CENTER}
      />
    </>
  );
}
