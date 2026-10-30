import { describe, expect, it } from 'vitest';
import { sortSongArtists } from './songsSort';

const artists = [
  { name: 'Bravo', distinctHeard: 5, totalHeard: 20, pct: 10 },
  { name: 'alpha', distinctHeard: 9, totalHeard: 9, pct: null },
  { name: 'Charlie', distinctHeard: 3, totalHeard: 3, pct: 50 },
];
const names = (list) => list.map((a) => a.name);

describe('sortSongArtists', () => {
  it('sorts by songs heard', () => {
    expect(names(sortSongArtists(artists, 'heard'))).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by plays', () => {
    expect(names(sortSongArtists(artists, 'plays'))).toEqual(['Bravo', 'alpha', 'Charlie']);
  });

  it('sorts by percentage, artists without one last', () => {
    expect(names(sortSongArtists(artists, 'pct'))).toEqual(['Charlie', 'Bravo', 'alpha']);
  });

  it('sorts by name, ignoring case', () => {
    expect(names(sortSongArtists(artists, 'name'))).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('does not reorder the original list', () => {
    sortSongArtists(artists, 'name');
    expect(artists[0].name).toBe('Bravo');
  });
});
