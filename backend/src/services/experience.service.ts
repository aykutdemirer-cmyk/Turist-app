import type { ExperienceDTO, ExperiencePartner, Locale } from '@localbite/shared';
import { env } from '../env';

/**
 * İş ortaklığı (affiliate) deneyim kartları. Katalog sunucuda: uygulama güncellemesi olmadan değiştirilebilir.
 * Bağlantılar ortağın arama/ürün sayfasına gider; ortaklık kimliği (varsa) burada eklenir.
 * Kartlar arayüzde her zaman "İş Ortaklığı" olarak etiketlenir (reklam/ortaklık bildirimi).
 */

interface CatalogItem {
  id: string;
  partner: ExperiencePartner;
  kind: ExperienceDTO['kind'];
  /** Boşsa her yerde gösterilir; doluysa yalnızca bu ilçelerdeki mekanlarda */
  districts: string[];
  url: string;
  text: Record<Locale, { title: string; description: string }>;
}

const CATALOG: CatalogItem[] = [
  {
    id: 'gyg-kadikoy-food-tour',
    partner: 'GetYourGuide',
    kind: 'tour',
    districts: ['Kadıköy'],
    url: 'https://www.getyourguide.com/s/?q=Kadikoy%20food%20tour',
    text: {
      tr: {
        title: 'Rehber Eşliğinde Kadıköy Sokak Lezzetleri Turu',
        description: 'Çarşıda yerel rehberle midye, kokoreç ve tatlı durakları. Tarih ve fiyatları GetYourGuide’da gör.',
      },
      en: {
        title: 'Guided Kadıköy Street Food Tour',
        description: 'Mussels, kokoreç and dessert stops with a local guide. See dates and prices on GetYourGuide.',
      },
    },
  },
  {
    id: 'viator-old-city-coffee-walk',
    partner: 'Viator',
    kind: 'tour',
    districts: ['Fatih', 'Eminönü'],
    url: 'https://www.viator.com/searchResults/all?text=Istanbul%20old%20city%20coffee%20dessert%20walk',
    text: {
      tr: {
        title: 'Tarihi Yarımada Kahve & Tatlı Yürüyüşü',
        description: 'Türk kahvesi, lokum ve baklava eşliğinde eski şehir sokakları. Seçenekleri Viator’da incele.',
      },
      en: {
        title: 'Old City Coffee & Dessert Walk',
        description: 'Turkish coffee, lokum and baklava through the old town’s backstreets. Browse options on Viator.',
      },
    },
  },
  {
    id: 'airalo-turkey-esim',
    partner: 'Airalo',
    kind: 'connectivity',
    districts: [],
    url: 'https://www.airalo.com/turkey-esim',
    text: {
      tr: {
        title: 'Türkiye Seyahat eSIM Paketi',
        description: 'Havalimanında SIM aramadan internete bağlan; haritalar ve yol tarifi her yerde çalışsın.',
      },
      en: {
        title: 'Türkiye Travel eSIM',
        description: 'Get online without hunting for a SIM at the airport — maps and directions work everywhere.',
      },
    },
  },
];

/** Ortaklık kimliğini ekler (ortam değişkeni verilmişse) */
function withAffiliate(partner: ExperiencePartner, url: string): string {
  const u = new URL(url);
  if (partner === 'GetYourGuide' && env.GETYOURGUIDE_PARTNER_ID) u.searchParams.set('partner_id', env.GETYOURGUIDE_PARTNER_ID);
  if (partner === 'Viator' && env.VIATOR_PID) u.searchParams.set('pid', env.VIATOR_PID);
  if (partner === 'Airalo' && env.AIRALO_REF) u.searchParams.set('ref', env.AIRALO_REF);
  u.searchParams.set('utm_source', 'localbite');
  u.searchParams.set('utm_medium', 'app');
  return u.toString();
}

export function listExperiences(locale: Locale, district?: string | null): ExperienceDTO[] {
  return CATALOG.filter((c) => !district || c.districts.length === 0 || c.districts.includes(district)).map((c) => ({
    id: c.id,
    partner: c.partner,
    kind: c.kind,
    title: c.text[locale].title,
    description: c.text[locale].description,
    url: withAffiliate(c.partner, c.url),
  }));
}
