import { notFound } from 'next/navigation';
import { createClient } from '../../../utils/supabase/server';
import { getArtistSongs } from '../../../utils/songsData';
import ArtistSongsView from '../../../components/ArtistSongsView';

export default async function ArtistSongsPage({ params }) {
  const { artistId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await getArtistSongs(supabase, user.id, artistId);
  if (!data) notFound();

  return <ArtistSongsView {...data} backHref="/songs" />;
}
