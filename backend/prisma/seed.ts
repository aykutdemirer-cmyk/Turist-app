/**
 * İstanbul örnek verisi — 13 mekan (4 seyyar, 4 esnaf lokantası, 3 burger/dürüm/döner, 1 pideci, 1 tatlıcı).
 *
 * Konumlar gerçek semtlerde (Kadıköy, Sirkeci, Eminönü, Vezneciler), ancak işletme adları,
 * saatleri ve puanları geliştirme için KURGUSALDIR; gerçek bir işletmeyi temsil etmez.
 *
 * Idempotent: yalnızca buradaki slug'lara sahip mekanları silip yeniden oluşturur,
 * kullanıcı önerilerine dokunmaz.
 */
import { PrismaClient, type FoodCategory, type LocalTip, type PriceLevel, type UserRole, type VenueType } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { toMinutes } from '@localbite/shared';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;
const EVERY_DAY = [SUN, MON, TUE, WED, THU, FRI, SAT];
const MON_SAT = [MON, TUE, WED, THU, FRI, SAT];

interface Text {
  tagline: string;
  description: string;
  customTip?: string;
}

interface SeedDish {
  localName: string;
  isVegetarian?: boolean;
  en: { name: string; description: string };
  tr: { name: string; description: string };
}

interface SeedSchedule {
  days: number[];
  open: string; // "HH:MM"
  close: string; // "HH:MM" — açılıştan küçükse gece yarısını aşar
  latitude?: number;
  longitude?: number;
  locationNote?: string;
}

interface SeedVenue {
  slug: string;
  name: string;
  type: VenueType;
  isMobile: boolean;
  priceLevel: PriceLevel;
  authenticityScore: number;
  latitude: number;
  longitude: number;
  address?: string;
  locationNote?: string;
  neighborhood: string;
  district: string;
  localTips: LocalTip[];
  spottedMinutesAgo?: number;
  spottedCount?: number;
  upvoteCount?: number;
  en: Text;
  tr: Text;
  dishes: SeedDish[];
  schedules: SeedSchedule[];
}

