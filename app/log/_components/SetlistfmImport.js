import { useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { applySetlistfm, setlistfmDateToIso } from '../_lib/entryForm';

export function SetlistfmImport({ form, update }) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [importedCount, setImportedCount] = useState(null);

  const search = async () => {
    setOpen(true);
    setImportedCount(null);
    if (!form.artist.trim()) {
      setError(t('log.importNeedsArtist'));
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const params = new URLSearchParams({ artist: form.artist.trim() });
      if (form.date) params.set('date', form.date);
      const res = await fetch(`/api/setlistfm/search?${params.toString()}`);
      if (res.status === 429) throw new Error(t('common.tooManyRequests'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('log.importFailed'));
      setResults(data.setlists);
    } catch (err) {
      setError(err.message ?? t('log.importFailed'));
    } finally {
      setLoading(false);
    }
  };

  const choose = (setlist) => {
    const patch = applySetlistfm(form, setlist);
    update(patch);
    setImportedCount(patch.setlist.length);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-brand/60 bg-surface/50 p-3">
      <button
        type="button"
        onClick={search}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{t('log.importCta')}</span>
          <span className="block text-xs text-muted">{t('log.importHint')}</span>
        </span>
      </button>

      {importedCount != null && !open && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-brand">
          <Check size={14} /> {t('log.importDone', { count: importedCount })}
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">
              {t('log.importMatchesFrom')}{' '}
              <a href="https://www.setlist.fm/" target="_blank" rel="noopener" className="text-brand underline-offset-2 hover:underline">
                setlist.fm
              </a>
            </p>
            <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {!loading && error && <p className="text-xs text-danger">{error}</p>}
          {!loading && !error && results?.length === 0 && <p className="text-xs text-muted">{t('log.importNone')}</p>}
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {!loading &&
              results?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => choose(s)}
                  className="rounded-lg border border-border bg-surface-light p-2.5 text-left transition hover:border-brand"
                >
                  <p className="text-sm font-medium">{date(setlistfmDateToIso(s.eventDate)) || s.eventDate}</p>
                  <p className="truncate text-xs text-muted">
                    {s.venueName}
                    {s.city ? `, ${s.city}` : ''}
                  </p>
                  {s.tourName && <p className="truncate text-xs text-muted">{s.tourName}</p>}
                  <p className="text-xs text-muted">{t('log.songCount', { count: s.songCount })}</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
