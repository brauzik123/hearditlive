import {
  ensureArtistImage,
  getArtistReleases,
  getReleaseCount,
  getAlbumTracks,
  searchTracks,
  mapLimit,
  spotifyBlockedUntil,
  blockSpotify,
  SpotifyRateLimitError,
} from './spotify';
import { normalizeSongName } from './normalize';
import { fetchAll } from './fetchAll';
import {
  buildCatalog,
  classifyHeardTrack,
  creditedName,
  bestEdition,
  preferPlainTracks,
  variantShare,
  officialSpelling,
  orderReleases,
  pickEditions,
} from './releases';
import { findArtistMbid, getBandMemberships } from './musicbrainz';
import { refreshPlan } from './catalogRefresh';

export { normalizeSongName };

const MAX_SONG_LOOKUPS_PER_SYNC = 50;

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
  // Full download, a one-request "anything new?" check, or nothing (see
  // utils/catalogRefresh.js).
  const plan = refreshPlan(artist);
  if (plan === 'skip') return artist;
  if (isInBackoff(artist)) return artist;
  // Spotify has the whole app paused: wait it out without calling it.
  if (await spotifyBlockedUntil(supabase)) return artist;

  if (plan === 'light' && artist.spotify_id) {
    try {
      const count = await getReleaseCount(artist.spotify_id);
      if (count === artist.releases_total) {
        const checkedAt = new Date().toISOString();
        await supabase.from('artists').update({ catalog_checked_at: checkedAt }).eq('id', artist.id);
        return { ...artist, catalog_checked_at: checkedAt };
      }
      // A different count: something came out (or was removed). Full sync.
    } catch (err) {
      if (err instanceof SpotifyRateLimitError) await blockSpotify(supabase, err.retryAfterSeconds);
      return artist;
    }
  }

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
  const fetched = resolved.spotify_id ? await getArtistReleases(resolved.spotify_id) : { items: [], total: null };
  const all = pickEditions(fetched.items);
  const releases = orderReleases(all, resolved.spotify_id);

  // One-track singles need no extra request: the release is the song.
  const tracksOf = (release) =>
    release.total_tracks > 1 ? getAlbumTracks(release.id) : [{ id: release.id, name: release.name }];
  const tracklists = await mapLimit(releases, 5, tracksOf);

  // An edition padded with chopped/slowed/instrumental copies of its own
  // songs ("HEROES & VILLAINS (Villains Version)") is compared with the
  // album's other editions, and the one with the most real songs, then the
  // shortest, is kept. Only albums like that cost the extra fetches.
  for (let i = 0; i < releases.length; i++) {
    const alternates = releases[i].alternates ?? [];
    if (alternates.length && variantShare(tracklists[i]) >= 0.25) {
      const candidates = [{ release: releases[i], tracks: tracklists[i] }];
      for (const alt of alternates) candidates.push({ release: alt, tracks: await tracksOf(alt) });
      const best = bestEdition(candidates);
      releases[i] = best.release;
      tracklists[i] = best.tracks;
    }
    tracklists[i] = preferPlainTracks(tracklists[i]);
  }
  const { albums, songs } = buildCatalog(releases, tracklists, resolved.spotify_id);

  const { error } = await supabase.rpc('replace_artist_catalog', {
    p_artist_id: artist.id,
    p_albums: albums,
    p_songs: songs,
  });
  if (error) throw new Error(`Catalog save failed: ${error.message}`);

  // "bts" as typed becomes "BTS" as Spotify credits it (spelling only).
  const official = officialSpelling(resolved.name, creditedName(all, resolved.spotify_id));
  if (official) await supabase.from('artists').update({ name: official }).eq('id', artist.id);

  // Remembered for the cheap monthly check. Best effort: before migration
  // 0025 the columns don't exist, and the next refresh is simply a full one.
  await supabase
    .from('artists')
    .update({ releases_total: fetched.total, catalog_checked_at: new Date().toISOString() })
    .eq('id', artist.id);

  return { ...resolved, ...(official ? { name: official } : {}), catalog_synced_at: new Date().toISOString() };
}

