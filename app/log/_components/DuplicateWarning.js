import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { createClient } from '../../../utils/supabase/client';
import { sameArtistName } from '../../../utils/normalize';
import { billedArtists } from '../../../utils/showArtists';
import { billedNames } from '../_lib/entryForm';

// "You already logged this": one of your shows with the same date and one
// of the same artists. Just a heads-up; saving still works (two sets on
// one day are real, e.g. a festival).
export function DuplicateWarning({ form, editId }) {
  const { t, date } = useI18n();
  const [match, setMatch] = useState(null);
  const names = billedNames(form);
  const key = `${form.date}|${names.join('|')}`;

  useEffect(() => {
    if (!form.date || !names.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('concert_entries')
        .select('id, event_date, artist_id, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name))')
        .eq('user_id', user.id)
        .eq('event_date', form.date);
      const found = (data ?? []).find(
        (entry) =>
          entry.id !== editId &&
          billedArtists(entry).some((artist) => names.some((name) => sameArtistName(name, artist.name)))
      );
      if (!cancelled) setMatch(found ?? null);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // key covers the date and every billed name
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, editId]);

  // Only show a match for what's currently typed.
  if (!match || match.event_date !== form.date || !names.length) return null;
  const artist = billedArtists(match).map((a) => a.name).join(' & ');

  return (
    <div role="status" className="flex items-start gap-2.5 rounded-xl border border-brand/60 bg-brand/10 p-3 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-brand" />
      <div className="flex flex-col gap-0.5">
        <p>{t('log.duplicate', { artist, date: date(form.date) })}</p>
        <p className="text-xs text-muted">
          {t('log.duplicateHint')}{' '}
          <Link href={`/entry/${match.id}`} target="_blank" className="text-brand underline-offset-2 hover:underline">
            {t('log.duplicateOpen')}
          </Link>
        </p>
      </div>
    </div>
  );
}
