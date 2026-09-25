
import type { Palette } from '../../../theme';
import { VENUE_ICON_SVG } from './icons';

export interface LeafletConfig {
  assetBase: string;
  tileUrl: string;
  center: [number, number];
  zoom: number;
  interactive: boolean;
  /** Pin ve seçim renkleri: harita açıldığındaki tema */
  colors: Palette;
}

/**
 * WebView içinde çalışan Leaflet sayfası. RN ile köprü:
 *  RN → sayfa: window.bridge.receive({ type: 'venues' | 'select' | 'user' | 'padding' | 'focus' | 'picker' | 'radius' | 'fitRadius', ... })
 *  sayfa → RN: { type: 'ready' | 'markerPress' | 'moveend' | 'pick' }
 */
export function buildLeafletHtml({ colors, ...config }: LeafletConfig): string {
  const page = {
    ...config,
    icons: VENUE_ICON_SVG,
    colors: {
      open: colors.open,
      mobile: colors.mobile,
      mobileAccent: colors.mobileAccent,
      primary: colors.primary,
      surface: colors.surface,
      shop: colors.shop,
      bg: '#EDE8DF',
    },
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${config.assetBase}/map/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${page.colors.bg}; }
  .leaflet-container { background: ${page.colors.bg}; font-family: -apple-system, Roboto, sans-serif; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.75) !important; }
  .lb-icon { background: none; border: none; }

  .pin-box { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
  .ring { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px solid transparent; }
  .ring.active { border-color: ${page.colors.open}; }
  .pin { display: flex; align-items: center; justify-content: center; border-radius: 50%; border-style: solid;
         box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .pin svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .pulse { position: absolute; border-radius: 50%; background: ${page.colors.open};
           animation: pulse 1.6s ease-out infinite; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.7); opacity: 0; } }

  /* Satıcının canlı konumu: ≤4 sa yeşil nokta, >12 sa soluk "son bilinen nokta" */
  .live-dot { position: absolute; top: 9px; right: 9px; width: 14px; height: 14px; border-radius: 50%;
              background: ${page.colors.open}; border: 2.5px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.35); }
  .live-dot::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid ${page.colors.open};
                     animation: pulse 1.6s ease-out infinite; }
  .pin-box.stale { opacity: 0.45; filter: grayscale(0.6); }

  /* Konum seçici: sürüklenebilir pin */
  .picker { position: relative; width: 48px; height: 60px; }
  .picker-head { position: absolute; left: 6px; top: 0; width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
                 transform: rotate(-45deg); background: ${page.colors.mobile}; border: 3px solid #fff;
                 box-shadow: 0 3px 8px rgba(0,0,0,0.35); }
  .picker-dot { position: absolute; left: 18px; top: 12px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
  .picker-shadow { position: absolute; left: 17px; bottom: 0; width: 14px; height: 6px; border-radius: 50%; background: rgba(0,0,0,0.25); }

  /* "Buradasınız": standart mavi konum noktası + nabız halkası; üstte seçilen avatarla etiket */
  .me { position: relative; width: 140px; height: 96px; }
  .me-halo { position: absolute; left: 48px; top: 26px; width: 44px; height: 44px; border-radius: 50%;
             background: rgba(37,99,235,0.18); animation: halo 2s ease-out infinite; }
  @keyframes halo { 0% { transform: scale(0.6); opacity: 1; } 100% { transform: scale(1.9); opacity: 0; } }
  .me-dot { position: absolute; left: 61px; top: 39px; width: 18px; height: 18px; border-radius: 50%;
            background: #2563EB; border: 3px solid #fff; box-sizing: border-box; box-shadow: 0 1px 4px rgba(0,0,0,0.45); }
  .me-label { position: absolute; left: 50%; top: 0; transform: translateX(-50%); white-space: nowrap;
              display: flex; align-items: center; gap: 4px; padding: 3px 9px 3px 5px; border-radius: 999px;
              background: #2563EB; color: #fff; font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  .me-face { font-size: 15px; line-height: 1; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${config.assetBase}/map/leaflet.js"></script>
<script>
(function () {
  var cfg = ${JSON.stringify(page)};
  function post(msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }

  if (!window.L) { post({ type: 'error', message: 'Leaflet failed to load from ' + cfg.assetBase }); return; }

  var map = L.map('map', {
    zoomControl: false,
    dragging: cfg.interactive, touchZoom: cfg.interactive, doubleClickZoom: cfg.interactive,
    scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false
  }).setView(cfg.center, cfg.zoom);
  map.attributionControl.setPrefix(false);
  L.tileLayer(cfg.tileUrl, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var padding = { top: 0, bottom: 0 };
  var venues = {};      // id -> { data, marker, key }
  var selectedId = null;
  var userMarker = null, userFace = null;

  // Kullanıcı hareketi mi, programatik mi? Dokunma varken başlayan hareket = kullanıcı
  var touching = false, gesture = false;
  var el = map.getContainer();
  el.addEventListener('touchstart', function () { touching = true; }, { passive: true });
  el.addEventListener('touchend', function () { touching = false; }, { passive: true });
  map.on('movestart', function () { if (touching) gesture = true; });
  map.on('dragstart', function () { gesture = true; });
  // Boş alana dokunma (pin tıklaması haritaya yayılmaz)
  map.on('click', function () { post({ type: 'mapPress' }); });
  map.on('moveend', function () {
    var c = visibleCenter();
    post({ type: 'moveend', latitude: c.lat, longitude: c.lng, zoom: map.getZoom(), isGesture: gesture });
    gesture = false;
  });

  // Üst bar ve alt kartların altında kalmayan görünür alanın merkezi
  function visibleCenter() {
    var size = map.getSize();
    return map.containerPointToLatLng([size.x / 2, (padding.top + size.y - padding.bottom) / 2]);
  }

  function venueHtml(v, selected) {
    var size = selected ? 44 : 34, icon = selected ? 22 : 17;
    var bg = v.isMobile ? cfg.colors.mobile : cfg.colors.surface;
    // 🟠 seyyar / 🔵 esnaf; ikon türü gösterir
    var border = v.isMobile ? cfg.colors.mobileAccent : cfg.colors.shop;
    var fg = v.isMobile ? '#fff' : cfg.colors.shop;
    var ring = size + 8;
    var live = v.live === 'LIVE';
    var stale = v.live === 'STALE';
    var active = (v.isActiveNow || live) && !stale;
    return '<div class="pin-box' + (stale ? ' stale' : '') + '">' +
      (active ? '<div class="pulse" style="width:' + ring + 'px;height:' + ring + 'px"></div>' : '') +
      '<div class="ring' + (active ? ' active' : '') + '" style="width:' + ring + 'px;height:' + ring + 'px">' +
        '<div class="pin" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + ';border-color:' + border +
          ';border-width:' + (selected ? 3 : 2.5) + 'px;color:' + fg + '">' +
          '<svg viewBox="0 0 24 24" width="' + icon + '" height="' + icon + '">' + cfg.icons[v.type] + '</svg>' +
        '</div>' +
      '</div>' + (live ? '<div class="live-dot"></div>' : '') + '</div>';
  }

  function venueIcon(v, selected) {
    return L.divIcon({ className: 'lb-icon', html: venueHtml(v, selected), iconSize: [64, 64], iconAnchor: [32, 32] });
  }

  function renderVenue(id) {
    var entry = venues[id];
    var selected = id === selectedId;
    var key = JSON.stringify([entry.data, selected]);
    if (entry.key === key) return;
    entry.key = key;
    entry.marker.setLatLng([entry.data.latitude, entry.data.longitude]);
    entry.marker.setIcon(venueIcon(entry.data, selected));
    entry.marker.setZIndexOffset(selected ? 2000 : entry.data.live === 'STALE' ? -100 : entry.data.isActiveNow ? 200 : 0);
  }

  function setVenues(list) {
    var seen = {};
    list.forEach(function (v) {
      seen[v.id] = true;
      if (!venues[v.id]) {
        var marker = L.marker([v.latitude, v.longitude], { icon: venueIcon(v, false), keyboard: false });
        marker.on('click', function () { post({ type: 'markerPress', id: v.id }); });
        marker.addTo(map);
        venues[v.id] = { data: v, marker: marker, key: null };
      }
      venues[v.id].data = v;
      renderVenue(v.id);
    });
    Object.keys(venues).forEach(function (id) {
      if (!seen[id]) { map.removeLayer(venues[id].marker); delete venues[id]; }
    });
  }

  function select(id) {
    var prev = selectedId;
    selectedId = id;
    if (prev && venues[prev]) renderVenue(prev);
    if (id && venues[id]) renderVenue(id);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setUser(u) {
    if (!u) { if (userMarker) { map.removeLayer(userMarker); userMarker = null; } return; }
    var key = u.face + '|' + u.label;
    if (!userMarker || userFace !== key) {
      if (userMarker) map.removeLayer(userMarker);
      userFace = key;
      userMarker = L.marker([u.latitude, u.longitude], {
        // Etkileşimsiz olduğu için dokunuşlar alttaki pinlere geçer; konum hep görünür kalsın
        interactive: false, keyboard: false, zIndexOffset: 5000,
        icon: L.divIcon({
          // Çapa mavi noktanın ortası (etiket noktanın üstünde durur)
          className: 'lb-icon', iconSize: [140, 96], iconAnchor: [70, 48],
          html: '<div class="me"><div class="me-halo"></div><div class="me-dot"></div>' +
                '<div class="me-label"><span class="me-face">' + escapeHtml(u.face) + '</span>' + escapeHtml(u.label) + '</div></div>'
        })
      }).addTo(map);
    } else {
      userMarker.setLatLng([u.latitude, u.longitude]);
    }
  }

  // Konum seçici: sürüklenebilir pin; haritaya dokunmak da pini taşır
  var pickerMarker = null;
  function emitPick() {
    var p = pickerMarker.getLatLng();
    post({ type: 'pick', latitude: p.lat, longitude: p.lng });
  }
  function setPicker(m) {
    if (!pickerMarker) {
      pickerMarker = L.marker([m.latitude, m.longitude], {
        draggable: true, keyboard: false, zIndexOffset: 6000,
        icon: L.divIcon({
          className: 'lb-icon', iconSize: [48, 60], iconAnchor: [24, 58],
          html: '<div class="picker"><div class="picker-shadow"></div><div class="picker-head"></div><div class="picker-dot"></div></div>'
        })
      }).addTo(map);
      pickerMarker.on('dragend', emitPick);
      map.on('click', function (e) { pickerMarker.setLatLng(e.latlng); emitPick(); });
    } else {
      pickerMarker.setLatLng([m.latitude, m.longitude]);
    }
  }

  // Keşfet mesafe filtresi: kesikli daire; "fitRadius" haritayı daireye sığdırır
  var radiusCircle = null;
  function setRadius(m) {
    if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
    if (!m.meters) return;
    radiusCircle = L.circle([m.latitude, m.longitude], {
      radius: m.meters, color: cfg.colors.primary, weight: 1.5, opacity: 0.7,
      dashArray: '6 6', fillColor: cfg.colors.primary, fillOpacity: 0.05, interactive: false
    }).addTo(map);
  }
  function fitRadius(m) {
    if (radiusCircle) {
      map.fitBounds(radiusCircle.getBounds(), {
        paddingTopLeft: [16, padding.top + 8], paddingBottomRight: [16, padding.bottom + 8], animate: true
      });
    } else if (m.zoom) {
      map.setZoom(m.zoom, { animate: true });
    }
  }

  // Hedef, görünür alanın (üst/alt boşluklar hariç) ortasına gelsin
  function focus(m) {
    var zoom = m.zoom || map.getZoom();
    var point = map.project([m.latitude, m.longitude], zoom).add([0, (padding.bottom - padding.top) / 2]);
    var target = map.unproject(point, zoom);
    // "Konumuma git": uzaktan akıcı uçuş; diğer odaklamalar kısa kaydırma
    if (m.fly) map.flyTo(target, zoom, { duration: 0.8 });
    else map.setView(target, zoom, { animate: true });
  }

  window.bridge = {
    receive: function (m) {
      if (m.type === 'venues') setVenues(m.venues);
      else if (m.type === 'select') select(m.id);
      else if (m.type === 'user') setUser(m.user);
      else if (m.type === 'padding') padding = m.padding;
      else if (m.type === 'focus') focus(m);
      else if (m.type === 'picker') setPicker(m);
      else if (m.type === 'radius') setRadius(m);
      else if (m.type === 'fitRadius') fitRadius(m);
    }
  };
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
