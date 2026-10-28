import { notFound } from 'next/navigation';
import OtherProfileView from '../../../components/OtherProfileView';
import { createClient } from '../../../utils/supabase/server';
import { getProfileAccess } from '../../../utils/profileAccess';
import { checked } from '../../../utils/checked';
import { countOutings } from '../../../utils/outings';

export default async function OtherProfilePage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const access = await getProfileAccess(supabase, username);
  if (!access) notFound();
  const { viewer, profile, isSelf, canViewContent } = access;

  const [{ count: followers }, { count: following }, { data: viewerFollowRow }] = await Promise.all([
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
  ]);

  let totalConcerts = 0;
  let concerts = [];
  if (canViewContent) {
    // Individual entries can still be hidden (friends-only / only-me); the
    // database filters those, so counts and lists reflect what you can see.
    const [{ count }, { data: concertData }] = (await Promise.all([
      supabase
        .from('concert_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('entry_type', 'attended'),
      supabase
        .from('concert_entries')
        .select('id, entry_type, event_date, rating, ticket_status, is_support, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name)), venues(name, city, city_id, cities(name_en, name_pl))')
        .eq('user_id', profile.id)
        .order('event_date', { ascending: false, nullsFirst: false })
        .limit(100),
    ])).map(checked);
    totalConcerts = count ?? 0;
    concerts = concertData ?? [];
  }

  // Events together, from your own log (who you marked as being there).
  let togetherEvents = 0;
  if (viewer && !isSelf) {
    const { data: shared } = checked(
      await supabase
        .from('concert_entries')
        .select('id, festival_id, event_date, venue_id, entry_attendees!inner(user_id)')
        .eq('user_id', viewer.id)
        .eq('entry_type', 'attended')
        .eq('entry_attendees.user_id', profile.id)
    );
    togetherEvents = countOutings(shared ?? []);
  }

  return (
    <OtherProfileView
      profile={profile}
      isSelf={isSelf}
      followers={followers ?? 0}
      following={following ?? 0}
      initialFollowStatus={viewerFollowRow?.status ?? null}
      canViewContent={canViewContent}
      totalConcerts={totalConcerts}
      concerts={concerts}
      togetherEvents={togetherEvents}
    />
  );
}
