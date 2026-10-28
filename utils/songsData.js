import { normalizeSongName } from './normalize';
import { fetchAll, fetchAllIn } from './fetchAll';
import { checked } from './checked';
import { songCountsFor } from './showArtists';

// Data for the Songs section, for any user — your own (/songs) or someone
// else's (/u/[username]/songs). Queries run with the *viewer's* session, so
// the database only returns entries the viewer may see: someone's
// friends-only or private concerts simply don't count toward what you see.

// Joint shows (several billed artists, see utils/showArtists.js) count for
// each of them, but each song only for the artist it belongs to — so a
// solo song of one doesn't land on the other's page, and totals elsewhere
// (Stats) never double.
const ENTRY_ARTISTS = 'id, artist_id, entry_co_artists(artist_id, position)';

function billedIdsOf(entry) {
  const rest = [...(entry.entry_co_artists ?? [])].sort((a, b) => a.position - b.position).map((c) => c.artist_id);
  return [entry.artist_id, ...rest].filter(Boolean);
}

// Normalized names of songs the sync placed on each artist's releases.
async function catalogKeys(supabase, artistIds) {
  const rows = await fetchAllIn(
    () => supabase.from('songs').select('artist_id, name, is_feature').not('spotify_track_id', 'is', null),
    'artist_id',
    artistIds
  );
  const any = new Map(); // every real song, features included
  const own = new Map(); // the artist's own releases (what % is out of)
  for (const row of rows) {
    const key = normalizeSongName(row.name);
    if (!any.has(row.artist_id)) any.set(row.artist_id, new Set());
    any.get(row.artist_id).add(key);
    if (!row.is_feature) {
      if (!own.has(row.artist_id)) own.set(row.artist_id, new Set());
      own.get(row.artist_id).add(key);
    }
  }
  return { any, own };
}

// Whether a setlist row counts for artistId, given the show's billed ids.
function creditedTo(row, artistId, billedIds, anyKeys) {
  const key = normalizeSongName(row.song_name);
  return songCountsFor(
    { ownerId: row.artist_id, inCatalog: (id) => anyKeys.get(id)?.has(key) ?? false },
    artistId,
    billedIds
  );
}

// The user's attended shows billed to artistId, and the setlist rows that
// count for that artist. Also used by the background sync, so it only looks
// up songs that are really this artist's.
export async function creditedSetlistRows(supabase, userId, artistId) {
  const all = await fetchAll(() =>
    supabase.from('concert_entries').select(ENTRY_ARTISTS).eq('user_id', userId).eq('entry_type', 'attended')
  );
  const entries = all.filter((e) => billedIdsOf(e).includes(artistId));
  const billedByEntry = new Map(entries.map((e) => [e.id, billedIdsOf(e)]));
  const rows = await fetchAllIn(
    () => supabase.from('entry_setlist').select('entry_id, song_name, artist_id'),
    'entry_id',
    entries.map((e) => e.id)
  );
  const coArtists = [...new Set(entries.flatMap(billedIdsOf))];
  const { any } = coArtists.length > 1 ? await catalogKeys(supabase, coArtists) : { any: new Map() };
  return {
    entryCount: entries.length,
    rows: rows.filter((row) => creditedTo(row, artistId, billedByEntry.get(row.entry_id), any)),
  };
}

