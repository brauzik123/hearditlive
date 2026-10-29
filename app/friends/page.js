import { createClient } from '../../utils/supabase/server';
import { checked } from '../../utils/checked';
import { TICKET_FIELDS } from '../../utils/entryFields';
import FriendsView from './_components/FriendsView';

// Friends: their latest shows first, then friends, requests and adding people.
export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Latest entries from people you follow. Visibility is enforced by the
  // database (private profiles, friends-only entries), so this only ever
  // returns what you're allowed to see.
  const { data: followRows } = checked(
    await supabase.from('follows').select('followee_id').eq('follower_id', user.id).eq('status', 'accepted')
  );
  const followedIds = (followRows ?? []).map((f) => f.followee_id);
  const { data: feed } = followedIds.length
    ? checked(
        await supabase
          .from('concert_entries')
          .select(`${TICKET_FIELDS}, profiles!concert_entries_user_id_fkey(username)`)
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(30)
      )
    : { data: [] };

  return <FriendsView feed={feed ?? []} hasFollows={followedIds.length > 0} />;
}
