import Link from 'next/link';
import { ChevronRight, Flag, Plus, Users } from 'lucide-react';
import { createClient } from '../utils/supabase/server';
import { getI18n } from '../i18n/server';
import TicketStub from '../components/TicketStub';
import PastPlans from '../components/PastPlans';
import TaggedShows from '../components/TaggedShows';
import { countOutings } from '../utils/outings';
import { checked } from '../utils/checked';
import { TICKET_FIELDS as ENTRY_FIELDS } from '../utils/entryFields';
import { daysBefore, nextMilestone, onThisDay } from '../utils/home';

export default async function Home() {
  const supabase = await createClient();
  const { t, ago } = await getI18n();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: attended }, { data: lastShowRows }, { data: upcoming }, { data: followRows }, { data: pastPlans }] = (await Promise.all([
    supabase
      .from('concert_entries')
      .select('id, artist_id, festival_id, event_date, venue_id, venues(city, city_id), entry_co_artists(artist_id)')
      .eq('user_id', user.id)
      .eq('entry_type', 'attended'),
    supabase
      .from('concert_entries')
      .select(ENTRY_FIELDS)
      .eq('user_id', user.id)
      .eq('entry_type', 'attended')
      .order('event_date', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('concert_entries')
      .select(ENTRY_FIELDS)
      .eq('user_id', user.id)
      .eq('entry_type', 'planned')
      .or(`event_date.gte.${today},event_date.is.null`)
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(5),
    supabase.from('follows').select('followee_id').eq('follower_id', user.id).eq('status', 'accepted'),
    // Planned shows whose date has passed: ask whether you went.
    supabase
      .from('concert_entries')
      .select(ENTRY_FIELDS)
      .eq('user_id', user.id)
      .eq('entry_type', 'planned')
      .lt('event_date', today)
      .order('event_date', { ascending: false })
      .limit(3),
  ])).map(checked);

  // Friends' activity lives on the Friends page; Home only says how much
  // is new this week. Visibility is enforced by the database.
  const followedIds = (followRows ?? []).map((f) => f.followee_id);
  const weekAgo = daysBefore(today, 7);
  // Shows from today's date in earlier years ("on this day").
  const memories = onThisDay(attended ?? [], today).slice(0, 2);
  const [{ count: friendsNew }, { count: songsHeard }, { data: memoryRows }] = (await Promise.all([
    followedIds.length
      ? supabase
          .from('concert_entries')
          .select('id', { count: 'exact', head: true })
          .in('user_id', followedIds)
          .gte('created_at', weekAgo)
      : Promise.resolve({ count: 0 }),
    supabase
      .from('entry_setlist')
      .select('id, concert_entries!inner(user_id, entry_type)', { count: 'exact', head: true })
      .eq('concert_entries.user_id', user.id)
      .eq('concert_entries.entry_type', 'attended'),
    memories.length
      ? supabase.from('concert_entries').select(ENTRY_FIELDS).in('id', memories.map((m) => m.id))
      : Promise.resolve({ data: [] }),
  ])).map(checked);
  const memoryEntries = memories
    .map((m) => ({ ...(memoryRows ?? []).find((e) => e.id === m.id), yearsAgo: m.yearsAgo }))
    .filter((e) => e.id);

  // Friends' shows you were marked at and haven't logged yet: not copied
  // already, and nothing of yours by the same artist on that date.
  const { data: tagRows } = checked(
    await supabase
      .from('entry_attendees')
      .select(`concert_entries(${ENTRY_FIELDS}, artist_id, user_id, profiles!concert_entries_user_id_fkey(username))`)
      .eq('user_id', user.id)
  );
  const taggedAll = (tagRows ?? []).map((r) => r.concert_entries).filter((e) => e && e.user_id !== user.id);
  let tagged = [];
  if (taggedAll.length) {
    const dates = [...new Set(taggedAll.map((e) => e.event_date).filter(Boolean))];
    const [{ data: copies }, { data: sameDay }] = (await Promise.all([
      supabase.from('concert_entries').select('copied_from').eq('user_id', user.id).in('copied_from', taggedAll.map((e) => e.id)),
      dates.length
        ? supabase.from('concert_entries').select('event_date, artist_id').eq('user_id', user.id).in('event_date', dates)
        : Promise.resolve({ data: [] }),
    ])).map(checked);
    const copied = new Set((copies ?? []).map((c) => c.copied_from));
    const logged = new Set((sameDay ?? []).map((e) => `${e.event_date}:${e.artist_id}`));
    tagged = taggedAll.filter((e) => !copied.has(e.id) && !logged.has(`${e.event_date}:${e.artist_id}`));
  }

  // Festivals count once per year, like the Stats page.
  const shows = countOutings(attended ?? []);
  // Joint shows count each billed artist.
  const artists = new Set(
    (attended ?? []).flatMap((e) => [e.artist_id, ...(e.entry_co_artists ?? []).map((c) => c.artist_id)]).filter(Boolean)
  ).size;
  const cities = new Set(
    (attended ?? [])
      .map((e) => (e.venues?.city_id ? `id:${e.venues.city_id}` : e.venues?.city?.trim().toLowerCase()))
      .filter(Boolean)
  ).size;

  const nextShow = upcoming?.[0];
  const laterShows = (upcoming ?? []).slice(1);
  const lastShow = lastShowRows?.[0];
  const heroEntry = nextShow ?? lastShow;
  const isNewHere = shows === 0 && !nextShow;
  const milestone = nextMilestone(shows);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-6 md:py-10">
      {tagged.length > 0 && <TaggedShows entries={tagged} userId={user.id} />}
      {pastPlans?.length > 0 && <PastPlans entries={pastPlans} />}

      {isNewHere ? (
        <section className="flex flex-col items-start gap-4 pt-6">
          <h1 className="marquee text-6xl md:text-7xl">{t('home.emptyTitle')}</h1>
          <p className="max-w-md text-muted">{t('home.emptyBody')}</p>
          <Link
            href="/log"
            className="flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-bold text-brand-foreground transition hover:brightness-105"
          >
            <Plus size={18} strokeWidth={2.5} /> {t('home.emptyCta')}
          </Link>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <h1 className="text-sm font-medium text-muted">{nextShow ? t('home.nextUp') : t('home.lastShow')}</h1>
          <TicketStub entry={heroEntry} size="lg" />
          {/* A peek at Stats; the whole strip opens it. */}
          <Link href="/stats" className="group mt-2 flex flex-col gap-2 rounded-xl border border-border p-3 transition hover:border-brand">
            <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <Stat value={shows} label={t('home.statEvents', { count: shows })} />
              <Stat value={artists} label={t('home.statArtists', { count: artists })} />
              <Stat value={songsHeard ?? 0} label={t('home.statSongs', { count: songsHeard ?? 0 })} />
              <Stat value={cities} label={t('home.statCities', { count: cities })} />
            </span>
            <span className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Flag size={13} className="text-brand" />
                {t('home.milestone', { remaining: milestone.remaining, target: milestone.target, count: milestone.remaining })}
              </span>
              <ChevronRight size={15} className="shrink-0 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      )}

      {memoryEntries.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('home.onThisDay')}</h2>
          {memoryEntries.map((entry) => (
            <TicketStub key={entry.id} entry={entry} meta={t('home.yearsAgo', { count: entry.yearsAgo })} />
          ))}
        </section>
      )}

      <Link
        href="/friends"
        className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-brand"
      >
        <Users size={18} className="shrink-0 text-brand" />
        <span className="flex-1 text-sm">
          {followedIds.length === 0
            ? t('home.friendsCardNone')
            : friendsNew > 0
              ? t('home.friendsCardNew', { count: friendsNew })
              : t('home.friendsCardQuiet')}
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted transition group-hover:translate-x-0.5" />
      </Link>

      {laterShows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{t('home.alsoComing')}</h2>
          <div className="flex flex-col gap-3">
            {laterShows.map((entry) => (
              <TicketStub key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ value, label }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="marquee text-3xl text-brand">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </span>
  );
}
