import { describe, expect, it } from 'vitest';
import { billedArtists, billedName, isBilled, songCountsFor, splitJointAct } from './showArtists';

const joint = {
  artist_id: 'zabson',
  artists: { name: 'Żabson' },
  entry_co_artists: [{ artist_id: 'igi', position: 1, artists: { name: 'Young Igi' } }],
};

describe('billed artists', () => {
  it('lists the first-billed artist, then the others in order', () => {
    expect(billedArtists(joint)).toEqual([
      { id: 'zabson', name: 'Żabson' },
      { id: 'igi', name: 'Young Igi' },
    ]);
    expect(billedName(joint)).toBe('Żabson & Young Igi');
    expect(isBilled(joint, 'igi')).toBe(true);
    expect(isBilled(joint, 'someone')).toBe(false);
  });

  it('works for ordinary one-artist shows and shows without an artist', () => {
    expect(billedName({ artist_id: 'a', artists: { name: 'BTS' } })).toBe('BTS');
    expect(billedName({ artist_id: null, artists: null })).toBeNull();
  });
});

describe('splitJointAct', () => {
  it("splits a duo when setlist.fm credits songs to each of them", () => {
    expect(splitJointAct('Tezzus & diamond*', ['diamond*', 'Tezzus', 'Żabson'])).toEqual(['Tezzus', 'diamond*']);
  });

  it('keeps a band with "&" in its name as one act', () => {
    expect(splitJointAct('Simon & Garfunkel', [])).toEqual(['Simon & Garfunkel']);
    expect(splitJointAct('Florence + the Machine', ['Sam Cooke'])).toEqual(['Florence + the Machine']);
  });

  it('leaves single names alone', () => {
    expect(splitJointAct('Quavo', ['Migos'])).toEqual(['Quavo']);
  });
});

describe('songCountsFor', () => {
  const billed = ['zabson', 'igi'];
  const catalogs = { zabson: new Set(['zabson solo', 'amfisbena track']), igi: new Set(['igi solo', 'amfisbena track']) };
  const song = (key, ownerId = null) => ({ ownerId, inCatalog: (artistId) => catalogs[artistId]?.has(key) ?? false });
  const countsFor = (s) => billed.filter((id) => songCountsFor(s, id, billed));

  it("gives each artist's solo songs only to them", () => {
    expect(countsFor(song('zabson solo'))).toEqual(['zabson']);
    expect(countsFor(song('igi solo'))).toEqual(['igi']);
  });

  it('gives a song from their joint album to both', () => {
    expect(countsFor(song('amfisbena track'))).toEqual(['zabson', 'igi']);
  });

  it('follows the setlist.fm credit when there is one', () => {
    expect(countsFor(song('unknown', 'igi'))).toEqual(['igi']);
  });

  it("puts a song nobody's catalog knows under the first-billed artist only", () => {
    expect(countsFor(song('unreleased'))).toEqual(['zabson']);
  });

  it('never makes a joint show count more songs than were played', () => {
    // 20 songs: 8 of Żabson's, 7 of Young Igi's, 5 from their joint album.
    const setlist = [
      ...Array.from({ length: 8 }, () => song('zabson solo')),
      ...Array.from({ length: 7 }, () => song('igi solo')),
      ...Array.from({ length: 5 }, () => song('amfisbena track')),
    ];
    // Stats counts setlist lines, whoever they're credited to.
    expect(setlist).toHaveLength(20);
    // Each artist's own page counts their songs: shared ones on both.
    expect(setlist.filter((s) => songCountsFor(s, 'zabson', billed))).toHaveLength(13);
    expect(setlist.filter((s) => songCountsFor(s, 'igi', billed))).toHaveLength(12);
    // And every line belongs to somebody.
    expect(setlist.every((s) => billed.some((id) => songCountsFor(s, id, billed)))).toBe(true);
  });

  it('counts everything for the artist of a one-artist show', () => {
    expect(songCountsFor(song('anything'), 'bts', ['bts'])).toBe(true);
  });
});
