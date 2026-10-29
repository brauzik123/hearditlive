import { describe, expect, it } from 'vitest';
import { daysBefore, nextMilestone, onThisDay } from './home';

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
