import type { LatLng } from '@localbite/shared';
import { create } from 'zustand';

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
];

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

/** Aksan/Türkçe karakter duyarsız arama ("uskudar" → Üsküdar) */
export function searchAreas(query: string): Area[] {
  const q = fold(query.trim());
  if (!q) return AREAS.filter((a) => a.popular);
  return AREAS.filter((a) => fold(a.name).includes(q));
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
