import { normalizeSongName } from './normalize';

// Data for the Songs section, for any user — your own (/songs) or someone
// else's (/u/[username]/songs). Queries run with the *viewer's* session, so
// the database only returns entries the viewer may see: someone's
// friends-only or private concerts simply don't count toward what you see.

// Grid of every artist the user has heard live, with coverage stats.
export async function getSongsOverview(supabase, userId) {
  const { data: entries } = await supabase
    .from('concert_entries')
    .select('id, artist_id, artists(id, name, image_url, catalog_synced_at)')
    .eq('user_id', userId)
    .eq('entry_type', 'attended')
    .not('artist_id', 'is', null);

  const rows = entries ?? [];
  const artistsById = new Map();
  const entryToArtist = new Map();
  rows.forEach((e) => {
    if (e.artists) artistsById.set(e.artist_id, e.artists);
    entryToArtist.set(e.id, e.artist_id);
  });

  const entryIds = rows.map((e) => e.id);
  const { data: setlistRows } = entryIds.length
    ? await supabase.from('entry_setlist').select('entry_id, song_name').in('entry_id', entryIds)
    : { data: [] };

  const { data: exclusionRows } = await supabase
    .from('song_count_exclusions')
    .select('artist_id, song_name')
    .eq('user_id', userId);
  const excluded = new Set((exclusionRows ?? []).map((r) => `${r.artist_id}::${r.song_name}`));

  const namesByArtist = new Map();
  (setlistRows ?? []).forEach((row) => {
    const artistId = entryToArtist.get(row.entry_id);
    if (!artistId || excluded.has(`${artistId}::${row.song_name}`)) return;
    if (!namesByArtist.has(artistId)) namesByArtist.set(artistId, []);
    namesByArtist.get(artistId).push(row.song_name);
  });

  const artists = Array.from(artistsById.values());
  const artistIds = artists.map((a) => a.id);
  const { data: catalogSongs } = artistIds.length
    ? await supabase
        .from('songs')
        .select('artist_id, name')
        .in('artist_id', artistIds)
        .eq('is_feature', false)
        .not('spotify_track_id', 'is', null)
    : { data: [] };

  const catalogByArtist = new Map();
  (catalogSongs ?? []).forEach((s) => {
    if (!catalogByArtist.has(s.artist_id)) catalogByArtist.set(s.artist_id, new Set());
    catalogByArtist.get(s.artist_id).add(normalizeSongName(s.name));
  });

  return artists
    .map((artist) => {
      const names = namesByArtist.get(artist.id) ?? [];
      const distinctNormalized = new Set(names.map(normalizeSongName));
      const catalogSet = catalogByArtist.get(artist.id) ?? new Set();
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
  // Everything except the setlist depends only on the ids we already have,
  // so fetch it all at once — this renders purely from cache.
  const [{ data: artist }, { data: attendedEntries }, { data: exclusionRows }, { data: catalogSongs }, { data: albumRows }] =
    await Promise.all([
      supabase.from('artists').select('*').eq('id', artistId).maybeSingle(),
      supabase
        .from('concert_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('artist_id', artistId)
        .eq('entry_type', 'attended'),
      supabase.from('song_count_exclusions').select('song_name').eq('user_id', userId).eq('artist_id', artistId),
      supabase
        .from('songs')
        .select('id, name, album_id, spotify_track_id, is_feature, track_number')
        .eq('artist_id', artistId),
      supabase
        .from('albums')
        .select('id, name, image_url, release_date, total_tracks')
        .eq('artist_id', artistId)
        .eq('bucket', 'album')
        .order('release_date', { ascending: false }),
    ]);
  if (!artist || !attendedEntries?.length) return null;

  const entryIds = attendedEntries.map((e) => e.id);
  const { data: setlistRows } = await supabase.from('entry_setlist').select('song_name').in('entry_id', entryIds);

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
    !artist.catalog_synced_at || distinctHeardNames.some((name) => !knownNormalized.has(normalizeSongName(name)));

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
    others: others.sort((a, b) => b.count - a.count),
    needsSync,
  };
}
