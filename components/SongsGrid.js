'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Music2, Loader2, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/client';

// Your own Songs (/songs) or someone else's (/u/[username]/songs). For
// someone else, `owner` is { id, username } and the sync classifies their
// heard songs instead of yours.
export default function SongsGrid({ artists, basePath, owner = null }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [syncingIds, setSyncingIds] = useState(() => new Set(artists.filter((a) => a.needsSync).map((a) => a.id)));
  const router = useRouter();
  const startedRef = useRef(new Set());

  useEffect(() => {
    const toSync = artists.filter((a) => a.needsSync && !startedRef.current.has(a.id));
    if (!toSync.length) return;

    setSyncingIds((prev) => new Set([...prev, ...toSync.map((a) => a.id)]));

    // One artist at a time: a full discography can be dozens of Spotify
    // calls, and a batch of new artists synced in parallel can trip
    // Spotify's rate limit (which pauses every sync for a while).
    const queue = [...toSync];
    const worker = async () => {
      while (queue.length) {
        const artist = queue.shift();
        startedRef.current.add(artist.id);
        try {
          await fetch('/api/catalog/sync-artist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistId: artist.id, userId: owner?.id }),
          });
        } catch {
          // Ignore — tile just keeps showing whatever it already had.
        }
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(artist.id);
          return next;
        });
        router.refresh();
      }
    };
    worker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

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

      {artists.length > 6 && (
        <div className="relative">
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
