import { HttpError } from './errors';

/**
 * Basit küfür/hakaret filtresi (App Store 1.2: "uygunsuz içeriği filtreleme yöntemi").
 * Yayından önce açıkça yasak sözcükleri reddeder; ince ayrımlar için şikayet + yönetici moderasyonu esastır.
 * Liste bilinçli olarak kısa ve yüksek güvenlidir: yanlış pozitif (ör. "götür", "Scunthorpe") üretmemek için
 * yalnızca tam sözcük eşleşmesine bakılır.
 */
const BLOCKED_TERMS = [
  // tr
  'amk',
  'aq',
  'orospu',
  'orospuçocuğu',
  'siktir',
  'sikerim',
  'sikeyim',
  'yarrak',
  'yavşak',
  'piç',
  'pezevenk',
  'ibne',
  'gavat',
  // en
  'fuck',
  'fucking',
  'motherfucker',
  'cunt',
  'bitch',
  'faggot',
  'nigger',
  'retard',
];

const normalize = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    // Sık kullanılan rakam/simge gizlemesi: s1kt1r, $ikerim (yıldızlı maskeleme şikayet akışına kalır)
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/[@4]/g, 'a')
    .replace(/\$/g, 's');

const LETTER = 'a-zçğıöşüâîû';
const pattern = new RegExp(`(^|[^${LETTER}])(${BLOCKED_TERMS.join('|')})(?=$|[^${LETTER}])`, 'u');

export function containsBlockedTerms(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => t !== undefined && pattern.test(normalize(t)));
}

export function assertAcceptableContent(...texts: (string | undefined)[]) {
  if (containsBlockedTerms(...texts)) {
    throw new HttpError(
      422,
      'CONTENT_REJECTED',
      'This text contains language that breaks the Community Guidelines. Please rephrase it.',
    );
  }
}
