import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '../../utils/supabase/server';
import { getI18n } from '../../i18n/server';
import { cityName } from '../../utils/placeNames';
import { countOutings, topByOutings } from '../../utils/outings';
import { fetchAllIn } from '../../utils/fetchAll';
import { checked } from '../../utils/checked';

function topCounts(items, keyFn, limit) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// Billing tiers, like a festival poster: one headliner, then smaller type
// for each row further down the bill.
const TIERS = [
  { size: 1, className: 'text-6xl md:text-8xl text-brand' },
  { size: 3, className: 'text-4xl md:text-5xl' },
  { size: 5, className: 'text-2xl md:text-3xl' },
  { size: 8, className: 'text-xl text-muted' },
];

function billing(artists) {
  const rows = [];
  let start = 0;
  for (const tier of TIERS) {
    const slice = artists.slice(start, start + tier.size);
    if (slice.length) rows.push({ ...tier, artists: slice });
    start += tier.size;
  }
  return rows;
}

export default async function Stats() {
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: attended } = checked(await supabase
    .from('concert_entries')
    .select('id, festival_id, event_date, venue_id, artists(name), festivals(name), venues(name, city, city_id, cities(name_en, name_pl))')
    .eq('user_id', user.id)
    .eq('entry_type', 'attended'));

  const entries = attended ?? [];
  const entryIds = entries.map((e) => e.id);
  const setlistRows = await fetchAllIn(() => supabase.from('entry_setlist').select('song_name'), 'entry_id', entryIds);

  // Cities and venues are counted by identity (a linked GeoNames city, a
  // venue row), so "Warsaw" and "Warszawa" are one city; festivals count
  // once per year (see utils/outings.js).
  const cityKey = (e) => (e.venues?.city_id ? `id:${e.venues.city_id}` : e.venues?.city?.trim().toLowerCase() || null);
  const summary = [
    { value: countOutings(entries), key: 'stats.eventsLabel' },
    { value: entries.length, key: 'stats.showsLabel' },
    { value: new Set(entries.map((e) => e.artists?.name).filter(Boolean)).size, key: 'stats.artistsLabel' },
    { value: (setlistRows ?? []).length, key: 'stats.songsLabel' },
    { value: new Set(entries.map(cityKey).filter(Boolean)).size, key: 'stats.citiesLabel' },
  ].map((s) => ({ ...s, label: t(s.key, { count: s.value }) }));

  const lineup = billing(topCounts(entries, (e) => e.artists?.name, 17));
  const topSongs = topCounts(setlistRows ?? [], (s) => s.song_name, 10);
  const topVenues = topByOutings(
    entries,
    (e) => e.venue_id,
    (e) => [e.venues?.name, cityName(e.venues, locale)].filter(Boolean).join(', '),
    5
  );
  const topCities = topByOutings(entries, cityKey, (e) => cityName(e.venues, locale), 5);

  // Festivals: editions (distinct years) and sets seen at each.
  const festivalMap = new Map();
  for (const e of entries) {
    if (!e.festival_id) continue;
    if (!festivalMap.has(e.festival_id)) {
      festivalMap.set(e.festival_id, { id: e.festival_id, name: e.festivals?.name ?? '', years: new Set(), sets: 0 });
    }
    const f = festivalMap.get(e.festival_id);
    f.sets += 1;
    if (e.event_date) f.years.add(e.event_date.slice(0, 4));
  }
  const festivals = [...festivalMap.values()].sort((a, b) => b.years.size - a.years.size || b.sets - a.sets);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-6 md:py-10">
      <Link href="/profile" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> {t('friends.backToProfile')}
      </Link>

      <section className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
        <h1 className="text-sm text-muted">{t('stats.lineupTitle')}</h1>
        {lineup.length === 0 ? (
          <p className="max-w-sm text-muted">{t('stats.empty')}</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {lineup.map((row) => (
              <p key={row.size} className={`marquee flex flex-wrap justify-center gap-x-5 gap-y-1 ${row.className}`}>
                {row.artists.map((a) => (
                  <span key={a.name} title={t('stats.seenTimes', { count: a.count })}>
                    {a.name}
                  </span>
                ))}
              </p>
            ))}
          </div>
        )}
        <dl className="mt-4 grid w-full grid-cols-3 gap-y-5 border-t border-dashed border-border pt-6 sm:grid-cols-5">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <dt className="order-2 text-sm text-muted">{s.label}</dt>
              <dd className="marquee order-1 text-4xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {festivals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('stats.festivals')}</h2>
          <ul className="flex flex-col">
            {festivals.map((f) => (
              <li key={f.id} className="border-b border-border last:border-b-0">
                <Link href={`/festival/${f.id}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:text-brand">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {f.years.size > 1 && <>{t('festival.editions', { count: f.years.size })}, </>}
                    {t('festival.sets', { count: f.sets })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RankedList title={t('stats.topSongs')} items={topSongs} countLabel={(n) => t('stats.timesHeard', { count: n })} />
      <div className="grid gap-12 md:grid-cols-2">
        <RankedList title={t('stats.topVenues')} items={topVenues} countLabel={(n) => t('stats.visits', { count: n })} />
        <RankedList title={t('stats.topCities')} items={topCities} countLabel={(n) => t('stats.visits', { count: n })} />
      </div>
    </main>
  );
}

function RankedList({ title, items, countLabel }) {
  if (items.length === 0) return null;
  const max = items[0].count;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="marquee text-3xl">{title}</h2>
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 text-sm text-muted">{countLabel(item.count)}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-brand" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
