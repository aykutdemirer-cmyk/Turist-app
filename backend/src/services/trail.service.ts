import type { Locale, TrailDetailDTO, TrailSummaryDTO } from '@localbite/shared';
import { prisma } from '../db';
import { HttpError, notFound } from '../lib/errors';
import { pickTranslation } from '../lib/locale';

/**
 * Küratörlü lezzet rotaları. Premium rotaların durakları yalnızca Explorer Pass sahiplerine gönderilir;
 * kilit istemcide değil sunucuda uygulanır.
 */

interface TrailDef {
  slug: string;
  isPremium: boolean;
  durationMinutes: number;
  /** Sıralı duraklar: mekan slug'ı, durak notu ve önerilen yemeğin yerel adı (listede başa alınır) */
  stops: { venue: string; highlight?: string; note: Record<Locale, string> }[];
  text: Record<Locale, { title: string; subtitle: string; area: string; description: string }>;
}

const TRAILS: TrailDef[] = [
  {
    slug: 'kadikoy-gece-kusu',
    isPremium: false,
    durationMinutes: 120,
    stops: [
      {
        venue: 'rihtim-gece-pilavcisi',
        highlight: 'Nohutlu Pilav',
        note: {
          tr: 'Son vapurdan inince ilk durak: tereyağlı nohutlu pilav, yanına turşu.',
          en: 'First stop off the last ferry: buttery chickpea pilaf with pickles.',
        },
      },
      {
        venue: 'kadikoy-seyyar-kofteci',
        highlight: 'Kokoreç',
        note: {
          tr: 'Altıyol’a yürü; "yarım kokoreç, bol baharatlı" iste.',
          en: 'Walk up to Altıyol and ask for "yarım kokoreç, bol baharatlı" (half, extra spicy).',
        },
      },
      {
        venue: 'moda-sutlu-tatlici',
        highlight: 'Fırın Sütlaç',
        note: {
          tr: 'Moda’ya doğru inerken fırın sütlaçla kapat.',
          en: 'Finish with baked rice pudding on the way down to Moda.',
        },
      },
    ],
    text: {
      tr: {
        title: 'Kadıköy Gece Kuşu: Pilav, Kokoreç & Tatlı',
        subtitle: 'Ücretsiz örnek rota',
        area: 'Kadıköy',
        description: 'Gece yarısından sonra açık kalan üç yerel durak. Yürüyerek ~2 saat, kişi başı yaklaşık ₺500.',
      },
      en: {
        title: 'Kadıköy Night Owl: Pilaf, Kokoreç & Dessert',
        subtitle: 'Free sample trail',
        area: 'Kadıköy',
        description: 'Three local stops that stay open past midnight. About 2 hours on foot, roughly ₺500 per person.',
      },
    },
  },
  {
    slug: 'tarihi-yarimada-esnaf',
    isPremium: true,
    durationMinutes: 240,
    stops: [
      { venue: 'hocapasa-sulu-yemek-evi', highlight: 'Kuru Fasulye', note: { tr: 'Öğlen kalabalığından önce kuru fasulye.', en: 'Beans and rice before the lunch rush.' } },
      { venue: 'tahtakale-esnaf-lokantasi', note: { tr: 'Tepsini al, vitrinden göster.', en: 'Grab a tray and point at the display.' } },
      { venue: 'sirkeci-kestane-misir', highlight: 'Közde Kestane', note: { tr: 'Yürürken közde kestane.', en: 'Roasted chestnuts to walk with.' } },
      { venue: 'eminonu-balik-ekmek-arabasi', highlight: 'Balık Ekmek', note: { tr: 'Tekneden balık ekmek, yanına turşu suyu.', en: 'Fish sandwich from the boat with pickle juice.' } },
      { venue: 'vezneciler-adana-durum', highlight: 'Adana Dürüm', note: { tr: 'Üniversite yokuşunda acılı Adana ile bitir.', en: 'End with a spicy Adana wrap up by the university.' } },
    ],
    text: {
      tr: {
        title: 'Tarihi Yarımada Gizli Esnaf Lokantaları',
        subtitle: 'Explorer Pass',
        area: 'Eminönü · Fatih',
        description: 'Turistlerin önünden geçip görmediği beş esnaf durağı, sipariş ipuçlarıyla. Yarım gün, kişi başı yaklaşık ₺900.',
      },
      en: {
        title: 'Old City Hidden Canteens',
        subtitle: 'Explorer Pass',
        area: 'Eminönü · Fatih',
        description: 'Five tradesmen’s canteens tourists walk past, with ordering tips. Half a day, roughly ₺900 per person.',
      },
    },
  },
];

const summary = (t: TrailDef, locale: Locale, premium: boolean): TrailSummaryDTO => ({
  slug: t.slug,
  title: t.text[locale].title,
  subtitle: t.text[locale].subtitle,
  area: t.text[locale].area,
  stopCount: t.stops.length,
  durationMinutes: t.durationMinutes,
  isPremium: t.isPremium,
  locked: t.isPremium && !premium,
});

export async function isPremiumUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } });
  return !!u?.premiumUntil && u.premiumUntil > new Date();
}

export async function listTrails(locale: Locale, viewerId: string | null): Promise<TrailSummaryDTO[]> {
  const premium = await isPremiumUser(viewerId);
  return TRAILS.map((t) => summary(t, locale, premium));
}

export async function getTrail(slug: string, locale: Locale, viewerId: string | null): Promise<TrailDetailDTO> {
  const def = TRAILS.find((t) => t.slug === slug);
  if (!def) throw notFound('Trail');
  const premium = await isPremiumUser(viewerId);
  if (def.isPremium && !premium) {
    throw new HttpError(402, 'PREMIUM_REQUIRED', 'This trail is part of the Explorer Pass', summary(def, locale, premium));
  }

  const venues = await prisma.venue.findMany({
    where: { slug: { in: def.stops.map((s) => s.venue) }, status: 'ACTIVE' },
    include: {
      dishes: { where: { isMustTry: true }, orderBy: { sortOrder: 'asc' }, include: { translations: true } },
    },
  });
  const bySlug = new Map(venues.map((v) => [v.slug, v]));

  return {
    ...summary(def, locale, premium),
    description: def.text[locale].description,
    stops: def.stops.flatMap((s, i) => {
      const v = bySlug.get(s.venue);
      if (!v) return [];
      return [
        {
          position: i + 1,
          note: s.note[locale],
          venue: {
            id: v.id,
            name: v.name,
            type: v.type,
            isMobile: v.locationType === 'DYNAMIC_STREET',
            neighborhood: v.neighborhood,
            coverImageUrl: v.coverImageUrl,
            latitude: v.latitude,
            longitude: v.longitude,
            // Durağın önerilen yemeği başta, ardından menüdeki ilk yemek
            mustTry: [...v.dishes]
              .sort((a, b) => Number(b.localName === s.highlight) - Number(a.localName === s.highlight))
              .slice(0, 2)
              .map((d) => pickTranslation(d.translations, locale)?.name ?? d.localName),
          },
        },
      ];
    }),
  };
}
