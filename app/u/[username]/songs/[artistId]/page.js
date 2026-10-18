import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../../../../utils/supabase/server';
import { getProfileAccess } from '../../../../../utils/profileAccess';
import { getArtistSongs } from '../../../../../utils/songsData';
import ArtistSongsView from '../../../../../components/ArtistSongsView';
import { getI18n } from '../../../../../i18n/server';

export default async function UserArtistSongsPage({ params }) {
  const { username, artistId } = await params;
  const supabase = await createClient();
  const { t } = await getI18n();

  const access = await getProfileAccess(supabase, username);
  if (!access) notFound();
  if (access.isSelf) redirect(`/songs/${artistId}`);
  if (!access.canViewContent) redirect(`/u/${access.profile.username}`);

  const { profile } = access;
  const data = await getArtistSongs(supabase, profile.id, artistId);
  if (!data) notFound();

  return (
    <ArtistSongsView
      {...data}
      backHref={`/u/${profile.username}/songs`}
      backLabel={t('songs.backToSongsOf', { name: profile.username })}
      readOnly
      ownerId={profile.id}
    />
  );
}