const venues: SeedVenue[] = [
  // ───────────── Seyyarlar ─────────────
  {
    slug: 'rihtim-gece-pilavcisi',
    name: 'Rıhtım Gece Pilavcısı — Hüseyin Usta',
    type: 'STREET_CART',
    isMobile: true,
    priceLevel: 'BUDGET',
    authenticityScore: 95,
    latitude: 40.9923,
    longitude: 29.0232,
    locationNote: 'Kadıköy iskelesi çıkışı, Rıhtım Caddesi otobüs duraklarının önü',
    neighborhood: 'Rıhtım',
    district: 'Kadıköy',
    localTips: ['CASH_ONLY', 'STANDING_ONLY', 'CLOSES_WHEN_SOLD_OUT'],
    spottedCount: 41,
    upvoteCount: 128,
    en: {
      tagline: 'The late-night rice cart night owls and ferry commuters swear by',
      description:
        'A glass-fronted cart that rolls up after dark and serves buttery rice pilaf with chickpeas until the pot is empty. Eaten standing, on a paper plate, next to taxi drivers finishing their shift.',
      customTip: "Ask for 'bol tereyağlı' for an extra spoon of butter.",
    },
    tr: {
      tagline: 'Gece kuşlarının ve vapur yolcularının vazgeçilmez pilav arabası',
      description:
        'Karanlık çökünce gelen camlı araba, tencere bitene kadar tereyağlı nohutlu pilav verir. Kâğıt tabakta, ayakta, vardiyadan çıkan taksicilerle yan yana yenir.',
      customTip: "Tereyağını seviyorsanız 'bol tereyağlı' deyin.",
    },
    dishes: [
      {
        localName: 'Nohutlu Pilav',
        isVegetarian: true,
        en: { name: 'Rice pilaf with chickpeas', description: 'Butter-rich rice with soft chickpeas, served hot.' },
        tr: { name: 'Nohutlu Pilav', description: 'Bol tereyağlı pirinç pilavı, yumuşak nohutla.' },
      },
      {
        localName: 'Tavuklu Nohutlu Pilav',
        en: { name: 'Chicken & chickpea pilaf', description: 'The same pilaf topped with shredded boiled chicken.' },
        tr: { name: 'Tavuklu Nohutlu Pilav', description: 'Didiklenmiş haşlama tavukla.' },
      },
      {
        localName: 'Turşu',
        isVegetarian: true,
        en: { name: 'Pickles', description: 'Sharp mixed pickles that cut through the butter.' },
        tr: { name: 'Turşu', description: 'Pilavın yağını kesen karışık turşu.' },
      },
    ],
    schedules: [{ days: [SUN, TUE, WED, THU, FRI, SAT], open: '22:00', close: '04:00' }],
  },
  {
    slug: 'kadikoy-seyyar-kofteci',
    name: 'Seyyar Köfteci Mehmet',
    type: 'STREET_CART',
    isMobile: true,
    priceLevel: 'BUDGET',
    authenticityScore: 92,
    latitude: 40.9876,
    longitude: 29.0293,
    locationNote: 'Altıyol, boğa heykelinin karşı köşesi',
    neighborhood: 'Altıyol',
    district: 'Kadıköy',
    localTips: ['CASH_ONLY', 'STANDING_ONLY', 'POINT_TO_ORDER'],
    spottedCount: 23,
    upvoteCount: 74,
    en: {
      tagline: 'Charcoal-grilled meatball sandwiches from a cart with a smoking grill',
      description:
        'Follow the smoke. Köfte are grilled over charcoal on the cart and stuffed into half a loaf with onions, tomato and pickled peppers. On weekends he moves up to the opera house where the crowds are.',
      customTip: "Say 'yarım ekmek' for a half loaf, 'çeyrek' for a quarter.",
    },
    tr: {
      tagline: 'Kömür ızgarasında pişen köfte-ekmek, dumanı takip edin',
      description:
        'Köfteler arabanın üstündeki mangalda pişer, soğan, domates ve turşu biberle yarım ekmeğe konur. Hafta sonları kalabalığın olduğu Süreyya Operası önüne geçer.',
      customTip: "'Yarım ekmek' ya da daha az aç iseniz 'çeyrek' isteyin.",
    },
    dishes: [
      {
        localName: 'Köfte Ekmek',
        en: { name: 'Meatball sandwich', description: 'Charcoal-grilled beef köfte in bread with onion, tomato and pickled pepper.' },
        tr: { name: 'Köfte Ekmek', description: 'Soğan, domates ve turşu biberle yarım ekmek arası kömür köfte.' },
      },
      {
        localName: 'Közlenmiş Biber',
        isVegetarian: true,
        en: { name: 'Charred green peppers', description: 'Blistered peppers, ask for them inside the sandwich.' },
        tr: { name: 'Közlenmiş Biber', description: 'Ekmek arasına eklenebilir.' },
      },
      {
        localName: 'Ayran',
        isVegetarian: true,
        en: { name: 'Ayran', description: 'Salty yogurt drink, the classic pairing.' },
        tr: { name: 'Ayran', description: 'Köftenin klasik eşlikçisi.' },
      },
    ],
    schedules: [
      { days: [MON, TUE, WED, THU], open: '18:00', close: '00:30' },
      {
        days: [FRI, SAT],
        open: '18:00',
        close: '02:00',
        latitude: 40.9868,
        longitude: 29.0305,
        locationNote: 'Hafta sonu: Bahariye Caddesi, Süreyya Operası önü',
      },
    ],
  },
  {
    slug: 'sirkeci-kestane-misir',
    name: 'Sirkeci Kestane & Mısır Arabası',
    type: 'STREET_CART',
    isMobile: true,
    priceLevel: 'BUDGET',
    authenticityScore: 86,
    latitude: 41.0149,
    longitude: 28.9767,
    locationNote: 'Sirkeci Garı ana girişinin karşısı, tramvay durağı yanı',
    neighborhood: 'Sirkeci',
    district: 'Fatih',
    localTips: ['CASH_ONLY', 'STANDING_ONLY'],
    spottedMinutesAgo: 35,
    spottedCount: 12,
    upvoteCount: 39,
    en: {
      tagline: 'Chestnuts roasting on a charcoal cart, the smell of an Istanbul autumn',
      description:
        'The red cart with the brass-topped roaster. Corn all year, chestnuts from October to March. A warm paper cone of chestnuts is the local way to walk to the ferry.',
      customTip: "Chestnuts are sold by weight — 'yüz gram' (100 g) is a good first try.",
    },
    tr: {
      tagline: 'Kömürde kestane kokusu: İstanbul sonbaharı',
      description:
        'Pirinç kapaklı kırmızı araba. Mısır bütün yıl, kestane ekimden marta kadar. Sıcak bir kâğıt külah kestaneyle vapura yürümek tam yerli işi.',
    },
    dishes: [
      {
        localName: 'Közde Kestane',
        isVegetarian: true,
        en: { name: 'Roasted chestnuts', description: 'Charcoal-roasted, sold warm in a paper cone. Seasonal (Oct–Mar).' },
        tr: { name: 'Közde Kestane', description: 'Kâğıt külahta sıcak kestane. Mevsimlik (Ekim–Mart).' },
      },
      {
        localName: 'Haşlanmış Mısır',
        isVegetarian: true,
        en: { name: 'Boiled corn', description: 'Salted corn on the cob, kept hot in the cart.' },
        tr: { name: 'Haşlanmış Mısır', description: 'Tuzlu haşlama mısır.' },
      },
      {
        localName: 'Közde Mısır',
        isVegetarian: true,
        en: { name: 'Grilled corn', description: 'Charred over the coals, smoky and chewy.' },
        tr: { name: 'Közde Mısır', description: 'Kömürde közlenmiş, isli mısır.' },
      },
    ],
    schedules: [{ days: EVERY_DAY, open: '10:00', close: '21:00' }],
  },
  {
    slug: 'eminonu-balik-ekmek-arabasi',
    name: 'Eminönü Balık-Ekmek Arabası — Reis',
    type: 'STREET_CART',
    isMobile: true,
    priceLevel: 'BUDGET',
    authenticityScore: 81,
    latitude: 41.0172,
    longitude: 28.9728,
    locationNote: 'Galata Köprüsü Eminönü ayağı, Mısır Çarşısı tarafı',
    neighborhood: 'Eminönü',
    district: 'Fatih',
    localTips: ['CASH_ONLY', 'STANDING_ONLY', 'POINT_TO_ORDER'],
    spottedCount: 18,
    upvoteCount: 55,
    en: {
      tagline: 'Grilled fish sandwiches by the Galata Bridge, the locals-only cart version',
      description:
        'Skip the rocking boats and their queues: this cart grills mackerel fillets on a flat-top and wraps them with onion and greens. Shipyard workers and fishermen eat here.',
      customTip: 'Add lemon and pul biber (chili flakes) from the bottles on the counter.',
    },
    tr: {
      tagline: 'Galata Köprüsü dibinde balık-ekmek, kalabalıksız arabası',
      description:
        'Sallanan teknelerin kuyruğuna girmeyin: bu araba uskumru filetoyu sacda pişirip soğan ve yeşillikle ekmeğe koyar. Balıkçılar ve esnaf burada yer.',
    },
    dishes: [
      {
        localName: 'Balık Ekmek',
        en: { name: 'Grilled fish sandwich', description: 'Mackerel fillet in bread with onion, lettuce and lemon.' },
        tr: { name: 'Balık Ekmek', description: 'Soğan, marul ve limonla uskumru ekmek arası.' },
      },
      {
        localName: 'Şalgam Suyu',
        isVegetarian: true,
        en: { name: 'Şalgam (turnip juice)', description: 'Spicy, sour fermented purple carrot drink. An acquired taste — try it!' },
        tr: { name: 'Şalgam Suyu', description: 'Acılı ya da acısız.' },
      },
      {
        localName: 'Turşu Suyu',
        isVegetarian: true,
        en: { name: 'Pickle juice', description: 'A cup of pickle brine with a few pickles. Locals drink it with fish.' },
        tr: { name: 'Turşu Suyu', description: 'Balığın yanına turşu suyu.' },
      },
    ],
    schedules: [{ days: EVERY_DAY, open: '09:00', close: '22:00' }],
  },

  // ───────────── Esnaf lokantaları ─────────────
  {
    slug: 'hocapasa-sulu-yemek-evi',
    name: 'Hocapaşa Sulu Yemek Evi',
    type: 'HOME_COOKING',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 91,
    latitude: 41.0143,
    longitude: 28.9757,
    address: 'Hocapaşa Sk., Hocapaşa Mah., Fatih',
    neighborhood: 'Sirkeci',
    district: 'Fatih',
    localTips: ['POINT_TO_ORDER', 'PAY_AT_COUNTER', 'LUNCH_ONLY', 'SHARED_TABLES', 'NO_RESERVATIONS'],
    upvoteCount: 97,
    en: {
      tagline: 'Steam-table home cooking where Sirkeci shopkeepers eat lunch',
      description:
        'Pots simmer behind a glass counter; you point, they ladle. Beans with rice is the house signature. Plates are half-portions on request, so you can try two or three dishes.',
      customTip: "Ask for 'yarım porsiyon' (half portion) to try more dishes.",
    },
    tr: {
      tagline: 'Sirkeci esnafının öğle yemeği yediği sulu yemekçi',
      description:
        'Tencereler camlı tezgahın arkasında kaynar; gösterirsiniz, koyarlar. Kuru fasulye-pilav evin imzası. Yarım porsiyon istenebilir.',
    },
    dishes: [
      {
        localName: 'Kuru Fasulye',
        en: { name: 'Stewed white beans', description: 'Slow-cooked beans in tomato sauce with pastırma (cured beef), eaten with rice pilaf.' },
        tr: { name: 'Kuru Fasulye', description: 'Pilavla birlikte, pastırmalı.' },
      },
      {
        localName: 'Etli Nohut',
        en: { name: 'Chickpea & beef stew', description: 'Chickpeas and cubed beef in a light tomato broth.' },
        tr: { name: 'Etli Nohut', description: 'Kuşbaşı etli nohut yemeği.' },
      },
      {
        localName: 'Fırın Sütlaç',
        isVegetarian: true,
        en: { name: 'Baked rice pudding', description: 'Creamy rice pudding with a caramelised top, served cold.' },
        tr: { name: 'Fırın Sütlaç', description: 'Üstü kızarmış, soğuk servis.' },
      },
    ],
    schedules: [{ days: MON_SAT, open: '11:00', close: '17:00' }],
  },
  {
    slug: 'tahtakale-esnaf-lokantasi',
    name: 'Tahtakale Esnaf Lokantası',
    type: 'HOME_COOKING',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 94,
    latitude: 41.0163,
    longitude: 28.9688,
    address: 'Tahtakale Cd., Rüstem Paşa Mah., Fatih',
    neighborhood: 'Tahtakale',
    district: 'Fatih',
    localTips: ['SELF_SERVICE_TRAY', 'PAY_AT_COUNTER', 'LUNCH_ONLY', 'CLOSES_WHEN_SOLD_OUT'],
    upvoteCount: 112,
    en: {
      tagline: 'A tray-and-counter canteen in the wholesale market lanes',
      description:
        'Grab a tray, slide it along the counter and pick your plates. This is where the Tahtakale wholesalers eat — fast, filling and gone by mid-afternoon.',
      customTip: 'Merchants eat early: arrive before 12:30 for the full selection.',
    },
    tr: {
      tagline: 'Tahtakale toptancılarının tepsi-tezgah lokantası',
      description:
        'Tepsiyi alın, tezgah boyunca kaydırıp tabaklarınızı seçin. Hızlı, doyurucu; öğleden sonra yemekler biter.',
    },
    dishes: [
      {
        localName: 'Mercimek Çorbası',
        isVegetarian: true,
        en: { name: 'Red lentil soup', description: 'Smooth lentil soup with lemon and chili butter.' },
        tr: { name: 'Mercimek Çorbası', description: 'Limon ve pul biberli.' },
      },
      {
        localName: 'Karnıyarık',
        en: { name: 'Stuffed eggplant', description: 'Fried eggplant split open and filled with spiced minced beef.' },
        tr: { name: 'Karnıyarık', description: 'Kıymalı, fırında.' },
      },
      {
        localName: 'İzmir Köfte',
        en: { name: 'Meatball & potato bake', description: 'Oven-baked meatballs with potatoes and peppers in tomato sauce.' },
        tr: { name: 'İzmir Köfte', description: 'Patates ve biberle fırın köfte.' },
      },
    ],
    schedules: [{ days: MON_SAT, open: '07:00', close: '16:00' }],
  },
  {
    slug: 'kadikoy-carsi-ev-yemekleri',
    name: 'Çarşı Ev Yemekleri',
    type: 'HOME_COOKING',
    isMobile: false,
    priceLevel: 'MODERATE',
    authenticityScore: 88,
    latitude: 40.9906,
    longitude: 29.0262,
    address: 'Güneşlibahçe Sk., Caferağa Mah., Kadıköy',
    neighborhood: 'Kadıköy Çarşı',
    district: 'Kadıköy',
    localTips: ['POINT_TO_ORDER', 'NO_RESERVATIONS', 'PAY_AT_COUNTER'],
    upvoteCount: 83,
    en: {
      tagline: 'Olive-oil vegetables and slow stews in the heart of the Kadıköy market',
      description:
        'Between the fishmongers and pickle shops, a family kitchen known for its cold olive-oil dishes (zeytinyağlı) and a proper hünkar beğendi.',
    },
    tr: {
      tagline: 'Kadıköy Çarşısı ortasında zeytinyağlılar ve ağır ateş yemekleri',
      description: 'Balıkçılar ve turşucular arasında, zeytinyağlıları ve hünkar beğendisiyle bilinen aile mutfağı.',
    },
    dishes: [
      {
        localName: 'İmam Bayıldı',
        isVegetarian: true,
        en: { name: 'Olive-oil stuffed eggplant', description: 'Eggplant braised with onion, garlic and tomato. Served cold.' },
        tr: { name: 'İmam Bayıldı', description: 'Zeytinyağlı, soğuk servis.' },
      },
      {
        localName: 'Hünkar Beğendi',
        en: { name: "Sultan's delight", description: 'Tender lamb stew over smoky eggplant and cheese purée.' },
        tr: { name: 'Hünkar Beğendi', description: 'Közlenmiş patlıcan beğendi üstünde kuzu.' },
      },
      {
        localName: 'Zeytinyağlı Enginar',
        isVegetarian: true,
        en: { name: 'Olive-oil artichokes', description: 'Artichoke hearts with dill, peas and carrots. Spring favorite.' },
        tr: { name: 'Zeytinyağlı Enginar', description: 'Dereotlu, bezelyeli.' },
      },
    ],
    schedules: [{ days: EVERY_DAY, open: '11:00', close: '21:00' }],
  },
  {
    slug: 'yeldegirmeni-anne-mutfagi',
    name: 'Yeldeğirmeni Anne Mutfağı',
    type: 'HOME_COOKING',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 93,
    latitude: 40.9951,
    longitude: 29.0284,
    address: 'Karakolhane Cd., Rasimpaşa Mah., Kadıköy',
    neighborhood: 'Yeldeğirmeni',
    district: 'Kadıköy',
    localTips: ['PAY_AT_COUNTER', 'SHARED_TABLES', 'CLOSES_WHEN_SOLD_OUT', 'NO_RESERVATIONS'],
    upvoteCount: 66,
    en: {
      tagline: 'Hand-folded mantı and dried dolma, cooked by neighborhood mothers',
      description:
        'A tiny shop with four shared tables. Everything is made by hand in the morning — when the mantı runs out, the day is over.',
      customTip: 'Mantı usually sells out by 15:00 on weekends.',
    },
    tr: {
      tagline: 'Elde kapanan mantı ve kuru dolma, mahalle annelerinden',
      description: 'Dört ortak masalı minik bir dükkan. Her şey sabah elde yapılır; mantı bitince gün biter.',
    },
    dishes: [
      {
        localName: 'Mantı',
        en: { name: 'Turkish dumplings', description: 'Tiny beef dumplings under garlic yogurt and chili butter.' },
        tr: { name: 'Mantı', description: 'Sarımsaklı yoğurt ve biber yağıyla.' },
      },
      {
        localName: 'Kuru Dolma',
        en: { name: 'Stuffed dried vegetables', description: 'Sun-dried eggplant and peppers stuffed with rice and meat.' },
        tr: { name: 'Kuru Dolma', description: 'Kurutulmuş patlıcan ve biber dolması.' },
      },
      {
        localName: 'Yayla Çorbası',
        isVegetarian: true,
        en: { name: 'Yogurt & mint soup', description: 'Warm yogurt soup with rice and dried mint.' },
        tr: { name: 'Yayla Çorbası', description: 'Naneli yoğurt çorbası.' },
      },
    ],
    schedules: [{ days: MON_SAT, open: '11:30', close: '20:00' }],
  },

  // ───────────── Burger / Dürüm ─────────────
  {
    slug: 'moda-mahalle-burger',
    name: 'Moda Mahalle Burger',
    type: 'LOCAL_BURGER_WRAP',
    isMobile: false,
    priceLevel: 'MODERATE',
    authenticityScore: 76,
    latitude: 40.9848,
    longitude: 29.0268,
    address: 'Moda Cd., Caferağa Mah., Kadıköy',
    neighborhood: 'Moda',
    district: 'Kadıköy',
    localTips: ['PAY_AT_COUNTER', 'NO_RESERVATIONS'],
    upvoteCount: 58,
    en: {
      tagline: 'Six-stool smash-burger counter plus the Istanbul wet burger',
      description:
        'A counter-only burger bar with a local twist: alongside smash burgers they make ıslak burger, the garlicky, sauce-soaked steamed bun that Taksim made famous.',
    },
    tr: {
      tagline: 'Altı tabureli smash burger tezgahı, bir de ıslak burger',
      description: 'Sadece tezgahı olan burgerci; smash burgerin yanında sarımsaklı soslu ıslak burger de var.',
    },
    dishes: [
      {
        localName: 'Islak Burger',
        en: { name: 'Wet burger', description: 'Small burger in a bun steamed in garlic-tomato sauce. An Istanbul late-night classic.' },
        tr: { name: 'Islak Burger', description: 'Sarımsaklı domates sosunda buharlanmış.' },
      },
      {
        localName: 'Smash Burger',
        en: { name: 'Smash burger', description: 'Double thin patties, cheddar, pickles, house sauce.' },
        tr: { name: 'Smash Burger', description: 'Çift ince köfte, cheddar, turşu.' },
      },
      {
        localName: 'Kızarmış Patates',
        isVegetarian: true,
        en: { name: 'Fries', description: 'Hand-cut, with pul biber salt.' },
        tr: { name: 'Kızarmış Patates', description: 'Elde kesilmiş, pul biberli tuzla.' },
      },
    ],
    // 12:00 – 00:00 (gece yarısında kapanır)
    schedules: [{ days: EVERY_DAY, open: '12:00', close: '00:00' }],
  },
  {
    slug: 'vezneciler-adana-durum',
    name: 'Vezneciler Adana Dürüm',
    type: 'LOCAL_BURGER_WRAP',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 87,
    latitude: 41.0128,
    longitude: 28.9597,
    address: 'Vezneciler Cd., Kalenderhane Mah., Fatih',
    neighborhood: 'Vezneciler',
    district: 'Fatih',
    localTips: ['PAY_AT_COUNTER', 'SHARED_TABLES'],
    upvoteCount: 90,
    en: {
      tagline: 'Student-priced charcoal kebab wraps by Istanbul University',
      description:
        'A narrow grill house feeding students and shopkeepers. Hand-minced Adana kebab and liver wraps straight off the charcoal, rolled in thin lavaş.',
      customTip: "Say 'acılı' for spicy, 'acısız' for mild.",
    },
    tr: {
      tagline: 'İstanbul Üniversitesi yanında öğrenci fiyatına kömür dürüm',
      description: 'Öğrencilerin ve esnafın dar ocakbaşısı. Zırh kıyması Adana ve ciğer, ince lavaşta.',
    },
    dishes: [
      {
        localName: 'Adana Dürüm',
        en: { name: 'Adana kebab wrap', description: 'Spicy hand-minced lamb kebab with sumac onions in lavaş.' },
        tr: { name: 'Adana Dürüm', description: 'Sumaklı soğanla lavaşta.' },
      },
      {
        localName: 'Ciğer Dürüm',
        en: { name: 'Grilled liver wrap', description: 'Small cubes of charcoal-grilled liver with onion and parsley.' },
        tr: { name: 'Ciğer Dürüm', description: 'Kuşbaşı kömür ciğer.' },
      },
      {
        localName: 'Ayran',
        isVegetarian: true,
        en: { name: 'Ayran', description: 'Frothy salty yogurt drink.' },
        tr: { name: 'Ayran', description: 'Köpüklü yayık ayran.' },
      },
    ],
    schedules: [
      { days: MON_SAT, open: '11:00', close: '23:00' },
      { days: [SUN], open: '12:00', close: '22:00' },
    ],
  },
  {
    slug: 'altiyol-yaprak-doner',
    name: 'Altıyol Yaprak Döner',
    type: 'LOCAL_BURGER_WRAP',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 88,
    latitude: 40.9889,
    longitude: 29.0276,
    address: 'Söğütlüçeşme Cd., Osmanağa Mah., Kadıköy',
    neighborhood: 'Altıyol',
    district: 'Kadıköy',
    localTips: ['PAY_AT_COUNTER', 'STANDING_ONLY', 'CLOSES_WHEN_SOLD_OUT'],
    upvoteCount: 64,
    en: {
      tagline: 'Hand-stacked leaf döner, sliced to order until the spit runs out',
      description:
        'A tiny counter where the döner is stacked by hand every morning from thin "yaprak" slices of beef. When the spit is finished, they close.',
      customTip: "Ask for 'az ekmek, bol et' — less bread, more meat.",
    },
    tr: {
      tagline: 'Elde dizilen yaprak döner; şiş bitene kadar',
      description: 'Her sabah ince yaprak etle elde dizilen döner. Şiş bitince kepenk iner.',
    },
    dishes: [
      {
        localName: 'Et Döner Dürüm',
        en: { name: 'Beef döner wrap', description: 'Thin-sliced leaf döner with tomato and onion in lavaş.' },
        tr: { name: 'Et Döner Dürüm', description: 'Domates, soğan, lavaş.' },
      },
      {
        localName: 'Pilav Üstü Döner',
        en: { name: 'Döner over rice', description: 'Döner slices on buttery rice pilaf with roasted pepper.' },
        tr: { name: 'Pilav Üstü Döner', description: 'Tereyağlı pilav üstünde, közlenmiş biberle.' },
      },
      {
        localName: 'Ayran',
        isVegetarian: true,
        en: { name: 'Ayran', description: 'Frothy salty yogurt drink.' },
        tr: { name: 'Ayran', description: 'Köpüklü ayran.' },
      },
    ],
    schedules: [{ days: MON_SAT, open: '11:00', close: '21:00' }],
  },
  // ───────────── Taş fırın ─────────────
  {
    slug: 'yeldegirmeni-tas-firin-pide',
    name: 'Yeldeğirmeni Taş Fırın Pide',
    type: 'HOME_COOKING',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 90,
    latitude: 40.9941,
    longitude: 29.0297,
    address: 'Karakolhane Cd., Rasimpaşa Mah., Kadıköy',
    neighborhood: 'Yeldeğirmeni',
    district: 'Kadıköy',
    localTips: ['NO_RESERVATIONS', 'SHARED_TABLES'],
    upvoteCount: 71,
    en: {
      tagline: 'Wood-fired Black Sea pide and lahmacun from a 1970s stone oven',
      description:
        'Boat-shaped pide baked on the stone floor of a wood-fired oven, brushed with butter as it comes out. Lahmacun is rolled thin and eaten with lemon and parsley.',
      customTip: 'Order lahmacun while you wait for your pide — it takes three minutes.',
    },
    tr: {
      tagline: '70lerden kalma taş fırında odun ateşi pide ve lahmacun',
      description: 'Taş zeminde pişen, çıkarken tereyağı sürülen Karadeniz pidesi; limonlu, maydanozlu ince lahmacun.',
    },
    dishes: [
      {
        localName: 'Kıymalı Pide',
        en: { name: 'Minced-meat pide', description: 'Boat-shaped flatbread with spiced minced beef, finished with butter.' },
        tr: { name: 'Kıymalı Pide', description: 'Baharatlı kıyma, üstüne tereyağı.' },
      },
      {
        localName: 'Kaşarlı Yumurtalı Pide',
        isVegetarian: true,
        en: { name: 'Cheese & egg pide', description: 'Melted kaşar cheese with an egg cracked on top in the oven.' },
        tr: { name: 'Kaşarlı Yumurtalı Pide', description: 'Fırında kırılan yumurtayla.' },
      },
      {
        localName: 'Lahmacun',
        en: { name: 'Lahmacun', description: 'Paper-thin flatbread with spiced meat; roll it up with lemon and parsley.' },
        tr: { name: 'Lahmacun', description: 'İnce hamur, limon ve maydanozla dürülür.' },
      },
    ],
    schedules: [{ days: EVERY_DAY, open: '11:00', close: '22:30' }],
  },
  // ───────────── Tatlı & çay ─────────────
  {
    slug: 'moda-sutlu-tatlici',
    name: 'Moda Sütlü Tatlıcı Nuri',
    type: 'DESSERT_TEA',
    isMobile: false,
    priceLevel: 'BUDGET',
    authenticityScore: 90,
    latitude: 40.9861,
    longitude: 29.0268,
    address: 'Moda Cd., Caferağa Mah., Kadıköy',
    neighborhood: 'Moda',
    district: 'Kadıköy',
    localTips: ['PAY_AT_COUNTER', 'CLOSES_WHEN_SOLD_OUT'],
    upvoteCount: 58,
    en: {
      tagline: 'Late-night milk puddings and tea, a Moda institution',
      description:
        'A tiny muhallebici with marble tables. Baked rice pudding with a burnt top, kazandibi and strong tea in tulip glasses until well past midnight.',
      customTip: 'Ask for the rice pudding "soğuk" (cold) in summer.',
    },
    tr: {
      tagline: "Gece yarısından sonra da açık Moda'nın muhallebicisi",
      description: 'Mermer masalı küçük bir muhallebici. Üstü yanık fırın sütlaç, kazandibi ve ince belli bardakta demli çay.',
    },
    dishes: [
      {
        localName: 'Fırın Sütlaç',
        isVegetarian: true,
        en: { name: 'Baked rice pudding', description: 'Creamy rice pudding with a caramelised, oven-browned top.' },
        tr: { name: 'Fırın Sütlaç', description: 'Üstü fırında kızarmış, kıvamlı sütlaç.' },
      },
      {
        localName: 'Kazandibi',
        isVegetarian: true,
        en: { name: 'Caramelised milk pudding', description: 'Milk pudding with a burnt caramel bottom, dusted with cinnamon.' },
        tr: { name: 'Kazandibi', description: 'Altı yanık, tarçınlı muhallebi.' },
      },
      {
        localName: 'Çay',
        isVegetarian: true,
        en: { name: 'Turkish tea', description: 'Strong black tea in a tulip glass.' },
        tr: { name: 'Çay', description: 'İnce belli bardakta demli çay.' },
      },
    ],
    schedules: [{ days: EVERY_DAY, open: '10:00', close: '01:30' }],
  },
];

