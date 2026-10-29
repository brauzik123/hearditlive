import { describe, expect, it } from 'vitest';
import { summarizeFestivals } from './festivals';

const set = (festival, date) => ({ festival_id: festival, festivals: { name: festival }, event_date: date });

describe('summarizeFestivals', () => {
  it('counts editions by year and every set', () => {
    const rows = summarizeFestivals([
      set('Opener', '2025-07-02'),
      set('Opener', '2025-07-03'),
      set('Opener', '2026-07-01'),
      set('Clout', '2026-07-10'),
      set('Clout', '2026-07-10'),
      { festival_id: null, event_date: '2026-01-01' },
    ]);
    expect(rows).toEqual([
      { id: 'Opener', name: 'Opener', editions: 2, sets: 3 },
      { id: 'Clout', name: 'Clout', editions: 1, sets: 2 },
    ]);
  });

  it('ranks by editions, then sets, then name', () => {
    const rows = summarizeFestivals([set('Zeta', '2026-01-01'), set('Alpha', '2026-01-01')]);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('handles undated sets and no festivals at all', () => {
    expect(summarizeFestivals([set('X', null)])).toEqual([{ id: 'X', name: 'X', editions: 0, sets: 1 }]);
    expect(summarizeFestivals([])).toEqual([]);
  });
});
