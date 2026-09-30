import type {
  AnnouncementStatus,
  AnnouncementType,
  ContentReportReason,
  FoodCategory,
  Locale,
  LocalTip,
  ModerationStatus,
  PriceLevel,
  ReportableContent,
  ReportType,
  ReviewSource,
  HoursSource,
  LiveCategory,
  LocationType,
  UserRole,
  VenueStatus,
  VenueSource,
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
  /** APP yorumlarında yazan üye */
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
  /** Porsiyon bilgisi: "1 porsiyon · 350 g" */
  portion: string | null;
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
  /** LOCALBITE dışındakiler canlı dış kaynaktan gelir: yorum/teyit/ihbar kabul etmez */
  source: VenueSource;
  /** Dış kaynaktaki mekanın sayfası (Google Maps / OpenStreetMap); kendi mekanlarımızda null */
  sourceUrl: string | null;
  /** Dış kaynakta fiyat bilgisi olmayabilir */
  priceLevel: PriceLevel | null;
  /** false → açık/kapalı bilinmiyor (isScheduledOpen/isActiveNow false döner) */
  openStatusKnown: boolean;
  /** Dış kaynaklı yerde tür etiketi yerine gösterilir; kendi mekanlarımızda null */
  liveCategory: LiveCategory | null;
  /** Dış kaynaklı yerde saat biliniyorsa İstanbul saatiyle bir sonraki değişim: açıksa kapanış, kapalıysa açılış */
  closesAt: string | null;
  opensAt: string | null;
  /** Saatin kaynağı (gerçek mekanlarda); kendi küratörlü mekanlarımızda null */
  hoursSource: HoursSource | null;
  /** Haritadaki gerçek bir dükkan (OSM/Google kaynaklı); false → LocalBite'ın küratörlü mekanı */
  isRealPlace: boolean;
  authenticityScore: number;
  /** Seyyarlarda o anki program diliminin köşesi, yoksa varsayılan konum */
  latitude: number;
  longitude: number;
  locationNote: string | null;
  neighborhood: string | null;
  district: string | null;
  localTips: LocalTip[];
  /** Ana sayfa yemek kategorileri (seyyarlarda STREET_CART dahil) */
  categories: FoodCategory[];
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
  /** Google Haritalar puanı (yalnızca Google'dan gelen gerçek mekanlarda); kendi yorumlarımızdan ayrıdır */
  googleRating: RatingSummary | null;
  /** Mekanın kendi kapağı; yoksa öne çıkan yemeğin fotoğrafı (temsili) */
  coverImageUrl: string | null;
  /** Kapak lisanslı yemek fotoğrafıysa görünür atıf ("Yazar · CC BY-SA 4.0"); mekanın kendi kapağında null */
  coverImageCredit: string | null;
  /** true → kapak mekanın kendisi değil, türünü temsil eden yemek fotoğrafı ("Temsili fotoğraf") */
  coverIsRepresentative: boolean;
  /** Esnaf sponsorlu öne çıkarma (ücretli yerleşim; "Sponsorlu" olarak etiketlenmeli) */
  isPromoted: boolean;
  /**
   * Satıcının kendi gönderdiği konum (seyyarlar). Doluysa latitude/longitude bu konumdur.
   * Tazelik istemcide liveLocationFreshness(updatedAt) ile hesaplanır (zaman ilerledikçe değişir).
   */
  liveLocation: { updatedAt: string } | null;
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
  /** Canlı dış mekanlar henüz gelmedi (arka planda yükleniyor); istemci kısa süre sonra yeniden sormalı */
  livePending: boolean;
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
  /** En yeni yorumlar (en fazla 30) */
  reviews: ReviewDTO[];
  /** Onaylı, yayın süresi dolmamış satıcı duyuruları */
  announcements: PublicAnnouncementDTO[];
  /** Adres konumdan türetildi (Nominatim); kesin kapı adresi değil */
  addressIsApproximate: boolean;
  website: string | null;
  /** Mekanı bir esnaf sahiplenmiş (menü/saat esnaf tarafından yönetilir) */
  isClaimed: boolean;
  /** Google kaynaklı gerçek mekanda canlı Google bilgileri (puan, yorumlar); saklanmaz. Yoksa null */
  google: GooglePlaceDTO | null;
  /** Dış kaynaklı yerin haftalık saatleri ("Pazartesi: 10:00–22:00"); kendi mekanlarımızda boş (schedules kullanılır) */
  weeklyHours: string[];
}