// ───────────── Fiyatlar (TL, yaklaşık) ─────────────
// Kurgusal mekanlar için İstanbul 2026 sokak/esnaf fiyatlarına göre tahmini değerler; rehber amaçlıdır.

/** Kişi başı ortalama harcama bandı */
const pricePerPerson: Record<string, [number, number]> = {
  'altiyol-yaprak-doner': [180, 280],
  'yeldegirmeni-tas-firin-pide': [220, 380],
  'rihtim-gece-pilavcisi': [120, 200],
  'kadikoy-seyyar-kofteci': [200, 320],
  'sirkeci-kestane-misir': [70, 180],
  'eminonu-balik-ekmek-arabasi': [250, 400],
  'hocapasa-sulu-yemek-evi': [250, 400],
  'tahtakale-esnaf-lokantasi': [250, 420],
  'kadikoy-carsi-ev-yemekleri': [300, 500],
  'yeldegirmeni-anne-mutfagi': [250, 400],
  'moda-mahalle-burger': [350, 550],
  'vezneciler-adana-durum': [300, 450],
  'moda-sutlu-tatlici': [150, 260],
};

/** Porsiyon fiyatı, yemeğin yerel adına göre */
/** Porsiyon bilgisi (esnaf panelinden güncellenebilir) */
const dishPortion: Record<string, string> = {
  'Nohutlu Pilav': '1 tabak · ~300 g',
  'Tavuklu Nohutlu Pilav': '1 tabak · ~350 g',
};

