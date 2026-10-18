'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EntryRow from './EntryRow';
import { User as UserIcon, Image as ImageIcon, Lock, Clock, UserCheck, UserPlus, UserMinus } from 'lucide-react';
import { createClient } from '../utils/supabase/client';

const FOLLOW_STATES = {
  NOT_FOLLOWING: 'not_following',
  PENDING: 'pending',
  FOLLOWING: 'following',
};

function stateFromStatus(status) {
  if (status === 'accepted') return FOLLOW_STATES.FOLLOWING;
  if (status === 'pending') return FOLLOW_STATES.PENDING;
  return FOLLOW_STATES.NOT_FOLLOWING;
}

export default function OtherProfileView({
  profile,
  isSelf,
  followers,
  following,
  initialFollowStatus,
  canViewContent,
  favorites,
  totalConcerts,
  concerts,
}) {
  const supabase = createClient();
  const router = useRouter();
  const [followState, setFollowState] = useState(stateFromStatus(initialFollowStatus));
  const [busy, setBusy] = useState(false);

  const isLocked = !canViewContent;
  const lockedMessage =
    profile.profile_visibility === 'private'
      ? `${profile.username} keeps their concerts private.`
      : `Only ${profile.username}'s friends can see their concerts. You become friends when you both follow each other.`;

  const handleFollow = async () => {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (followState === FOLLOW_STATES.NOT_FOLLOWING) {
      const status = profile.profile_visibility === 'private' ? 'pending' : 'accepted';
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followee_id: profile.id, status });
      if (!error) setFollowState(status === 'pending' ? FOLLOW_STATES.PENDING : FOLLOW_STATES.FOLLOWING);
    } else {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followee_id', profile.id);
      if (!error) setFollowState(FOLLOW_STATES.NOT_FOLLOWING);
    }
    setBusy(false);
    // Following can make you friends, which can unlock their concerts.
    router.refresh();
  };

  const followButtonLabel = {
    [FOLLOW_STATES.NOT_FOLLOWING]: 'Follow',
    [FOLLOW_STATES.PENDING]: 'Requested',
    [FOLLOW_STATES.FOLLOWING]: 'Following',
  }[followState];

  const FollowIcon =
    followState === FOLLOW_STATES.PENDING ? Clock : followState === FOLLOW_STATES.FOLLOWING ? UserMinus : UserPlus;

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">

      {/* Header */}
      <section className="flex items-start gap-6">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-surface flex items-center justify-center border border-border shrink-0">
          <UserIcon size={40} className="text-muted" />
        </div>

        <div className="flex flex-col flex-1 mt-2 min-w-0">
          <h1 className="text-2xl font-bold truncate">{profile.username}</h1>
          {!isLocked && profile.bio && <p className="text-muted text-sm mt-1">{profile.bio}</p>}

          <div className="flex gap-6 mt-4 text-sm">
            <div className="flex flex-col">
              <span className="font-bold text-lg">{followers}</span>
              <span className="text-muted">Followers</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg">{following}</span>
              <span className="text-muted">Following</span>
            </div>
          </div>
        </div>
      </section>

      {!isSelf && (
        <button
          onClick={handleFollow}
          disabled={busy}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition disabled:opacity-60 ${
            followState === FOLLOW_STATES.FOLLOWING
              ? 'bg-surface-light border border-border hover:border-red-400 hover:text-red-400'
              : followState === FOLLOW_STATES.PENDING
              ? 'bg-surface-light border border-border text-muted'
              : 'bg-brand text-brand-foreground hover:opacity-90'
          }`}
        >
          <FollowIcon size={16} /> {followButtonLabel}
        </button>
      )}

      {isLocked ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted">
          <Lock size={28} />
          <p className="font-medium text-foreground">
            {profile.profile_visibility === 'private' ? 'This profile is private' : 'Friends only'}
          </p>
          <p className="text-sm max-w-xs">{lockedMessage}</p>
        </div>
      ) : (
        <>
          <hr className="border-border" />

          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Favourite Concerts</h2>
            </div>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted italic">No favorites yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {favorites.map((concert) => (
                  <Link
                    href={`/entry/${concert.id}`}
                    key={concert.id}
                    className="aspect-square bg-surface rounded-xl border border-border flex flex-col items-center justify-center p-2 text-center"
                  >
                    <ImageIcon size={24} className="text-muted mb-2" />
                    <span className="text-xs font-bold truncate w-full">{concert.artists?.name ?? 'Unknown artist'}</span>
                    {concert.event_date && <span className="text-[10px] text-muted">{concert.event_date.slice(0, 4)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <hr className="border-border" />

          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-lg">
              {totalConcerts} {totalConcerts === 1 ? 'concert' : 'concerts'} logged
            </h2>
            {concerts.length === 0 ? (
              <p className="text-sm text-muted italic">Nothing to show yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {concerts.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
