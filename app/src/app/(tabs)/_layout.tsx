import { Tabs } from 'expo-router';
import { Bell, Compass, House, User } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { SuggestSpotModal } from '../../components/suggest/SuggestSpotModal';
import { DEFAULT_CENTER, useLocationTracker, useUserLocation } from '../../hooks/useUserLocation';
import { useT } from '../../i18n';
import { useExploreStore } from '../../store/explore';
import { colors } from '../../theme';

export default function TabsLayout() {
  const t = useT();
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
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
          name="profile"
          options={{ title: t.tabs.profile, tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
        />
      </Tabs>

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
