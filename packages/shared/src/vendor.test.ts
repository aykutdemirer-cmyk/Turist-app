import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeOpenOverride, liveLocationFreshness } from './vendor';

const now = new Date('2026-09-24T20:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe('liveLocationFreshness', () => {
  it('güncelleme yoksa null', () => {
    assert.equal(liveLocationFreshness(null, now), null);
    assert.equal(liveLocationFreshness('not-a-date', now), null);
  });
  it('4 saate kadar canlı', () => {
    assert.equal(liveLocationFreshness(ago(15), now), 'LIVE');
    assert.equal(liveLocationFreshness(ago(240), now), 'LIVE');
  });
  it('4–12 saat arası yakın zamanlı', () => {
    assert.equal(liveLocationFreshness(ago(241), now), 'RECENT');
    assert.equal(liveLocationFreshness(ago(720).toISOString(), now), 'RECENT');
  });
  it('12 saatten eski son bilinen nokta', () => {
    assert.equal(liveLocationFreshness(ago(721), now), 'STALE');
  });
});

describe('activeOpenOverride', () => {
  it('ayar yoksa null', () => assert.equal(activeOpenOverride(null, ago(5), now), null));
  it('12 saat içinde geçerli', () => assert.equal(activeOpenOverride(false, ago(60), now), false));
  it('süresi dolunca çalışma saatlerine döner', () => assert.equal(activeOpenOverride(true, ago(13 * 60), now), null));
});
