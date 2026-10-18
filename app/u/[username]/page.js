import { notFound } from 'next/navigation';
import OtherProfileView from '../../../components/OtherProfileView';
import { createClient } from '../../../utils/supabase/server';

export default async function OtherProfilePage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, profile_visibility')
    .ilike('username', username)
    .maybeSingle();

  if (!profile) notFound();

  const isSelf = viewer?.id === profile.id;

  const [{ count: followers }, { count: following }, { data: viewerFollowRow }, { data: isFriendRow }] =
    await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', profile.id)
        .eq('status', 'accepted'),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profile.id)
        .eq('status', 'accepted'),
      viewer
        ? supabase
            .from('follows')
            .select('status')
            .eq('follower_id', viewer.id)
            .eq('followee_id', profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      viewer
        ? supabase
            .from('friendships')
            .select('friend_id')
            .eq('user_id', profile.id)
            .eq('friend_id', viewer.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const isFriend = !!isFriendRow;
  const canViewContent =
    isSelf || profile.profile_visibility === 'public' || (profile.profile_visibility === 'friends' && isFriend);

  let favorites = [];
  let totalConcerts = 0;
  let concerts = [];
  if (canViewContent) {
    // Individual entries can still be hidden (friends-only / only-me); the
    // database filters those, so counts and lists reflect what you can see.
    const [{ data: favData }, { count }, { data: concertData }] = await Promise.all([
      supabase
        .from('concert_entries')
        .select('id, event_date, artists(name)')
        .eq('user_id', profile.id)
        .eq('is_favorite', true)
        .limit(6),
      supabase
        .from('concert_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('entry_type', 'attended'),
      supabase
        .from('concert_entries')
        .select('id, entry_type, event_date, rating, artists(name, image_url), venues(name, city)')
        .eq('user_id', profile.id)
        .order('event_date', { ascending: false, nullsFirst: false })
        .limit(100),
    ]);
    favorites = favData ?? [];
    totalConcerts = count ?? 0;
    concerts = concertData ?? [];
  }

  return (
    <OtherProfileView
      profile={profile}
      isSelf={isSelf}
      followers={followers ?? 0}
      following={following ?? 0}
      initialFollowStatus={viewerFollowRow?.status ?? null}
      canViewContent={canViewContent}
      favorites={favorites}
      totalConcerts={totalConcerts}
      concerts={concerts}
    />
  );
}
