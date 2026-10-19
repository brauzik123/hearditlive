import {
  ensureArtistImage,
  getArtistReleases,
  getAlbumTracks,
  searchTracks,
  bestImage,
  mapLimit,
  spotifyBlockedUntil,
  blockSpotify,
  SpotifyRateLimitError,
} from './spotify';
import { normalizeSongName } from './normalize';

export { normalizeSongName };

const SYNC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Spotify files EPs under album_type "single"; anything this long gets its
// own tile like an album (Spotify's own EP threshold).
const EP_MIN_TRACKS = 4;
const MAX_SONG_LOOKUPS_PER_SYNC = 50;

function isTile(release) {
  return release.album_type === 'album' || release.total_tracks >= EP_MIN_TRACKS;
}

// "Half Blood" and "Half Blood (BloodLuxe)", or clean/explicit duplicates,
// share an edition key — only the most complete edition is kept.
function editionKey(release) {
  const base = release.name.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').replace(/\s+-\s+[^-]*$/, '');
  return `${isTile(release) ? 'tile' : 'single'}::${normalizeSongName(base)}`;
}

// Live albums re-release songs that belong to studio albums ("Live at
// Kilmainham Gaol"), so they'd steal those songs from their real home.
const LIVE_RELEASE = /(^|\s|\(|\[|-\s*)live(\s+(at|from|in|on)\b|\s*[)\]]|$)/i;

function pickEditions(allReleases) {
  const releases = allReleases.filter((r) => !LIVE_RELEASE.test(r.name));
  const byKey = new Map();
  releases.forEach((release) => {
    const key = editionKey(release);
    const current = byKey.get(key);
    if (!current || release.total_tracks > current.total_tracks) byKey.set(key, release);
  });
  // Albums first, then EPs, then singles, and oldest first within each:
  // when a song appears on several releases, the first one claims it — so
  // it stays with the album it originally came out on, not a later
  // deluxe/expanded reissue under a different title.
  const rank = (r) => (r.album_type === 'album' ? 0 : isTile(r) ? 1 : 2);
  return [...byKey.values()].sort(
    (a, b) => rank(a) - rank(b) || (a.release_date ?? '').localeCompare(b.release_date ?? '')
  );
}