// Grid of every artist the user has heard live, with coverage stats.
export async function getSongsOverview(supabase, userId) {
  const entries = await fetchAll(() =>
    supabase
      .from('concert_entries')
      .select(
        'id, artist_id, artists(id, name, image_url, catalog_synced_at), entry_co_artists(artist_id, position, artists(id, name, image_url, catalog_synced_at))'
      )
      .eq('user_id', userId)
      .eq('entry_type', 'attended')
      .not('artist_id', 'is', null)
  );

  const artistsById = new Map();
  const billedByEntry = new Map();
  entries.forEach((e) => {
    if (e.artists) artistsById.set(e.artist_id, e.artists);
    (e.entry_co_artists ?? []).forEach((c) => c.artists && artistsById.set(c.artist_id, c.artists));
    billedByEntry.set(e.id, billedIdsOf(e));
  });

  const setlistRows = await fetchAllIn(
    () => supabase.from('entry_setlist').select('entry_id, song_name, artist_id'),
    'entry_id',
    entries.map((e) => e.id)
  );

  const { data: exclusionRows } = checked(
    await supabase.from('song_count_exclusions').select('artist_id, song_name').eq('user_id', userId)
  );
  const excluded = new Set((exclusionRows ?? []).map((r) => `${r.artist_id}::${r.song_name}`));

  const artists = Array.from(artistsById.values());
  const { any, own } = await catalogKeys(supabase, artists.map((a) => a.id));

  const namesByArtist = new Map();
  setlistRows.forEach((row) => {
    const billed = billedByEntry.get(row.entry_id) ?? [];
    for (const artistId of billed) {
      if (excluded.has(`${artistId}::${row.song_name}`) || !creditedTo(row, artistId, billed, any)) continue;
      if (!namesByArtist.has(artistId)) namesByArtist.set(artistId, []);
      namesByArtist.get(artistId).push(row.song_name);
    }
  });

  return artists
    .map((artist) => {
      const names = namesByArtist.get(artist.id) ?? [];
      const distinctNormalized = new Set(names.map(normalizeSongName));
      const catalogSet = own.get(artist.id) ?? new Set();
      const catalogHeard = Array.from(distinctNormalized).filter((n) => catalogSet.has(n)).length;

      return {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url,
        totalHeard: names.length,
        distinctHeard: distinctNormalized.size,
        catalogTotal: catalogSet.size,
        pct: catalogSet.size > 0 ? Math.round((catalogHeard / catalogSet.size) * 100) : null,
        needsSync: !artist.catalog_synced_at,
      };
    })
    .sort((a, b) => b.totalHeard - a.totalHeard);
}

