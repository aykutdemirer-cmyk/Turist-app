import { Linking, Platform } from 'react-native';

/** Yürüyüş tarifi: iOS'ta Apple Maps, Android'de Google Maps (uygulama yoksa tarayıcı). */
export async function openDirections(latitude: number, longitude: number, label?: string) {
  const dest = `${latitude},${longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${dest}&dirflg=w${label ? `&q=${encodeURIComponent(label)}` : ''}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  await Linking.openURL(url);
}
