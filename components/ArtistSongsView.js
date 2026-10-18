'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Music2, Check, X, Disc3, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';

function Tile({ imageUrl, icon: Icon, title, subtitle, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group bg-surface rounded-xl overflow-hidden border transition flex flex-col text-left ${
        active ? 'border-brand' : 'border-border hover:border-muted'
      }`}
    >
      <div className="aspect-square bg-surface-light flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon size={28} className="text-muted" />
        )}
      </div>
      <div className="p-3 border-t border-border">
        <h3 className="font-bold truncate text-sm">{title}</h3>
        <p className="text-xs text-muted mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}

function SongRow({ song, showOthersToggle, artistId }) {
  const supabase = createClient();
  const [excluded, setExcluded] = useState(song.excluded ?? false);
  const [busy, setBusy] = useState(false);

  const toggleExclude = async () => {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (excluded) {
      await supabase
        .from('song_count_exclusions')
        .delete()
        .eq('user_id', user.id)
        .eq('artist_id', artistId)
        .eq('song_name', song.name);
      setExcluded(false);
    } else {
      await supabase
        .from('song_count_exclusions')
        .insert({ user_id: user.id, artist_id: artistId, song_name: song.name });
      setExcluded(true);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0">
      {showOthersToggle ? (
        <button onClick={toggleExclude} disabled={busy} className="shrink-0" title="Count toward totals?">
          {excluded ? <X size={16} className="text-muted" /> : <Check size={16} className="text-brand" />}
        </button>
      ) : (
        <span className={`w-4 h-4 rounded-full border shrink-0 ${song.heard ? 'bg-brand border-brand' : 'border-border'}`} />
      )}
      <span className={`flex-1 text-sm truncate ${song.heard === false ? 'text-muted' : ''}`}>{song.name}</span>
      {song.count > 0 && <span className="text-xs text-muted shrink-0">{song.count}x</span>}
    </div>
  );
}

export default function ArtistSongsView({ artist, albums: allAlbums, singles, features, others, needsSync }) {
  // Only show albums/EPs with at least one heard track — an untouched 0%
  // tile isn't useful clutter here (unlike the Songs grid, where every
  // heard artist should appear regardless of coverage).
  const albums = allAlbums.filter((album) => album.songs.some((s) => s.heard));
  const [selected, setSelected] = useState(albums[0] ? { type: 'album', id: albums[0].id } : null);
  const [syncing, setSyncing] = useState(needsSync);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!needsSync || startedRef.current) return;
    startedRef.current = true;
    setSyncing(true);
    (async () => {
      try {
        await fetch('/api/catalog/sync-artist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistId: artist.id }),
        });
      } catch {
        // Ignore — page just keeps showing whatever it already had.
      }
      setSyncing(false);
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSync]);

  const select = (type, id) => setSelected({ type, id });

  const selectedSongs = (() => {
    if (!selected) return null;
    if (selected.type === 'album') return albums.find((a) => a.id === selected.id);
    if (selected.type === 'singles') return { name: 'Singles', songs: singles };
    if (selected.type === 'features') return { name: 'Features', songs: features };
    if (selected.type === 'others') return { name: 'Others', songs: others };
    return null;
  })();

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <Link href="/songs" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
        <ArrowLeft size={16} /> Back to Songs
      </Link>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-surface-light border border-border flex items-center justify-center overflow-hidden shrink-0">
          {artist.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music2 size={24} className="text-muted" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{artist.name}</h1>
          {syncing && (
            <p className="flex items-center gap-1.5 text-xs text-muted mt-1">
              <Loader2 size={12} className="animate-spin" /> Syncing catalog from Spotify — the list below will fill in shortly.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {albums.map((album) => {
          const heardCount = album.songs.filter((s) => s.heard).length;
          return (
            <Tile
              key={album.id}
              imageUrl={album.imageUrl}
              icon={Disc3}
              title={album.name}
              subtitle={`${heardCount}/${album.songs.length} heard`}
              active={selected?.type === 'album' && selected.id === album.id}
              onClick={() => select('album', album.id)}
            />
          );
        })}
        {singles.length > 0 && (
          <Tile
            icon={Music2}
            title="Singles"
            subtitle={`${singles.length} heard`}
            active={selected?.type === 'singles'}
            onClick={() => select('singles')}
          />
        )}
        {features.length > 0 && (
          <Tile
            icon={Sparkles}
            title="Features"
            subtitle={`${features.length} heard`}
            active={selected?.type === 'features'}
            onClick={() => select('features')}
          />
        )}
        {others.length > 0 && (
          <Tile
            icon={HelpCircle}
            title="Others"
            subtitle={`${others.length} unsorted`}
            active={selected?.type === 'others'}
            onClick={() => select('others')}
          />
        )}
      </div>

      {!syncing && albums.length === 0 && singles.length === 0 && features.length === 0 && others.length === 0 && (
        <p className="text-sm text-muted italic">Nothing synced for this artist yet.</p>
      )}

      {selectedSongs && (
        <section className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border bg-surface-light">
            <h2 className="font-bold text-sm">{selectedSongs.name}</h2>
          </div>
          {selectedSongs.songs.length === 0 ? (
            <p className="text-sm text-muted italic p-4">No songs here.</p>
          ) : (
            selectedSongs.songs.map((song) => (
              <SongRow
                key={song.name}
                song={song}
                artistId={artist.id}
                showOthersToggle={selected.type === 'others'}
              />
            ))
          )}
        </section>
      )}
    </main>
  );
}
