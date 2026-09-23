import type { LatLng } from '@localbite/shared';
import { create } from 'zustand';

/** Keşfet haritasındaki katman anahtarları: 🟠 SEYYAR, 🔵 ESNAF */
export interface MapLayers {
  carts: boolean;
  shops: boolean;
}

interface ExploreState {
  layers: MapLayers;
  toggleLayer: (key: keyof MapLayers) => void;

  /** Haritada seçili mekan ("Social Lezzet Report" balonu) */
  selectedId: string | null;
  select: (id: string | null) => void;

  /** "Bu bölgede ara" ile sabitlenen arama merkezi; null ise kullanıcı konumu kullanılır */
  searchCenter: LatLng | null;
  setSearchCenter: (center: LatLng | null) => void;

  /** "Gizli Lezzet Bildir" modalı */
  suggestOpen: boolean;
  openSuggest: () => void;
  closeSuggest: () => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  layers: { carts: true, shops: true },
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),

  selectedId: null,
  select: (selectedId) => set({ selectedId }),

  searchCenter: null,
  setSearchCenter: (searchCenter) => set({ searchCenter }),

  suggestOpen: false,
  openSuggest: () => set({ suggestOpen: true }),
  closeSuggest: () => set({ suggestOpen: false }),
}));
