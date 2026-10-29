'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Check, X, UserPlus, Clock, Loader2 } from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';
import { useI18n } from '../../../i18n/client';
import CopyButton from '../../../components/CopyButton';
import Avatar from '../../../components/Avatar';

const TABS = ['find', 'requests', 'friends'];

// Adding people, follow requests and your friend list, in a panel over the
// Friends page: a bottom sheet on phones, a side panel on wider screens.
// Loads when first opened; refreshes the page behind it when who you follow
// changes, so the timeline catches up.
export default function PeopleSheet({ open, onClose, initialTab, onRequestsChange }) {
  const { t } = useI18n();
  const router = useRouter();
  const panelRef = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [followingMap, setFollowingMap] = useState({}); // followee_id -> status
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendCodeMessage, setFriendCodeMessage] = useState(null); // { kind, text }

  // Opening on a given tab (e.g. straight to requests).
  const [openedWith, setOpenedWith] = useState(null);
  if (open && openedWith !== initialTab) {
    setOpenedWith(initialTab);
    setTab(initialTab);
  }
  if (!open && openedWith !== null) setOpenedWith(null);

  useEffect(() => {
    if (!open || loaded) return;
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
            .select('follower_id, profiles!follows_follower_id_fkey(username, avatar_url)')
            .eq('followee_id', user.id)
            .eq('status', 'pending'),
          supabase.from('follows').select('followee_id, status').eq('follower_id', user.id),
        ]);
      setMe(myProfile ? { ...myProfile, friend_code: friendCode } : null);

      const friendIds = (friendRows ?? []).map((f) => f.friend_id);
      const { data: friendProfiles } = friendIds.length
        ? await supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds).order('username')
        : { data: [] };
      setFriends(friendProfiles ?? []);
      setRequests(
        (requestRows ?? []).map((r) => ({ followerId: r.follower_id, username: r.profiles?.username, avatarUrl: r.profiles?.avatar_url }))
      );
      setFollowingMap(Object.fromEntries((myFollows ?? []).map((f) => [f.followee_id, f.status])));
      setLoaded(true);
    })();
  }, [open, loaded]);

  // Esc closes; focus moves into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2 || !me) {
        setSearchResults([]);
        return;
      }
      const { data } = await createClient()
        .from('profiles')
        .select('id, username, avatar_url, profile_visibility')
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
    if (error) return null;
    setFollowingMap((m) => ({ ...m, [targetId]: data.status }));
    router.refresh();
    return data.status;
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

  const settleRequest = (followerId) => {
    const left = requests.filter((req) => req.followerId !== followerId);
    setRequests(left);
    onRequestsChange(left.length);
  };

  // follows has a composite key (follower_id, followee_id) — no id column.
  const accept = async (request) => {
    const { error } = await createClient()
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', request.followerId)
      .eq('followee_id', me?.id);
    if (error) return;
    settleRequest(request.followerId);
    // Accepting makes them a follower; they're a friend only if you follow back.
    if (followingMap[request.followerId] === 'accepted') {
      setFriends((f) => [...f, { id: request.followerId, username: request.username, avatar_url: request.avatarUrl }]);
    }
    router.refresh();
  };

  const decline = async (request) => {
    const { error } = await createClient()
      .from('follows')
      .delete()
      .eq('follower_id', request.followerId)
      .eq('followee_id', me?.id);
    if (!error) settleRequest(request.followerId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-stretch md:justify-end">
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="absolute inset-0 bg-black/55" tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-sheet-title"
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl border-t border-border bg-background outline-none motion-safe:animate-[sheet-up_220ms_ease-out] md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0 md:motion-safe:animate-[sheet-left_220ms_ease-out]"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 id="people-sheet-title" className="marquee text-3xl">
            {t('friends.peopleTitle')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-2 text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div role="tablist" className="mx-5 grid grid-cols-3 rounded-full border border-border p-1">
          {TABS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-medium transition ${
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

        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          {!loaded ? (
            <div className="flex justify-center p-8">
              <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
            </div>
          ) : tab === 'find' ? (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-3 rounded-2xl bg-paper p-4 text-paper-ink">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-paper-muted">{t('profile.friendCode')}</p>
                    <p className="marquee text-3xl tracking-wider">{me?.friend_code}</p>
                  </div>
                  <CopyButton text={me?.friend_code ?? ''} />
                </div>
                <p className="text-xs text-paper-muted">{t('friends.codeShareHint')}</p>
              </section>

              <form onSubmit={addByFriendCode} className="flex flex-col gap-2">
                <label htmlFor="friend-code" className="text-sm text-muted">
                  {t('friends.codeLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="friend-code"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value)}
                    placeholder={t('friends.codePlaceholder')}
                    autoComplete="off"
                    className="field"
                  />
                  <button type="submit" className="shrink-0 rounded-lg bg-brand px-4 text-sm font-bold text-brand-foreground">
                    {t('friends.codeAdd')}
                  </button>
                </div>
                {friendCodeMessage && (
                  <p className={`text-sm ${friendCodeMessage.kind === 'error' ? 'text-danger' : 'text-brand'}`}>{friendCodeMessage.text}</p>
                )}
              </form>

              <section className="flex flex-col gap-2">
                <label htmlFor="people-search" className="text-sm text-muted">
                  {t('friends.searchLabel')}
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={17} />
                  <input
                    id="people-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('friends.searchPlaceholder')}
                    className="field rounded-full pl-10"
                  />
                </div>
                <ul className="flex flex-col">
                  {searchResults.map((result) => {
                    const status = followingMap[result.id];
                    const followsMe = requests.some((r) => r.followerId === result.id);
                    return (
                      <li key={result.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                        <Link href={`/u/${result.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand">
                          <Avatar username={result.username} src={result.avatar_url} size={40} />
                          <span className="truncate font-medium">{result.username}</span>
                        </Link>
                        {status ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
                            {status === 'pending' ? <Clock size={14} /> : <Check size={14} />}
                            {t(status === 'pending' ? 'profile.follow.pending' : 'profile.follow.following')}
                          </span>
                        ) : (
                          <button
                            onClick={() => followUser(result.id)}
                            className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-brand-foreground"
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
          ) : tab === 'requests' ? (
            requests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t('friends.requestsEmpty')}</p>
            ) : (
              <ul className="flex flex-col">
                {requests.map((r) => (
                  <li key={r.followerId} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                    <Link href={`/u/${r.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand">
                      <Avatar username={r.username} src={r.avatarUrl} size={40} />
                      <span className="truncate font-medium">{r.username}</span>
                    </Link>
                    <button
                      onClick={() => decline(r)}
                      aria-label={t('friends.decline', { name: r.username })}
                      className="shrink-0 rounded-full border border-border p-2 text-muted transition hover:border-danger hover:text-danger"
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => accept(r)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-brand-foreground"
                    >
                      <Check size={15} /> {t('friends.accept')}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted">{t('friends.empty')}</p>
              <button onClick={() => setTab('find')} className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
                {t('friends.emptyCta')}
              </button>
            </div>
          ) : (
            <ul className="flex flex-col">
              {friends.map((f) => (
                <li key={f.id} className="border-b border-border last:border-b-0">
                  <Link href={`/u/${f.username}`} className="flex items-center gap-3 py-3 hover:text-brand">
                    <Avatar username={f.username} src={f.avatar_url} size={40} />
                    <span className="font-medium">{f.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
