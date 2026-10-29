import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  classifyHeardTrack,
  creditedName,
  editionKey,
  isOwnRelease,
  officialSpelling,
  orderReleases,
  pickEditions,
  toDate,
} from './releases';

const QUAVO = 'quavo-id';

function release({ id, name, type = 'album', tracks = 10, date = '2020-01-01', artist = QUAVO }) {
  return {
    id,
    name,
    album_type: type,
    total_tracks: tracks,
    release_date: date,
    artists: [artist].flat().map((id) => ({ id })),
    images: [{ url: `https://img/${id}` }],
  };
}

const track = (id, name, artists = [QUAVO]) => ({ id, name, artists: artists.map((a) => ({ id: a })) });

describe('pickEditions', () => {
  it('drops live albums but keeps titles that merely contain "live"', () => {
    const kept = pickEditions([
      release({ id: 'a', name: 'UTOPIA' }),
      release({ id: 'b', name: 'Live at Kilmainham Gaol' }),
      release({ id: 'c', name: 'UTOPIA (Live)' }),
      release({ id: 'd', name: 'Rodeo - Live' }),
      release({ id: 'e', name: 'Live Forever' }),
      release({ id: 'f', name: 'Alive' }),
    ]).map((r) => r.id);
    expect(kept.sort()).toEqual(['a', 'e', 'f']);
  });

  it('keeps only the most complete edition of an album', () => {
    const kept = pickEditions([
      release({ id: 'std', name: 'Half Blood', tracks: 12 }),
      release({ id: 'lux', name: 'Half Blood (BloodLuxe)', tracks: 18 }),
    ]);
    expect(kept.map((r) => r.id)).toEqual(['lux']);
  });

  it('does not merge a single with an album of the same name', () => {
    const kept = pickEditions([
      release({ id: 'album', name: 'Starboy', tracks: 18 }),
      release({ id: 'single', name: 'Starboy', type: 'single', tracks: 1 }),
    ]);
    expect(kept).toHaveLength(2);
  });

  it('orders albums, then EPs, then singles, oldest first within each', () => {
    const kept = pickEditions([
      release({ id: 'single', name: 'One', type: 'single', tracks: 1, date: '2010-01-01' }),
      release({ id: 'ep', name: 'Four Songs', type: 'single', tracks: 4, date: '2011-01-01' }),
      release({ id: 'new', name: 'Second Album', date: '2022-05-01' }),
      release({ id: 'old', name: 'First Album', date: '2015-05-01' }),
    ]);
    expect(kept.map((r) => r.id)).toEqual(['old', 'new', 'ep', 'single']);
  });
});

describe('editionKey', () => {
  it('ignores bracketed and dashed edition suffixes', () => {
    const plain = editionKey(release({ id: '1', name: 'After Hours' }));
    expect(editionKey(release({ id: '2', name: 'After Hours (Deluxe)' }))).toBe(plain);
    expect(editionKey(release({ id: '3', name: 'After Hours - Remastered' }))).toBe(plain);
  });
});

describe('toDate', () => {
  it('fills in a missing month or day', () => {
    expect(toDate('2019')).toBe('2019-01-01');
    expect(toDate('2019-07')).toBe('2019-07-01');
    expect(toDate('2019-07-14')).toBe('2019-07-14');
    expect(toDate(null)).toBeNull();
  });
});

describe('own releases vs. features', () => {
  const ownAlbum = release({ id: 'qrome', name: 'QUAVO HUNCHO', tracks: 3 });
  const remix = release({ id: 'congrats', name: 'Congratulations (Remix)', type: 'single', tracks: 1, artist: ['post', QUAVO] });

  it('counts a release as own only when the artist is credited first', () => {
    expect(isOwnRelease(ownAlbum, QUAVO)).toBe(true);
    expect(isOwnRelease(remix, QUAVO)).toBe(false);
  });

  it("counts a joint album as each credited artist's own", () => {
    const amfisbena = release({ id: 'amf', name: 'Amfisbena', artist: ['zabson', QUAVO] });
    expect(isOwnRelease(amfisbena, QUAVO)).toBe(true);
    expect(isOwnRelease(amfisbena, 'zabson')).toBe(true);
  });

  it('puts own releases first so they claim shared songs', () => {
    expect(orderReleases([remix, ownAlbum], QUAVO).map((r) => r.id)).toEqual(['qrome', 'congrats']);
  });

  it("files someone else's single under features, not singles", () => {
    const { songs } = buildCatalog([remix], [[{ id: 'congrats', name: 'Congratulations (Remix)' }]], QUAVO);
    expect(songs).toEqual([
      {
        name: 'Congratulations (Remix)',
        spotify_track_id: 'congrats',
        spotify_album_id: null,
        track_number: 1,
        is_feature: true,
      },
    ]);
  });

  it("keeps only the artist's own tracks from someone else's EP", () => {
    const compilation = release({ id: 'comp', name: 'Culture EP', type: 'single', tracks: 2, artist: ['migos', QUAVO] });
    const { albums, songs } = buildCatalog(
      [compilation],
      [[track('t1', 'Bad and Boujee', ['migos', QUAVO]), track('t2', 'T-Shirt', ['migos'])]],
      QUAVO
    );
    expect(albums).toEqual([]);
    expect(songs.map((s) => s.name)).toEqual(['Bad and Boujee']);
    expect(songs[0].is_feature).toBe(true);
  });
});

