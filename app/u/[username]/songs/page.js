import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../../../utils/supabase/server';
import { getProfileAccess } from '../../../../utils/profileAccess';
import { getSongsOverview } from '../../../../utils/songsData';
import SongsGrid from '../../../../components/SongsGrid';

export default async function UserSongsPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const access = await getProfileAccess(supabase, username);
  if (!access) notFound();
  if (access.isSelf) redirect('/songs');
  // The profile page explains why it's locked (private vs friends-only).
  if (!access.canViewSongs) redirect(`/u/${access.profile.username}`);

  const { profile } = access;
  const artists = await getSongsOverview(supabase, profile.id);
  return (
    <SongsGrid
      artists={artists}
      basePath={`/u/${profile.username}/songs`}
      owner={{ id: profile.id, username: profile.username }}
    />
  );
}