/**
 * Satıcı canlı konumu örnekleri: harita göstergesinin üç durumu
 * (≤4 sa canlı, 4–12 sa güncellendi, >12 sa son bilinen nokta).
 */
const liveDemo: Record<string, { minutesAgo: number; dLat: number; dLng: number }> = {
  'rihtim-gece-pilavcisi': { minutesAgo: 15, dLat: 0.0005, dLng: -0.0006 },
  'kadikoy-seyyar-kofteci': { minutesAgo: 6 * 60, dLat: -0.0004, dLng: 0.0005 },
  'sirkeci-kestane-misir': { minutesAgo: 20 * 60, dLat: 0.0003, dLng: 0.0004 },
};

/**
 * Ana sayfa yemek kategorileri. Seyyar (STREET_CART) saklanmaz, API türetir;
 * burada yalnızca yemek türleri. Listede olmayan mekan yalnızca "tümü"nde görünür.
 */
const foodCategoriesBySlug: Record<string, FoodCategory[]> = {
  'hocapasa-sulu-yemek-evi': ['STEW'],
  'tahtakale-esnaf-lokantasi': ['STEW', 'SOUP'],
  'kadikoy-carsi-ev-yemekleri': ['STEW', 'OLIVE_OIL_VEGAN'],
  'yeldegirmeni-anne-mutfagi': ['STEW', 'SOUP'],
  'moda-mahalle-burger': ['BURGER_TOAST'],
  'vezneciler-adana-durum': ['DONER_WRAP'],
  'altiyol-yaprak-doner': ['DONER_WRAP'],
  'yeldegirmeni-tas-firin-pide': ['PIDE_PIZZA'],
};

