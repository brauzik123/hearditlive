'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Check, X, UserPlus, Clock, User as UserIcon, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import CopyButton from '../../components/CopyButton';

const TABS = ['Friends', 'Requests', 'Find Friends'];

export default function Friends() {
  const supabase = createClient();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('Friends');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [followingMap, setFollowingMap] = useState({}); // followee_id -> status
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendCodeError, setFriendCodeError] = useState('');

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id, username, friend_code')
        .eq('id', user.id)
        .single();
      setMe(myProfile);

      const [{ data: friendRows }, { data: requestRows }, { data: myFollows }] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        supabase
          .from('follows')
          .select('id, follower_id, profiles!follows_follower_id_fkey(username)')
          .eq('followee_id', user.id)
          .eq('status', 'pending'),
        supabase.from('follows').select('followee_id, status').eq('follower_id', user.id),
      ]);

      const friendIds = (friendRows ?? []).map((f) => f.friend_id);
      const { data: friendProfiles } = friendIds.length
        ? await supabase.from('profiles').select('id, username').in('id', friendIds)
        : { data: [] };
      setFriends(friendProfiles ?? []);

      setRequests(
        (requestRows ?? []).map((r) => ({ id: r.id, followerId: r.follower_id, username: r.profiles?.username }))
      );

      const map = {};
      (myFollows ?? []).forEach((f) => {
        map[f.followee_id] = f.status;
      });
      setFollowingMap(map);

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2 || !me) {
        setSearchResults([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, username, profile_visibility')
        .ilike('username', `%${query.trim()}%`)
        .neq('id', me?.id)
        .limit(10);
      setSearchResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, me]);

  const followUser = async (targetId, targetVisibility) => {
    const status = targetVisibility === 'private' ? 'pending' : 'accepted';
    const { error } = await supabase.from('follows').insert({ follower_id: me?.id, followee_id: targetId, status });
    if (!error) setFollowingMap((m) => ({ ...m, [targetId]: status }));
  };

  const addByFriendCode = async () => {
    setFriendCodeError('');
    const code = friendCodeInput.trim();
    if (!code) return;
    const { data: target } = await supabase
      .from('profiles')
      .select('id, username, profile_visibility')
      .eq('friend_code', code)
      .maybeSingle();
    if (!target) {
      setFriendCodeError('No account with that friend code.');
      return;
    }
    if (target.id === me?.id) {
      setFriendCodeError("That's your own friend code.");
      return;
    }
    await followUser(target.id, target.profile_visibility);
    setFriendCodeInput('');
  };

  const accept = async (request) => {
    const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('id', request.id);
    if (!error) {
      setRequests((r) => r.filter((req) => req.id !== request.id));
      setFriends((f) => [...f, { id: request.followerId, username: request.username }]);
    }
  };

  const decline = async (request) => {
    const { error } = await supabase.from('follows').delete().eq('id', request.id);
    if (!error) setRequests((r) => r.filter((req) => req.id !== request.id));
  };

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" />
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
        <ArrowLeft size={16} /> Back to profile
      </Link>

      <h1 className="text-2xl font-bold">Friends</h1>

      <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-muted">Your friend code</p>
          <p className="font-mono font-bold tracking-wide">{me?.friend_code}</p>
        </div>
        <CopyButton text={me?.friend_code ?? ''} />
      </div>

      <div className="flex gap-1 bg-surface border border-border rounded-full p-1 self-start">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {t}
            {t === 'Requests' && requests.length > 0 && (
              <span className="ml-1.5 bg-background/30 rounded-full px-1.5 text-xs">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Friends' && (
        <div className="flex flex-col gap-2">
          {friends.length === 0 ? (
            <p className="text-sm text-muted italic">No friends yet — try Find Friends.</p>
          ) : (
            friends.map((f) => (
              <Link
                key={f.id}
                href={`/u/${f.username}`}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-muted transition"
              >
                <div className="w-10 h-10 rounded-full bg-surface-light border border-border flex items-center justify-center text-xs shrink-0">
                  {f.username?.[0]}
                </div>
                <span className="font-medium">{f.username}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'Requests' && (
        <div className="flex flex-col gap-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted italic">No pending follow requests.</p>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-surface-light border border-border flex items-center justify-center text-xs shrink-0">
                  {req.username?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{req.username}</p>
                </div>
                <button
                  onClick={() => accept(req)}
                  className="p-2 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => decline(req)}
                  className="p-2 rounded-full bg-surface-light border border-border text-muted hover:text-foreground transition"
                >
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Find Friends' && (
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex gap-2">
              <input
                placeholder="Enter a friend code"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand transition"
              />
              <button
                onClick={addByFriendCode}
                className="bg-brand text-brand-foreground rounded-lg px-4 font-bold text-sm hover:opacity-90 transition"
              >
                Add
              </button>
            </div>
            {friendCodeError && <p className="text-xs text-red-400 mt-1.5">{friendCodeError}</p>}
          </div>

          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                placeholder="Search by username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-brand transition"
              />
            </div>

            <div className="flex flex-col gap-2">
              {searchResults.map((result) => {
                const status = followingMap[result.id];
                return (
                  <div key={result.id} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                    <Link href={`/u/${result.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-light border border-border flex items-center justify-center shrink-0">
                        <UserIcon size={16} className="text-muted" />
                      </div>
                      <span className="flex-1 font-medium truncate">{result.username}</span>
                    </Link>
                    {status === 'accepted' ? (
                      <span className="text-xs text-muted">Following</span>
                    ) : status === 'pending' ? (
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Clock size={12} /> Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => followUser(result.id, result.profile_visibility)}
                        className="flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 bg-brand text-brand-foreground hover:opacity-90 transition"
                      >
                        <UserPlus size={12} /> Follow
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
