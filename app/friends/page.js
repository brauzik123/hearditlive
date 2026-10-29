import { createClient } from '../../utils/supabase/server';
import { checked } from '../../utils/checked';
import { TICKET_FIELDS } from '../../utils/entryFields';
import { groupFriendShows } from '../../utils/friendShows';
import FriendsView from './_components/FriendsView';

const FEED_FIELDS = `${TICKET_FIELDS}, profiles!concert_entries_user_id_fkey(username, avatar_url)`;

// Friends: where the people you follow are going and have been, by concert
// date. Adding people, requests and your friend list open in a side panel.
// Visibility is enforced by the database (private profiles, friends-only
// shows), so this only ever returns what you're allowed to see.
export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: followRows }, { data: friendRows }, { count: pendingRequests }] = (
    await Promise.all([
      supabase.from('follows').select('followee_id').eq('follower_id', user.id).eq('status', 'accepted'),
      supabase.from('friendships').select('friend_id').eq('user_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', user.id).eq('status', 'pending'),
    ])
  ).map(checked);

  const followedIds = (followRows ?? []).map((f) => f.followee_id);
  const friendIds = (friendRows ?? []).map((f) => f.friend_id);

  const [{ data: upcoming }, { data: recent }, { data: friends }] = (
    await Promise.all([
      followedIds.length
        ? supabase
            .from('concert_entries')
            .select(FEED_FIELDS)
            .in('user_id', followedIds)
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .limit(40)
        : Promise.resolve({ data: [] }),
      followedIds.length
        ? supabase
            .from('concert_entries')
            .select(FEED_FIELDS)
            .in('user_id', followedIds)
            .eq('entry_type', 'attended')
            .lt('event_date', today)
            .order('event_date', { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] }),
      friendIds.length
        ? supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds).order('username')
        : Promise.resolve({ data: [] }),
    ])
  ).map(checked);

  return (
    <FriendsView
      upcoming={groupFriendShows(upcoming ?? [])}
      recent={groupFriendShows(recent ?? []).slice(0, 25)}
      friends={friends ?? []}
      hasFollows={followedIds.length > 0}
      pendingRequests={pendingRequests ?? 0}
    />
  );
}