export interface PublicAnnouncementDTO {
  id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  publishedAt: string;
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
  /** Apple ile Giriş (yalnızca iOS'ta gösterilir) */
  apple: boolean;
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
  /** Kart fotoğrafı (göreli /media/... yolu) ve lisans atfı */
  imageUrl: string | null;
  imageCredit: string | null;
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

/** Web formundan gelen hesap silme talebi (yönetici görünümü) */
export interface DeletionRequestDTO {
  id: string;
  email: string;
  note: string | null;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  processedAt: string | null;
  /** Bu e-postaya kayıtlı hesap var mı */
  accountExists: boolean;
}

// ─────────────────────────────────────────────
// Esnaf paneli / Super Admin yönetim merkezi
// ─────────────────────────────────────────────

export interface VendorAnnouncementDTO {
  id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  status: AnnouncementStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface VendorDishDTO {
  id: string;
  localName: string;
  name: string;
  priceTry: number | null;
  portion: string | null;
}

export interface GeoPointDTO {
  latitude: number;
  longitude: number;
}

/** Satıcının kendi mekanı */
export interface VendorVenueDTO {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  locationType: LocationType;
  status: VenueStatus;
  /** Varsayılan (kayıtlı) konum */
  baseLocation: GeoPointDTO;
  /** Satıcının son gönderdiği konum */
  liveLocation: (GeoPointDTO & { updatedAt: string }) | null;
  /** Ziyaretçinin gördüğü durum (elle ayar ya da çalışma saatleri) */
  isOpenNow: boolean;
  /** Satıcının geçerli elle ayarı; null = çalışma saatlerine göre */
  openOverride: boolean | null;
  dishes: VendorDishDTO[];
  announcements: VendorAnnouncementDTO[];
  /** Esnafın girdiği haftalık saatler (gerçek mekanlar); küratörlü mekanlarda program kullanılır */
  weeklyHours: string[];
}

/** Google Places (New) bilgileri. Gösterilirken "Google Haritalar" atfı zorunlu. */
export interface GooglePlaceDTO {
  placeId: string;
  mapsUrl: string | null;
  rating: number | null;
  userRatingCount: number;
  /** null → Google'da saat bilgisi yok */
  openNow: boolean | null;
  /** İstanbul saatiyle "22:00"; açıkken kapanış, kapalıyken açılış */
  closesAt: string | null;
  opensAt: string | null;
  /** Google'ın yerelleştirdiği haftalık saatler ("Pazartesi: 09:00–22:00") */
  weekdayHours: string[];
  /** API üzerinden vekillenen kapak fotoğrafı (anahtar istemciye gitmez) */
  photos: { url: string; attribution: string | null; byOwner: boolean }[];
  reviews: GoogleReviewDTO[];
}

export interface GoogleReviewDTO {
  authorName: string;
  authorUrl: string | null;
  authorPhotoUrl: string | null;
  rating: number;
  text: string;
  /** "2 hafta önce" (Google yerelleştirir) */
  relativeTime: string | null;
  publishedAt: string | null;
}

/** Sahiplenme başvurusu (yönetim merkezi) */
export interface AdminClaimDTO {
  id: string;
  venue: { id: string; name: string; slug: string; address: string | null };
  user: { id: string; name: string; email: string | null; role: UserRole };
  note: string | null;
  phone: string | null;
  createdAt: string;
}

/** Üyenin menü önerisi (yönetim merkezi) */
export interface AdminDishSuggestionDTO {
  id: string;
  venue: { id: string; name: string; slug: string };
  userName: string | null;
  localName: string;
  priceTry: number | null;
  portion: string | null;
  createdAt: string;
}

/** Yönetim merkezi mekan satırı (onay, sponsorluk, konum denetimi) */
export interface AdminVenueDTO {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  locationType: LocationType;
  status: VenueStatus;
  isPromoted: boolean;
  neighborhood: string | null;
  district: string | null;
  locationNote: string | null;
  tagline: string | null;
  mustTry: string[];
  baseLocation: GeoPointDTO;
  liveLocation: (GeoPointDTO & { updatedAt: string }) | null;
  owner: { id: string; name: string; email: string | null } | null;
  createdAt: string;
}

export interface AdminAnnouncementDTO extends VendorAnnouncementDTO {
  venue: { id: string; name: string; slug: string };
}
