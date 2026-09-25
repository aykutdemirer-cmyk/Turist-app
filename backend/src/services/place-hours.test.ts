import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOpeningHours } from '../lib/openingHours';
import { toOsmHours } from './place-hours.service';

describe('toOsmHours', () => {
  it('formu OSM sözdizimine çevirir ve aynı ayrıştırıcı okuyabilir', () => {
    const value = toOsmHours({
      days: [
        { closed: false, open: '10:00', close: '22:00' },
        { closed: false, open: '10:00', close: '22:00' },
        { closed: false, open: '10:00', close: '22:00' },
        { closed: false, open: '10:00', close: '22:00' },
        { closed: false, open: '10:00', close: '23:30' },
        { closed: false, open: '18:00', close: '02:00' },
        { closed: true },
      ],
    });
    assert.equal(
      value,
      'Mo 10:00-22:00, Tu 10:00-22:00, We 10:00-22:00, Th 10:00-22:00, Fr 10:00-23:30, Sa 18:00-02:00',
    );
    // Cumartesi 23:00 İstanbul
    const h = parseOpeningHours(value, 'tr', new Date('2026-09-26T20:00:00Z'));
    assert.equal(h?.openNow, true);
    assert.equal(h?.closesAt, '02:00');
    assert.equal(h?.weeklyHours[5], 'Cumartesi: 18:00–02:00');
    assert.equal(h?.weeklyHours[6], 'Pazar: Kapalı');
  });

  it('hepsi kapalıysa "off" (geçerli ve kapalı)', () => {
    const value = toOsmHours({ days: Array.from({ length: 7 }, () => ({ closed: true as const })) });
    assert.equal(value, 'off');
    assert.equal(parseOpeningHours(value, 'tr')?.openNow, false);
  });
});