const dishPrice: Record<string, number> = {
  'Et Döner Dürüm': 190,
  'Pilav Üstü Döner': 240,
  'Kıymalı Pide': 260,
  'Kaşarlı Yumurtalı Pide': 230,
  Lahmacun: 110,
  'Nohutlu Pilav': 120,
  'Tavuklu Nohutlu Pilav': 160,
  Turşu: 40,
  'Köfte Ekmek': 220,
  'Közlenmiş Biber': 30,
  Ayran: 40,
  Kokoreç: 250,
  'Közde Kestane': 150,
  'Haşlanmış Mısır': 70,
  'Közde Mısır': 70,
  'Balık Ekmek': 250,
  'Midye Tava': 300,
  'Şalgam Suyu': 50,
  'Turşu Suyu': 40,
  'Kuru Fasulye': 200,
  'Etli Nohut': 220,
  'Fırın Sütlaç': 130,
  'Mercimek Çorbası': 110,
  Karnıyarık: 240,
  'İzmir Köfte': 260,
  'İmam Bayıldı': 200,
  'Hünkar Beğendi': 380,
  'Zeytinyağlı Enginar': 180,
  Mantı: 280,
  'Kuru Dolma': 180,
  'Yayla Çorbası': 110,
  'Islak Burger': 120,
  'Smash Burger': 360,
  'Kızarmış Patates': 110,
  'Adana Dürüm': 320,
  'Ciğer Dürüm': 280,
  Kazandibi: 140,
  Çay: 30,
};

// ───────────── Sponsorlu öne çıkarma (örnek) ─────────────
// Ücretli yerleşim: uygulamada "Seçilmiş Lezzet · Sponsorlu" olarak etiketlenir.
const promotedSlugs = new Set(['kadikoy-carsi-ev-yemekleri', 'moda-sutlu-tatlici']);

// ───────────── Ek yemekler ─────────────
const extraDishes: Record<string, SeedDish[]> = {
  'kadikoy-seyyar-kofteci': [
    {
      localName: 'Kokoreç',
      en: { name: 'Kokoreç (grilled lamb intestines)', description: 'Spit-roasted, chopped on the griddle with tomato, pepper and oregano, served in bread.' },
      tr: { name: 'Kokoreç', description: 'Şişte pişip sacda domates, biber ve kekikle doğranır; yarım ekmek arası.' },
    },
  ],
  'eminonu-balik-ekmek-arabasi': [
    {
      localName: 'Midye Tava',
      en: { name: 'Fried mussels', description: 'Beer-battered mussels on skewers with tarator (walnut-garlic) sauce.' },
      tr: { name: 'Midye Tava', description: 'Şişe dizili, bira hamurlu kızarmış midye; tarator sosla.' },
    },
  ],
};
for (const v of venues) v.dishes.push(...(extraDishes[v.slug] ?? []));

