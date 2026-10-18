'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, Image as ImageIcon, LayoutGrid, Grid3x3, List, Star, X, Loader2,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

const viewOptions = [
  { id: 'grid', label: 'Gallery', icon: LayoutGrid },
  { id: 'compact', label: 'Compact', icon: Grid3x3 },
  { id: 'list', label: 'List', icon: List },
];

const sortOptions = [
  { id: 'date_desc', label: 'Date (newest)' },
  { id: 'date_asc', label: 'Date (oldest)' },
  { id: 'rating_desc', label: 'Rating (highest)' },
  { id: 'artist_asc', label: 'Artist (A-Z)' },
];

export default function Collection() {
  const supabase = createClient();
  const [view, setView] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [festivalsOnly, setFestivalsOnly] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('concert_entries')
        .select(
          `id, event_date, rating, is_favorite, festival_id,
           artist_id, artists(name, image_url), venues(name, city),
           entry_photos(url, position)`
        )
        .eq('user_id', user.id)
        .eq('entry_type', 'attended');

      if (error) {
        setLoading(false);
        return;
      }

      const withCovers = await Promise.all(
        (data ?? []).map(async (entry) => {
          const photos = (entry.entry_photos ?? []).sort((a, b) => a.position - b.position);
          let coverUrl = null;
          if (photos[0]) {
            const { data: signed } = await supabase.storage
              .from('entry-photos')
              .createSignedUrl(photos[0].url, 3600);
            coverUrl = signed?.signedUrl ?? null;
          }

          let fallbackImageUrl = entry.artists?.image_url ?? null;
          if (!coverUrl && !fallbackImageUrl && entry.artist_id) {
            try {
              const res = await fetch('/api/spotify/artist-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artistId: entry.artist_id }),
              });
              const json = await res.json();
              fallbackImageUrl = json.imageUrl ?? null;
            } catch {
              // no fallback available — icon placeholder will show instead
            }
          }

          return { ...entry, coverUrl: coverUrl ?? fallbackImageUrl };
        })
      );

      setEntries(withCovers);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = entries;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.artists?.name?.toLowerCase().includes(q) ||
          e.venues?.name?.toLowerCase().includes(q) ||
          e.venues?.city?.toLowerCase().includes(q)
      );
    }
    if (favoritesOnly) list = list.filter((e) => e.is_favorite);
    if (festivalsOnly) list = list.filter((e) => e.festival_id);

    list = [...list].sort((a, b) => {
      if (sort === 'date_asc') return (a.event_date ?? '').localeCompare(b.event_date ?? '');
      if (sort === 'rating_desc') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'artist_asc') return (a.artists?.name ?? '').localeCompare(b.artists?.name ?? '');
      return (b.event_date ?? '').localeCompare(a.event_date ?? '');
    });

    return list;
  }, [entries, query, sort, favoritesOnly, festivalsOnly]);

  if (loading) {
    return (
      <main className="p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" />
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">

      {/* Top bar: search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, venues, or cities..."
            className="w-full bg-surface border border-border rounded-full py-2 pl-10 pr-4 text-foreground focus:outline-none focus:border-brand transition"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`p-2 rounded-full border transition ${
            filtersOpen ? 'bg-brand text-brand-foreground border-brand' : 'bg-surface border-border text-foreground hover:border-muted'
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Filters</h3>
            <button onClick={() => setFiltersOpen(false)} className="text-muted hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <FilterField label="Sort by">
            <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterField>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFestivalsOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                festivalsOnly ? 'bg-brand text-brand-foreground border-brand' : 'border-border text-muted hover:border-brand hover:text-foreground'
              }`}
            >
              Festivals only
            </button>
            <button
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                favoritesOnly ? 'bg-brand text-brand-foreground border-brand' : 'border-border text-muted hover:border-brand hover:text-foreground'
              }`}
            >
              Favorites only
            </button>
          </div>
        </div>
      )}

      {/* Count + view toggle */}
      <div className="flex justify-between items-center text-sm text-muted">
        <p>{filtered.length} concert{filtered.length === 1 ? '' : 's'} logged</p>
        <div className="flex gap-1 bg-surface border border-border rounded-full p-1">
          {viewOptions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              title={label}
              className={`p-1.5 rounded-full transition ${
                view === id ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted italic">
          No concerts match yet — log one to start your collection.
        </div>
      ) : (
        <>
          {/* Gallery view */}
          {view === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((concert) => (
                <Link
                  href={`/entry/${concert.id}`}
                  key={concert.id}
                  className="group relative aspect-square bg-surface rounded-xl overflow-hidden border border-border hover:border-muted transition cursor-pointer flex flex-col"
                >
                  <div className="flex-1 bg-surface-light flex items-center justify-center group-hover:opacity-80 transition overflow-hidden">
                    {concert.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={concert.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} className="text-muted" />
                    )}
                  </div>
                  <div className="bg-surface p-3 border-t border-border">
                    <h3 className="font-bold truncate">{concert.artists?.name ?? 'Unknown artist'}</h3>
                    <p className="text-xs text-muted">{concert.event_date}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Compact view */}
          {view === 'compact' && (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filtered.map((concert) => (
                <Link
                  href={`/entry/${concert.id}`}
                  key={concert.id}
                  className="group relative aspect-square bg-surface-light rounded-xl overflow-hidden border border-border hover:border-muted transition cursor-pointer flex items-center justify-center"
                >
                  {concert.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={concert.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={22} className="text-muted" />
                  )}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center p-2">
                    <span className="text-xs font-bold text-center">{concert.artists?.name ?? 'Unknown artist'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* List view */}
          {view === 'list' && (
            <div className="flex flex-col border border-border rounded-2xl overflow-hidden">
              {filtered.map((concert, i) => (
                <Link
                  href={`/entry/${concert.id}`}
                  key={concert.id}
                  className={`flex items-center gap-4 p-4 bg-surface hover:bg-surface-light transition cursor-pointer ${
                    i !== filtered.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-surface-light border border-border flex items-center justify-center shrink-0 overflow-hidden">
                    {concert.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={concert.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={18} className="text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{concert.artists?.name ?? 'Unknown artist'}</p>
                    <p className="text-xs text-muted truncate">{concert.venues?.name}</p>
                  </div>
                  <p className="text-xs text-muted shrink-0">{concert.event_date}</p>
                  {concert.rating != null && (
                    <div className="flex items-center gap-1 text-brand font-bold shrink-0 w-12 justify-end">
                      <Star size={14} className="fill-brand" /> {concert.rating}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
