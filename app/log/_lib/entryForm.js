import { newId } from '../../../utils/id';
import { cityName } from '../../../utils/placeNames';
import { sameArtistName } from '../../../utils/normalize';
import { billedArtists, splitJointAct } from '../../../utils/showArtists';

// The log form's state and how it maps to and from the database. No React
// and no network here, so it's all unit-tested (entryForm.test.js).

export const STEPS = ['basics', 'details', 'media', 'people'];
export const MAX_PHOTOS = 8;
export const TICKET_STATUSES = ['bought', 'not_yet', 'interested'];

export const emptyForm = {
  entryType: 'attended',
  artist: '',
  coArtists: [], // other billed artists of a joint show, in order
  venue: '',
  city: '',
  cityGeonameId: null, // GeoNames id once a city is picked or imported
  setlistfmVenueId: null, // setlist.fm venue id from an import
  date: '',
  tourName: '',
  isFestival: false,
  festivalName: '',
  ticketStatus: 'not_yet',
  rating: null, // optional: null = not rated
  isSupport: false,
  description: '',
  isFavorite: false,
  photos: [], // { id, url (stored path) | blob (new), previewUrl, caption }
  coverId: null, // id of the photo used as the cover, or null for none
  setlist: [],
  attendees: [],
  tags: [],
  visibility: 'inherit',
  setlistfmId: null,
  setlistfmUrl: null,
};

// Columns and relations entryToForm needs.
export const ENTRY_FORM_SELECT = `*, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name)), venues(name, city, city_id, setlistfm_id, cities(name_en, name_pl)), festivals(name),
  entry_photos(id, url, caption, position, is_cover),
  entry_setlist(song_name, position, is_encore, is_cover, cover_original_artist, artist_id, guest_artist_id,
    owner:artists!entry_setlist_artist_id_fkey(name), guest:artists!entry_setlist_guest_artist_id_fkey(name)),
  entry_attendees(guest_name),
  entry_tags(tags(name))`;

// ilike treats _ and % as wildcards; escape them for exact name matches.
export const exact = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// setlist.fm dates arrive as dd-MM-yyyy.
export function setlistfmDateToIso(value) {
  const [day, month, year] = (value ?? '').split('-');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

// A saved entry, as loaded for editing. `went` comes from Home's "Were you
// there?": the planned show becomes an attended one.
export function entryToForm(entry, { locale, went = false }) {
  const photos = [...(entry.entry_photos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, url: p.url, caption: p.caption ?? '', blob: null, previewUrl: null, isCover: p.is_cover }));

  const billed = billedArtists(entry);
  const nameOf = (artistId) => billed.find((a) => a.id === artistId)?.name ?? null;

  return {
    entryType: went ? 'attended' : entry.entry_type,
    artist: entry.artists?.name ?? '',
    coArtists: billed.slice(1).map((a) => a.name),
    venue: entry.venues?.name ?? '',
    city: entry.venues ? cityName(entry.venues, locale) : '',
    cityGeonameId: entry.venues?.city_id ?? null,
    setlistfmVenueId: entry.venues?.setlistfm_id ?? null,
    date: entry.event_date ?? '',
    tourName: entry.tour_name ?? '',
    isFestival: !!entry.festivals,
    festivalName: entry.festivals?.name ?? '',
    ticketStatus: TICKET_STATUSES.includes(entry.ticket_status) ? entry.ticket_status : 'not_yet',
    rating: entry.rating != null ? Number(entry.rating) : null,
    isSupport: !!entry.is_support,
    description: entry.description ?? '',
    isFavorite: !!entry.is_favorite,
    photos,
    coverId: photos.find((p) => p.isCover)?.id ?? null,
    setlist: [...(entry.entry_setlist ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: newId(),
        name: s.song_name,
        isEncore: !!s.is_encore,
        isCover: !!s.is_cover,
        coverOriginalArtist: s.cover_original_artist ?? null,
        ownerName: s.owner?.name ?? (s.artist_id ? nameOf(s.artist_id) : null),
        guestName: s.guest?.name ?? null,
      })),
    attendees: (entry.entry_attendees ?? []).map((a) => a.guest_name).filter(Boolean),
    tags: (entry.entry_tags ?? []).map((tag) => tag.tags?.name).filter(Boolean),
    visibility: entry.visibility ?? 'inherit',
    setlistfmId: entry.setlistfm_id ?? null,
    setlistfmUrl: entry.setlistfm_url ?? null,
  };
}

