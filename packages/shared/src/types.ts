import type {
  ContentReportReason,
  Locale,
  LocalTip,
  ModerationStatus,
  PriceLevel,
  ReportableContent,
  ReportType,
  ReviewSource,
  UserRole,
  VenueType,
} from './enums';

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
  /** Yaklaşık porsiyon fiyatı (TL) */
  priceTry: number | null;
  /** Mutlak URL ya da API'ye göre göreli yol (/media/...) */
  imageUrl: string | null;
  /** Lisanslı fotoğrafın görünür atfı: "Yazar · CC BY-SA 4.0" */
  imageCredit: string | null;
  imageSourceUrl: string | null;
}

/** Kişi başı yaklaşık harcama (TL) */
export interface PriceBandDTO {
  min: number;
  max: number;
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
  /** Esnaf sponsorlu öne çıkarma (ücretli yerleşim; "Sponsorlu" olarak etiketlenmeli) */
  isPromoted: boolean;
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
  /** Kişi başı ortalama; veri yoksa null */
  pricePerPerson: PriceBandDTO | null;
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
  /** Explorer Pass sahibi */
  isPremium: boolean;
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

// ─────────────────────────────────────────────
// Moderasyon
// ─────────────────────────────────────────────

export interface BlockedUserDTO {
  id: string;
  name: string;
  blockedAt: string;
}

/** Yönetici paneli: şikayet edilen içerik, şikayet sayısıyla gruplanmış */
export interface AdminReportDTO {
  /** İlk şikayetin kimliği (kaldır/yoksay işlemleri bununla yapılır) */
  id: string;
  contentType: ReportableContent;
  contentId: string;
  status: ModerationStatus;
  reasons: Partial<Record<ContentReportReason, number>>;
  reportCount: number;
  notes: string[];
  firstReportedAt: string;
  /** İçerik silinmişse null */
  content: { text: string; authorId: string | null; authorName: string; removed: boolean } | null;
}

// ─────────────────────────────────────────────
// Gelir modeli: iş ortaklığı deneyimleri, lezzet rotaları
// ─────────────────────────────────────────────

export type ExperiencePartner = 'GetYourGuide' | 'Viator' | 'Airalo';

/** Harici iş ortağı hizmeti (affiliate). Arayüzde "İş Ortaklığı" olarak etiketlenir. */
export interface ExperienceDTO {
  id: string;
  partner: ExperiencePartner;
  kind: 'tour' | 'connectivity';
  title: string;
  description: string;
  /** Harici tarayıcıda açılır; ortaklık kimliği sunucuda eklenir */
  url: string;
}

export interface TrailSummaryDTO {
  slug: string;
  title: string;
  subtitle: string;
  area: string;
  stopCount: number;
  durationMinutes: number;
  isPremium: boolean;
  /** Premium rota ve izleyici Pass sahibi değil */
  locked: boolean;
}

export interface TrailStopDTO {
  position: number;
  note: string;
  venue: Pick<VenueSummaryDTO, 'id' | 'name' | 'type' | 'isMobile' | 'neighborhood' | 'coverImageUrl' | 'latitude' | 'longitude'> & {
    mustTry: string[];
  };
}

export interface TrailDetailDTO extends TrailSummaryDTO {
  description: string;
  stops: TrailStopDTO[];
}
