import { createClient } from '../../utils/supabase/server';
import { normalizeSongName } from '../../utils/normalize';
import SongsGrid from '../../components/SongsGrid';

export default async function SongsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from('concert_entries')
    .select('id, artist_id, artists(id, name, image_url, catalog_synced_at)')
    .eq('user_id', user.id)
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
    .eq('user_id', user.id);
  const excluded = new Set((exclusionRows ?? []).map((r) => `${r.artist_id}::${r.song_name}`));

  const namesByArtist = new Map();
  (setlistRows ?? []).forEach((row) => {
    const artistId = entryToArtist.get(row.entry_id);
    if (!artistId || excluded.has(`${artistId}::${row.song_name}`)) return;
    if (!namesByArtist.has(artistId)) namesByArtist.set(artistId, []);
    namesByArtist.get(artistId).push(row.song_name);
  });

  // No blocking sync here — render instantly from whatever's already
  // cached. SongsGrid kicks off background syncs for anything stale/new
  // and refreshes tiles as each one finishes.
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

  const artistStats = artists
    .map((artist) => {
      const names = namesByArtist.get(artist.id) ?? [];
      const totalHeard = names.length;
      const distinctNormalized = new Set(names.map(normalizeSongName));
      const distinctHeard = distinctNormalized.size;
      const catalogSet = catalogByArtist.get(artist.id) ?? new Set();
      const catalogTotal = catalogSet.size;
      const catalogHeard = Array.from(distinctNormalized).filter((n) => catalogSet.has(n)).length;
      const pct = catalogTotal > 0 ? Math.round((catalogHeard / catalogTotal) * 100) : null;

      return {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.image_url,
        totalHeard,
        distinctHeard,
        catalogTotal,
        pct,
        needsSync: !artist.catalog_synced_at,
      };
    })
    .sort((a, b) => b.totalHeard - a.totalHeard);

  return <SongsGrid artists={artistStats} />;
}
