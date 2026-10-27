import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Tent } from 'lucide-react';
import { createClient } from '../../../utils/supabase/server';
import { getI18n } from '../../../i18n/server';
import { getProfileAccess } from '../../../utils/profileAccess';
import TicketStub from '../../../components/TicketStub';

// One festival, as one person experienced it: every year they went, the
// dates, each set as a ticket, and the photos from those sets. Yours by
// default; ?u=username shows someone else's (if their profile allows it —
// the database also filters entries they've hidden).
export default async function FestivalPage({ params, searchParams }) {
  const { id } = await params;
  const { u } = await searchParams;
  const supabase = await createClient();
  const { t, date } = await getI18n();

  let owner;
  if (u) {
    const access = await getProfileAccess(supabase, u);
    if (!access) notFound();
    if (access.isSelf) redirect(`/festival/${id}`);
    if (!access.canViewContent) redirect(`/u/${access.profile.username}`);
    owner = access.profile;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    owner = { id: user.id, username: null };
  }

  const [{ data: festival }, { data: rows }] = await Promise.all([
    supabase.from('festivals').select('id, name, city').eq('id', id).maybeSingle(),
    supabase
      .from('concert_entries')
      .select(
        'id, entry_type, event_date, rating, ticket_status, artist_id, artists(name), venues(name, city, city_id, cities(name_en, name_pl)), entry_photos(url, is_cover)'
      )
      .eq('user_id', owner.id)
      .eq('festival_id', id)
      .order('event_date', { ascending: true, nullsFirst: false }),
  ]);
  if (!festival || !rows?.length) notFound();

  // Cover photos of every set, signed in one batch.
  const covers = rows.flatMap((e) => (e.entry_photos ?? []).filter((p) => p.is_cover).map((p) => ({ entryId: e.id, url: p.url })));
  const { data: signed } = covers.length
    ? await supabase.storage.from('entry-photos').createSignedUrls(covers.map((c) => c.url), 3600)
    : { data: [] };
  const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const years = new Map();
  for (const entry of rows) {
    const year = entry.event_date?.slice(0, 4) ?? '—';
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(entry);
  }
  const yearGroups = [...years.entries()].sort(([a], [b]) => b.localeCompare(a));
  const artistCount = new Set(rows.map((e) => e.artist_id).filter(Boolean)).size;
  const attendedYears = yearGroups.filter(([, list]) => list.some((e) => e.entry_type === 'attended')).length;

  const backHref = u ? `/u/${owner.username}` : '/collection';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-6 md:py-10">
      <div className="flex flex-col gap-4">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> {u ? t('entry.backToProfile', { name: owner.username }) : t('entry.backToCollection')}
        </Link>
        <div className="flex items-start gap-3">
          <Tent size={28} className="mt-2 shrink-0 text-brand" />
          <div className="min-w-0">
            <h1 className="marquee text-5xl [overflow-wrap:anywhere]">{festival.name}</h1>
            {festival.city && <p className="mt-1 text-muted">{festival.city}</p>}
          </div>
        </div>
        <dl className="flex gap-8">
          {[
            // Editions only mean something when one festival spans several
            // years; most people put the edition in the name ("Clout 5").
            ...(attendedYears > 1 ? [[attendedYears, t('festival.editionsLabel', { count: attendedYears })]] : []),
            [rows.length, t('festival.setsLabel', { count: rows.length })],
            [artistCount, t('stats.artistsLabel', { count: artistCount })],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="order-2 text-sm text-muted">{label}</dt>
              <dd className="marquee order-1 text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {yearGroups.map(([year, entries]) => {
        const dates = entries.map((e) => e.event_date).filter(Boolean).sort();
        const first = dates[0];
        const last = dates[dates.length - 1];
        const photos = entries
          .map((e) => {
            const cover = (e.entry_photos ?? []).find((p) => p.is_cover);
            return cover ? { id: e.id, src: signedByPath.get(cover.url) } : null;
          })
          .filter((p) => p?.src);
        return (
          <section key={year} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="marquee text-4xl text-brand">{year}</h2>
              {first && (
                <span className="text-sm text-muted">
                  {first === last ? date(first) : `${date(first)} – ${date(last)}`}
                </span>
              )}
            </div>
            {photos.length > 0 && (
              <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo) => (
                  <Link key={photo.id} href={`/entry/${photo.id}`} className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt="" className="h-full w-full object-cover" />
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <TicketStub key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
