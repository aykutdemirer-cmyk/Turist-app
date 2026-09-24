import type { Locale, LocalTip, PriceLevel, ReportType, ReviewSource, UserRole, VenueType } from './enums';

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
  /** COMMUNITY yorumlarında yazan üye */
  userId: string | null;
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
  imageUrl: string | null;
}

/** Haritadaki "Social Lezzet Report" balonu ve kartlar için en yeni yorumun kısa hali */
export type ReviewSnippetDTO = Pick<ReviewDTO, 'authorName' | 'rating' | 'text' | 'source'>;

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
  coverImageUrl: string | null;
  topReview: ReviewSnippetDTO | null;
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

export interface VenueDetailDTO extends Omit<VenueSummaryDTO, 'distanceMeters' | 'mustTry' | 'topReview'> {
  address: string | null;
  phone: string | null;
  description: string | null;
  customTip: string | null;
  dishes: DishDTO[];
  schedules: ScheduleDTO[];
  /** En yeni yorumlar (en fazla 10) */
  reviews: ReviewDTO[];
}

/** Teyitler akışı: yakındaki son "Bugün burada gördüm" bildirimleri (raporlayan kimliği paylaşılmaz) */
export interface RecentConfirmationDTO {
  id: string;
  venueId: string;
  venueName: string;
  venueType: VenueType;
  isMobile: boolean;
  createdAt: string;
  distanceMeters: number;
}

export interface ReportResultDTO {
  reportId: string;
  type: ReportType;
  dayKey: string;
  venue: { lastSpottedAt: string | null; spottedCount: number; spottedTodayCount: number; upvoteCount: number };
}

// ─────────────────────────────────────────────
// Üyelik
// ─────────────────────────────────────────────

export interface AuthUserDTO {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  locale: Locale;
  createdAt: string;
}

/** Sunucuda yapılandırılmış sosyal giriş sağlayıcıları */
export interface OAuthProvidersDTO {
  google: boolean;
  github: boolean;
}

export interface AuthResponseDTO {
  /** Authorization: Bearer <token> */
  token: string;
  expiresAt: string;
  user: AuthUserDTO;
}

// ─────────────────────────────────────────────
// Topluluk
// ─────────────────────────────────────────────

/** Herkese açık yazar bilgisi: e-posta asla paylaşılmaz, soyadı kısaltılır. */
export interface PublicAuthorDTO {
  id: string;
  name: string;
  role: UserRole;
}

export interface PostDTO {
  id: string;
  title: string;
  content: string;
  author: PublicAuthorDTO;
  venue: { id: string; name: string } | null;
  likeCount: number;
  commentCount: number;
  /** Giriş yapmamış kullanıcı için false */
  likedByMe: boolean;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  content: string;
  author: PublicAuthorDTO;
  createdAt: string;
}

export interface FeedResponseDTO {
  items: PostDTO[];
  /** Sonraki sayfa için; son sayfada null */
  nextCursor: string | null;
}

export interface PostDetailDTO extends PostDTO {
  comments: CommentDTO[];
}

export interface LikeResultDTO {
  liked: boolean;
  likeCount: number;
}
