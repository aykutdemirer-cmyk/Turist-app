import { colors } from '../../../theme';
import { VENUE_ICON_SVG } from './icons';

export interface LeafletConfig {
  assetBase: string;
  tileUrl: string;
  center: [number, number];
  zoom: number;
  interactive: boolean;
}

/**
 * WebView içinde çalışan Leaflet sayfası. RN ile köprü:
 *  RN → sayfa: window.bridge.receive({ type: 'venues' | 'select' | 'user' | 'padding' | 'focus', ... })
 *  sayfa → RN: { type: 'ready' | 'markerPress' | 'moveend' }
 */
export function buildLeafletHtml(config: LeafletConfig): string {
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

  .me { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; }
  .radar { position: absolute; width: 56px; height: 56px; border-radius: 50%;
           border: 2px solid ${page.colors.primary}; background: rgba(194,65,12,0.10);
           animation: radar 2.6s ease-out infinite; }
  .radar.r2 { animation-delay: 1.3s; }
  @keyframes radar { 0% { transform: scale(0.9); opacity: 0.9; } 100% { transform: scale(2.1); opacity: 0; } }
  .avatar { position: relative; width: 50px; height: 50px; border-radius: 50%; background: #fff;
            border: 3px solid ${page.colors.primary}; box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center; font-size: 28px; line-height: 1; }
  .backpack { position: absolute; right: -8px; bottom: -6px; width: 24px; height: 24px; border-radius: 50%;
              background: ${page.colors.mobileAccent}; border: 2px solid #fff; font-size: 13px;
              display: flex; align-items: center; justify-content: center; }
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
    return '<div class="pin-box">' +
      (v.isActiveNow ? '<div class="pulse" style="width:' + ring + 'px;height:' + ring + 'px"></div>' : '') +
      '<div class="ring' + (v.isActiveNow ? ' active' : '') + '" style="width:' + ring + 'px;height:' + ring + 'px">' +
        '<div class="pin" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + ';border-color:' + border +
          ';border-width:' + (selected ? 3 : 2.5) + 'px;color:' + fg + '">' +
          '<svg viewBox="0 0 24 24" width="' + icon + '" height="' + icon + '">' + cfg.icons[v.type] + '</svg>' +
        '</div>' +
      '</div></div>';
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
    entry.marker.setZIndexOffset(selected ? 2000 : entry.data.isActiveNow ? 200 : 0);
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

  function setUser(u) {
    if (!u) { if (userMarker) { map.removeLayer(userMarker); userMarker = null; } return; }
    if (!userMarker || userFace !== u.face) {
      if (userMarker) map.removeLayer(userMarker);
      userFace = u.face;
      userMarker = L.marker([u.latitude, u.longitude], {
        // Etkileşimsiz olduğu için dokunuşlar alttaki pinlere geçer; karakter hep görünür kalsın
        interactive: false, keyboard: false, zIndexOffset: 5000,
        icon: L.divIcon({
          className: 'lb-icon', iconSize: [120, 120], iconAnchor: [60, 60],
          html: '<div class="me"><div class="radar"></div><div class="radar r2"></div>' +
                '<div class="avatar">' + u.face + '<div class="backpack">🎒</div></div></div>'
        })
      }).addTo(map);
    } else {
      userMarker.setLatLng([u.latitude, u.longitude]);
    }
  }

  // Hedef, görünür alanın (üst/alt boşluklar hariç) ortasına gelsin
  function focus(m) {
    var zoom = m.zoom || map.getZoom();
    var point = map.project([m.latitude, m.longitude], zoom).add([0, (padding.bottom - padding.top) / 2]);
    map.setView(map.unproject(point, zoom), zoom, { animate: true });
  }

  window.bridge = {
    receive: function (m) {
      if (m.type === 'venues') setVenues(m.venues);
      else if (m.type === 'select') select(m.id);
      else if (m.type === 'user') setUser(m.user);
      else if (m.type === 'padding') padding = m.padding;
      else if (m.type === 'focus') focus(m);
    }
  };
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
