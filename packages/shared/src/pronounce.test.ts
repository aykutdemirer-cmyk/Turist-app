import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pronunciationGuide, syllabify } from './pronounce';

describe('syllabify', () => {
  it('splits by Turkish syllable rules', () => {
    assert.deepEqual(syllabify('karnıyarık'), ['kar', 'nı', 'ya', 'rık']);
    assert.deepEqual(syllabify('türkçe'), ['türk', 'çe']);
    assert.deepEqual(syllabify('şalgam'), ['şal', 'gam']);
    assert.deepEqual(syllabify('kokoreç'), ['ko', 'ko', 'reç']);
    assert.deepEqual(syllabify('çay'), ['çay']);
  });
});

describe('pronunciationGuide', () => {
  it('handles ğ between front vowels as y', () => {
    assert.equal(pronunciationGuide('Hünkar Beğendi'), 'hewn-kahr beh-yehn-dee');
  });

  it('drops ğ after back vowels', () => {
    assert.equal(pronunciationGuide('Dağ'), 'dah');
    assert.equal(pronunciationGuide('Yağlı'), 'yah-luh');
  });

  it('maps Turkish letters to English sounds', () => {
    assert.equal(pronunciationGuide('Köfte Ekmek'), 'kurf-teh ehk-mehk');
    assert.equal(pronunciationGuide('Mantı'), 'mahn-tuh');
    assert.equal(pronunciationGuide('Kokoreç'), 'koh-koh-rehch');
    assert.equal(pronunciationGuide('Şalgam Suyu'), 'shahl-gahm soo-yoo');
    assert.equal(pronunciationGuide('Midye Tava'), 'meed-yeh tah-vah');
    assert.equal(pronunciationGuide('Çorba'), 'chohr-bah');
    assert.equal(pronunciationGuide('Ciğer'), 'jee-yehr');
  });

  it('handles capital İ and punctuation', () => {
    assert.equal(pronunciationGuide('İmam Bayıldı'), 'ee-mahm bah-yuhl-duh');
    assert.equal(pronunciationGuide('Adana-Dürüm!'), 'ah-dah-nah dew-rewm');
  });
});
