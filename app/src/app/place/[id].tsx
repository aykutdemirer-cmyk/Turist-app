import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Paylaşılan bağlantı: https://<alan>/place/{id} ve localbite://place/{id}.
 * Mekan detayına yönlendirir; "link" işareti mesafe kartını (uzaktaysa yol tarifi önerisi) açar.
 */
export default function PlaceLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/venue/[id]', params: { id, via: 'link' } }} />;
}
