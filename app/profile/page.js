import Link from 'next/link';
import { Settings, UserPlus, Image as ImageIcon, User as UserIcon, Lock } from 'lucide-react';
import { createClient } from '../../utils/supabase/server';
import CopyButton from '../../components/CopyButton';

export default async function Profile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profileRow },
    { data: friendCode },
    { count: followers },
    { count: following },
    { data: favorites },
    { data: friendRows },
    { count: pendingRequests },
  ] =
    await Promise.all([
      supabase.from('profiles').select('username, bio, profile_visibility').eq('id', user.id).single(),
      // friend_code isn't selectable directly (it'd be visible to everyone).
      supabase.rpc('my_friend_code'),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id)
        .eq('status', 'accepted'),
      supabase
        .from('concert_entries')
        .select('id, event_date, artists(name)')
        .eq('user_id', user.id)
        .eq('is_favorite', true)
        .limit(6),
      supabase.from('friendships').select('friend_id').eq('user_id', user.id).limit(8),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', user.id)
        .eq('status', 'pending'),
    ]);

  const profile = profileRow ? { ...profileRow, friend_code: friendCode } : null;
  const friendIds = (friendRows ?? []).map((f) => f.friend_id);
  const { data: friendProfiles } = friendIds.length
    ? await supabase.from('profiles').select('id, username').in('id', friendIds)
    : { data: [] };
  const friends = friendProfiles ?? [];

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">

      {/* Header */}
      <section className="flex items-start gap-6">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-surface flex items-center justify-center border border-border shrink-0">
          <UserIcon size={40} className="text-muted" />
        </div>

        <div className="flex flex-col flex-1 mt-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold truncate">{profile?.username}</h1>
              {profile?.bio && <p className="text-muted text-sm mt-1">{profile.bio}</p>}
            </div>
            <Link href="/settings" className="text-muted hover:text-foreground transition shrink-0">
              <Settings size={20} />
            </Link>
          </div>

          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex flex-col">
              <span className="font-bold text-lg">{followers ?? 0}</span>
              <span className="text-muted">Followers</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg">{following ?? 0}</span>
              <span className="text-muted">Following</span>
            </div>
          </div>
        </div>
      </section>

      {/* Friend code */}
      <section className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-muted">Your friend code</p>
          <p className="font-mono font-bold tracking-wide">{profile?.friend_code}</p>
        </div>
        <CopyButton text={profile?.friend_code ?? ''} />
      </section>

      {/* Action buttons */}
      <section className="flex gap-3">
        <Link
          href="/settings"
          className="flex-1 bg-surface-light border border-border py-2 rounded-lg font-medium hover:border-muted transition flex justify-center items-center gap-2 text-sm"
        >
          <Settings size={16} /> Edit Profile
        </Link>
        <Link
          href="/friends"
          className="flex-1 bg-brand text-brand-foreground py-2 rounded-lg font-bold hover:opacity-90 transition flex justify-center items-center gap-2 text-sm"
        >
          <UserPlus size={16} />
          {pendingRequests ? `Friend requests (${pendingRequests})` : 'Add Friends'}
        </Link>
      </section>

      <hr className="border-border" />

      {/* Favorite concerts */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Favourite Concerts</h2>
          <Link href="/collection" className="text-xs text-muted hover:text-foreground transition">Edit</Link>
        </div>

        {!favorites || favorites.length === 0 ? (
          <p className="text-sm text-muted italic">Mark entries as favorites from the log form to see them here.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {favorites.map((concert) => (
              <Link
                href={`/entry/${concert.id}`}
                key={concert.id}
                className="aspect-square bg-surface rounded-xl border border-border flex flex-col items-center justify-center p-2 text-center group cursor-pointer hover:border-muted transition"
              >
                <ImageIcon size={24} className="text-muted mb-2 group-hover:text-foreground transition" />
                <span className="text-xs font-bold truncate w-full">{concert.artists?.name ?? 'Unknown artist'}</span>
                {concert.event_date && <span className="text-[10px] text-muted">{concert.event_date.slice(0, 4)}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <hr className="border-border" />

      {/* Friends */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Friends</h2>
          <Link href="/friends" className="text-xs text-muted hover:text-foreground transition">See All</Link>
        </div>

        {friends.length === 0 ? (
          <p className="text-sm text-muted italic">No friends yet — share your friend code to get started.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {friends.map((f) => (
              <Link
                href={`/u/${f.username}`}
                key={f.id}
                className="flex flex-col items-center gap-1 cursor-pointer shrink-0"
              >
                <div className="w-14 h-14 rounded-full bg-surface-light border border-border flex items-center justify-center hover:border-brand transition">
                  <span className="text-muted text-xs">{f.username?.[0]}</span>
                </div>
                <span className="text-xs text-muted">{f.username}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {profile?.profile_visibility !== 'public' && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock size={12} /> Your profile is set to {profile?.profile_visibility === 'private' ? 'private' : 'friends only'}.
        </p>
      )}

    </main>
  );
}
