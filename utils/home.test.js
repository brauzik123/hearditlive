import { describe, expect, it } from 'vitest';
import { daysBefore, nextMilestone, onThisDay, pendingTags, thisYearSummary } from './home';

describe('nextMilestone', () => {
  it('finds the next round number', () => {
    expect(nextMilestone(0)).toEqual({ target: 5, remaining: 5 });
    expect(nextMilestone(12)).toEqual({ target: 25, remaining: 13 });
    expect(nextMilestone(25)).toEqual({ target: 50, remaining: 25 });
  });

  it('keeps going past the list', () => {
    expect(nextMilestone(1000)).toEqual({ target: 1500, remaining: 500 });
    expect(nextMilestone(1499)).toEqual({ target: 1500, remaining: 1 });
  });
});

describe('onThisDay', () => {
  const shows = [
    { id: 'bts', event_date: '2019-06-01' },
    { id: 'recent', event_date: '2025-06-01' },
    { id: 'today', event_date: '2026-06-01' },
    { id: 'other', event_date: '2024-06-02' },
    { id: 'undated', event_date: null },
  ];

  it('finds earlier years on the same day, most recent first', () => {
    expect(onThisDay(shows, '2026-06-01').map((e) => [e.id, e.yearsAgo])).toEqual([
      ['recent', 1],
      ['bts', 7],
    ]);
  });

  it('is empty on days without anything', () => {
    expect(onThisDay(shows, '2026-12-24')).toEqual([]);
  });
});

describe('daysBefore', () => {
  it('counts back across months and years', () => {
    expect(daysBefore('2026-10-29', 7)).toBe('2026-10-22');
    expect(daysBefore('2026-01-03', 7)).toBe('2025-12-27');
  });
});

describe('thisYearSummary', () => {
  const show = (id, date, artist, extra = {}) => ({
    id,
    event_date: date,
    festival_id: null,
    venue_id: `v-${id}`,
    artist_id: artist,
    artists: { name: artist },
    ...extra,
  });

  it("counts this year's events and finds who you saw most", () => {
    const summary = thisYearSummary(
      [show('a', '2026-03-01', 'Travis Scott'), show('b', '2026-07-01', 'Travis Scott'), show('c', '2026-05-01', 'BTS'), show('d', '2025-01-01', 'BTS')],
      2026
    );
    expect(summary.events).toBe(3);
    expect(summary.top.name).toBe('Travis Scott');
  });

  it('counts a festival edition once', () => {
    const fest = { festival_id: 'opener' };
    const summary = thisYearSummary([show('a', '2026-07-01', 'A', fest), show('b', '2026-07-02', 'B', fest)], '2026');
    expect(summary.events).toBe(1);
  });

  it('is empty for a year without shows', () => {
    expect(thisYearSummary([show('a', '2025-01-01', 'A')], 2026)).toEqual({ events: 0, top: null });
  });
});

describe('pendingTags', () => {
  const tagged = [
    { id: 'tezzus', event_date: '2026-10-21', artist_id: 't' },
    { id: 'weeknd', event_date: '2026-08-05', artist_id: 'w' },
    { id: 'bts', event_date: '2026-07-01', artist_id: 'b' },
  ];

  it('keeps tags you have not answered yet', () => {
    expect(pendingTags(tagged, [], []).map((e) => e.id)).toEqual(['tezzus', 'weeknd', 'bts']);
  });

  it('drops tags you already copied, or shows you logged yourself', () => {
    const copies = [{ copied_from: 'tezzus' }];
    const sameDay = [{ event_date: '2026-08-05', artist_id: 'w' }, { event_date: '2026-07-01', artist_id: 'someone-else' }];
    expect(pendingTags(tagged, copies, sameDay).map((e) => e.id)).toEqual(['bts']);
  });
});
