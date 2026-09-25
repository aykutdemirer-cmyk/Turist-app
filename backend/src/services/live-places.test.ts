import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { env } from '../env';
import { enrichWithGoogle, namesMatch } from './google-places.service';
import { classify, findLivePlaces, isExcludedPlace } from './live-places.service';

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

describe('enrichWithGoogle', () => {
  const realFetch = globalThis.fetch;
  const realKey = env.GOOGLE_PLACES_API_KEY;
  afterEach(() => {
    globalThis.fetch = realFetch;
    env.GOOGLE_PLACES_API_KEY = realKey;
  });

  const target = { id: 'osm:n1', name: 'Baydöner', latitude: 40.99, longitude: 29.024 };

  it('anahtar yoksa ağa çıkmadan null döner', async () => {
    env.GOOGLE_PLACES_API_KEY = '';
    globalThis.fetch = () => assert.fail('fetch çağrılmamalı');
    assert.equal(await enrichWithGoogle({ ...target, id: 'osm:n0' }, 'tr'), null);
  });

  it('yakındaki ve adı tutan yeri eşleştirip saat/foto/yorum döndürür', async () => {
    env.GOOGLE_PLACES_API_KEY = 'test-key';
    let body: { textQuery?: string } = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          places: [
            // Uzakta aynı adlı şube: elenmeli
            { id: 'far', displayName: { text: 'Baydöner' }, location: { latitude: 41.05, longitude: 29.0 } },
            {
              id: 'near',
              displayName: { text: 'Bay Döner Kadıköy' },
              location: { latitude: 40.9901, longitude: 29.0241 },
              rating: 4.3,
              userRatingCount: 812,
              currentOpeningHours: { openNow: true, nextCloseTime: '2026-09-25T19:00:00Z' },
              regularOpeningHours: { weekdayDescriptions: ['Pazartesi: 10:00–22:00'] },
              photos: [{ name: 'places/near/photos/abc_1', authorAttributions: [{ displayName: 'Ali' }] }],
              reviews: [{ rating: 5, text: { text: 'Harika' }, relativePublishTimeDescription: '2 hafta önce', authorAttribution: { displayName: 'Ayşe' } }],
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const g = await enrichWithGoogle({ ...target, id: 'osm:n2' }, 'tr');
    assert.equal(body.textQuery, 'Baydöner');
    assert.ok(g);
    assert.equal(g.placeId, 'near');
    assert.equal(g.openNow, true);
    assert.equal(g.closesAt, '22:00'); // 19:00 UTC → İstanbul
    assert.equal(g.rating, 4.3);
    assert.equal(g.photos[0]?.url, '/api/v1/places/photo?name=places%2Fnear%2Fphotos%2Fabc_1');
    assert.equal(g.reviews[0]?.authorName, 'Ayşe');
  });

  it('hata ya da eşleşme yoksa null (istek patlamaz)', async () => {
    env.GOOGLE_PLACES_API_KEY = 'test-key';
    globalThis.fetch = (async () => new Response('quota', { status: 429 })) as typeof fetch;
    assert.equal(await enrichWithGoogle({ ...target, id: 'osm:n3' }, 'tr'), null);
    globalThis.fetch = (async () => new Response(JSON.stringify({ places: [] }), { status: 200 })) as typeof fetch;
    assert.equal(await enrichWithGoogle({ ...target, id: 'osm:n4' }, 'tr'), null);
  });

  it('namesMatch boşluk ve Türkçe karakterden bağımsızdır', () => {
    assert.ok(namesMatch('Baydöner', 'Bay Döner Kadıköy'));
    assert.ok(!namesMatch('Baydöner', 'Starbucks'));
  });
});

describe('findLivePlaces (Google)', () => {
  const realFetch = globalThis.fetch;
  const realKey = env.GOOGLE_PLACES_API_KEY;
  afterEach(() => {
    globalThis.fetch = realFetch;
    env.GOOGLE_PLACES_API_KEY = realKey;
  });

  it('türleri gruplar halinde sorar; barı ve pahalıyı eler, fiyatı bilinmeyeni foto/puanla tutar', async () => {
    env.GOOGLE_PLACES_API_KEY = 'test-key';
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          places: [
            {
              id: 'p1',
              displayName: { text: 'Kardeşler Döner' },
              location: { latitude: 41.0101, longitude: 28.9701 },
              types: ['restaurant'],
              rating: 4.6,
              userRatingCount: 120,
              photos: [{ name: 'places/p1/photos/x1', authorAttributions: [{ displayName: 'Mehmet' }] }],
            },
            { id: 'p2', displayName: { text: 'Gece Bar' }, location: { latitude: 41.0102, longitude: 28.9702 }, types: ['bar'] },
            {
              id: 'p3',
              displayName: { text: 'Lüks Restoran' },
              location: { latitude: 41.0103, longitude: 28.9703 },
              priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE',
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const log = { warn: () => {} };
    const { places } = await findLivePlaces({ latitude: 41.0105, longitude: 28.9705 }, 'tr', log);
    assert.equal(calls, 4); // tür grupları
    assert.deepEqual(
      places.map((p) => p.id),
      ['google:p1'],
    );
    const [p] = places;
    assert.equal(p?.priceLevel, null);
    assert.equal(p?.rating, 4.6);
    assert.equal(p?.liveCategory, 'KEBAB_WRAP');
    assert.equal(p?.photo?.url, '/api/v1/places/photo?name=places%2Fp1%2Fphotos%2Fx1');
  });
});