// One artist's albums/singles/features/others for the user. Returns null
// when the artist doesn't exist or the user has no (visible) attended show.
export async function getArtistSongs(supabase, userId, artistId) {
  const [{ data: artist }, credited, { data: exclusionRows }, catalogSongs, { data: albumRows }] = await Promise.all([
    supabase.from('artists').select('*').eq('id', artistId).maybeSingle().then(checked),
    creditedSetlistRows(supabase, userId, artistId),
    supabase.from('song_count_exclusions').select('song_name').eq('user_id', userId).eq('artist_id', artistId).then(checked),
    fetchAll(() =>
      supabase
        .from('songs')
        .select('id, name, album_id, spotify_track_id, is_feature, track_number')
        .eq('artist_id', artistId)
    ),
    supabase
      .from('albums')
      .select('id, name, image_url, release_date, total_tracks')
      .eq('artist_id', artistId)
      .eq('bucket', 'album')
      .order('release_date', { ascending: false })
      .then(checked),
  ]);
  if (!artist || !credited.entryCount) return null;
  const setlistRows = credited.rows;

  const excludedNames = new Set((exclusionRows ?? []).map((r) => r.song_name));

  const heardNamesRaw = (setlistRows ?? []).map((r) => r.song_name);
  const heardCounts = new Map(); // normalized -> { count, rawName, excluded }
  heardNamesRaw.forEach((raw) => {
    const key = normalizeSongName(raw);
    if (!heardCounts.has(key)) heardCounts.set(key, { count: 0, rawName: raw, excluded: excludedNames.has(raw) });
    heardCounts.get(key).count += 1;
  });

  // No blocking sync here — ArtistSongsView kicks off the sync (+ per-song
  // resolution) in the background and refreshes once it's done.
  const distinctHeardNames = Array.from(new Set(heardNamesRaw));
  const knownNormalized = new Set((catalogSongs ?? []).map((s) => normalizeSongName(s.name)));
  const needsSync =
    !artist.catalog_synced_at ||
    !artist.groups_checked_at ||
    distinctHeardNames.some((name) => !knownNormalized.has(normalizeSongName(name)));

  const songsByAlbum = new Map();
  const singles = [];
  const features = [];
  const matchedNormalized = new Set();

  (catalogSongs ?? []).forEach((song) => {
    const key = normalizeSongName(song.name);
    const heard = heardCounts.get(key);
    const entry = {
      name: song.name,
      heard: !!heard,
      count: heard?.count ?? 0,
      trackNumber: song.track_number,
    };
    // Only songs placed in a real bucket count as matched. Rows the sync
    // saved as "looked up, not on Spotify" (no album, no track id) are
    // placeholders — those heard songs belong in Others.
    if (song.album_id) {
      if (!songsByAlbum.has(song.album_id)) songsByAlbum.set(song.album_id, []);
      songsByAlbum.get(song.album_id).push(entry);
      if (heard) matchedNormalized.add(key);
    } else if (song.is_feature) {
      if (heard) {
        features.push(entry);
        matchedNormalized.add(key);
      }
    } else if (song.spotify_track_id) {
      if (heard) {
        singles.push(entry);
        matchedNormalized.add(key);
      }
    }
  });

  // Bands the artist is in (Quavo → Migos): heard songs that aren't the
  // artist's own but are in a band's catalog go under that band.
  const { data: groupLinks } = checked(
    await supabase.from('artist_groups').select('group_id').eq('artist_id', artistId)
  );
  const groupIds = (groupLinks ?? []).map((g) => g.group_id);
  const groups = [];
  if (groupIds.length) {
    const unmatched = [...heardCounts.keys()].filter((key) => !matchedNormalized.has(key));
    const [{ data: groupArtists }, groupSongs] = await Promise.all([
      supabase.from('artists').select('id, name, image_url').in('id', groupIds),
      unmatched.length
        ? fetchAllIn(() => supabase.from('songs').select('artist_id, name').not('spotify_track_id', 'is', null), 'artist_id', groupIds)
        : [],
    ]);
    const byGroup = new Map((groupArtists ?? []).map((g) => [g.id, { id: g.id, name: g.name, imageUrl: g.image_url, songs: [] }]));
    const unmatchedSet = new Set(unmatched);
    for (const song of groupSongs ?? []) {
      const key = normalizeSongName(song.name);
      if (!unmatchedSet.has(key)) continue;
      unmatchedSet.delete(key); // first band to claim a song keeps it
      matchedNormalized.add(key);
      const heard = heardCounts.get(key);
      byGroup.get(song.artist_id)?.songs.push({ name: heard.rawName, heard: true, count: heard.count });
    }
    for (const group of byGroup.values()) {
      if (group.songs.length) groups.push({ ...group, songs: group.songs.sort((a, b) => b.count - a.count) });
    }
  }

  const others = Array.from(heardCounts.entries())
    .filter(([key]) => !matchedNormalized.has(key))
    .map(([, v]) => ({ name: v.rawName, count: v.count, excluded: v.excluded }));

  const albums = (albumRows ?? []).map((album) => ({
    id: album.id,
    name: album.name,
    imageUrl: album.image_url,
    releaseDate: album.release_date,
    songs: (songsByAlbum.get(album.id) ?? []).sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0)),
  }));

  return {
    artist: { id: artist.id, name: artist.name, imageUrl: artist.image_url },
    albums,
    singles: singles.sort((a, b) => b.count - a.count),
    features: features.sort((a, b) => b.count - a.count),
    bands: groups,
    others: others.sort((a, b) => b.count - a.count),
    needsSync,
    // No discography yet (first sync pending, or Spotify unavailable):
    // everything heard sits in Others until it arrives.
    catalogMissing: !artist.catalog_synced_at,
  };
}