// ───────────── Yemek fotoğrafları ─────────────
// Wikimedia Commons, CC BY / CC BY-SA. Dosyalar backend/media/dishes altında; atıf zorunlu (credits.json).
interface DishPhoto {
  file: string;
  credit: string;
  sourceUrl: string;
}
const dishPhotos: Record<string, DishPhoto> = JSON.parse(
  readFileSync(new URL('../media/dishes/credits.json', import.meta.url), 'utf-8'),
);

// ───────────── Örnek yorumlar ─────────────
// SAMPLE kaynaklıdır: geliştirme/demo için yazılmıştır, gerçek kişilere veya Google'a ait DEĞİLDİR.
// Uygulama bunları "örnek" etiketiyle gösterir.

interface SeedReview {
  author: string;
  rating: number;
  daysAgo: number;
  original: 'en' | 'tr';
  en: string;
  tr: string;
}

const reviewsBySlug: Record<string, SeedReview[]> = {
  'rihtim-gece-pilavcisi': [
    {
      author: 'Tom W.', rating: 5, daysAgo: 6, original: 'en',
      en: 'Came off the last ferry starving and this cart saved me. Buttery rice, chickpeas, a paper plate and a crowd of taxi drivers — absolutely no frills, absolutely delicious. Huge portion for the price.',
      tr: 'Son vapurdan açlıktan ölerek indim, bu araba beni kurtardı. Tereyağlı pilav, nohut, kâğıt tabak ve bir sürü taksici — hiçbir süs yok ama inanılmaz lezzetli. Fiyatına göre kocaman porsiyon.',
    },
    {
      author: 'Burak Ö.', rating: 5, daysAgo: 19, original: 'tr',
      en: 'Proper Kadıköy night pilaf. Ask for extra butter and chicken, eat it standing up. The pickles are a must.',
      tr: 'Tam Kadıköy gece pilavı. Bol tereyağlı tavuklu isteyin, ayakta yiyin. Turşusu şart.',
    },
    {
      author: 'Aiko S.', rating: 4, daysAgo: 42, original: 'en',
      en: 'Simple but so comforting at 2am. It sold out before 3 on a Saturday, so go early.',
      tr: 'Sade ama gece 2\'de o kadar iyi geliyor ki. Cumartesi 3\'ten önce bitti, erken gidin.',
    },
  ],
  'kadikoy-seyyar-kofteci': [
    {
      author: 'Marco R.', rating: 5, daysAgo: 3, original: 'en',
      en: 'Followed the smoke from the bull statue. Charcoal köfte in half a loaf with pickled peppers — messy, smoky, perfect. He speaks no English but pointing works fine.',
      tr: 'Boğa heykelinden dumanı takip ettim. Yarım ekmekte kömür köfte ve turşu biber — dağınık, isli, mükemmel. İngilizce bilmiyor ama göstererek anlaşılıyor.',
    },
    {
      author: 'Zeynep A.', rating: 5, daysAgo: 12, original: 'tr',
      en: 'Better than half the restaurants on Bahariye. Generous with the meat, bread is always fresh.',
      tr: 'Bahariye\'deki restoranların yarısından iyi. Köfteyi bol koyuyor, ekmek hep taze.',
    },
  ],
  'sirkeci-kestane-misir': [
    {
      author: 'Hannah L.', rating: 4, daysAgo: 9, original: 'en',
      en: 'A warm cone of chestnuts on the walk to the ferry is the most Istanbul thing I did all week. Cheap, friendly vendor, no seating obviously.',
      tr: 'Vapura yürürken bir külah sıcak kestane, bütün hafta yaptığım en İstanbul işiydi. Ucuz, satıcı güler yüzlü, oturacak yer yok tabii.',
    },
    {
      author: 'Mehmet Y.', rating: 5, daysAgo: 30, original: 'tr',
      en: 'Been buying from this cart for years. Grilled corn is smoky and the salt is just right.',
      tr: 'Yıllardır bu arabadan alırım. Közde mısır isli, tuzu tam kıvamında.',
    },
  ],
  'eminonu-balik-ekmek-arabasi': [
    {
      author: 'Lukas B.', rating: 5, daysAgo: 5, original: 'en',
      en: 'Skipped the queues at the boats and ate here with the fishermen. Mackerel was hot off the grill, huge sandwich, and the şalgam was a wild but good experience.',
      tr: 'Teknelerdeki kuyruğu atlayıp balıkçılarla burada yedim. Uskumru ızgaradan yeni çıkmıştı, kocaman bir ekmek; şalgam da çılgın ama güzel bir deneyimdi.',
    },
    {
      author: 'Ayşe K.', rating: 4, daysAgo: 22, original: 'tr',
      en: 'Honest fish sandwich, no tourist markup. Squeeze plenty of lemon on it.',
      tr: 'Dürüst balık-ekmek, turist fiyatı yok. Bol limon sıkın.',
    },
  ],
  'hocapasa-sulu-yemek-evi': [
    {
      author: 'Sophie D.', rating: 5, daysAgo: 4, original: 'en',
      en: 'Pointed at three pots and got a feast. The white beans with rice are life-changing and the half portions let you try everything. Shared a table with shopkeepers who helped me order.',
      tr: 'Üç tencereyi gösterdim, ziyafet geldi. Kuru fasulye-pilav hayat değiştirici, yarım porsiyonlarla her şeyi tadabiliyorsunuz. Masayı paylaştığım esnaf sipariş vermeme yardım etti.',
    },
    {
      author: 'Hakan T.', rating: 5, daysAgo: 16, original: 'tr',
      en: 'A real tradesmen\'s canteen. Simple place, spotless kitchen, and the portions fill you up for the whole day.',
      tr: 'Gerçek esnaf lokantası. Mekan sade, mutfak tertemiz, porsiyonlar bütün gün doyuruyor.',
    },
    {
      author: 'James P.', rating: 4, daysAgo: 51, original: 'en',
      en: 'Get there before 1pm — by 2 the best dishes were gone. The rice pudding is worth saving room for.',
      tr: '13:00\'ten önce gidin — saat 2\'de en iyi yemekler bitmişti. Fırın sütlaç için yer ayırmaya değer.',
    },
  ],
  'tahtakale-esnaf-lokantasi': [
    {
      author: 'Emre C.', rating: 5, daysAgo: 8, original: 'tr',
      en: 'Tray in hand, down the counter — fast and filling. The karnıyarık was excellent and the lentil soup comes with a huge chunk of bread.',
      tr: 'Tepsiyi al, tezgah boyunca yürü — hızlı ve doyurucu. Karnıyarık harikaydı, mercimeğin yanında kocaman ekmek geliyor.',
    },
    {
      author: 'Olivia M.', rating: 4, daysAgo: 27, original: 'en',
      en: 'Hectic in the best way. Zero English menu, zero tourists, great home-style food and very fair prices.',
      tr: 'En güzel anlamıyla kaotik. İngilizce menü yok, turist yok; ev usulü harika yemek ve çok makul fiyatlar.',
    },
  ],
  'kadikoy-carsi-ev-yemekleri': [
    {
      author: 'Clara N.', rating: 5, daysAgo: 7, original: 'en',
      en: 'The olive-oil dishes are incredible — the imam bayıldı melted in my mouth. Cozy, a bit cramped, and the owner explained every dish.',
      tr: 'Zeytinyağlılar inanılmaz — imam bayıldı ağzımda eridi. Samimi, biraz sıkışık; sahibi her yemeği tek tek anlattı.',
    },
    {
      author: 'Selin D.', rating: 4, daysAgo: 35, original: 'tr',
      en: 'The hünkar beğendi is a proper portion, the lamb is very tender. A bit pricier than a classic canteen but worth it.',
      tr: 'Hünkar beğendi tam porsiyon, kuzu çok yumuşak. Klasik esnaftan biraz pahalı ama değer.',
    },
  ],
  'yeldegirmeni-anne-mutfagi': [
    {
      author: 'Deniz E.', rating: 5, daysAgo: 2, original: 'tr',
      en: 'Tastes like mum\'s mantı. Four tables, everything handmade. It was sold out by 3pm so I went early the next day.',
      tr: 'Annemin mantısı gibi. Dört masa, her şey elde yapılmış. Saat 3\'te bitmişti, ertesi gün erken gittim.',
    },
    {
      author: 'Noah F.', rating: 5, daysAgo: 24, original: 'en',
      en: 'Tiny, homely and run by a lovely team. The yogurt soup and dried stuffed peppers were new to me and delicious.',
      tr: 'Minicik, sıcacık ve çok tatlı bir ekip işletiyor. Yayla çorbası ve kuru dolma benim için yeniydi, çok lezzetliydi.',
    },
  ],
  'moda-mahalle-burger': [
    {
      author: 'Kerem Ş.', rating: 4, daysAgo: 10, original: 'tr',
      en: 'The wet burger is surprisingly good; two is a meal. Only six stools, so expect to wait a bit.',
      tr: 'Islak burger şaşırtıcı derecede iyi, iki tane bir öğün ediyor. Altı tabure var, biraz beklemeyi göze alın.',
    },
    {
      author: 'Emily H.', rating: 4, daysAgo: 33, original: 'en',
      en: 'Great smash burger and a fun local twist with the wet burger. Pricier than street food but still cheap for Moda.',
      tr: 'Harika smash burger, ıslak burgerle de eğlenceli yerel bir dokunuş. Sokak yemeğinden pahalı ama Moda için hâlâ ucuz.',
    },
  ],
  'vezneciler-adana-durum': [
    {
      author: 'Ali R.', rating: 5, daysAgo: 1, original: 'tr',
      en: 'The best liver wrap near the university. Student prices, big portions, served straight off the grill.',
      tr: 'Üniversite civarının en iyi ciğer dürümü. Öğrenci fiyatı, bol porsiyon, ocaktan direkt.',
    },
    {
      author: 'Isabel G.', rating: 5, daysAgo: 18, original: 'en',
      en: 'No-frills grill house full of students. The Adana wrap was juicy and properly spicy, and the ayran is frothy and fresh.',
      tr: 'Öğrencilerle dolu, süssüz bir ocakbaşı. Adana dürüm sulu ve gerçekten acılıydı, ayran köpüklü ve taze.',
    },
  ],
};

