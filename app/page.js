import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '../utils/supabase/server';
import { getI18n } from '../i18n/server';
import TicketStub from '../components/TicketStub';
import PastPlans from '../components/PastPlans';
import TaggedShows from '../components/TaggedShows';
import { countOutings } from '../utils/outings';
import { checked } from '../utils/checked';

const ENTRY_FIELDS = 'id, entry_type, event_date, rating, ticket_status, is_support, created_at, artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name)), venues(name, city, city_id, cities(name_en, name_pl))';

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

  // Activity feed: latest entries from people you follow. Visibility is
  // enforced by the database (private profiles, friends-only entries), so
  // this only ever returns what you're allowed to see.
  const followedIds = (followRows ?? []).map((f) => f.followee_id);
  const { data: feedRows } = followedIds.length
    ? checked(await supabase
        .from('concert_entries')
        .select(`${ENTRY_FIELDS}, profiles!concert_entries_user_id_fkey(username)`)
        .in('user_id', followedIds)
        .order('created_at', { ascending: false })
        .limit(20))
    : { data: [] };
  const feed = feedRows ?? [];

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
          <Link href="/stats" className="group mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <Stat value={shows} label={t('home.statEvents', { count: shows })} />
            <Stat value={artists} label={t('home.statArtists', { count: artists })} />
            <Stat value={cities} label={t('home.statCities', { count: cities })} />
            <span className="text-sm text-muted underline-offset-4 group-hover:text-foreground group-hover:underline">
              {t('home.allStats')}
            </span>
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="marquee text-3xl">{t('home.feedTitle')}</h2>
          <Link href="/friends" className="shrink-0 whitespace-nowrap text-sm text-muted hover:text-foreground">
            {t('home.findFriends')}
          </Link>
        </div>
        {feed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
            {followedIds.length === 0 ? t('home.feedEmptyNoFollows') : t('home.feedEmpty')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {feed.map((entry) => (
              <TicketStub
                key={entry.id}
                entry={entry}
                byline={t(entry.entry_type === 'planned' ? 'home.bylinePlanned' : 'home.bylineAttended', {
                  name: entry.profiles?.username,
                })}
                meta={ago(entry.created_at)}
              />
            ))}
          </div>
        )}
      </section>

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
