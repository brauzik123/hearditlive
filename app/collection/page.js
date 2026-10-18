'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Ticket, Image as ImageIcon, Star, Loader2, Music2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import TicketStub from '../../components/TicketStub';

const SORTS = ['date_desc', 'date_asc', 'rating_desc', 'artist_asc'];

export default function Collection() {
  const { t, date } = useI18n();
  const [view, setView] = useState('tickets');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [festivalsOnly, setFestivalsOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('concert_entries')
        .select(
          `id, entry_type, event_date, rating, ticket_status, is_favorite, festival_id,
           artist_id, artists(name, image_url), venues(name, city),
           entry_photos(url, position)`
        )
        .eq('user_id', user.id)
        .eq('entry_type', 'attended');

      if (error) {
        setLoading(false);
        return;
      }

      // One batch request for every cover photo instead of one per entry.
      const rows = data ?? [];
      const coverPaths = rows
        .map((e) => (e.entry_photos ?? []).sort((a, b) => a.position - b.position)[0]?.url)
        .filter(Boolean);
      const { data: signed } = coverPaths.length
        ? await supabase.storage.from('entry-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] };
      const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

      const withCovers = rows.map((e) => {
        const firstPhoto = (e.entry_photos ?? []).sort((a, b) => a.position - b.position)[0]?.url;
        return { ...e, coverUrl: (firstPhoto && signedByPath.get(firstPhoto)) || e.artists?.image_url || null };
      });
      setEntries(withCovers);
      setLoading(false);

      // Artists we have no photo for yet: look each up once, in the
      // background, and fill the covers in as they arrive.
      const missing = [...new Set(withCovers.filter((e) => !e.coverUrl && e.artist_id).map((e) => e.artist_id))];
      for (const artistId of missing) {
        try {
          const res = await fetch('/api/spotify/artist-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artistId }),
          });
          const { imageUrl } = await res.json();
          if (imageUrl) {
            setEntries((list) => list.map((e) => (e.artist_id === artistId && !e.coverUrl ? { ...e, coverUrl: imageUrl } : e)));
          }
        } catch {
          // No photo available; the placeholder stays.
        }
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = entries;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.artists?.name?.toLowerCase().includes(q) ||
          e.venues?.name?.toLowerCase().includes(q) ||
          e.venues?.city?.toLowerCase().includes(q)
      );
    }
    if (favoritesOnly) list = list.filter((e) => e.is_favorite);
    if (festivalsOnly) list = list.filter((e) => e.festival_id);

    return [...list].sort((a, b) => {
      if (sort === 'date_asc') return (a.event_date ?? '').localeCompare(b.event_date ?? '');
      if (sort === 'rating_desc') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'artist_asc') return (a.artists?.name ?? '').localeCompare(b.artists?.name ?? '');
      return (b.event_date ?? '').localeCompare(a.event_date ?? '');
    });
  }, [entries, query, sort, favoritesOnly, festivalsOnly]);

  if (loading) {
    return (
      <main className="flex justify-center p-12">
        <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 md:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="marquee text-5xl">{t('collection.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('collection.count', { count: entries.length })}</p>
        </div>
        <div role="tablist" aria-label={t('collection.view')} className="flex rounded-full border border-border p-1">
          {[
            { id: 'tickets', icon: Ticket },
            { id: 'photos', icon: ImageIcon },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                view === id ? 'bg-brand font-semibold text-brand-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon size={15} /> <span className="hidden sm:inline">{t(`collection.${id}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={17} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('collection.search')}
              aria-label={t('collection.search')}
              className="field rounded-full pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label={t('collection.sortBy')}
              className="filter-select rounded-full px-3"
            >
              {SORTS.map((id) => (
                <option key={id} value={id}>
                  {t(`collection.sort.${id}`)}
                </option>
              ))}
            </select>
            <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>
              {t('collection.favorites')}
            </Chip>
            <Chip active={festivalsOnly} onClick={() => setFestivalsOnly((v) => !v)}>
              {t('collection.festivals')}
            </Chip>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
          <p className="text-muted">{t('collection.empty')}</p>
          <Link href="/log" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
            {t('collection.emptyCta')}
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t('collection.noMatches')}</p>
      ) : view === 'tickets' ? (
        <div className="flex flex-col gap-3">
          {filtered.map((entry) => (
            <TicketStub key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              href={`/entry/${entry.id}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface"
            >
              {entry.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.coverUrl}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music2 size={28} className="text-muted" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-3 pt-10">
                <p className="marquee truncate text-2xl">{entry.artists?.name ?? t('common.unknownArtist')}</p>
                <p className="flex items-center justify-between text-xs text-muted">
                  <span>{date(entry.event_date)}</span>
                  {entry.rating != null && (
                    <span className="flex items-center gap-0.5 font-semibold text-brand">
                      <Star size={11} className="fill-brand" /> {entry.rating}
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active ? 'border-brand bg-brand font-semibold text-brand-foreground' : 'border-border text-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
