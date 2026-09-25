import type { FoodCategory, LatLng } from '@localbite/shared';
import { create } from 'zustand';

/** Keşfet mesafe seçenekleri (metre); null = "Tümü" */
export const DISTANCE_OPTIONS = [500, 1_000, 3_000, 5_000, null] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];
export const DEFAULT_DISTANCE: DistanceOption = 3_000;

export interface ExploreFilters {
  category: FoodCategory | null;
  /** Şu an açık / bugün teyit edilmiş */
  openNow: boolean;
  /** Yalnızca $ mekanlar */
  budget: boolean;
  /** Son 4 saatte konum paylaşan seyyarlar */
  liveOnly: boolean;
}

const NO_FILTERS: ExploreFilters = { category: null, openNow: false, budget: false, liveOnly: false };

/** Keşfet haritasındaki katman anahtarları: 🟠 SEYYAR, 🔵 ESNAF */
export interface MapLayers {
  carts: boolean;
  shops: boolean;
}

interface ExploreState {
  layers: MapLayers;
  toggleLayer: (key: keyof MapLayers) => void;
  /** Tümü / yalnız seyyar / yalnız esnaf */
  setLayers: (layers: MapLayers) => void;

  /** Haritada seçili mekan ("Social Lezzet Report" balonu) */
  selectedId: string | null;
  select: (id: string | null) => void;

  /** "Bu bölgede ara" ile sabitlenen arama merkezi; null ise kullanıcı konumu kullanılır */
  searchCenter: LatLng | null;
  setSearchCenter: (center: LatLng | null) => void;

  distance: DistanceOption;
  setDistance: (distance: DistanceOption) => void;
  filters: ExploreFilters;
  setFilter: <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) => void;
  /** Mesafe varsayılana döner, diğer filtreler kapanır */
  resetFilters: () => void;

  /** "Gizli Lezzet Bildir" modalı */
  suggestOpen: boolean;
  openSuggest: () => void;
  closeSuggest: () => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  layers: { carts: true, shops: true },
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  setLayers: (layers) => set({ layers }),

  selectedId: null,
  select: (selectedId) => set({ selectedId }),

  searchCenter: null,
  setSearchCenter: (searchCenter) => set({ searchCenter }),

  distance: DEFAULT_DISTANCE,
  setDistance: (distance) => set({ distance }),
  filters: NO_FILTERS,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ distance: DEFAULT_DISTANCE, filters: NO_FILTERS }),

  suggestOpen: false,
  openSuggest: () => set({ suggestOpen: true }),
  closeSuggest: () => set({ suggestOpen: false }),
}));
