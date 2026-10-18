'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Check, X, UserPlus, Clock, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import CopyButton from '../../components/CopyButton';
import Avatar from '../../components/Avatar';

const TABS = ['friends', 'requests', 'find'];

export default function Friends() {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('friends');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [followingMap, setFollowingMap] = useState({}); // followee_id -> status
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendCodeMessage, setFriendCodeMessage] = useState(null); // { kind, text }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: myProfile }, { data: friendCode }, { data: friendRows }, { data: requestRows }, { data: myFollows }] =
        await Promise.all([
          supabase.from('profiles').select('id, username').eq('id', user.id).single(),
          supabase.rpc('my_friend_code'),
          supabase.from('friendships').select('friend_id').eq('user_id', user.id),
          supabase
            .from('follows')
            .select('follower_id, profiles!follows_follower_id_fkey(username)')
            .eq('followee_id', user.id)
            .eq('status', 'pending'),
          supabase.from('follows').select('followee_id, status').eq('follower_id', user.id),
        ]);
      setMe(myProfile ? { ...myProfile, friend_code: friendCode } : null);

      const friendIds = (friendRows ?? []).map((f) => f.friend_id);
      const { data: friendProfiles } = friendIds.length
        ? await supabase.from('profiles').select('id, username').in('id', friendIds)
        : { data: [] };
      setFriends(friendProfiles ?? []);

      const pending = (requestRows ?? []).map((r) => ({ followerId: r.follower_id, username: r.profiles?.username }));
      setRequests(pending);
      if (pending.length) setTab('requests');

      const map = {};
      (myFollows ?? []).forEach((f) => {
        map[f.followee_id] = f.status;
      });
      setFollowingMap(map);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2 || !me) {
        setSearchResults([]);
        return;
      }
      const { data } = await createClient()
        .from('profiles')
        .select('id, username, profile_visibility')
        .ilike('username', `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
        .neq('id', me.id)
        .limit(10);
      setSearchResults(data ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, me]);

  // The database decides accepted vs pending (private profiles need
  // approval); read back what it chose.
  const followUser = async (targetId) => {
    const { data, error } = await createClient()
      .from('follows')
      .insert({ follower_id: me?.id, followee_id: targetId })
      .select('status')
      .single();
    if (!error) setFollowingMap((m) => ({ ...m, [targetId]: data.status }));
    return error ? null : data.status;
  };

  const addByFriendCode = async (e) => {
    e.preventDefault();
    setFriendCodeMessage(null);
    const code = friendCodeInput.trim();
    if (!code) return;
    const { data: matches } = await createClient().rpc('find_profile_by_friend_code', { code });
    const target = matches?.[0];
    if (!target) {
      setFriendCodeMessage({ kind: 'error', text: t('friends.codeNotFound') });
      return;
    }
    if (target.id === me?.id) {
      setFriendCodeMessage({ kind: 'error', text: t('friends.codeOwn') });
      return;
    }
    if (followingMap[target.id]) {
      setFriendCodeMessage({ kind: 'info', text: t('friends.codeAlready', { name: target.username }) });
      return;
    }
    const status = await followUser(target.id);
    if (status) {
      setFriendCodeMessage({
        kind: 'info',
        text: t(status === 'pending' ? 'friends.codeRequested' : 'friends.codeFollowed', { name: target.username }),
      });
      setFriendCodeInput('');
    }
  };

  // follows has a composite key (follower_id, followee_id) — no id column.
  const accept = async (request) => {
    const { error } = await createClient()
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', request.followerId)
      .eq('followee_id', me?.id);
    if (!error) {
      setRequests((r) => r.filter((req) => req.followerId !== request.followerId));
      // Accepting makes them a follower; they're a friend only if you follow back.
      if (followingMap[request.followerId] === 'accepted') {
        setFriends((f) => [...f, { id: request.followerId, username: request.username }]);
      }
    }
  };

  const decline = async (request) => {
    const { error } = await createClient()
      .from('follows')
      .delete()
      .eq('follower_id', request.followerId)
      .eq('followee_id', me?.id);
    if (!error) setRequests((r) => r.filter((req) => req.followerId !== request.followerId));
  };

  if (loading) {
    return (
      <main className="flex justify-center p-12">
        <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:py-10">
      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> {t('friends.backToProfile')}
      </Link>

      <h1 className="marquee text-5xl">{t('friends.title')}</h1>

      <div role="tablist" className="flex self-start rounded-full border border-border p-1">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === id ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {t(`friends.tabs.${id}`)}
            {id === 'requests' && requests.length > 0 && (
              <span className={`text-xs ${tab === id ? '' : 'text-brand'}`}>{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' &&
        (friends.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
            <p className="text-muted">{t('friends.empty')}</p>
            <button
              onClick={() => setTab('find')}
              className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground"
            >
              {t('friends.emptyCta')}
            </button>
          </div>
        ) : (
          <ul className="flex flex-col">
            {friends.map((f) => (
              <li key={f.id} className="border-b border-border last:border-b-0">
                <Link href={`/u/${f.username}`} className="flex items-center gap-3 py-3 hover:text-brand">
                  <Avatar username={f.username} size={40} />
                  <span className="font-medium">{f.username}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'requests' &&
        (requests.length === 0 ? (
          <p className="text-sm text-muted">{t('friends.requestsEmpty')}</p>
        ) : (
          <ul className="flex flex-col">
            {requests.map((r) => (
              <li key={r.followerId} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                <Link href={`/u/${r.username}`} className="flex flex-1 items-center gap-3 hover:text-brand">
                  <Avatar username={r.username} size={40} />
                  <span className="font-medium">{r.username}</span>
                </Link>
                <button
                  onClick={() => decline(r)}
                  aria-label={t('friends.decline', { name: r.username })}
                  className="rounded-full border border-border p-2 text-muted transition hover:border-danger hover:text-danger"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={() => accept(r)}
                  className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-brand-foreground"
                >
                  <Check size={15} /> {t('friends.accept')}
                </button>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'find' && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted">{t('profile.friendCode')}</p>
                <p className="marquee text-2xl tracking-wider">{me?.friend_code}</p>
              </div>
              <CopyButton text={me?.friend_code ?? ''} />
            </div>
            <form onSubmit={addByFriendCode} className="flex gap-2">
              <input
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder={t('friends.codePlaceholder')}
                aria-label={t('friends.codePlaceholder')}
                className="field"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground">
                {t('friends.codeAdd')}
              </button>
            </form>
            {friendCodeMessage && (
              <p className={`text-sm ${friendCodeMessage.kind === 'error' ? 'text-danger' : 'text-brand'}`}>
                {friendCodeMessage.text}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={17} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('friends.searchPlaceholder')}
                aria-label={t('friends.searchPlaceholder')}
                className="field rounded-full pl-10"
              />
            </div>
            <ul className="flex flex-col">
              {searchResults.map((result) => {
                const status = followingMap[result.id];
                const followsMe = requests.some((r) => r.followerId === result.id);
                return (
                  <li key={result.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                    <Link href={`/u/${result.username}`} className="flex flex-1 items-center gap-3 hover:text-brand">
                      <Avatar username={result.username} size={40} />
                      <span className="font-medium">{result.username}</span>
                    </Link>
                    {status ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted">
                        {status === 'pending' ? <Clock size={14} /> : <Check size={14} />}
                        {t(status === 'pending' ? 'profile.follow.pending' : 'profile.follow.following')}
                      </span>
                    ) : (
                      <button
                        onClick={() => followUser(result.id)}
                        className="flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-brand-foreground"
                      >
                        <UserPlus size={15} /> {followsMe ? t('friends.followBack') : t('profile.follow.none')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {query.trim().length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted">{t('friends.searchNone', { query: query.trim() })}</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
