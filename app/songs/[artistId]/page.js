import { notFound } from 'next/navigation';
import { createClient } from '../../../utils/supabase/server';
import { normalizeSongName } from '../../../utils/normalize';
import ArtistSongsView from '../../../components/ArtistSongsView';

export default async function ArtistSongsPage({ params }) {
  const { artistId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Everything except the setlist depends only on the ids we already have,
  // so fetch it all at once — this page renders purely from cache.
  const [{ data: artist }, { data: attendedEntries }, { data: exclusionRows }, { data: catalogSongs }, { data: albumRows }] =
    await Promise.all([
      supabase.from('artists').select('*').eq('id', artistId).maybeSingle(),
      supabase
        .from('concert_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('artist_id', artistId)
        .eq('entry_type', 'attended'),
      supabase.from('song_count_exclusions').select('song_name').eq('user_id', user.id).eq('artist_id', artistId),
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
  if (!artist) notFound();
  if (!attendedEntries || attendedEntries.length === 0) notFound();

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
    if (heard) matchedNormalized.add(key);

    if (song.album_id) {
      if (!songsByAlbum.has(song.album_id)) songsByAlbum.set(song.album_id, []);
      songsByAlbum.get(song.album_id).push(entry);
    } else if (song.is_feature) {
      if (heard) features.push(entry);
    } else if (song.spotify_track_id) {
      if (heard) singles.push(entry);
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

  return (
    <ArtistSongsView
      artist={{ id: artist.id, name: artist.name, imageUrl: artist.image_url }}
      albums={albums}
      singles={singles.sort((a, b) => b.count - a.count)}
      features={features.sort((a, b) => b.count - a.count)}
      others={others.sort((a, b) => b.count - a.count)}
      needsSync={needsSync}
    />
  );
}
