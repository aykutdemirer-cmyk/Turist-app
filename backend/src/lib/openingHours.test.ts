import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOpeningHours } from './openingHours';

// 2026-09-26 Cumartesi 23:00 İstanbul (20:00 UTC)
const SAT_NIGHT = new Date('2026-09-26T20:00:00Z');

describe('parseOpeningHours', () => {
  it('gece yarısını aşan saatte açık ve kapanışı İstanbul saatiyle verir', () => {
    const h = parseOpeningHours('Mo-Su 10:00-02:00', 'tr', SAT_NIGHT);
    assert.ok(h);
    assert.equal(h.openNow, true);
    assert.equal(h.closesAt, '02:00');
    assert.equal(h.weeklyHours[0], 'Pazartesi: 10:00–02:00');
    assert.equal(h.weeklyHours.length, 7);
  });

  it('kapalıyken açılış saatini ve kapalı günleri verir', () => {
    const h = parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00; PH off', 'tr', SAT_NIGHT);
    assert.ok(h);
    assert.equal(h.openNow, false);
    assert.equal(h.opensAt, '09:00'); // Pazartesi
    assert.equal(h.weeklyHours[5], 'Cumartesi: 10:00–14:00');
    assert.equal(h.weeklyHours[6], 'Pazar: Kapalı');
  });

  it('24/7 ve bozuk değer', () => {
    const allDay = parseOpeningHours('24/7', 'tr', SAT_NIGHT);
    assert.equal(allDay?.openNow, true);
    assert.equal(allDay?.weeklyHours[0], 'Pazartesi: 24 saat açık');
    assert.equal(parseOpeningHours('bozuk değer', 'tr', SAT_NIGHT), null);
    assert.equal(parseOpeningHours(undefined, 'tr', SAT_NIGHT), null);
  });
});
