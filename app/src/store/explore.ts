import type { LatLng, VenueType } from '@localbite/shared';
import { create } from 'zustand';

export interface Filters {
  openNow: boolean;
  budget: boolean;
  /** Boşsa tüm kategoriler */
  categories: VenueType[];
}

export const NO_FILTERS: Filters = { openNow: false, budget: false, categories: [] };

interface ExploreState {
  filters: Filters;
  toggleFilter: (key: 'openNow' | 'budget') => void;
  toggleCategory: (type: VenueType) => void;
  /** Ana sayfadaki hızlı kategori seçiciler: yalnızca bu kategori */
  showOnlyCategory: (type: VenueType) => void;

  /** Haritada/karuselde seçili mekan */
  selectedId: string | null;
  select: (id: string | null) => void;

  /** "Bu bölgede ara" ile sabitlenen arama merkezi; null ise kullanıcı konumu kullanılır */
  searchCenter: LatLng | null;
  setSearchCenter: (center: LatLng | null) => void;

  /** "Gizli Lezzet Bildir" modalı (Bildir sekmesinden açılır) */
  suggestOpen: boolean;
  openSuggest: () => void;
  closeSuggest: () => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  filters: NO_FILTERS,
  toggleFilter: (key) => set((s) => ({ filters: { ...s.filters, [key]: !s.filters[key] } })),
  toggleCategory: (type) =>
    set((s) => {
      const has = s.filters.categories.includes(type);
      return {
        filters: {
          ...s.filters,
          categories: has ? s.filters.categories.filter((c) => c !== type) : [...s.filters.categories, type],
        },
      };
    }),
  showOnlyCategory: (type) => set((s) => ({ filters: { ...s.filters, categories: [type] } })),

  selectedId: null,
  select: (selectedId) => set({ selectedId }),

  searchCenter: null,
  setSearchCenter: (searchCenter) => set({ searchCenter }),

  suggestOpen: false,
  openSuggest: () => set({ suggestOpen: true }),
  closeSuggest: () => set({ suggestOpen: false }),
}));
