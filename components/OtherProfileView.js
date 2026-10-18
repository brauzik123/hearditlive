'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Clock, UserPlus, UserMinus, Music2 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';
import ProfileHeader from './ProfileHeader';
import TicketStub from './TicketStub';

function stateFromStatus(status) {
  if (status === 'accepted') return 'following';
  if (status === 'pending') return 'pending';
  return 'none';
}

export default function OtherProfileView({
  profile,
  isSelf,
  followers,
  following,
  initialFollowStatus,
  canViewContent,
  totalConcerts,
  concerts,
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [followState, setFollowState] = useState(stateFromStatus(initialFollowStatus));
  const [busy, setBusy] = useState(false);

  const handleFollow = async () => {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (followState === 'none') {
      // The database decides accepted vs pending (private profiles need
      // approval); read back what it chose.
      const { data, error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followee_id: profile.id })
        .select('status')
        .single();
      if (!error) setFollowState(stateFromStatus(data.status));
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followee_id', profile.id);
      if (!error) setFollowState('none');
    }
    setBusy(false);
    // Following can make you friends, which can unlock their concerts.
    router.refresh();
  };

  const FollowIcon = followState === 'pending' ? Clock : followState === 'following' ? UserMinus : UserPlus;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
      <ProfileHeader
        username={profile.username}
        bio={canViewContent ? profile.bio : null}
        shows={canViewContent ? totalConcerts : null}
        followers={followers}
        following={following}
      />

      {!isSelf && (
        <button
          onClick={handleFollow}
          disabled={busy}
          className={`group flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition disabled:opacity-60 ${
            followState === 'none'
              ? 'bg-brand text-brand-foreground hover:brightness-105'
              : 'border border-border text-foreground hover:border-danger hover:text-danger'
          }`}
        >
          <FollowIcon size={16} /> {t(`profile.follow.${followState}`)}
        </button>
      )}

      {!canViewContent ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Lock size={24} className="text-muted" />
          <p className="font-semibold">
            {profile.profile_visibility === 'private' ? t('profile.lockedPrivateTitle') : t('profile.lockedFriendsTitle')}
          </p>
          <p className="max-w-xs text-sm text-muted">
            {profile.profile_visibility === 'private'
              ? t('profile.lockedPrivate', { name: profile.username })
              : t('profile.lockedFriends', { name: profile.username })}
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="marquee text-3xl">{t('profile.concerts')}</h2>
            <Link
              href={isSelf ? '/songs' : `/u/${profile.username}/songs`}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-brand"
            >
              <Music2 size={14} /> {t('profile.songsHeard')}
            </Link>
          </div>
          {concerts.length === 0 ? (
            <p className="text-sm text-muted">{t('profile.concertsEmpty', { name: profile.username })}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {concerts.map((entry) => (
                <TicketStub key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
