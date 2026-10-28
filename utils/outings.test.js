import { describe, expect, it } from 'vitest';
import { countOutings, outingKey, topByOutings } from './outings';

const entry = (id, fields = {}) => ({ id, festival_id: null, event_date: null, venue_id: null, ...fields });

describe('outings', () => {
  it("counts every set at one festival edition as one outing", () => {
    const sets = ['a', 'b', 'c'].map((id) => entry(id, { festival_id: 'opener', event_date: '2026-07-01' }));
    expect(countOutings(sets)).toBe(1);
  });

  it('counts different years of a festival separately', () => {
    expect(
      countOutings([
        entry('a', { festival_id: 'opener', event_date: '2025-07-01' }),
        entry('b', { festival_id: 'opener', event_date: '2026-07-02' }),
      ])
    ).toBe(2);
  });

  it('counts a support act and the headliner on the same night as one outing', () => {
    expect(
      countOutings([
        entry('support', { event_date: '2026-03-10', venue_id: 'torwar' }),
        entry('headliner', { event_date: '2026-03-10', venue_id: 'torwar' }),
      ])
    ).toBe(1);
  });

  it('keeps shows apart when the date or venue is missing or different', () => {
    expect(
      countOutings([
        entry('a', { event_date: '2026-03-10' }),
        entry('b', { event_date: '2026-03-10' }),
        entry('c', { event_date: '2026-03-10', venue_id: 'x' }),
        entry('d', { event_date: '2026-03-11', venue_id: 'x' }),
      ])
    ).toBe(4);
  });

  it('files undated festival sets under one key', () => {
    expect(outingKey(entry('a', { festival_id: 'f' }))).toBe('festival:f:undated');
  });

  it('ranks places by distinct outings, ties by name', () => {
    const entries = [
      entry('1', { festival_id: 'opener', event_date: '2026-07-01', venue_id: 'gdynia' }),
      entry('2', { festival_id: 'opener', event_date: '2026-07-02', venue_id: 'gdynia' }),
      entry('3', { event_date: '2026-01-01', venue_id: 'torwar' }),
      entry('4', { event_date: '2026-02-01', venue_id: 'torwar' }),
      entry('5', { event_date: '2026-02-01', venue_id: 'stodola' }),
      entry('6', { event_date: '2026-02-02' }),
    ];
    const top = topByOutings(entries, (e) => e.venue_id, (e) => e.venue_id, 10);
    expect(top).toEqual([
      { name: 'torwar', count: 2 },
      { name: 'gdynia', count: 1 },
      { name: 'stodola', count: 1 },
    ]);
  });
});
