import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { env } from '../env';
import { bearing, googleDetails, googleNearby, periodsToOsm, pickPhotos, resetGoogleQuota } from './google-places.service';

const realFetch = globalThis.fetch;
const realKey = env.GOOGLE_PLACES_API_KEY;
const realLimits = { n: env.GOOGLE_NEARBY_DAILY_LIMIT, d: env.GOOGLE_DETAIL_DAILY_LIMIT };

beforeEach(() => {
  env.GOOGLE_PLACES_API_KEY = 'test-key';
  resetGoogleQuota();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  env.GOOGLE_PLACES_API_KEY = realKey;
  env.GOOGLE_NEARBY_DAILY_LIMIT = realLimits.n;
  env.GOOGLE_DETAIL_DAILY_LIMIT = realLimits.d;
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('googleNearby', () => {
  it('saat ve puanı ister ama telefon/yorum/fiyat istemez, kalıcı kapananları eler', async () => {
    const masks: string[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      masks.push(String((init.headers as Record<string, string>)['X-Goog-FieldMask']));
      return json({
        places: [
          { id: 'a', displayName: { text: 'Kardeşler Döner' }, location: { latitude: 41, longitude: 29 }, types: ['restaurant'] },
          { id: 'b', displayName: { text: 'Kapanmış' }, location: { latitude: 41, longitude: 29 }, businessStatus: 'CLOSED_PERMANENTLY' },
        ],
      });
    }) as typeof fetch;
    const places = await googleNearby({ latitude: 41, longitude: 29 }, 3000, 'tr');
    assert.deepEqual(places?.map((p) => p.id), ['a']);
    assert.ok(masks.length > 0);
    for (const mask of masks) {
      for (const expensive of ['currentOpeningHours', 'PhoneNumber', 'reviews', 'priceLevel']) {
        assert.ok(!mask.includes(expensive), `listede pahalı alan istenmemeli: ${expensive}`);
      }
    }
  });

  it('günlük sınır dolunca ağa çıkmadan null (OSM\'e düşülür)', async () => {
    env.GOOGLE_NEARBY_DAILY_LIMIT = 0;
    globalThis.fetch = () => assert.fail('fetch çağrılmamalı');
    assert.equal(await googleNearby({ latitude: 41, longitude: 29 }, 3000, 'tr'), null);
  });
});

describe('periodsToOsm', () => {
  it('haftalık dönemleri OSM sözdizimine çevirir (gece yarısını geçen dahil)', () => {
    assert.equal(
      periodsToOsm([
        { open: { day: 1, hour: 10, minute: 0 }, close: { day: 2, hour: 2, minute: 0 } },
        { open: { day: 2, hour: 9, minute: 30 }, close: { day: 2, hour: 0, minute: 0 } },
      ]),
      'Mo 10:00-02:00, Tu 09:30-24:00',
    );
  });

  it('kapanışsız tek dönem 7/24, dönem yoksa null', () => {
    assert.equal(periodsToOsm([{ open: { day: 0, hour: 0, minute: 0 } }]), '24/7');
    assert.equal(periodsToOsm(undefined), null);
  });
});

describe('pickPhotos', () => {
  const ph = (id: string, author: string) => ({ name: `places/p/photos/${id}`, authorAttributions: [{ displayName: author }] });

  it('işletmenin kendi yüklediği fotoğrafı kullanıcı fotoğrafına tercih eder', () => {
    const { owner, first } = pickPhotos([ph('a', 'OSMAN KARİSAN'), ph('b', 'Adıyamanlı Çiğköfteci Aziz Usta')], 'Adıyamanlı Çiğköfteci Aziz Usta');
    assert.equal(owner?.name, 'places/p/photos/b');
    assert.equal(first?.name, 'places/p/photos/a');
  });

  it('işletme fotoğrafı yoksa owner null', () => {
    assert.equal(pickPhotos([ph('a', 'Ali Veli')], 'Kosovalı Döner').owner, null);
  });
});

describe('bearing', () => {
  it('panoramadan mekana pusula yönü (kuzey 0, doğu 90)', () => {
    assert.ok(Math.abs(bearing({ latitude: 41, longitude: 29 }, { latitude: 41.001, longitude: 29 })) < 1);
    assert.ok(Math.abs(bearing({ latitude: 41, longitude: 29 }, { latitude: 41, longitude: 29.001 }) - 90) < 1);
  });
});

describe('googleDetails', () => {
  it('saat, telefon, puan, yorum ve vekil fotoğraf adresi', async () => {
    globalThis.fetch = (async () =>
      json({
        id: 'p1',
        displayName: { text: 'Kardeşler Döner' },
        location: { latitude: 41, longitude: 29 },
        nationalPhoneNumber: '0216 555 12 34',
        rating: 4.4,
        userRatingCount: 300,
        currentOpeningHours: { openNow: true, nextCloseTime: '2026-09-28T20:00:00Z' },
        regularOpeningHours: { weekdayDescriptions: ['Pazartesi: 10:00–23:00'] },
        photos: [{ name: 'places/p1/photos/x_1', authorAttributions: [{ displayName: 'Ali' }] }],
        reviews: [{ rating: 5, text: { text: 'Çok iyi' }, authorAttribution: { displayName: 'Ayşe' } }],
      })) as typeof fetch;
    const d = await googleDetails('p1', 'tr');
    assert.ok(d);
    assert.equal(d.phone, '0216 555 12 34');
    assert.equal(d.dto.closesAt, '23:00');
    assert.equal(d.dto.rating, 4.4);
    assert.equal(d.dto.photos[0]?.url, '/api/v1/places/photo?name=places%2Fp1%2Fphotos%2Fx_1');
    assert.equal(d.dto.reviews[0]?.authorName, 'Ayşe');
  });

  it('günlük sınır dolunca null; anahtar yoksa ağa çıkmaz', async () => {
    env.GOOGLE_DETAIL_DAILY_LIMIT = 0;
    globalThis.fetch = () => assert.fail('fetch çağrılmamalı');
    assert.equal(await googleDetails('p2', 'tr'), null);
    env.GOOGLE_PLACES_API_KEY = '';
    env.GOOGLE_DETAIL_DAILY_LIMIT = 30;
    assert.equal(await googleDetails('p3', 'tr'), null);
  });
});
