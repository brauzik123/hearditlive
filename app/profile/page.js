import Link from 'next/link';
import { Settings, UserPlus, Lock, Music2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/server';
import { getI18n } from '../../i18n/server';
import CopyButton from '../../components/CopyButton';
import ProfileHeader from '../../components/ProfileHeader';
import TicketStub from '../../components/TicketStub';
import Avatar from '../../components/Avatar';

export default async function Profile() {
  const supabase = await createClient();
  const { t } = await getI18n();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: friendCode },
    { count: followers },
    { count: following },
    { count: shows },
    { data: favorites },
    { data: friendRows },
    { count: pendingRequests },
  ] = await Promise.all([
    supabase.from('profiles').select('username, bio, avatar_url, profile_visibility').eq('id', user.id).single(),
    // friend_code isn't selectable directly (it'd be visible to everyone).
    supabase.rpc('my_friend_code'),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', user.id).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id).eq('status', 'accepted'),
    supabase
      .from('concert_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('entry_type', 'attended'),
    supabase
      .from('concert_entries')
      .select('id, entry_type, event_date, rating, ticket_status, is_support, artists(name), venues(name, city, city_id, cities(name_en, name_pl))')
      .eq('user_id', user.id)
      .eq('is_favorite', true)
      .order('event_date', { ascending: false })
      .limit(6),
    supabase.from('friendships').select('friend_id').eq('user_id', user.id).limit(12),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', user.id).eq('status', 'pending'),
  ]);

  const friendIds = (friendRows ?? []).map((f) => f.friend_id);
  const { data: friendProfiles } = friendIds.length
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds)
    : { data: [] };
  const friends = friendProfiles ?? [];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-6 md:py-10">
      <ProfileHeader
        username={profile?.username}
        avatarUrl={profile?.avatar_url}
        bio={profile?.bio}
        shows={shows ?? 0}
        followers={followers ?? 0}
        following={following ?? 0}
        action={
          <Link
            href="/settings"
            aria-label={t('profile.settings')}
            className="self-start rounded-full border border-border p-2.5 text-muted transition hover:border-brand hover:text-foreground"
          >
            <Settings size={18} />
          </Link>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Link
            href="/friends"
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-bold text-brand-foreground transition hover:brightness-105"
          >
            <UserPlus size={16} />
            {pendingRequests ? t('profile.requests', { count: pendingRequests }) : t('profile.findFriends')}
          </Link>
          <Link
            href="/stats"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium transition hover:border-brand"
          >
            {t('profile.stats')}
          </Link>
          <Link
            href="/songs"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium transition hover:border-brand"
          >
            <Music2 size={15} /> {t('nav.songs')}
          </Link>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3">
          <div>
            <p className="text-xs text-muted">{t('profile.friendCode')}</p>
            <p className="marquee text-2xl tracking-wider">{friendCode}</p>
          </div>
          <CopyButton text={friendCode ?? ''} />
        </div>
        {profile?.profile_visibility !== 'public' && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock size={12} /> {t(`profile.visibilityNote.${profile?.profile_visibility}`)}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="marquee text-3xl">{t('profile.favorites')}</h2>
        {!favorites?.length ? (
          <p className="text-sm text-muted">{t('profile.favoritesEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {favorites.map((entry) => (
              <TicketStub key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="marquee text-3xl">{t('profile.friends')}</h2>
          <Link href="/friends" className="shrink-0 whitespace-nowrap text-sm text-muted hover:text-foreground">
            {t('profile.seeAll')}
          </Link>
        </div>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">{t('profile.friendsEmpty')}</p>
        ) : (
          <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
            {friends.map((f) => (
              <Link key={f.id} href={`/u/${f.username}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                <Avatar username={f.username} src={f.avatar_url} size={56} />
                <span className="w-full truncate text-center text-xs text-muted">{f.username}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
