import { Tabs } from 'expo-router';
import { CirclePlus, House, Map } from 'lucide-react-native';
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
  const { suggestOpen, openSuggest, closeSuggest } = useExploreStore(
    useShallow((s) => ({ suggestOpen: s.suggestOpen, openSuggest: s.openSuggest, closeSuggest: s.closeSuggest })),
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
          options={{ title: t.tabs.map, tabBarIcon: ({ color, size }) => <Map color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="spot"
          options={{
            title: t.tabs.spot,
            tabBarIcon: ({ size }) => <CirclePlus color={colors.primary} size={size + 2} strokeWidth={2.4} />,
          }}
          // Bildir sekmesi bir ekran değil: bulunduğun sekmede formu modal olarak açar
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              openSuggest();
            },
          }}
        />
      </Tabs>

      <SuggestSpotModal
        visible={suggestOpen}
        onClose={closeSuggest}
        userLocation={location.coords}
        fallbackCenter={location.coords ?? DEFAULT_CENTER}
      />
    </>
  );
}
