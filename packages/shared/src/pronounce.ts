/**
 * Türkçe yemek adları için İngilizce konuşanlara yönelik okunuş rehberi.
 * "Hünkar Beğendi" → "hewn-kahr beh-yehn-dee"
 *
 * Türkçe yazıldığı gibi okunur; hece yapısı düzenlidir: her hecede tek ünlü vardır ve iki ünlü
 * arasındaki son ünsüz bir sonraki heceye geçer (ka-ra, kar-puz, Türk-çe).
 */

const VOWELS = new Set(['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü']);
const FRONT = new Set(['e', 'i', 'ö', 'ü']);

/** Hece sonu/ortası için ünlü karşılıkları (İngilizce okuma alışkanlığına göre) */
const VOWEL_SOUND: Record<string, string> = {
  a: 'ah',
  e: 'eh',
  ı: 'uh',
  i: 'ee',
  o: 'oh',
  ö: 'ur',
  u: 'oo',
  ü: 'ew',
};

const CONSONANT_SOUND: Record<string, string> = {
  c: 'j',
  ç: 'ch',
  ş: 'sh',
  j: 'zh',
  // ğ bağlama göre ayrıca işlenir
};

const isVowel = (ch: string) => VOWELS.has(ch);

/** Türkçe heceleme: ünlüler arasındaki ünsüz dizisinin yalnızca sonuncusu sonraki heceye geçer */
export function syllabify(word: string): string[] {
  const letters = [...word];
  const vowelIdx = letters.flatMap((ch, i) => (isVowel(ch) ? [i] : []));
  if (vowelIdx.length <= 1) return [word];

  const syllables: string[] = [];
  let start = 0;
  for (let v = 0; v < vowelIdx.length - 1; v++) {
    const next = vowelIdx[v + 1]!;
    const gap = next - vowelIdx[v]! - 1; // iki ünlü arasındaki ünsüz sayısı
    const cut = gap === 0 ? next : next - 1;
    syllables.push(letters.slice(start, cut).join(''));
    start = cut;
  }
  syllables.push(letters.slice(start).join(''));
  return syllables;
}

function respellSyllable(syl: string, prevVowel: string | undefined, nextVowel: string | undefined): string {
  let out = '';
  const chars = [...syl];
  chars.forEach((ch, i) => {
    if (ch === 'ğ') {
      // İnce ünlüler arasında "y" gibi duyulur (beğendi → beh-yehn-dee), aksi hâlde önceki ünlüyü uzatır ve okunmaz
      const before = i > 0 ? chars[i - 1] : prevVowel;
      const after = i < chars.length - 1 ? chars[i + 1] : nextVowel;
      if (before && after && FRONT.has(before) && FRONT.has(after)) out += 'y';
      return;
    }
    out += VOWEL_SOUND[ch] ?? CONSONANT_SOUND[ch] ?? ch;
  });
  return out;
}

/** Tek kelime: heceler tire ile */
function respellWord(word: string): string {
  const syllables = syllabify(word);
  const vowelOf = (s: string | undefined) => (s ? [...s].find(isVowel) : undefined);
  return syllables
    .map((syl, i) => {
      // ğ ile başlayan hece: kendi ünlüsünden önceki ünlü, önceki hecenin ünlüsüdür
      const prev = vowelOf(syllables[i - 1]);
      const next = vowelOf(syllables[i + 1]);
      return respellSyllable(syl, prev, next);
    })
    .filter(Boolean)
    .join('-');
}

export function pronunciationGuide(name: string): string {
  return name
    .toLocaleLowerCase('tr')
    .split(/[\s/-]+/)
    .map((w) => w.replace(/[^a-zçğıöşüâîû]/g, '').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u'))
    .filter(Boolean)
    .map(respellWord)
    .join(' ');
}