describe('buildCatalog', () => {
  it('gives own albums and EPs a tile, and own one-track singles none', () => {
    const album = release({ id: 'alb', name: 'Album', tracks: 2, date: '2018' });
    const ep = release({ id: 'ep', name: 'EP', type: 'single', tracks: 4 });
    const single = release({ id: 'sgl', name: 'Single', type: 'single', tracks: 1 });
    const { albums, songs } = buildCatalog(
      [album, ep, single],
      [
        [track('a1', 'Intro'), track('a2', 'Outro')],
        [track('e1', 'E1'), track('e2', 'E2'), track('e3', 'E3'), track('e4', 'E4')],
        [{ id: 'sgl', name: 'Single' }],
      ],
      QUAVO
    );
    expect(albums.map((a) => a.spotify_album_id)).toEqual(['alb', 'ep']);
    expect(albums[0]).toMatchObject({ release_date: '2018-01-01', image_url: 'https://img/alb', total_tracks: 2 });
    expect(songs.find((s) => s.name === 'Outro')).toMatchObject({ spotify_album_id: 'alb', track_number: 2, is_feature: false });
    expect(songs.find((s) => s.name === 'Single')).toMatchObject({ spotify_album_id: null, is_feature: false });
  });

  it('lets the first release claim a song that appears again later', () => {
    const album = release({ id: 'orig', name: 'Original', tracks: 1 });
    const reissue = release({ id: 'best', name: 'Greatest Hits', tracks: 1 });
    const { songs } = buildCatalog(
      [album, reissue],
      [[track('o1', 'Hit Song')], [track('b1', 'Hit Song - 2011 Remaster')]],
      QUAVO
    );
    expect(songs).toHaveLength(1);
    expect(songs[0].spotify_album_id).toBe('orig');
  });
});

describe('officialSpelling', () => {
  it("adopts Spotify's capitals and spacing", () => {
    expect(officialSpelling('bts', 'BTS')).toBe('BTS');
    expect(officialSpelling('J. cole', 'J. Cole')).toBe('J. Cole');
    expect(officialSpelling('justin  bieber ', 'Justin Bieber')).toBe('Justin Bieber');
  });

  it('never swaps in a different name', () => {
    expect(officialSpelling('Kinny Zimmer', 'Kinny Zimmer Band')).toBeNull();
    expect(officialSpelling('slayr', 'Slayer')).toBeNull();
  });

  it('does nothing when the spelling already matches', () => {
    expect(officialSpelling('Quavo', 'Quavo')).toBeNull();
    expect(officialSpelling('Quavo', null)).toBeNull();
  });
});

describe('creditedName', () => {
  it("takes the name from the artist's own release, not a feature", () => {
    const feature = release({ id: 'f', name: 'Remix', artist: ['post'] });
    feature.artists[0].name = 'Post Malone';
    const own = release({ id: 'o', name: 'Album' });
    own.artists[0].name = 'Quavo';
    expect(creditedName([feature, own], QUAVO)).toBe('Quavo');
    expect(creditedName([feature], QUAVO)).toBeNull();
  });
});

describe('classifyHeardTrack', () => {
  const migos = { id: 'migos-row', name: 'Migos', spotify_id: null };
  const track = (albumArtists) => ({ id: 't', album: { artists: albumArtists } });

  it("knows the artist's own releases", () => {
    expect(classifyHeardTrack(track([{ id: QUAVO, name: 'Quavo' }]), QUAVO, [migos])).toEqual({ kind: 'own' });
  });

  it('files a song from a band release under that band, by name', () => {
    expect(classifyHeardTrack(track([{ id: 'sp-migos', name: 'Migos' }]), QUAVO, [migos])).toEqual({ kind: 'band', band: migos });
  });

  it('matches a band by Spotify id even when the names differ', () => {
    const linked = { id: 'row', name: 'Unc and Phew', spotify_id: 'sp-up' };
    expect(classifyHeardTrack(track([{ id: 'sp-up', name: "UNC'N'PHEW" }]), QUAVO, [linked]).kind).toBe('band');
  });

  it("calls anything else a feature", () => {
    expect(classifyHeardTrack(track([{ id: 'post', name: 'Post Malone' }]), QUAVO, [migos])).toEqual({ kind: 'feature' });
    expect(classifyHeardTrack(track([{ id: 'post', name: 'Post Malone' }]), QUAVO)).toEqual({ kind: 'feature' });
  });
});
