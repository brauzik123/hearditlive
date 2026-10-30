import { bestImage } from './spotify';
import { normalizeSongName, sameArtistName } from './normalize';

// Turning an artist's Spotify releases into the Songs catalog: which
// releases to keep, which get an album tile, and which song lands where.
// Pure functions, no network — catalogSync.js fetches, these decide.

// Spotify files EPs under album_type "single"; anything this long gets its
// own tile like an album (Spotify's own EP threshold).
const EP_MIN_TRACKS = 4;

export function isTile(release) {
  return release.album_type === 'album' || release.total_tracks >= EP_MIN_TRACKS;
}

// "Half Blood" and "Half Blood (BloodLuxe)", or clean/explicit duplicates,
// share an edition key — only the most complete edition is kept.
export function editionKey(release) {
  const base = release.name.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').replace(/\s+-\s+[^-]*$/, '');
  return `${isTile(release) ? 'tile' : 'single'}::${normalizeSongName(base)}`;
}

// Live albums re-release songs that belong to studio albums ("Live at
// Kilmainham Gaol"), so they'd steal those songs from their real home.
export const LIVE_RELEASE = /(^|\s|\(|\[|-\s*)live(\s+(at|from|in|on)\b|\s*[)\]]|$)/i;

// Whole albums re-released as a sound treatment: chopped & screwed
// ("HEROES & VILLAINS [ChoppedNotSlopped]"), slowed, sped up, instrumental,
// a cappella. Same songs, so they'd crowd out the original edition.
export const VARIANT_RELEASE = /\b(chopped|screwed|slowed|sped[\s-]?up|instrumentals?|a[\s-]?cappella|acapella)/i;

export function pickEditions(allReleases) {
  // Only albums and EPs are dropped as variants: a remix single someone else
  // put out ("Congratulations (Remix)") is still a real guest appearance.
  const releases = allReleases.filter((r) => !LIVE_RELEASE.test(r.name) && !(isTile(r) && VARIANT_RELEASE.test(r.name)));
  // Per album, the most complete edition wins; the others stay attached as
  // `alternates` (most tracks first) in case its tracklist turns out to be a
  // chopped/slowed version under a plain name (see isVariantTracklist).
  const byKey = new Map();
  releases.forEach((release) => {
    const key = editionKey(release);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(release);
  });
  const picked = [...byKey.values()].map((editions) => {
    const [best, ...alternates] = [...editions].sort((a, b) => b.total_tracks - a.total_tracks);
    return { ...best, alternates };
  });
  // Albums first, then EPs, then singles, and oldest first within each:
  // when a song appears on several releases, the first one claims it — so
  // it stays with the album it originally came out on, not a later
  // deluxe/expanded reissue under a different title.
  const rank = (r) => (r.album_type === 'album' ? 0 : isTile(r) ? 1 : 2);
  return picked.sort(
    (a, b) => rank(a) - rank(b) || (a.release_date ?? '').localeCompare(b.release_date ?? '')
  );
}

// A tracklist that's mostly chopped & screwed / slowed / sped-up versions
// ("Raindrops (Insane) - ChoppedNotSlopped"), as on "HEROES & VILLAINS
// (Villains Version)", whose name doesn't say so.
const VARIANT_TRACK = /([-–—(\[]\s*)(chopped|screwed|slowed|sped[\s-]?up)/i;
export function isVariantTracklist(tracks) {
  if (!tracks?.length) return false;
  return tracks.filter((t) => VARIANT_TRACK.test(t.name)).length > tracks.length / 2;
}

// Spotify release dates can be just a year or a year and month.
export function toDate(releaseDate) {
  if (!releaseDate) return null;
  const parts = releaseDate.split('-');
  if (parts.length === 1) return `${parts[0]}-01-01`;
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`;
  return releaseDate;
}

// Spotify lists every release the artist is credited on as a main artist,
// including other people's singles ("Congratulations (Remix)" by Post
// Malone shows up under Quavo). Releases where they're the first credit are
// their own, and so are albums credited to several artists jointly
// ("Amfisbena" by Żabson & Young Igi); other singles are guest appearances.
export function isOwnRelease(release, spotifyId) {
  const artists = release.artists ?? [];
  if (artists[0]?.id === spotifyId) return true;
  return release.album_type === 'album' && artists.some((a) => a.id === spotifyId);
}

// Own releases first, so a song lands on the artist's own release when it
// appears on both.
export function orderReleases(releases, spotifyId) {
  return [
    ...releases.filter((r) => isOwnRelease(r, spotifyId)),
    ...releases.filter((r) => !isOwnRelease(r, spotifyId)),
  ];
}

// `releases` in claim order (see orderReleases) and their tracklists at the
// same index. Returns the rows replace_artist_catalog saves.
export function buildCatalog(releases, tracklists, spotifyId) {
  const albums = [];
  const songs = [];
  const seen = new Set();
  releases.forEach((release, i) => {
    const own = isOwnRelease(release, spotifyId);
    const tile = own && isTile(release);
    if (tile) {
      albums.push({
        spotify_album_id: release.id,
        name: release.name,
        release_date: toDate(release.release_date),
        image_url: bestImage(release.images),
        total_tracks: release.total_tracks,
      });
    }
    tracklists[i].forEach((track, position) => {
      // On someone else's multi-track release, only the songs this artist
      // is actually on count (a one-track single carries no artist list).
      if (!own && track.artists && !track.artists.some((a) => a.id === spotifyId)) return;
      const key = normalizeSongName(track.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      songs.push({
        name: track.name,
        spotify_track_id: track.id,
        spotify_album_id: tile ? release.id : null,
        track_number: position + 1,
        is_feature: !own,
      });
    });
  });
  return { albums, songs };
}

// Spotify's spelling of an artist name ("BTS", "J. Cole"), but only when it's
// the same name as typed apart from capitals and spacing — never a
// different name, so a wrong Spotify match can't rename an artist.
export function officialSpelling(typed, spotifyName) {
  const simplify = (s) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!spotifyName || spotifyName === typed) return null;
  return simplify(typed) === simplify(spotifyName) ? spotifyName : null;
}

// The artist's own name as Spotify credits it on their releases.
export function creditedName(releases, spotifyId) {
  return releases.find((r) => isOwnRelease(r, spotifyId))?.artists[0].name ?? null;
}

// What a heard song found by a Spotify track search is to this artist:
// 'own' (on the artist's own release), 'band' (on a release by one of the
// bands they're in, matched by Spotify id or name, since bands come from
// MusicBrainz and may not be linked to Spotify), or 'feature' (someone
// else's release they're on). bands: [{ id, name, spotify_id }].
export function classifyHeardTrack(track, spotifyId, bands = []) {
  const releaseArtists = track.album?.artists ?? [];
  if (releaseArtists.some((a) => a.id === spotifyId)) return { kind: 'own' };
  const band = bands.find((b) =>
    releaseArtists.some((a) => (b.spotify_id && a.id === b.spotify_id) || sameArtistName(a.name, b.name))
  );
  return band ? { kind: 'band', band } : { kind: 'feature' };
}
