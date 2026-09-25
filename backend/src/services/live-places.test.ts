import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classify, isExcludedPlace } from './live-places.service';

describe('isExcludedPlace', () => {
  it('bar, pub, gece kulübü ve meyhaneleri eler', () => {
    assert.equal(isExcludedPlace('Dilo Bar', ['restaurant']), true);
    assert.equal(isExcludedPlace('Moda Meyhanesi', ['restaurant']), true);
    assert.equal(isExcludedPlace('Kadıköy Pub', []), true);
    assert.equal(isExcludedPlace('Nargile Lounge', []), true);
    assert.equal(isExcludedPlace('Herhangi Bir Yer', ['night_club']), true);
  });

  it('yemek belirten "bar" adlarını ve normal esnafı tutar', () => {
    assert.equal(isExcludedPlace('Döner Bar', ['fast_food']), false);
    assert.equal(isExcludedPlace('Çorba Barı', ['restaurant']), false);
    assert.equal(isExcludedPlace('Baydöner', ['fast_food']), false);
    assert.equal(isExcludedPlace('Barbaros Pide', ['restaurant']), false);
  });
});

describe('classify', () => {
  it('etiketi gerçek OSM etiketinden belirler', () => {
    assert.equal(classify(['kebab', 'Baydöner'], 'fast_food').liveCategory, 'KEBAB_WRAP');
    assert.equal(classify(['turkish', 'Hacıoğlu'], 'restaurant').liveCategory, 'KEBAB_WRAP');
    assert.equal(classify(['pizza', 'X'], 'restaurant').liveCategory, 'PIDE_BOREK');
    assert.equal(classify(['', 'Bambi'], 'fast_food').liveCategory, 'STREET_FOOD');
    assert.equal(classify(['', 'Fırın'], 'bakery').liveCategory, 'BAKERY_DESSERT');
  });

  it('bilinmeyen restorana "Esnaf lokantası" (STEW) demez', () => {
    const r = classify(['', 'Dilo'], 'restaurant');
    assert.equal(r.liveCategory, 'LOCAL_RESTAURANT');
    assert.ok(!r.categories.includes('STEW'));
    assert.ok(!classify(['turkish', 'Bir Yer'], 'restaurant').categories.includes('STEW'));
  });
});