// ───────────── Örnek topluluk gönderileri ─────────────
// Kurgusal üyeler; şifreleri yoktur, uygulamadan giriş yapılamaz. Idempotent: bu deviceId'li
// üyeler silinince gönderi/yorum/beğenileri de cascade ile silinir.

interface SeedMember {
  deviceId: string;
  fullName: string;
  role: 'USER' | 'LOCAL_GUIDE';
  locale: 'en' | 'tr';
}

const members: SeedMember[] = [
  { deviceId: 'seed-member-selin', fullName: 'Selin Aydın', role: 'LOCAL_GUIDE', locale: 'tr' },
  { deviceId: 'seed-member-mark', fullName: 'Mark Jensen', role: 'USER', locale: 'en' },
  { deviceId: 'seed-member-emre', fullName: 'Emre Kaplan', role: 'USER', locale: 'tr' },
];

interface SeedPost {
  author: string; // deviceId
  venueSlug?: string;
  hoursAgo: number;
  title: string;
  content: string;
  likedBy: string[];
  comments: { author: string; minutesAfter: number; content: string }[];
}

const posts: SeedPost[] = [
  {
    author: 'seed-member-mark',
    hoursAgo: 20,
    title: 'Where can I find good kokoreç after midnight in Kadıköy?',
    content:
      "First time in Istanbul and I keep hearing about kokoreç. Is there a cart near the ferry pier that stays open late? Any tips on how to order it — half or full?",
    likedBy: ['seed-member-emre'],
    comments: [
      {
        author: 'seed-member-selin',
        minutesAfter: 35,
        content:
          'Try the carts on Rıhtım side after 23:00. Ask for "yarım ekmek, bol baharatlı" — half bread with extra spice. Pay cash, they rarely take cards.',
      },
      {
        author: 'seed-member-emre',
        minutesAfter: 90,
        content: 'Also the rice cart right there is great if you want something milder. Cheap and filling.',
      },
    ],
  },
  {
    author: 'seed-member-selin',
    venueSlug: 'rihtim-gece-pilavcisi',
    hoursAgo: 6,
    title: 'Gece pilavcısında nohutlu pilav hâlâ efsane',
    content:
      'Dün gece son vapurdan inip uğradım. Porsiyon büyüdü bile, tereyağı kokusu iskeleden geliyor. Tavuklu yerine nohutlu deneyin, gerçek yerel tercih o.',
    likedBy: ['seed-member-mark', 'seed-member-emre'],
    comments: [
      {
        author: 'seed-member-mark',
        minutesAfter: 50,
        content: 'Went there after reading this — can confirm, the chickpea rice was perfect. Thanks!',
      },
    ],
  },
];

async function seedCommunity(now: number) {
  const deviceIds = members.map((m) => m.deviceId);
  const { count } = await prisma.user.deleteMany({ where: { deviceId: { in: deviceIds } } });
  if (count) console.log(`Removed ${count} previously seeded members`);

  const idByDevice = new Map<string, string>();
  for (const m of members) {
    const user = await prisma.user.create({ data: m });
    idByDevice.set(m.deviceId, user.id);
  }
  const uid = (deviceId: string) => idByDevice.get(deviceId)!;

  for (const p of posts) {
    const createdAt = new Date(now - p.hoursAgo * 3_600_000);
    const venue = p.venueSlug ? await prisma.venue.findUnique({ where: { slug: p.venueSlug }, select: { id: true } }) : null;
    await prisma.post.create({
      data: {
        userId: uid(p.author),
        venueId: venue?.id,
        title: p.title,
        content: p.content,
        createdAt,
        likeCount: p.likedBy.length,
        commentCount: p.comments.length,
        likes: { create: p.likedBy.map((d) => ({ userId: uid(d) })) },
        comments: {
          create: p.comments.map((c) => ({
            userId: uid(c.author),
            content: c.content,
            createdAt: new Date(createdAt.getTime() + c.minutesAfter * 60_000),
          })),
        },
      },
    });
  }
  console.log(`Seeded ${posts.length} community posts.`);
}

// ─────────────────────────────────────────────
// Yönetim test hesapları + esnaf paneli örnek verisi
// ─────────────────────────────────────────────

interface StaffAccount {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
  /** VENDOR'ın yönettiği mekan */
  owns?: string;
}

/** Yerel geliştirme şifreleri; üretimde ortam değişkeniyle verilmezse hesaplar oluşturulmaz */
const staff: StaffAccount[] = [
  {
    email: 'admin@localbite.app',
    fullName: 'LocalBite Yönetici',
    role: 'SUPER_ADMIN',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'LocalBite-Admin-2026',
  },
  {
    email: 'pilavci@localbite.app',
    fullName: 'Hüseyin Usta',
    role: 'VENDOR',
    password: process.env.SEED_VENDOR_PASSWORD ?? 'LocalBite-Pilav-2026',
    owns: 'rihtim-gece-pilavcisi',
  },
];

