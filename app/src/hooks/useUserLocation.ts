import type { LatLng } from '@localbite/shared';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { create } from 'zustand';

/** Konum yoksa (izin reddi ya da GPS kapalı) kullanılan İstanbul merkezi: Kadıköy Rıhtım */
export const DEFAULT_CENTER: LatLng = { latitude: 40.9923, longitude: 29.0232 };

/**
 * pending: ilk konum bekleniyor · granted: gerçek konum var
 * denied: izin verilmedi · unavailable: izin var ama GPS kapalı / konum alınamadı
 */
export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

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
// Gerçek bir konum geldiyse (takip dahil) GPS artık kullanılabilir demektir
const setCoords = (coords: LatLng) => useLocationStore.setState({ coords, status: 'granted' });

// ─────────────────────────────────────────────
// Ön plan izni + uygulama içi açıklama (Google Play / App Store konum politikası)
// Sistem penceresinden hemen önce neden ve nasıl kullanıldığı anlatılır; arka plan izni hiç istenmez.
// ─────────────────────────────────────────────

interface DisclosureState {
  visible: boolean;
  resolve: ((accepted: boolean) => void) | null;
}

export const useLocationDisclosureStore = create<DisclosureState>(() => ({ visible: false, resolve: null }));

/** Açıklama ekranı kararını bildirir (Devam Et / Şimdi değil) */
export function answerLocationDisclosure(accepted: boolean) {
  const { resolve } = useLocationDisclosureStore.getState();
  useLocationDisclosureStore.setState({ visible: false, resolve: null });
  resolve?.(accepted);
}

let pendingDisclosure: Promise<boolean> | null = null;

/**
 * İzin verilmişse hemen true. Sistem penceresi açılabilecekse önce açıklamayı gösterir;
 * kullanıcı "Devam Et" derse sistem iznini ister. Kalıcı reddedilmişse pencere açılmaz.
 */
async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  // Aynı anda birden çok çağrı (harita + detay) tek açıklama gösterir
  pendingDisclosure ??= new Promise<boolean>((resolve) =>
    useLocationDisclosureStore.setState({ visible: true, resolve }),
  ).finally(() => {
    pendingDisclosure = null;
  });
  if (!(await pendingDisclosure)) return false;

  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

/**
 * İzin ister; son bilinen konumu hemen, güncel konumu en geç 10 sn içinde yazar.
 * Taze konum gelmezse (kapalı alan, emülatör) eski de olsa son bilinen konum kullanılır.
 */
async function locate(): Promise<LatLng | null> {
  const granted = await ensureForegroundPermission();
  if (!granted) {
    useLocationStore.setState({ status: 'denied' });
    return null;
  }

  // Konum servisleri kapalıysa (GPS / konum anahtarı) sistem konum veremez
  if (!(await Location.hasServicesEnabledAsync().catch(() => false))) {
    useLocationStore.setState({ status: 'unavailable' });
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
  if (coords) setCoords(coords);
  else useLocationStore.setState((s) => ({ status: s.coords ? 'granted' : 'unavailable' }));
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
      // İzin varsa GPS şu an kapalı olsa da takip başlar; açıldığında ilk konum durumu "granted" yapar
      if (cancelled || useLocationStore.getState().status === 'denied') return;
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

/**
 * Mesafelerin ölçüldüğü nokta: gerçek konum, yoksa İstanbul merkezi.
 * İlk konum beklenirken null (yanlış merkezle istek atılmasın).
 * isFallback: konum izni yok ya da GPS kapalı → arayüz hafif bir uyarı gösterir.
 */
export function useLocationOrigin() {
  const { status, coords, refresh } = useUserLocation();
  const isFallback = !coords && (status === 'denied' || status === 'unavailable');
  const origin = coords ?? (status === 'pending' ? null : DEFAULT_CENTER);
  return { origin, isFallback, status, coords, refresh };
}

/** "Bugün buradaydı" için anlık, yüksek doğruluklu konum. İzin yoksa ya da alınamazsa null. */
export async function getPreciseLocation(): Promise<LatLng | null> {
  if (!(await ensureForegroundPermission())) return null;
  const position = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    CURRENT_POSITION_TIMEOUT_MS,
  );
  return position ? toLatLng(position) : null;
}
