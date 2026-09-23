import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSuggestPayload, initialSuggestForm } from './payload';

const here = { latitude: 40.9905, longitude: 29.0241 };

describe('buildSuggestPayload', () => {
  it('builds a valid street-cart payload with defaults', () => {
    const result = buildSuggestPayload(
      { ...initialSuggestForm(here), name: '  Gece Pilavcısı Mehmet Usta ', dish: 'Tavuklu Pilav', tips: ['CASH_ONLY'], hoursNote: "Sadece 20:00'den sonra" },
      'tr',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.payload, {
      name: 'Gece Pilavcısı Mehmet Usta',
      type: 'STREET_CART',
      isMobile: true,
      priceLevel: 'BUDGET',
      latitude: 40.9905,
      longitude: 29.0241,
      locationNote: "Sadece 20:00'den sonra",
      locale: 'tr',
      localTips: ['CASH_ONLY'],
      mustTry: [{ localName: 'Tavuklu Pilav' }],
      schedules: [],
    });
  });

  it('drops the hours note and empty dish for non-mobile spots', () => {
    const result = buildSuggestPayload(
      { ...initialSuggestForm(here), name: 'Esnaf Lokantası', type: 'HOME_COOKING', isMobile: false, hoursNote: 'x y z' },
      'en',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.payload.locationNote, undefined);
    assert.deepEqual(result.payload.mustTry, []);
  });

  it('maps schema errors to form fields', () => {
    const result = buildSuggestPayload({ ...initialSuggestForm(null), name: ' ', dish: 'x' }, 'en');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.errors, { name: true, location: true, dish: true });
  });
});
