import { describe, expect, it } from 'vitest';
import {
  applySetlistfm,
  attendeeRows,
  billedNames,
  copyFromFriend,
  setlistArtistNames,
  emptyForm,
  entryPayload,
  entryToForm,
  photosInSaveOrder,
  setlistfmDateToIso,
  setlistRows,
} from './entryForm';

const savedEntry = {
  entry_type: 'planned',
  artists: { name: 'Travis Scott' },
  venues: { name: 'PGE Narodowy', city: 'Warszawa', city_id: 756135, setlistfm_id: 'abc123', cities: { name_en: 'Warsaw', name_pl: 'Warszawa' } },
  festivals: null,
  event_date: '2026-07-10',
  tour_name: null,
  ticket_status: 'bought',
  rating: '7.5',
  is_support: true,
  is_favorite: null,
  description: null,
  entry_photos: [
    { id: 'p2', url: 'u/e/2.jpg', caption: null, position: 1, is_cover: false },
    { id: 'p1', url: 'u/e/1.jpg', caption: 'front row', position: 0, is_cover: true },
  ],
  entry_setlist: [
    { song_name: 'FE!N', position: 1, is_encore: false, is_cover: false, cover_original_artist: null },
    { song_name: 'HYAENA', position: 0, is_encore: false, is_cover: false, cover_original_artist: null },
  ],
  entry_attendees: [{ guest_name: 'Ola' }, { user_id: 'kuba-id', profiles: { username: 'kuba' } }],
  entry_tags: [{ tags: { name: 'rager' } }],
  visibility: null,
  setlistfm_id: null,
  setlistfm_url: null,
};

