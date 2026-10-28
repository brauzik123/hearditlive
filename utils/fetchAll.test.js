import { describe, expect, it, vi } from 'vitest';
import { fetchAll, fetchAllIn } from './fetchAll';

// A stand-in for a Supabase select: honours .in(), .order() and .range()
// and, like Supabase, never returns more than 1000 rows at once.
function fakeTable(rows, { error } = {}) {
  const requests = [];
  const makeQuery = () => {
    let filtered = rows;
    const query = {
      in(column, values) {
        filtered = filtered.filter((r) => values.includes(r[column]));
        return query;
      },
      order() {
        return query;
      },
      async range(from, to) {
        requests.push([from, to]);
        if (error) return { data: null, error: { message: error } };
        return { data: filtered.slice(from, Math.min(to + 1, from + 1000)), error: null };
      },
    };
    return query;
  };
  return { makeQuery: vi.fn(makeQuery), requests };
}

const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i, artist_id: `a${i % 300}` }));

describe('fetchAll', () => {
  it('returns every row past the 1000-row cap', async () => {
    const table = fakeTable(rows(2500));
    expect(await fetchAll(table.makeQuery)).toHaveLength(2500);
    expect(table.requests).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('stops after one request when everything fits', async () => {
    const table = fakeTable(rows(10));
    expect(await fetchAll(table.makeQuery)).toHaveLength(10);
    expect(table.requests).toHaveLength(1);
  });

  it('throws instead of returning partial data', async () => {
    await expect(fetchAll(fakeTable([], { error: 'boom' }).makeQuery)).rejects.toThrow('boom');
  });
});

describe('fetchAllIn', () => {
  it('splits long id lists and combines the results', async () => {
    const table = fakeTable(rows(1200));
    const ids = Array.from({ length: 300 }, (_, i) => `a${i}`);
    const result = await fetchAllIn(table.makeQuery, 'artist_id', ids);
    expect(result).toHaveLength(1200);
    expect(table.makeQuery.mock.calls.length).toBeGreaterThan(1);
  });

  it('makes no request for an empty list', async () => {
    const table = fakeTable(rows(5));
    expect(await fetchAllIn(table.makeQuery, 'artist_id', [])).toEqual([]);
    expect(table.requests).toHaveLength(0);
  });
});
