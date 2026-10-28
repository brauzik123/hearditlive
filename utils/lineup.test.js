import { describe, expect, it } from 'vitest';
import { billing, rankArtists } from './lineup';

let nextId = 0;
const show = (name, fields = {}) => ({
  id: `e${nextId++}`,
  artist_id: name.toLowerCase(),
  artists: { name },
  is_support: false,
  event_date: '2024-01-01',
  ...fields,
});
const names = (ranked) => ranked.map((a) => a.name);

describe('rankArtists', () => {
  it('ranks by shows seen first', () => {
    const ranked = rankArtists([show('Zed'), show('Zed'), show('Abba')]);
    expect(names(ranked)).toEqual(['Zed', 'Abba']);
    expect(ranked[0]).toMatchObject({ shows: 2, headline: 2 });
  });

  it('puts a support act below the headliner it opened for', () => {
    const ranked = rankArtists([
      show('Katy Perry', { event_date: '2015-02-24' }),
      show('charli xcx', { event_date: '2015-02-24', is_support: true }),
    ]);
    expect(names(ranked)).toEqual(['Katy Perry', 'charli xcx']);
  });

  it('then prefers the artist you heard more songs from', () => {
    const a = show('Abba');
    const b = show('Blur');
    expect(names(rankArtists([a, b], new Map([[a.id, 5], [b.id, 20]])))).toEqual(['Blur', 'Abba']);
  });

  it('then the more recent show, and only then the name', () => {
    expect(names(rankArtists([show('Abba', { event_date: '2019-01-01' }), show('Blur', { event_date: '2026-01-01' })]))).toEqual([
      'Blur',
      'Abba',
    ]);
    expect(names(rankArtists([show('Blur'), show('Abba')]))).toEqual(['Abba', 'Blur']);
  });

  it('counts the same artist once even if the name was typed differently', () => {
    const ranked = rankArtists([show('BTS', { artist_id: 'x' }), show('bts', { artist_id: 'x' })]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].shows).toBe(2);
  });

  it('skips shows without an artist', () => {
    expect(rankArtists([{ id: '1', artists: null }])).toEqual([]);
  });
});

describe('billing', () => {
  it('fills rows of 1, 3, 5 and 8 like a festival poster', () => {
    const ranked = Array.from({ length: 20 }, (_, i) => ({ name: `A${i}` }));
    expect(billing(ranked).map((row) => row.artists.length)).toEqual([1, 3, 5, 8]);
  });

  it('leaves out empty rows', () => {
    expect(billing([{ name: 'Only' }, { name: 'Two' }]).map((row) => [row.tier, row.artists.length])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });
});
