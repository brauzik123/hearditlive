'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Music2, Check, X, Disc3, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';

function Tile({ imageUrl, icon: Icon, title, heard, total, active, onClick }) {
  const pct = total ? Math.round((heard / total) * 100) : null;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group flex flex-col gap-2 rounded-xl p-1.5 text-left transition ${active ? 'bg-surface ring-2 ring-brand' : 'hover:bg-surface'}`}
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-light">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon size={28} className="text-muted" />
        )}
      </div>
      <div className="min-w-0 px-1 pb-1">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <div className="mt-1 flex items-center gap-2">
          {pct != null && (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-light">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          )}
          <span className="shrink-0 text-xs text-muted">{total ? `${heard}/${total}` : heard}</span>
        </div>
      </div>
    </button>
  );
}

function SongRow({ song, number, showOthersToggle, artistId }) {
  const { t } = useI18n();
  const [excluded, setExcluded] = useState(song.excluded ?? false);
  const [busy, setBusy] = useState(false);

  const toggleExclude = async () => {
    setBusy(true);
    const supabase = createClient();
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
      await supabase.from('song_count_exclusions').insert({ user_id: user.id, artist_id: artistId, song_name: song.name });
      setExcluded(true);
    }
    setBusy(false);
  };

  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-1 py-2.5 last:border-b-0">
      {showOthersToggle ? (
        <button
          onClick={toggleExclude}
          disabled={busy}
          aria-pressed={!excluded}
          aria-label={excluded ? t('songs.countIt') : t('songs.dontCount')}
          title={excluded ? t('songs.countIt') : t('songs.dontCount')}
          className="shrink-0"
        >
          {excluded ? <X size={16} className="text-muted" /> : <Check size={16} className="text-brand" />}
        </button>
      ) : number != null ? (
        <span className={`marquee w-6 shrink-0 text-right text-lg ${song.heard ? 'text-brand' : 'text-muted/60'}`}>
          {number}
        </span>
      ) : (
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${song.heard !== false ? 'bg-brand' : 'border border-border'}`} />
      )}
      <span className={`flex-1 truncate ${song.heard === false || excluded ? 'text-muted' : ''}`}>{song.name}</span>
      {song.count > 0 && (
        <span className="shrink-0 text-sm text-muted">{t('songs.timesHeard', { count: song.count })}</span>
      )}
    </li>
  );
}

// `readOnly` (someone else's Songs) hides the count/don't-count toggles;
// `ownerId` makes the background sync classify that user's heard songs.
export default function ArtistSongsView({
  artist,
  albums: allAlbums,
  singles,
  features,
  others,
  needsSync,
  catalogMissing = false,
  backHref,
  backLabel,
  readOnly = false,
  ownerId = null,
}) {
  const { t } = useI18n();
  // Only albums/EPs with at least one heard track: an untouched 0% tile
  // is just clutter here.
  const albums = allAlbums.filter((album) => album.songs.some((s) => s.heard));
  const groups = [
    ...albums.map((a) => ({ type: 'album', id: a.id })),
    ...(singles.length ? [{ type: 'singles', id: 'singles' }] : []),
    ...(features.length ? [{ type: 'features', id: 'features' }] : []),
    ...(others.length ? [{ type: 'others', id: 'others' }] : []),
  ];
  const [selectedId, setSelectedId] = useState(null);
  const [syncing, setSyncing] = useState(needsSync);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!needsSync || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        await fetch('/api/catalog/sync-artist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistId: artist.id, userId: ownerId }),
        });
      } catch {
        // Keep showing whatever is already cached.
      }
      setSyncing(false);
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSync]);

  // Falls back to the first group when nothing (or something that no
  // longer exists after a sync) is selected.
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0] ?? null;

  const selectedSongs = (() => {
    if (!selected) return null;
    if (selected.type === 'album') return albums.find((a) => a.id === selected.id);
    if (selected.type === 'singles') return { name: t('songs.singles'), songs: singles };
    if (selected.type === 'features') return { name: t('songs.features'), songs: features };
    return { name: t('songs.others'), songs: others, hint: readOnly ? null : t('songs.othersHint') };
  })();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:py-10">
      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> {backLabel ?? t('songs.backToSongs')}
      </Link>

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
          {artist.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artist.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music2 size={26} className="text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="marquee text-5xl [overflow-wrap:anywhere]">{artist.name}</h1>
          {syncing && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Loader2 size={13} className="animate-spin" /> {t('songs.syncingCatalog')}
            </p>
          )}
        </div>
      </div>

      {catalogMissing && !syncing && (
        <p role="status" className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          {t('songs.catalogPending')}
        </p>
      )}

      {groups.length === 0 ? (
        !syncing && <p className="text-sm text-muted">{t('songs.nothingYet')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albums.map((album) => (
            <Tile
              key={album.id}
              imageUrl={album.imageUrl}
              icon={Disc3}
              title={album.name}
              heard={album.songs.filter((s) => s.heard).length}
              total={album.songs.length}
              active={selected?.id === album.id}
              onClick={() => setSelectedId(album.id)}
            />
          ))}
          {singles.length > 0 && (
            <Tile icon={Music2} title={t('songs.singles')} heard={singles.length} active={selected?.id === 'singles'} onClick={() => setSelectedId('singles')} />
          )}
          {features.length > 0 && (
            <Tile icon={Sparkles} title={t('songs.features')} heard={features.length} active={selected?.id === 'features'} onClick={() => setSelectedId('features')} />
          )}
          {others.length > 0 && (
            <Tile icon={HelpCircle} title={t('songs.others')} heard={others.length} active={selected?.id === 'others'} onClick={() => setSelectedId('others')} />
          )}
        </div>
      )}

      {selectedSongs && (
        <section className="flex flex-col gap-2">
          <h2 className="marquee text-3xl">{selectedSongs.name}</h2>
          {selectedSongs.hint && <p className="text-sm text-muted">{selectedSongs.hint}</p>}
          {selectedSongs.songs.length === 0 ? (
            <p className="text-sm text-muted">{t('songs.noSongs')}</p>
          ) : (
            <ol className="flex flex-col">
              {selectedSongs.songs.map((song, i) => (
                <SongRow
                  key={song.name}
                  song={song}
                  number={selected.type === 'album' ? i + 1 : null}
                  artistId={artist.id}
                  showOthersToggle={!readOnly && selected.type === 'others'}
                />
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}
