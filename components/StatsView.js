import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '../utils/supabase/server';
import { getI18n } from '../i18n/server';
import { cityName } from '../utils/placeNames';
import { countOutings, topByOutings } from '../utils/outings';
import { fetchAllIn } from '../utils/fetchAll';
import { checked } from '../utils/checked';
import { billing, LINEUP_SIZE, rankArtists } from '../utils/lineup';
import { togetherCounts } from '../utils/together';
import { guestAppearances } from '../utils/guests';
import { summarizeFestivals } from '../utils/festivals';
import Avatar from './Avatar';

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

// Type size per poster row (see utils/lineup.js): one headliner, then
// smaller type for each row further down the bill.
const TIER_CLASSES = [
  'text-6xl md:text-8xl text-brand',
  'text-4xl md:text-5xl',
  'text-2xl md:text-3xl',
  'text-xl text-muted',
];

// One person's Stats: yours on /stats, or someone else's on
// /u/[username]/stats (`owner` set). Queries run with the viewer's session,
// so only shows the viewer may see are counted.
export default async function StatsView({ userId, owner = null }) {
  const supabase = await createClient();
  const { t, locale } = await getI18n();

  const { data: attended } = checked(await supabase
    .from('concert_entries')
    .select('id, artist_id, is_support, festival_id, event_date, venue_id, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name)), festivals(name), venues(name, city, city_id, cities(name_en, name_pl)), entry_attendees(user_id, guest_name, profiles(username, avatar_url))')
    .eq('user_id', userId)
    .eq('entry_type', 'attended'));

  const entries = attended ?? [];
  const entryIds = entries.map((e) => e.id);
  const setlistRows = await fetchAllIn(() => supabase.from('entry_setlist').select('entry_id, song_name, guest_artist_id, guest:artists!entry_setlist_guest_artist_id_fkey(name)'), 'entry_id', entryIds);

  // Cities and venues are counted by identity (a linked GeoNames city, a
  // venue row), so "Warsaw" and "Warszawa" are one city; festivals count
  // once per year (see utils/outings.js).
  const songCountByEntry = new Map();
  for (const row of setlistRows) songCountByEntry.set(row.entry_id, (songCountByEntry.get(row.entry_id) ?? 0) + 1);
  const ranked = rankArtists(entries, songCountByEntry);

  const cityKey = (e) => (e.venues?.city_id ? `id:${e.venues.city_id}` : e.venues?.city?.trim().toLowerCase() || null);
  const summary = [
    { value: countOutings(entries), key: 'stats.eventsLabel' },
    { value: entries.length, key: 'stats.showsLabel' },
    { value: ranked.length, key: 'stats.artistsLabel' },
    { value: (setlistRows ?? []).length, key: 'stats.songsLabel' },
    { value: new Set(entries.map(cityKey).filter(Boolean)).size, key: 'stats.citiesLabel' },
  ].map((s) => ({ ...s, label: t(s.key, { count: s.value }) }));

  const lineup = billing(ranked.slice(0, LINEUP_SIZE));
  // Who you go with is about you; not shown on other people's Stats.
  const together = owner ? [] : togetherCounts(entries).slice(0, 5);
  const guests = guestAppearances(setlistRows).slice(0, 5);
  const topSongs = topCounts(setlistRows ?? [], (s) => s.song_name, 10);
  const topVenues = topByOutings(
    entries,
    (e) => e.venue_id,
    (e) => [e.venues?.name, cityName(e.venues, locale)].filter(Boolean).join(', '),
    5
  );
  const topCities = topByOutings(entries, cityKey, (e) => cityName(e.venues, locale), 5);

  const festivals = summarizeFestivals(entries);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-6 md:py-10">
      <Link
        href={owner ? `/u/${owner.username}` : '/profile'}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> {owner ? owner.username : t('friends.backToProfile')}
      </Link>

      <section className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
        <h1 className="text-sm text-muted">
          {owner ? t('stats.lineupTitleOf', { name: owner.username }) : t('stats.lineupTitle')}
        </h1>
        {lineup.length === 0 ? (
          <p className="max-w-sm text-muted">{t('stats.empty')}</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {lineup.map((row) => (
              <p key={row.tier} className={`marquee flex flex-wrap justify-center gap-x-5 gap-y-1 ${TIER_CLASSES[row.tier]}`}>
                {row.artists.map((a) => (
                  <span key={a.name} title={t('stats.seenTimes', { count: a.shows })}>
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
                <Link href={`/festival/${f.id}${owner ? `?u=${owner.username}` : ''}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:text-brand">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {f.editions > 1 && <>{t('festival.editions', { count: f.editions })}, </>}
                    {t('festival.sets', { count: f.sets })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {together.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('stats.together')}</h2>
          <ul className="flex flex-col">
            {together.map((p) => {
              const label = (
                <>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar username={p.name} src={p.avatar} size={28} />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {t('stats.togetherEvents', { count: p.events })}
                    {p.shows > p.events && <> · {t('stats.togetherShows', { count: p.shows })}</>}
                  </span>
                </>
              );
              return (
                <li key={p.userId ?? p.name} className="border-b border-border last:border-b-0">
                  {p.userId ? (
                    <Link href={`/u/${p.name}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                      {label}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between gap-3 py-2">{label}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {guests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('stats.guests')}</h2>
          <ul className="flex flex-col">
            {guests.map((g) => (
              <li key={g.name} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
                <span className="truncate">{g.name}</span>
                <span className="shrink-0 text-sm text-muted">
                  {t('stats.guestShows', { count: g.shows })} · {t('stats.guestSongs', { count: g.songs })}
                </span>
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
