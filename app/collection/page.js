'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, List, Image as ImageIcon, Star, Loader2, Music2, ChevronDown, Check } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import TicketStub from '../../components/TicketStub';
import { formatRating } from '../../components/StarRating';

const SORTS = ['date_desc', 'date_asc', 'rating_desc', 'artist_asc'];
const VIEW_KEY = 'collection-view';

// Remembered per device; unavailable storage (private mode) just means
// the default view.
function readSavedView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'list' || saved === 'photos' ? saved : null;
  } catch {
    return null;
  }
}

export default function Collection() {
  const { t, date } = useI18n();
  const [view, setView] = useState('photos');
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [festivalFilter, setFestivalFilter] = useState([]); // festival names; empty = no filter

  useEffect(() => {
    const saved = readSavedView();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setView(saved);
  }, []);

  const chooseView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not saved; the choice still applies for this visit.
    }
  };

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
           artist_id, artists(name, image_url), venues(name, city), festivals(name),
           entry_photos(url, is_cover)`
        )
        .eq('user_id', user.id)
        .eq('entry_type', 'attended');

      if (error) {
        setLoading(false);
        return;
      }

      // One batch request for every cover photo instead of one per entry.
      const rows = data ?? [];
      const coverOf = (e) => (e.entry_photos ?? []).find((p) => p.is_cover)?.url;
      const coverPaths = rows.map(coverOf).filter(Boolean);
      const { data: signed } = coverPaths.length
        ? await supabase.storage.from('entry-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] };
      const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

      const withCovers = rows.map((e) => {
        const cover = coverOf(e);
        return { ...e, coverUrl: (cover && signedByPath.get(cover)) || e.artists?.image_url || null };
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
    if (festivalFilter.length) list = list.filter((e) => festivalFilter.includes(e.festivals?.name));

    return [...list].sort((a, b) => {
      if (sort === 'date_asc') return (a.event_date ?? '').localeCompare(b.event_date ?? '');
      if (sort === 'rating_desc') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'artist_asc') return (a.artists?.name ?? '').localeCompare(b.artists?.name ?? '');
      return (b.event_date ?? '').localeCompare(a.event_date ?? '');
    });
  }, [entries, query, sort, favoritesOnly, festivalFilter]);

  const festivalNames = useMemo(
    () => [...new Set(entries.map((e) => e.festivals?.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [entries]
  );

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
            { id: 'photos', icon: ImageIcon },
            { id: 'list', icon: List },
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => chooseView(id)}
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
            {festivalNames.length > 0 && (
              <FestivalFilter names={festivalNames} selected={festivalFilter} onChange={setFestivalFilter} />
            )}
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
      ) : view === 'list' ? (
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
                      <Star size={11} className="fill-brand" /> {formatRating(entry.rating)}
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

// "Festival: …" dropdown with a checkbox per festival the user has logged.
// Nothing ticked means no festival filter at all.
function FestivalFilter({ names, selected, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (name) => onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  const summary =
    selected.length === 0
      ? t('collection.festivalAll')
      : selected.length === 1
        ? selected[0]
        : t('collection.festivalCount', { count: selected.length });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex max-w-56 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
          selected.length ? 'border-brand bg-brand font-semibold text-brand-foreground' : 'border-border text-muted hover:text-foreground'
        }`}
      >
        <span className="truncate">
          {t('collection.festivalFilter')}: {summary}
        </span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]">
          <div className="flex justify-between gap-2 border-b border-border px-1 pb-2">
            <button type="button" onClick={() => onChange(names)} className="text-sm font-medium text-brand">
              {t('collection.festivalSelectAll')}
            </button>
            <button type="button" onClick={() => onChange([])} className="text-sm text-muted hover:text-foreground">
              {t('collection.festivalClear')}
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto pt-1">
            {names.map((name) => {
              const checked = selected.includes(name);
              return (
                <li key={name}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-light">
                    <input type="checkbox" checked={checked} onChange={() => toggle(name)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? 'border-brand bg-brand text-brand-foreground' : 'border-border'
                      }`}
                    >
                      {checked && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="truncate">{name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
