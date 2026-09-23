import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findActiveSlot, formatMinutes, getLocalClock, isOpenNow, toMinutes } from './time';

// İstanbul UTC+3 (2016'dan beri yaz saati yok). 2026-09-23 bir Çarşamba (dayOfWeek = 3).
const istanbul = (isoLocal: string) => new Date(`${isoLocal}+03:00`);

const nightCart = [{ dayOfWeek: 3, openMinute: toMinutes('19:00'), closeMinute: toMinutes('02:00') }];
const lunchPlace = [{ dayOfWeek: 3, openMinute: toMinutes('11:00'), closeMinute: toMinutes('16:00') }];

describe('getLocalClock', () => {
  it('converts to Istanbul local time', () => {
    assert.deepEqual(getLocalClock(new Date('2026-09-23T21:30:00Z')), {
      dayOfWeek: 4, // UTC Çarşamba 21:30 = İstanbul Perşembe 00:30
      minuteOfDay: 30,
      dayKey: '2026-09-24',
    });
  });
});

describe('isOpenNow', () => {
  it('handles same-day slots with an exclusive close time', () => {
    assert.equal(isOpenNow(lunchPlace, null, istanbul('2026-09-23T11:00:00')), true);
    assert.equal(isOpenNow(lunchPlace, null, istanbul('2026-09-23T15:59:00')), true);
    assert.equal(isOpenNow(lunchPlace, null, istanbul('2026-09-23T16:00:00')), false);
    assert.equal(isOpenNow(lunchPlace, null, istanbul('2026-09-24T12:00:00')), false);
  });

  it('handles slots that cross midnight', () => {
    assert.equal(isOpenNow(nightCart, null, istanbul('2026-09-23T18:59:00')), false);
    assert.equal(isOpenNow(nightCart, null, istanbul('2026-09-23T23:00:00')), true);
    // Perşembe 01:30 hâlâ Çarşamba akşamı başlayan dilimin içinde
    assert.equal(isOpenNow(nightCart, null, istanbul('2026-09-24T01:30:00')), true);
    assert.equal(isOpenNow(nightCart, null, istanbul('2026-09-24T02:00:00')), false);
    // Salı 01:30 → Pazartesi dilimi yok
    assert.equal(isOpenNow(nightCart, null, istanbul('2026-09-22T01:30:00')), false);
  });

  it('treats equal open/close as open all day', () => {
    const allDay = [{ dayOfWeek: 3, openMinute: 0, closeMinute: 0 }];
    assert.equal(isOpenNow(allDay, null, istanbul('2026-09-23T03:00:00')), true);
    assert.equal(isOpenNow(allDay, null, istanbul('2026-09-24T03:00:00')), false);
  });

  it('counts a recent "spotted today" report as active', () => {
    const now = istanbul('2026-09-23T15:00:00');
    assert.equal(isOpenNow(nightCart, istanbul('2026-09-23T13:30:00'), now), true);
    assert.equal(isOpenNow(nightCart, istanbul('2026-09-23T11:00:00'), now), false);
    assert.equal(isOpenNow(nightCart, '2026-09-23T10:30:00.000Z', now), true);
  });
});

describe('findActiveSlot', () => {
  it('returns the slot so the vendor location override can be used', () => {
    const slots = [
      { dayOfWeek: 3, openMinute: 1140, closeMinute: 120, locationNote: 'Rıhtım' },
      { dayOfWeek: 5, openMinute: 1140, closeMinute: 120, locationNote: 'Bahariye' },
    ];
    assert.equal(findActiveSlot(slots, istanbul('2026-09-26T00:30:00'))?.locationNote, 'Bahariye');
  });
});

describe('minute helpers', () => {
  it('round-trips HH:MM', () => {
    assert.equal(toMinutes('19:00'), 1140);
    assert.equal(formatMinutes(120), '02:00');
    assert.throws(() => toMinutes('24:00'));
  });
});