function toDate(releaseDate) {
  if (!releaseDate) return null;
  const parts = releaseDate.split('-');
  if (parts.length === 1) return `${parts[0]}-01-01`;
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`;
  return releaseDate;
}

// A claim older than this is assumed abandoned (crashed/timed-out request).
const SYNC_CLAIM_TTL_MS = 2 * 60 * 1000;
// After a failed sync: wait 10 min, then 1 h, then 6 h, capped at 1 day.
function backoffMs(failCount) {
  return Math.min(10 * 60 * 1000 * 6 ** Math.max(failCount - 1, 0), 24 * 60 * 60 * 1000);
}

export function isInBackoff(artist) {
  return (
    !!artist.sync_failed_at &&
    Date.now() - new Date(artist.sync_failed_at).getTime() < backoffMs(artist.sync_fail_count)
  );
}

async function recordFailure(supabase, artist) {
  await supabase
    .from('artists')
    .update({
      sync_started_at: null,
      sync_failed_at: new Date().toISOString(),
      sync_fail_count: (artist.sync_fail_count ?? 0) + 1,
    })
    .eq('id', artist.id);
}

export async function ensureArtistSynced(supabase, artist) {
  const syncedRecently =
    artist.catalog_synced_at && Date.now() - new Date(artist.catalog_synced_at).getTime() < SYNC_MAX_AGE_MS;
  if (syncedRecently) return artist;
  if (isInBackoff(artist)) return artist;
  // Spotify has the whole app paused: wait it out without calling it.
  if (await spotifyBlockedUntil(supabase)) return artist;

  // Atomically claim the sync; if another request holds a live claim, let
  // it do the work instead of syncing the same artist twice.
  const staleBefore = new Date(Date.now() - SYNC_CLAIM_TTL_MS).toISOString();
  const { data: claimed } = await supabase
    .from('artists')
    .update({ sync_started_at: new Date().toISOString() })
    .eq('id', artist.id)
    .or(`sync_started_at.is.null,sync_started_at.lt.${staleBefore}`)
    .select('id');
  if (!claimed?.length) return artist;

  try {
    const synced = await syncCatalog(supabase, artist);
    await supabase
      .from('artists')
      .update({ sync_started_at: null, sync_failed_at: null, sync_fail_count: 0 })
      .eq('id', artist.id);
    return synced;
  } catch (err) {
    // A rate limit is about the app, not this artist: pause everything
    // until Spotify says so, and let this artist retry right after.
    if (err instanceof SpotifyRateLimitError) {
      await blockSpotify(supabase, err.retryAfterSeconds);
      await supabase.from('artists').update({ sync_started_at: null }).eq('id', artist.id);
      return artist;
    }
    await recordFailure(supabase, artist);
    throw err;
  }
}

async function syncCatalog(supabase, artist) {
  const resolved = await ensureArtistImage(supabase, artist);
  const releases = resolved.spotify_id ? pickEditions(await getArtistReleases(resolved.spotify_id)) : [];

  // One-track singles need no extra request: the release is the song.
  const tracklists = await mapLimit(releases, 5, (release) =>
    release.total_tracks > 1 ? getAlbumTracks(release.id) : [{ id: release.id, name: release.name }]
  );

  const albums = [];
  const songs = [];
  const seen = new Set();
  releases.forEach((release, i) => {
    const tile = isTile(release);
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
      const key = normalizeSongName(track.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      songs.push({
        name: track.name,
        spotify_track_id: track.id,
        spotify_album_id: tile ? release.id : null,
        track_number: position + 1,
        is_feature: false,
      });
    });
  });

  const { error } = await supabase.rpc('replace_artist_catalog', {
    p_artist_id: artist.id,
    p_albums: albums,
    p_songs: songs,
  });
  if (error) throw new Error(`Catalog save failed: ${error.message}`);
  return { ...resolved, catalog_synced_at: new Date().toISOString() };
}

// Heard songs that didn't match the artist's own releases by name: a
// Spotify track search classifies each as a release we don't tile (e.g. a
// compilation track — goes to Singles), a guest feature on someone else's
// release, or (no match) "Others".
export async function resolveHeardSongsForArtist(supabase, artist, heardNames) {
  const { data: existingSongs } = await supabase.from('songs').select('name').eq('artist_id', artist.id);
  const known = new Set((existingSongs ?? []).map((s) => normalizeSongName(s.name)));

  const unmatched = [];
  heardNames.forEach((name) => {
    const key = normalizeSongName(name);
    if (known.has(key)) return;
    known.add(key);
    unmatched.push(name);
  });
  if (!unmatched.length) return;

  if (artist.spotify_id && (await spotifyBlockedUntil(supabase))) return;

  // Bounded per sync, so a setlist full of made-up names can't fan out into
  // hundreds of Spotify searches at once; the rest resolve on later visits.
  const batch = unmatched.slice(0, MAX_SONG_LOOKUPS_PER_SYNC);
  let aborted = false;
  let rateLimit = null;
  const results = await mapLimit(batch, 4, async (name) => {
    const base = { artist_id: artist.id, name, album_id: null, spotify_track_id: null, is_feature: false };
    if (!artist.spotify_id) return base;
    if (aborted) return null;

    let candidates = [];
    try {
      candidates = await searchTracks(name, artist.name);
    } catch (err) {
      // A failed lookup (e.g. rate limit) isn't evidence the song is
      // unknown: skip it rather than file it under Others for good, and
      // stop issuing further searches this round.
      aborted = true;
      if (err instanceof SpotifyRateLimitError) rateLimit = err;
      return null;
    }
    const target = normalizeSongName(name);
    const hit = candidates.find(
      (t) => normalizeSongName(t.name) === target && t.artists.some((a) => a.id === artist.spotify_id)
    );
    if (!hit) return base;

    const ownRelease = hit.album.artists.some((a) => a.id === artist.spotify_id);
    return { ...base, spotify_track_id: hit.id, is_feature: !ownRelease };
  });

  // Two heard names can resolve to the same track; the second becomes an
  // unmatched row instead of tripping the (artist_id, spotify_track_id) index.
  if (rateLimit) {
    await blockSpotify(supabase, rateLimit.retryAfterSeconds);
  } else if (aborted) {
    await recordFailure(supabase, artist);
  } else if (artist.sync_fail_count) {
    await supabase.from('artists').update({ sync_failed_at: null, sync_fail_count: 0 }).eq('id', artist.id);
  }
  const rows = results.filter(Boolean);
  if (!rows.length) return;
  const usedTrackIds = new Set();
  const deduped = rows.map((row) => {
    if (!row.spotify_track_id) return row;
    if (usedTrackIds.has(row.spotify_track_id)) return { ...row, spotify_track_id: null, is_feature: false };
    usedTrackIds.add(row.spotify_track_id);
    return row;
  });

  const { error } = await supabase
    .from('songs')
    .upsert(deduped, { onConflict: 'artist_id,name', ignoreDuplicates: true });
  if (error) console.error('heard songs upsert failed:', error.message);
}