describe('entryToForm', () => {
  it('loads a saved entry into the form', () => {
    const form = entryToForm(savedEntry, { locale: 'en' });
    expect(form).toMatchObject({
      entryType: 'planned',
      artist: 'Travis Scott',
      venue: 'PGE Narodowy',
      city: 'Warsaw',
      cityGeonameId: 756135,
      setlistfmVenueId: 'abc123',
      ticketStatus: 'bought',
      rating: 7.5,
      isSupport: true,
      isFavorite: false,
      coverId: 'p1',
      attendees: [
        { name: 'Ola', userId: null },
        { name: 'kuba', userId: 'kuba-id' },
      ],
      tags: ['rager'],
      visibility: 'inherit',
    });
    expect(form.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(form.setlist.map((s) => s.name)).toEqual(['HYAENA', 'FE!N']);
  });

  it('shows the city in the app language', () => {
    expect(entryToForm(savedEntry, { locale: 'pl' }).city).toBe('Warszawa');
  });

  it('turns a planned show into an attended one from "Were you there?"', () => {
    expect(entryToForm(savedEntry, { locale: 'en', went: true }).entryType).toBe('attended');
  });

  it('keeps an unrated show unrated', () => {
    expect(entryToForm({ ...savedEntry, rating: null }, { locale: 'en' }).rating).toBeNull();
  });
});

describe('applySetlistfm', () => {
  const result = {
    id: 'sfm1',
    url: 'https://www.setlist.fm/setlist/x',
    eventDate: '05-08-2026',
    venueName: 'Tauron Arena',
    venueId: 'v9',
    city: 'Kraków',
    cityGeonameId: 3094802,
    tourName: 'Circus Maximus',
    sets: [
      { isEncore: false, songs: [{ name: 'One', isCover: false, coverOriginalArtist: null }] },
      { isEncore: true, songs: [{ name: 'Two', isCover: true, coverOriginalArtist: 'Someone' }] },
    ],
  };

  it("overrides what was typed with the setlist's details", () => {
    const form = { ...emptyForm, venue: 'Typed Venue', city: 'London', date: '2026-01-01' };
    expect(applySetlistfm(form, result)).toMatchObject({
      venue: 'Tauron Arena',
      city: 'Kraków',
      cityGeonameId: 3094802,
      setlistfmVenueId: 'v9',
      date: '2026-08-05',
      tourName: 'Circus Maximus',
      setlistfmId: 'sfm1',
      setlistfmUrl: 'https://www.setlist.fm/setlist/x',
    });
  });

  it('flattens sets into one setlist, keeping encores and covers', () => {
    const { setlist } = applySetlistfm(emptyForm, result);
    expect(setlist.map(({ name, isEncore, isCover }) => ({ name, isEncore, isCover }))).toEqual([
      { name: 'One', isEncore: false, isCover: false },
      { name: 'Two', isEncore: true, isCover: true },
    ]);
  });

  it('keeps typed details the setlist lacks', () => {
    const form = { ...emptyForm, tourName: 'My Tour', date: '2026-01-01' };
    const patch = applySetlistfm(form, { ...result, tourName: null, eventDate: '' });
    expect(patch.tourName).toBe('My Tour');
    expect(patch.date).toBe('2026-01-01');
  });
});

describe('saving', () => {
  const ids = { userId: 'u', artistId: 'a', venueId: 'v', festivalId: null };

  it('only saves a rating for attended shows and a ticket status for planned ones', () => {
    const attended = entryPayload({ ...emptyForm, rating: 8, ticketStatus: 'bought' }, ids);
    expect(attended).toMatchObject({ rating: 8, ticket_status: null });
    const planned = entryPayload({ ...emptyForm, entryType: 'planned', rating: 8, ticketStatus: 'bought' }, ids);
    expect(planned).toMatchObject({ rating: null, ticket_status: 'bought' });
  });

  it('saves a show without a rating', () => {
    expect(entryPayload(emptyForm, ids).rating).toBeNull();
  });

  it('turns blank text into nulls', () => {
    expect(entryPayload({ ...emptyForm, tourName: '  ', description: '' }, ids)).toMatchObject({
      tour_name: null,
      description: null,
      event_date: null,
    });
  });

  it('puts the cover photo first', () => {
    const form = { ...emptyForm, photos: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], coverId: 'b' };
    expect(photosInSaveOrder(form).map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('drops blank songs and numbers the rest in order', () => {
    const form = { ...emptyForm, setlist: [{ name: ' One ' }, { name: '  ' }, { name: 'Two', isEncore: true }] };
    expect(setlistRows(form, 'e1')).toEqual([
      { entry_id: 'e1', song_name: 'One', position: 0, is_encore: false, is_cover: false, cover_original_artist: null, artist_id: null, guest_artist_id: null },
      { entry_id: 'e1', song_name: 'Two', position: 1, is_encore: true, is_cover: false, cover_original_artist: null, artist_id: null, guest_artist_id: null },
    ]);
  });
});

describe('setlistfmDateToIso', () => {
  it('converts dd-MM-yyyy and rejects anything else', () => {
    expect(setlistfmDateToIso('05-08-2026')).toBe('2026-08-05');
    expect(setlistfmDateToIso('')).toBeNull();
    expect(setlistfmDateToIso(null)).toBeNull();
  });
});

describe('joint shows', () => {
  const tezzus = {
    id: 'sfm2',
    url: 'https://www.setlist.fm/setlist/y',
    eventDate: '21-10-2026',
    artistName: 'Tezzus & diamond*',
    venueName: 'Atlas Arena',
    city: 'Łódź',
    sets: [
      {
        isEncore: false,
        songs: [
          { name: '3 PhØnes', isCover: true, coverOriginalArtist: 'diamond*' },
          { name: 'Aubrey', isCover: true, coverOriginalArtist: 'Tezzus' },
          { name: 'Sexoholik', isCover: true, coverOriginalArtist: 'Żabson', withArtist: 'Żabson' },
        ],
      },
    ],
  };

  it('splits a joint act and credits each song to its artist instead of calling it a cover', () => {
    const patch = applySetlistfm({ ...emptyForm, artist: 'Tezzus' }, tezzus);
    expect(patch.artist).toBe('Tezzus');
    expect(patch.coArtists).toEqual(['diamond*']);
    expect(patch.setlist.map(({ name, isCover, ownerName, guestName }) => [name, isCover, ownerName, guestName])).toEqual([
      ['3 PhØnes', false, 'diamond*', null],
      ['Aubrey', false, 'Tezzus', null],
      // Żabson came out for his own song: a guest spot, not a cover.
      ['Sexoholik', false, 'Żabson', 'Żabson'],
    ]);
  });

  it('uses the artists typed in the form when setlist.fm files the show under one of them', () => {
    const form = { ...emptyForm, artist: 'Żabson', coArtists: ['Young Igi'] };
    const patch = applySetlistfm(form, {
      ...tezzus,
      artistName: 'Żabson',
      sets: [{ isEncore: false, songs: [{ name: 'Solo', isCover: true, coverOriginalArtist: 'Young Igi' }] }],
    });
    expect(patch.coArtists).toBeUndefined();
    expect(patch.setlist[0]).toMatchObject({ isCover: false, ownerName: 'Young Igi' });
  });

  it('loads co-billed artists and song owners back for editing', () => {
    const form = entryToForm(
      {
        ...savedEntry,
        artist_id: 'z',
        artists: { name: 'Żabson' },
        entry_co_artists: [{ artist_id: 'i', position: 1, artists: { name: 'Young Igi' } }],
        entry_setlist: [{ song_name: 'Solo', position: 0, artist_id: 'i' }],
      },
      { locale: 'en' }
    );
    expect(form.coArtists).toEqual(['Young Igi']);
    expect(form.setlist[0].ownerName).toBe('Young Igi');
  });

  it('saves each song with its owner and drops blank or repeated artists', () => {
    const form = { ...emptyForm, artist: 'Żabson', coArtists: [' ', 'Young Igi', 'żabson'], setlist: [{ name: 'Solo', ownerName: 'Young Igi' }] };
    expect(billedNames(form)).toEqual(['Żabson', 'Young Igi']);
    const ids = { 'Young Igi': 'i' };
    expect(setlistRows(form, 'e1', (name) => ids[name] ?? null)[0].artist_id).toBe('i');
  });
});

describe('guests', () => {
  it('keeps a real cover a cover, even with a guest on it', () => {
    const patch = applySetlistfm(emptyForm, {
      id: 'x',
      url: 'u',
      eventDate: '01-01-2026',
      sets: [{ isEncore: false, songs: [{ name: 'Creep', isCover: true, coverOriginalArtist: 'Radiohead', withArtist: 'Żabson' }] }],
    });
    expect(patch.setlist[0]).toMatchObject({ isCover: true, coverOriginalArtist: 'Radiohead', ownerName: null, guestName: 'Żabson' });
  });

  it('saves the guest, resolving artists who are not billed', () => {
    const form = {
      ...emptyForm,
      artist: 'Tezzus',
      coArtists: ['diamond*'],
      setlist: [{ name: 'Sexoholik', ownerName: 'Żabson', guestName: 'Żabson' }, { name: 'Aubrey', ownerName: 'Tezzus', guestName: '' }],
    };
    expect(setlistArtistNames(form)).toEqual(['Żabson']);
    const ids = { Żabson: 'z', Tezzus: 't' };
    const rows = setlistRows(form, 'e1', (name) => ids[name] ?? null);
    expect(rows.map((r) => [r.artist_id, r.guest_artist_id])).toEqual([
      ['z', 'z'],
      ['t', null],
    ]);
  });

  it('loads guests back for editing', () => {
    const form = entryToForm(
      { ...savedEntry, entry_setlist: [{ song_name: 'Sexoholik', position: 0, artist_id: 'z', owner: { name: 'Żabson' }, guest: { name: 'Żabson' } }] },
      { locale: 'en' }
    );
    expect(form.setlist[0]).toMatchObject({ ownerName: 'Żabson', guestName: 'Żabson' });
  });
});

describe('friends at shows', () => {
  it('saves friends by account and everyone else by name', () => {
    const form = { ...emptyForm, attendees: [{ name: 'kuba', userId: 'k' }, { name: ' Ola ', userId: null }] };
    expect(attendeeRows(form, 'e1')).toEqual([
      { entry_id: 'e1', user_id: 'k' },
      { entry_id: 'e1', guest_name: 'Ola' },
    ]);
  });

  it("copies a friend's show: shared parts kept, personal parts empty, the friend marked as there", () => {
    const theirs = {
      ...entryToForm(savedEntry, { locale: 'en' }),
      entryType: 'attended',
      rating: 9,
      description: 'best night ever',
      isFavorite: true,
      tags: ['rager'],
      visibility: 'friends',
      photos: [{ id: 'p1' }],
      coverId: 'p1',
      coArtists: ['Young Igi'],
      setlistfmId: 'sfm',
    };
    const mine = copyFromFriend(theirs, { sourceId: 'their-entry', friend: { id: 'k', username: 'kuba' } });
    expect(mine).toMatchObject({
      artist: 'Travis Scott',
      coArtists: ['Young Igi'],
      venue: 'PGE Narodowy',
      date: '2026-07-10',
      isSupport: true,
      setlistfmId: 'sfm',
      rating: null,
      description: '',
      isFavorite: false,
      tags: [],
      visibility: 'inherit',
      photos: [],
      coverId: null,
      attendees: [{ name: 'kuba', userId: 'k' }],
      copiedFrom: 'their-entry',
    });
    expect(mine.setlist.map((s) => s.name)).toEqual(theirs.setlist.map((s) => s.name));
    // New ids, so editing your copy never touches theirs.
    expect(mine.setlist[0].id).not.toBe(theirs.setlist[0].id);
  });
});