/** Yönetim merkezindeki "Esnaf & Mekan Onayları" için bekleyen başvuru */
const PENDING_APPLICATION_SLUG = 'moda-sahil-lokmacisi';

async function seedStaff(now: number) {
  if (process.env.NODE_ENV === 'production' && !(process.env.SEED_ADMIN_PASSWORD && process.env.SEED_VENDOR_PASSWORD)) {
    console.log('Skipped staff accounts (set SEED_ADMIN_PASSWORD and SEED_VENDOR_PASSWORD in production).');
    return;
  }
  for (const a of staff) {
    const passwordHash = await hashPassword(a.password);
    const user = await prisma.user.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        fullName: a.fullName,
        role: a.role,
        passwordHash,
        authProvider: 'email',
        locale: 'tr',
        termsAcceptedAt: new Date(now),
      },
      update: { role: a.role, passwordHash },
    });
    if (a.owns) {
      const venue = await prisma.venue.update({ where: { slug: a.owns }, data: { ownerId: user.id }, select: { id: true } });
      await prisma.vendorAnnouncement.createMany({
        data: [
          {
            venueId: venue.id,
            type: 'ANNOUNCEMENT',
            title: 'Bu gece tencere 22:00’de açılıyor',
            content: 'Son vapurdan inenlere sıcak tereyağlı nohutlu pilav. Tencere bitene kadar buradayız.',
            status: 'APPROVED',
            createdAt: new Date(now - 3 * 3_600_000),
            reviewedAt: new Date(now - 2 * 3_600_000),
          },
          {
            venueId: venue.id,
            type: 'PROMOTION',
            title: 'Öğrencilere ayran bizden',
            content: 'Öğrenci kartını gösterene pilavın yanında ayran ikram. Bu hafta sonu geçerli.',
            status: 'PENDING',
            createdAt: new Date(now - 20 * 60_000),
          },
        ],
      });
    }
    console.log(`  ✓ ${a.role} ${a.email}`);
  }
}

async function seedPendingApplication() {
  await prisma.venue.create({
    data: {
      slug: PENDING_APPLICATION_SLUG,
      name: 'Moda Sahil Lokmacısı',
      type: 'DESSERT_TEA',
      locationType: 'DYNAMIC_STREET',
      priceLevel: 'BUDGET',
      latitude: 40.9819,
      longitude: 29.0254,
      locationNote: 'Moda sahili, çay bahçesinin yanındaki merdivenler',
      neighborhood: 'Moda',
      district: 'Kadıköy',
      localTips: ['CASH_ONLY', 'STANDING_ONLY'],
      status: 'PENDING_APPROVAL',
      translations: {
        create: [
          { locale: 'tr', tagline: 'Akşamüstü sahilde sıcak, şerbetli lokma' },
          { locale: 'en', tagline: 'Warm syrupy lokma doughnuts on the seafront at dusk' },
        ],
      },
      dishes: {
        create: [
          {
            localName: 'Lokma',
            sortOrder: 1,
            priceTry: 60,
            portion: '10 adet',
            isVegetarian: true,
            translations: { create: [{ locale: 'en', name: 'Lokma (fried dough in syrup)' }] },
          },
        ],
      },
    },
  });
  console.log('Seeded 1 pending venue application.');
}

async function main() {
  const slugs = [...venues.map((v) => v.slug), PENDING_APPLICATION_SLUG];
  const { count } = await prisma.venue.deleteMany({ where: { slug: { in: slugs } } });
  if (count) console.log(`Removed ${count} previously seeded venues`);

  const now = Date.now();

  for (const v of venues) {
    await prisma.venue.create({
      data: {
        slug: v.slug,
        name: v.name,
        type: v.type,
        locationType: v.isMobile ? 'DYNAMIC_STREET' : 'STATIC',
        priceLevel: v.priceLevel,
        authenticityScore: v.authenticityScore,
        latitude: v.latitude,
        longitude: v.longitude,
        address: v.address,
        locationNote: v.locationNote,
        neighborhood: v.neighborhood,
        district: v.district,
        localTips: v.localTips,
        foodCategories: foodCategoriesBySlug[v.slug] ?? [],
        status: 'ACTIVE',
        ...(liveDemo[v.slug] && {
          isLiveLocation: true,
          liveLatitude: v.latitude + liveDemo[v.slug]!.dLat,
          liveLongitude: v.longitude + liveDemo[v.slug]!.dLng,
          lastLocationUpdate: new Date(now - liveDemo[v.slug]!.minutesAgo * 60_000),
        }),
        lastSpottedAt: v.spottedMinutesAgo !== undefined ? new Date(now - v.spottedMinutesAgo * 60_000) : null,
        spottedCount: v.spottedCount ?? 0,
        upvoteCount: v.upvoteCount ?? 0,
        isPromoted: promotedSlugs.has(v.slug),
        avgPriceMinTry: pricePerPerson[v.slug]?.[0],
        avgPriceMaxTry: pricePerPerson[v.slug]?.[1],
        translations: {
          create: [
            { locale: 'en', ...v.en },
            { locale: 'tr', ...v.tr },
          ],
        },
        dishes: {
          create: v.dishes.map((d, i) => ({
            localName: d.localName,
            isMustTry: true,
            sortOrder: i + 1,
            isVegetarian: d.isVegetarian ?? false,
            priceTry: dishPrice[d.localName],
            portion: dishPortion[d.localName],
            imageUrl: dishPhotos[d.localName] ? `/media/dishes/${dishPhotos[d.localName]!.file}` : undefined,
            imageCredit: dishPhotos[d.localName]?.credit,
            imageSourceUrl: dishPhotos[d.localName]?.sourceUrl,
            translations: {
              create: [
                { locale: 'en', ...d.en },
                { locale: 'tr', ...d.tr },
              ],
            },
          })),
        },
        reviews: {
          // Örnek (SAMPLE) yorumlar yalnızca geliştirmede: mağaza sürümünde uydurma yorum olmasın
          create: (process.env.NODE_ENV === 'production' ? [] : (reviewsBySlug[v.slug] ?? [])).map((r) => ({
            authorName: r.author,
            rating: r.rating,
            source: 'SAMPLE' as const,
            originalLocale: r.original,
            publishedAt: new Date(now - r.daysAgo * 86_400_000),
            translations: {
              create: [
                { locale: 'en' as const, text: r.en },
                { locale: 'tr' as const, text: r.tr },
              ],
            },
          })),
        },
        schedules: {
          create: v.schedules.flatMap((s) =>
            s.days.map((dayOfWeek) => ({
              dayOfWeek,
              openMinute: toMinutes(s.open),
              closeMinute: toMinutes(s.close),
              latitude: s.latitude,
              longitude: s.longitude,
              locationNote: s.locationNote,
            })),
          ),
        },
      },
    });
    console.log(`  ✓ ${v.name}`);
  }

  const mobile = venues.filter((v) => v.isMobile).length;
  console.log(`Seeded ${venues.length} venues (${mobile} mobile vendors).`);

  // Örnek topluluk üyeleri ve gönderileri yalnızca geliştirmede (mağaza sürümünde uydurma içerik olmasın)
  if (process.env.NODE_ENV !== 'production') await seedCommunity(now);
  await seedPendingApplication();
  await seedStaff(now);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