// Heard songs that didn't match the artist's own releases by name: a
// Spotify track search classifies each as a release we don't tile (e.g. a
// compilation track — goes to Singles), a guest feature on someone else's
// release, or (no match) "Others".
export async function resolveHeardSongsForArtist(supabase, artist, heardNames) {
  const existingSongs = await fetchAll(() => supabase.from('songs').select('name').eq('artist_id', artist.id));
  const known = new Set(existingSongs.map((s) => normalizeSongName(s.name)));

  const unmatched = [];
  heardNames.forEach((name) => {
    const key = normalizeSongName(name);
    if (known.has(key)) return;
    known.add(key);
    unmatched.push(name);
  });
  if (!unmatched.length) return;

  if (artist.spotify_id && (await spotifyBlockedUntil(supabase))) return;

  // Bands the artist is in (see ensureArtistGroups): a heard song found on a
  // band's release is filed under that band, not as the artist's feature.
  const { data: groupLinks } = await supabase
    .from('artist_groups')
    .select('artists!artist_groups_group_id_fkey(id, name, spotify_id)')
    .eq('artist_id', artist.id);
  const bands = (groupLinks ?? []).map((g) => g.artists).filter(Boolean);
  const bandRows = [];

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

    const { kind, band } = classifyHeardTrack(hit, artist.spotify_id, bands);
    if (kind === 'band') {
      // The artist keeps a placeholder (so it isn't searched again); the
      // song itself goes on the band, where the Songs page looks for it.
      bandRows.push({ artist_id: band.id, name: hit.name, album_id: null, spotify_track_id: hit.id, is_feature: false });
      return base;
    }
    return { ...base, spotify_track_id: hit.id, is_feature: kind === 'feature' };
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

  // One at a time: a band whose full catalog is already stored may have the
  // track under another title, which would fail a batch on its unique index.
  for (const row of bandRows) {
    await supabase.from('songs').upsert(row, { onConflict: 'artist_id,name', ignoreDuplicates: true });
  }
}

const GROUPS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Looks up which bands the artist is in (MusicBrainz, no Spotify calls),
// makes sure each band exists as an artist, and records the membership.
// Band catalogs aren't downloaded: the track search for each unmatched heard
// song already says whose release it's on, and a band's songs are filed
// under the band then (resolveHeardSongsForArtist). Checked once per 30 days per artist; failures
// just mean no band tiles until the next check.
export async function ensureArtistGroups(supabase, artist) {
  const fresh =
    artist.groups_checked_at && Date.now() - new Date(artist.groups_checked_at).getTime() < GROUPS_MAX_AGE_MS;
  if (fresh) return;

  try {
    let mbid = artist.setlistfm_mbid;
    if (!mbid) {
      mbid = await findArtistMbid(artist.name);
      if (mbid) await supabase.from('artists').update({ setlistfm_mbid: mbid }).eq('id', artist.id);
    }
    const bands = mbid ? await getBandMemberships(mbid) : [];

    for (const band of bands) {
      let { data: row } = await supabase.from('artists').select('*').eq('setlistfm_mbid', band.mbid).maybeSingle();
      if (!row) {
        const { data: byName } = await supabase
          .from('artists')
          .select('*')
          .ilike('name', band.name.replace(/[\\%_]/g, (c) => `\\${c}`))
          .limit(1)
          .maybeSingle();
        row = byName;
      }
      if (!row) {
        const { data: created, error } = await supabase
          .from('artists')
          .insert({ name: band.name, setlistfm_mbid: band.mbid })
          .select('*')
          .single();
        if (error) continue;
        row = created;
      }
      if (row.id === artist.id) continue;
      await supabase.from('artist_groups').upsert({ artist_id: artist.id, group_id: row.id });
    }
  } catch (err) {
    console.error('band lookup failed:', err.message);
  }
  await supabase.from('artists').update({ groups_checked_at: new Date().toISOString() }).eq('id', artist.id);
}
