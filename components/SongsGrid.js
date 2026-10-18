'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Music2, Loader2 } from 'lucide-react';

export default function SongsGrid({ artists }) {
  const [query, setQuery] = useState('');
  const [syncingIds, setSyncingIds] = useState(() => new Set(artists.filter((a) => a.needsSync).map((a) => a.id)));
  const router = useRouter();
  const startedRef = useRef(new Set());

  useEffect(() => {
    const toSync = artists.filter((a) => a.needsSync && !startedRef.current.has(a.id));
    if (!toSync.length) return;

    setSyncingIds((prev) => new Set([...prev, ...toSync.map((a) => a.id)]));

    // A few artists at a time — each sync is a handful of fast Spotify
    // calls, so this fills the grid quickly without hammering the API.
    const queue = [...toSync];
    const worker = async () => {
      while (queue.length) {
        const artist = queue.shift();
        startedRef.current.add(artist.id);
        try {
          await fetch('/api/catalog/sync-artist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistId: artist.id }),
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
    Array.from({ length: 3 }, worker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Songs</h1>
        <p className="text-sm text-muted mt-1">Every artist you&apos;ve heard live, with how much of their catalog you&apos;ve covered.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists..."
          className="w-full bg-surface border border-border rounded-full py-2 pl-10 pr-4 text-foreground focus:outline-none focus:border-brand transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted italic">
          {artists.length === 0
            ? 'Log a concert with a setlist to start building this out.'
            : 'No artists match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((artist) => {
            const syncing = syncingIds.has(artist.id);
            return (
              <Link
                href={`/songs/${artist.id}`}
                key={artist.id}
                className="group relative bg-surface rounded-xl overflow-hidden border border-border hover:border-muted transition flex flex-col"
              >
                <div className="aspect-square bg-surface-light flex items-center justify-center overflow-hidden">
                  {artist.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 size={32} className="text-muted" />
                  )}
                </div>
                {syncing && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 bg-background/80 border border-border rounded-full px-2 py-1 text-[10px] text-muted">
                    <Loader2 size={10} className="animate-spin" /> Syncing
                  </span>
                )}
                <div className="p-3 border-t border-border">
                  <h3 className="font-bold truncate">{artist.name}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {artist.totalHeard} heard · {artist.distinctHeard} distinct
                    {artist.pct != null && ` · ${artist.pct}% of catalog`}
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
