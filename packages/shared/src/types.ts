import type { Locale, LocalTip, PriceLevel, ReportType, ReviewSource, VenueType } from './enums';

export interface ReviewDTO {
  id: string;
  authorName: string;
  rating: number;
  source: ReviewSource;
  sourceUrl: string | null;
  publishedAt: string;
  /** İstenen dildeki metin; yoksa özgün dil */
  text: string;
  originalLocale: Locale;
  /** Metin özgün dilinden farklı bir dilde mi gösteriliyor */
  isTranslated: boolean;
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

export interface DishDTO {
  id: string;
  localName: string;
  name: string; // istenen dilde; çeviri yoksa localName
  description: string | null;
  isMustTry: boolean;
  isVegetarian: boolean;
  priceTry: number | null;
}

export interface ScheduleDTO {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
  opensAt: string; // "19:00"
  closesAt: string; // "02:00"
  latitude: number | null;
  longitude: number | null;
  locationNote: string | null;
}

export interface VenueSummaryDTO {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  isMobile: boolean;
  priceLevel: PriceLevel;
  authenticityScore: number;
  /** Seyyarlarda o anki program diliminin köşesi, yoksa varsayılan konum */
  latitude: number;
  longitude: number;
  locationNote: string | null;
  neighborhood: string | null;
  district: string | null;
  localTips: LocalTip[];
  tagline: string | null;
  distanceMeters: number;
  isScheduledOpen: boolean;
  isActiveNow: boolean;
  lastSpottedAt: string | null;
  spottedCount: number;
  /** Bugün (İstanbul saatiyle) "Bugün burada gördüm" diyen kişi sayısı */
  spottedTodayCount: number;
  upvoteCount: number;
  rating: RatingSummary;
  mustTry: Pick<DishDTO, 'id' | 'localName' | 'name'>[];
}

export interface NearbyResponseDTO {
  items: VenueSummaryDTO[];
  count: number;
  center: { latitude: number; longitude: number };
  radius: number;
  locale: string;
  generatedAt: string;
}

export interface VenueDetailDTO extends Omit<VenueSummaryDTO, 'distanceMeters' | 'mustTry'> {
  address: string | null;
  phone: string | null;
  description: string | null;
  customTip: string | null;
  dishes: DishDTO[];
  schedules: ScheduleDTO[];
  /** En yeni yorumlar (en fazla 10) */
  reviews: ReviewDTO[];
}

export interface ReportResultDTO {
  reportId: string;
  type: ReportType;
  dayKey: string;
  venue: { lastSpottedAt: string | null; spottedCount: number; spottedTodayCount: number; upvoteCount: number };
}
