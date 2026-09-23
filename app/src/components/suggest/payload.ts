import {
  suggestVenueSchema,
  type LatLng,
  type LocalTip,
  type Locale,
  type PriceLevel,
  type SuggestVenueInput,
  type VenueType,
} from '@localbite/shared';

/** Formda sunulan kültürel ipucu çipleri (enum'un turiste en faydalı alt kümesi) */
export const SUGGEST_TIPS: LocalTip[] = ['CASH_ONLY', 'SELF_SERVICE_TRAY', 'PAY_AT_COUNTER', 'STANDING_ONLY'];

export interface SuggestFormState {
  location: LatLng | null;
  name: string;
  type: VenueType;
  isMobile: boolean;
  dish: string;
  priceLevel: PriceLevel;
  tips: LocalTip[];
  /** Seyyarlar için "Sadece akşamları 20:00'den sonra burada" gibi not → locationNote */
  hoursNote: string;
}

export const initialSuggestForm = (location: LatLng | null = null): SuggestFormState => ({
  location,
  name: '',
  type: 'STREET_CART',
  isMobile: true,
  dish: '',
  priceLevel: 'BUDGET',
  tips: [],
  hoursNote: '',
});

export type SuggestField = 'location' | 'name' | 'dish' | 'hoursNote' | 'form';
export type SuggestErrors = Partial<Record<SuggestField, true>>;

export type SuggestValidation =
  | { ok: true; payload: SuggestVenueInput }
  | { ok: false; errors: SuggestErrors };

const FIELD_BY_PATH: Record<string, SuggestField> = {
  name: 'name',
  latitude: 'location',
  longitude: 'location',
  mustTry: 'dish',
  locationNote: 'hoursNote',
};

/** Form durumunu API gövdesine çevirir ve paylaşılan Zod şemasıyla doğrular. */
export function buildSuggestPayload(form: SuggestFormState, locale: Locale): SuggestValidation {
  const dish = form.dish.trim();
  const hoursNote = form.hoursNote.trim();

  const result = suggestVenueSchema.safeParse({
    name: form.name,
    type: form.type,
    isMobile: form.isMobile,
    priceLevel: form.priceLevel,
    latitude: form.location?.latitude,
    longitude: form.location?.longitude,
    locationNote: form.isMobile && hoursNote ? hoursNote : undefined,
    locale,
    localTips: form.tips,
    mustTry: dish ? [{ localName: dish }] : [],
  });

  if (result.success) return { ok: true, payload: result.data };

  const errors: SuggestErrors = {};
  for (const issue of result.error.issues) {
    errors[FIELD_BY_PATH[String(issue.path[0])] ?? 'form'] = true;
  }
  return { ok: false, errors };
}
