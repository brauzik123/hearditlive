'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Music2, Loader2, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/client';
import { syncArtistPaced } from '../utils/artistSyncClient';
import { SONG_SORTS, sortSongArtists } from '../utils/songsSort';

// Your own Songs (/songs) or someone else's (/u/[username]/songs). For
// someone else, `owner` is { id, username } and the sync classifies their
// heard songs instead of yours.
export default function SongsGrid({ artists, basePath, owner = null }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [syncingIds, setSyncingIds] = useState(() => new Set(artists.filter((a) => a.needsSync).map((a) => a.id)));
  const [pace, setPace] = useState(null); // null, 'waiting' (turn coming up) or 'held' (limit for now)
  const [sort, setSort] = useState('plays');
  const router = useRouter();
  const startedRef = useRef(new Set());
  const queueRef = useRef([]);
  const workingRef = useRef(false);
  const leftRef = useRef(false);

  // Leaving the page ends the queue; the next visit picks it up.
  useEffect(() => {
    leftRef.current = false;
    return () => {
      leftRef.current = true;
    };
  }, []);

  useEffect(() => {
    // Marked as soon as they're queued: every refresh below brings a new
    // `artists`, and must not queue the same artists again.
    const toSync = artists.filter((a) => a.needsSync && !startedRef.current.has(a.id));
    if (!toSync.length) return;
    toSync.forEach((a) => startedRef.current.add(a.id));
    queueRef.current.push(...toSync);

    setSyncingIds((prev) => new Set([...prev, ...toSync.map((a) => a.id)]));

    // One artist at a time, and only one worker: a full discography can be
    // dozens of Spotify calls, and going over Spotify's limit pauses every
    // sync for a while. The server spaces them out (see syncArtistPaced).
    if (workingRef.current) return;
    workingRef.current = true;
    (async () => {
      const queue = queueRef.current;
      while (queue.length && !leftRef.current) {
        const artist = queue.shift();
        const outcome = await syncArtistPaced(artist.id, owner?.id, {
          isStopped: () => leftRef.current,
          onWait: () => setPace('waiting'),
        });
        if (outcome === 'paused') {
          queue.length = 0;
          setPace('held');
          setSyncingIds(new Set());
          break;
        }
        if (outcome === 'stopped') break;
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(artist.id);
          return next;
        });
        router.refresh();
      }
      workingRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? artists.filter((a) => a.name.toLowerCase().includes(q)) : artists;
    return sortSongArtists(matching, sort);
  }, [artists, query, sort]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:py-10">
      {owner && (
        <Link href={`/u/${owner.username}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> {t('songs.backTo', { name: owner.username })}
        </Link>
      )}
      <div>
        <h1 className="marquee text-5xl">{owner ? t('songs.titleOf', { name: owner.username }) : t('songs.title')}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          {owner ? t('songs.subtitleOf', { name: owner.username }) : t('songs.subtitle')}
        </p>
      </div>

      {artists.length > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {artists.length > 6 && (
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={17} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('songs.search')}
                aria-label={t('songs.search')}
                className="field rounded-full pl-10"
              />
            </div>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={t('collection.sortBy')}
            className="filter-select self-start rounded-full px-3 sm:self-auto"
          >
            {SONG_SORTS.map((id) => (
              <option key={id} value={id}>
                {t(`songs.sort.${id}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      {pace === 'waiting' && syncingIds.size > 0 && <p className="text-sm text-muted">{t('songs.syncWaiting')}</p>}
      {pace === 'held' && <p className="text-sm text-muted">{t('songs.syncHeld')}</p>}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
          {artists.length === 0 ? (owner ? t('songs.emptyOf') : t('songs.empty')) : t('songs.noMatches')}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((artist) => {
            const syncing = syncingIds.has(artist.id);
            return (
              <Link href={`${basePath}/${artist.id}`} key={artist.id} className="group flex flex-col gap-2">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
                  {artist.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artist.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Music2 size={32} className="text-muted" />
                    </div>
                  )}
                  {syncing && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[11px] text-muted">
                      <Loader2 size={10} className="animate-spin" /> {t('songs.syncing')}
                    </span>
                  )}
                  {artist.pct != null && (
                    <span className="marquee absolute bottom-2 left-2 rounded-md bg-background/85 px-2 py-0.5 text-2xl text-brand">
                      {artist.pct}%
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="marquee truncate text-2xl">{artist.name}</h3>
                  <p className="text-xs text-muted">
                    {t('songs.heardCount', { count: artist.distinctHeard })}
                    {artist.totalHeard > artist.distinctHeard && <> {t('songs.playsCount', { count: artist.totalHeard })}</>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
