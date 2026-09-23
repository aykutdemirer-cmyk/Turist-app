import type { LatLng, VenueType } from '@localbite/shared';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { API_URL, TILE_URL } from '../../../api/config';
import { buildLeafletHtml } from './html';

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  type: VenueType;
  isMobile: boolean;
  isActiveNow: boolean;
}

export interface MapUser extends LatLng {
  face: string;
}

export interface LeafletHandle {
  focus: (target: LatLng, zoom?: number) => void;
}

interface Props {
  ref?: Ref<LeafletHandle>;
  initialCenter: LatLng;
  initialZoom?: number;
  interactive?: boolean;
  pins?: MapPin[];
  selectedId?: string | null;
  user?: MapUser | null;
  /** Haritanın üstünü/altını örten arayüz yüksekliği; odaklama görünür alana göre yapılır */
  padding?: { top: number; bottom: number };
  onPinPress?: (id: string) => void;
  onMapPress?: () => void;
  onMoveEnd?: (center: LatLng, info: { isGesture: boolean; zoom: number }) => void;
  style?: StyleProp<ViewStyle>;
}

// U+2028/2029 JSON içinde geçerli ama enjekte edilen JS kodunda satır sonu sayılır; kaçışla
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);
const BACKSLASH = String.fromCharCode(92);
const escapeLineSeparators = (s: string) =>
  s.split(LINE_SEP).join(`${BACKSLASH}u2028`).split(PARA_SEP).join(`${BACKSLASH}u2029`);

type PageMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress' }
  | { type: 'moveend'; latitude: number; longitude: number; zoom: number; isGesture: boolean };

/**
 * react-native-webview içinde Leaflet + OpenStreetMap.
 * Google Maps anahtarı/Play Services gerektirmez; Expo Go dahil her ortamda çalışır.
 */
export function LeafletView({
  ref,
  initialCenter,
  initialZoom = 15,
  interactive = true,
  pins,
  selectedId = null,
  user = null,
  padding = { top: 0, bottom: 0 },
  onPinPress,
  onMapPress,
  onMoveEnd,
  style,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // HTML yalnızca ilk render'da üretilir; sonraki güncellemeler köprü üzerinden gider
  const [html] = useState(() =>
    buildLeafletHtml({
      assetBase: API_URL,
      tileUrl: TILE_URL,
      center: [initialCenter.latitude, initialCenter.longitude],
      zoom: initialZoom,
      interactive,
    }),
  );

  const send = useCallback((message: object) => {
    const json = escapeLineSeparators(JSON.stringify(message));
    webRef.current?.injectJavaScript(`window.bridge && window.bridge.receive(${json}); true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    focus: (target, zoom) => send({ type: 'focus', latitude: target.latitude, longitude: target.longitude, zoom }),
  }));

  // Değer bazlı karşılaştırma için JSON; aynı içerikte yeniden gönderme yapılmaz
  const pinsJson = pins ? JSON.stringify(pins) : null;
  useEffect(() => {
    if (ready && pinsJson) send({ type: 'venues', venues: JSON.parse(pinsJson) });
  }, [ready, pinsJson, send]);

  useEffect(() => {
    if (ready) send({ type: 'select', id: selectedId });
  }, [ready, selectedId, send]);

  const userJson = user ? JSON.stringify({ latitude: user.latitude, longitude: user.longitude, face: user.face }) : null;
  useEffect(() => {
    if (ready) send({ type: 'user', user: userJson ? JSON.parse(userJson) : null });
  }, [ready, userJson, send]);

  useEffect(() => {
    if (ready) send({ type: 'padding', padding: { top: padding.top, bottom: padding.bottom } });
  }, [ready, padding.top, padding.bottom, send]);

  const onMessage = (event: WebViewMessageEvent) => {
    let msg: PageMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data) as PageMessage;
    } catch {
      return;
    }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'markerPress') onPinPress?.(msg.id);
    else if (msg.type === 'mapPress') onMapPress?.();
    else if (msg.type === 'moveend')
      onMoveEnd?.({ latitude: msg.latitude, longitude: msg.longitude }, { isGesture: msg.isGesture, zoom: msg.zoom });
    else if (msg.type === 'error') console.warn('[LeafletView]', msg.message);
  };

  return (
    <WebView
      ref={webRef}
      style={[styles.web, style]}
      source={{ html, baseUrl: API_URL }}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      mixedContentMode="always"
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      pointerEvents={interactive ? 'auto' : 'none'}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#EDE8DF' },
});
