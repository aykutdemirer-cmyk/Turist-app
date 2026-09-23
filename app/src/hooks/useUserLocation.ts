import type { LatLng } from '@localbite/shared';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { create } from 'zustand';

/** İzin verilmezse harita buraya odaklanır: Kadıköy Rıhtım */
export const DEFAULT_CENTER: LatLng = { latitude: 40.9923, longitude: 29.0232 };

export type LocationStatus = 'pending' | 'granted' | 'denied';

const CURRENT_POSITION_TIMEOUT_MS = 10_000;
/** Canlı takip: bu kadar metre yer değiştirince güncelle (pil dostu) */
const WATCH_DISTANCE_M = 15;

const toLatLng = (l: Location.LocationObject): LatLng => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

interface LocationState {
  status: LocationStatus;
  coords: LatLng | null;
}

const useLocationStore = create<LocationState>(() => ({ status: 'pending', coords: null }));
const setCoords = (coords: LatLng) => useLocationStore.setState({ coords });

/**
 * İzin ister; son bilinen konumu hemen, güncel konumu en geç 10 sn içinde yazar.
 * Taze konum gelmezse (kapalı alan, emülatör) eski de olsa son bilinen konum kullanılır.
 */
async function locate(): Promise<LatLng | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    useLocationStore.setState({ status: 'denied' });
    return null;
  }

  const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
  if (last) setCoords(toLatLng(last));

  const current = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    CURRENT_POSITION_TIMEOUT_MS,
  ).catch(() => null);
  const fix = current ?? last ?? (await Location.getLastKnownPositionAsync().catch(() => null));

  const coords = fix ? toLatLng(fix) : null;
  useLocationStore.setState((s) => ({ status: 'granted', coords: coords ?? s.coords }));
  return coords;
}

/**
 * Uygulama boyunca bir kez (sekme düzeninde) çağrılır: konumu alır ve canlı takip eder.
 * Harita avatarı, ana sayfa ve öneri formu aynı konumu paylaşır.
 */
export function useLocationTracker() {
  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    locate().then(async () => {
      if (cancelled || useLocationStore.getState().status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: WATCH_DISTANCE_M },
        (l) => setCoords(toLatLng(l)),
      ).catch(() => undefined);
      if (cancelled) subscription?.remove();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
}

/** Kullanıcının konumu ve izin durumu. refresh() "Konumumu göster" butonu içindir. */
export function useUserLocation() {
  const status = useLocationStore((s) => s.status);
  const coords = useLocationStore((s) => s.coords);
  return { status, coords, refresh: locate };
}

/** "Bugün buradaydı" için anlık, yüksek doğruluklu konum. İzin yoksa ya da alınamazsa null. */
export async function getPreciseLocation(): Promise<LatLng | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    CURRENT_POSITION_TIMEOUT_MS,
  );
  return position ? toLatLng(position) : null;
}
