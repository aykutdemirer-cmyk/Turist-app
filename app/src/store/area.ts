import type { LatLng } from '@localbite/shared';
import { create } from 'zustand';
import { ISTANBUL_NEIGHBOURHOODS } from './istanbulNeighbourhoods';

export interface Area extends LatLng {
  id: string;
  /** Semt adları özel isimdir; her dilde aynı gösterilir */
  name: string;
  popular?: boolean;
}

/** Semt seçicideki bölgeler: önce popüler olanlar, aramada hepsi */
export const AREAS: Area[] = [
  { id: 'kadikoy', name: 'Kadıköy / Moda', latitude: 40.9912, longitude: 29.0278, popular: true },
  { id: 'fatih', name: 'Tarihi Yarımada / Eminönü / Fatih', latitude: 41.0175, longitude: 28.97, popular: true },
  { id: 'besiktas', name: 'Beşiktaş / Ortaköy', latitude: 41.0428, longitude: 29.0077, popular: true },
  { id: 'beyoglu', name: 'Beyoğlu / Taksim / Karaköy', latitude: 41.0369, longitude: 28.9774, popular: true },
  { id: 'kagithane', name: 'Kağıthane / Levent', latitude: 41.0815, longitude: 28.9744, popular: true },
  { id: 'uskudar', name: 'Üsküdar', latitude: 41.0267, longitude: 29.0153, popular: true },
  { id: 'sisli', name: 'Şişli / Nişantaşı', latitude: 41.052, longitude: 28.992 },
  { id: 'balat', name: 'Balat / Fener', latitude: 41.029, longitude: 28.949 },
  { id: 'bakirkoy', name: 'Bakırköy', latitude: 40.9819, longitude: 28.8719 },
  { id: 'atasehir', name: 'Ataşehir', latitude: 40.9923, longitude: 29.1244 },
  { id: 'suadiye', name: 'Bağdat Caddesi / Suadiye', latitude: 40.962, longitude: 29.083 },
  { id: 'sariyer', name: 'Sarıyer', latitude: 41.167, longitude: 29.05 },
  // İstanbul'un 39 ilçesi (OpenStreetMap idari sınır merkezleri)
  { id: 'ilce-adalar', name: 'Adalar', latitude: 40.8663, longitude: 29.0587 },
  { id: 'ilce-arnavutkoy', name: 'Arnavutköy', latitude: 41.2484, longitude: 28.6554 },
  { id: 'ilce-atasehir', name: 'Ataşehir', latitude: 40.9843, longitude: 29.1379 },
  { id: 'ilce-avcilar', name: 'Avcılar', latitude: 41.0375, longitude: 28.7195 },
  { id: 'ilce-bahcelievler', name: 'Bahçelievler', latitude: 41.0098, longitude: 28.8459 },
  { id: 'ilce-bakirkoy', name: 'Bakırköy', latitude: 40.9806, longitude: 28.8347 },
  { id: 'ilce-bayrampasa', name: 'Bayrampaşa', latitude: 41.0508, longitude: 28.9012 },
  { id: 'ilce-bagcilar', name: 'Bağcılar', latitude: 41.0450, longitude: 28.8403 },
  { id: 'ilce-basaksehir', name: 'Başakşehir', latitude: 41.1036, longitude: 28.7451 },
  { id: 'ilce-beykoz', name: 'Beykoz', latitude: 41.1388, longitude: 29.2148 },
  { id: 'ilce-beylikduzu', name: 'Beylikdüzü', latitude: 40.9879, longitude: 28.6475 },
  { id: 'ilce-beyoglu', name: 'Beyoğlu', latitude: 41.0428, longitude: 28.9674 },
  { id: 'ilce-besiktas', name: 'Beşiktaş', latitude: 41.0717, longitude: 29.0235 },
  { id: 'ilce-buyukcekmece', name: 'Büyükçekmece', latitude: 41.0571, longitude: 28.5125 },
  { id: 'ilce-esenler', name: 'Esenler', latitude: 41.0624, longitude: 28.8672 },
  { id: 'ilce-esenyurt', name: 'Esenyurt', latitude: 41.0489, longitude: 28.6612 },
  { id: 'ilce-eyupsultan', name: 'Eyüpsultan', latitude: 41.1652, longitude: 28.8732 },
  { id: 'ilce-fatih', name: 'Fatih', latitude: 41.0142, longitude: 28.9540 },
  { id: 'ilce-gaziosmanpasa', name: 'Gaziosmanpaşa', latitude: 41.0729, longitude: 28.9068 },
  { id: 'ilce-gungoren', name: 'Güngören', latitude: 41.0201, longitude: 28.8808 },
  { id: 'ilce-kadikoy', name: 'Kadıköy', latitude: 40.9811, longitude: 29.0630 },
  { id: 'ilce-kartal', name: 'Kartal', latitude: 40.9156, longitude: 29.1967 },
  { id: 'ilce-kagithane', name: 'Kâğıthane', latitude: 41.0798, longitude: 28.9779 },
  { id: 'ilce-kucukcekmece', name: 'Küçükçekmece', latitude: 41.0206, longitude: 28.7796 },
  { id: 'ilce-maltepe', name: 'Maltepe', latitude: 40.9440, longitude: 29.1556 },
  { id: 'ilce-pendik', name: 'Pendik', latitude: 40.9572, longitude: 29.3611 },
  { id: 'ilce-sancaktepe', name: 'Sancaktepe', latitude: 40.9994, longitude: 29.2750 },
  { id: 'ilce-sariyer', name: 'Sarıyer', latitude: 41.1716, longitude: 29.0244 },
  { id: 'ilce-silivri', name: 'Silivri', latitude: 41.1979, longitude: 28.1832 },
  { id: 'ilce-sultanbeyli', name: 'Sultanbeyli', latitude: 40.9683, longitude: 29.2783 },
  { id: 'ilce-sultangazi', name: 'Sultangazi', latitude: 41.1207, longitude: 28.8728 },
  { id: 'ilce-tuzla', name: 'Tuzla', latitude: 40.8917, longitude: 29.3557 },
  { id: 'ilce-zeytinburnu', name: 'Zeytinburnu', latitude: 41.0052, longitude: 28.9096 },
  { id: 'ilce-catalca', name: 'Çatalca', latitude: 41.3195, longitude: 28.3331 },
  { id: 'ilce-cekmekoy', name: 'Çekmeköy', latitude: 41.0728, longitude: 29.2701 },
  { id: 'ilce-umraniye', name: 'Ümraniye', latitude: 41.0272, longitude: 29.1375 },
  { id: 'ilce-uskudar', name: 'Üsküdar', latitude: 41.0352, longitude: 29.0490 },
  { id: 'ilce-sile', name: 'Şile', latitude: 41.0892, longitude: 29.6399 },
  { id: 'ilce-sisli', name: 'Şişli', latitude: 41.0665, longitude: 28.9889 },
];

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

const MAX_RESULTS = 60;

/**
 * Aksan/Türkçe karakter duyarsız arama ("uskudar" → Üsküdar): öne çıkan bölgeler, 39 ilçe ve ~1.000 semt.
 * Adı aramayla başlayanlar önce gelir.
 */
export function searchAreas(query: string): Area[] {
  const q = fold(query.trim());
  if (!q) return AREAS.filter((a) => a.popular);
  const matches = [...AREAS, ...ISTANBUL_NEIGHBOURHOODS].filter((a) => fold(a.name).includes(q));
  const starts = matches.filter((a) => fold(a.name).startsWith(q));
  const rest = matches.filter((a) => !fold(a.name).startsWith(q));
  return [...starts, ...rest].slice(0, MAX_RESULTS);
}

interface AreaState {
  /** Kullanıcının elle seçtiği bölge; null → cihaz GPS'i kullanılır */
  manual: Area | null;
  setManual: (area: Area | null) => void;
}

/** Elle seçilen bölge GPS'ten önceliklidir: seçim durdukça GPS güncellemeleri merkezi değiştirmez */
export const useAreaStore = create<AreaState>((set) => ({
  manual: null,
  setManual: (manual) => set({ manual }),
}));
