import type { VenueSummaryDTO } from '@localbite/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyExploreFilters, type ExploreFilterInput } from './exploreFilter';

const origin = { latitude: 40.99, longitude: 29.02 };
const now = new Date('2026-09-24T20:00:00Z');

// ~111 m / 0.001° enlem
function venue(id: string, dLat: number, patch: Partial<VenueSummaryDTO> = {}): VenueSummaryDTO {
  return {
    id,
    latitude: origin.latitude + dLat,
    longitude: origin.longitude,
    categories: [],
    isActiveNow: false,
    isScheduledOpen: false,
    priceLevel: 'BUDGET',
    liveLocation: null,
    distanceMeters: 0,
    ...patch,
  } as VenueSummaryDTO;
}

const base: ExploreFilterInput = { origin, maxDistance: 3_000, category: null, openNow: false, budget: false, liveOnly: false };
const ids = (list: VenueSummaryDTO[]) => list.map((v) => v.id);

describe('applyExploreFilters', () => {
  const near = venue('near', 0.004); // ~445 m
  const mid = venue('mid', 0.02, { categories: ['DONER_WRAP'], isActiveNow: true }); // ~2.2 km
  const far = venue('far', 0.04, { priceLevel: 'MODERATE' }); // ~4.4 km

  it('mesafeye göre süzer ve yakından uzağa sıralar', () => {
    assert.deepEqual(ids(applyExploreFilters([far, mid, near], { ...base, maxDistance: 500 })), ['near']);
    assert.deepEqual(ids(applyExploreFilters([far, mid, near], base)), ['near', 'mid']);
    assert.deepEqual(ids(applyExploreFilters([far, mid, near], { ...base, maxDistance: null })), ['near', 'mid', 'far']);
  });

  it('kart mesafesini seçilen merkeze göre yeniden hesaplar', () => {
    const [v] = applyExploreFilters([near], base);
    assert.ok(v!.distanceMeters > 400 && v!.distanceMeters < 500);
  });

  it('kategori, açık ve bütçe filtreleri birlikte çalışır', () => {
    const all = { ...base, maxDistance: null };
    assert.deepEqual(ids(applyExploreFilters([near, mid, far], { ...all, category: 'DONER_WRAP' })), ['mid']);
    assert.deepEqual(ids(applyExploreFilters([near, mid, far], { ...all, openNow: true })), ['mid']);
    assert.deepEqual(ids(applyExploreFilters([near, mid, far], { ...all, budget: true })), ['near', 'mid']);
  });

  it('canlı konum filtresi yalnızca son 4 saati sayar', () => {
    const live = venue('live', 0.001, { liveLocation: { updatedAt: new Date(now.getTime() - 30 * 60_000).toISOString() } });
    const stale = venue('stale', 0.002, { liveLocation: { updatedAt: new Date(now.getTime() - 6 * 3_600_000).toISOString() } });
    assert.deepEqual(ids(applyExploreFilters([live, stale, near], { ...base, liveOnly: true }, now)), ['live']);
  });
});