// A setlist.fm search result, applied to the form. The chosen setlist is
// the source of truth for the show's details: it overrides what was typed
// rather than leave e.g. a London venue on a Paris setlist.
//
// setlist.fm marks a song by someone else as a "cover". On a joint act
// ("Tezzus & diamond*") that's just whose song it is, not a cover: the act
// is split into its artists and each song remembers its owner.
export function applySetlistfm(form, setlist) {
  const owners = setlist.sets.flatMap((set) => set.songs.map((song) => song.coverOriginalArtist).filter(Boolean));
  const parts = setlist.artistName ? splitJointAct(setlist.artistName, owners) : [];
  const billed = parts.length > 1 ? parts : [form.artist, ...form.coArtists].filter((name) => name.trim());
  const billedMatch = (name) => (name ? billed.find((b) => sameArtistName(b, name)) ?? null : null);

  const songs = setlist.sets.flatMap((set) =>
    set.songs.map((song) => {
      const guest = song.withArtist ?? null;
      // A guest playing their own song: it's theirs, not a cover.
      const guestsOwn = guest && sameArtistName(song.coverOriginalArtist, guest) ? guest : null;
      const owner = (billed.length > 1 ? billedMatch(song.coverOriginalArtist) : null) ?? guestsOwn;
      return {
        id: newId(),
        name: song.name,
        isEncore: set.isEncore,
        isCover: song.isCover && !owner,
        coverOriginalArtist: owner ? null : song.coverOriginalArtist,
        ownerName: owner,
        guestName: guest,
      };
    })
  );
  return {
    ...(parts.length > 1 ? { artist: parts[0], coArtists: parts.slice(1) } : {}),
    setlist: songs,
    setlistfmId: setlist.id,
    setlistfmUrl: setlist.url,
    tourName: setlist.tourName || form.tourName,
    venue: setlist.venueName || form.venue,
    city: setlist.city || form.city,
    cityGeonameId: setlist.cityGeonameId ?? form.cityGeonameId,
    setlistfmVenueId: setlist.venueId ?? null,
    date: setlistfmDateToIso(setlist.eventDate) ?? form.date,
  };
}

// The concert_entries row. Ratings only exist for attended shows, ticket
// status only for planned ones.
export function entryPayload(form, { userId, artistId, venueId, festivalId }) {
  return {
    user_id: userId,
    entry_type: form.entryType,
    artist_id: artistId,
    venue_id: venueId,
    festival_id: festivalId,
    event_date: form.date || null,
    tour_name: form.tourName.trim() || null,
    rating: form.entryType === 'attended' ? form.rating : null,
    description: form.description.trim() || null,
    ticket_status: form.entryType === 'planned' ? form.ticketStatus : null,
    is_favorite: form.isFavorite,
    is_support: form.isSupport,
    visibility: form.visibility,
    setlistfm_id: form.setlistfmId,
    setlistfm_url: form.setlistfmUrl,
  };
}

// Artists named on setlist lines (owners and guests) who aren't billed.
export function setlistArtistNames(form) {
  const billed = billedNames(form);
  const names = [];
  for (const song of form.setlist) {
    for (const name of [song.ownerName, song.guestName].map((n) => n?.trim()).filter(Boolean)) {
      if (![...billed, ...names].some((n) => sameArtistName(n, name))) names.push(name);
    }
  }
  return names;
}

// The show's billed artist names, first-billed first, blanks and repeats dropped.
export function billedNames(form) {
  const names = [];
  for (const name of [form.artist, ...form.coArtists].map((n) => n.trim()).filter(Boolean)) {
    if (!names.some((n) => sameArtistName(n, name))) names.push(name);
  }
  return names;
}

// Cover first, then the rest in the order shown.
export function photosInSaveOrder(form) {
  return [...form.photos.filter((p) => p.id === form.coverId), ...form.photos.filter((p) => p.id !== form.coverId)];
}

// entry_setlist rows; blank song lines are dropped. artistIdFor(name) maps a
// song's owner or guest to the artist's id.
export function setlistRows(form, entryId, artistIdFor = () => null) {
  return form.setlist
    .filter((s) => s.name.trim())
    .map((s, i) => ({
      entry_id: entryId,
      song_name: s.name.trim(),
      position: i,
      is_encore: !!s.isEncore,
      is_cover: !!s.isCover,
      cover_original_artist: s.coverOriginalArtist || null,
      artist_id: s.ownerName ? artistIdFor(s.ownerName) : null,
      guest_artist_id: s.guestName?.trim() ? artistIdFor(s.guestName.trim()) : null,
    }));
}
