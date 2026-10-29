import Link from 'next/link';
import { ChevronRight, Flag, Music2, Plus, Users } from 'lucide-react';
import { createClient } from '../utils/supabase/server';
import { getI18n } from '../i18n/server';
import TicketStub from '../components/TicketStub';
import { billedName } from '../utils/showArtists';
import PastPlans from '../components/PastPlans';
import TaggedShows from '../components/TaggedShows';
import { countOutings } from '../utils/outings';
import { checked } from '../utils/checked';
import { TICKET_FIELDS as ENTRY_FIELDS } from '../utils/entryFields';
import { daysBefore, nextMilestone, onThisDay, pendingTags, thisYearSummary } from '../utils/home';
import { groupFriendShows } from '../utils/friendShows';
import FriendShowRow from './friends/_components/FriendShowRow';

export default async function Home() {
  const supabase = await createClient();
  const { t, date } = await getI18n();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: attended }, { data: lastShowRows }, { data: upcoming }, { data: followRows }, { data: pastPlans }] = (await Promise.all([
    supabase
      .from('concert_entries')
      .select('id, artist_id, festival_id, event_date, venue_id, is_support, venues(city, city_id), artists!concert_entries_artist_id_fkey(name), entry_co_artists(artist_id, position, artists(name))')
      .eq('user_id', user.id)
      .eq('entry_type', 'attended'),
    supabase
      .from('concert_entries')
      .select(`${ENTRY_FIELDS}, entry_photos(url, is_cover), artist_photo:artists!concert_entries_artist_id_fkey(image_url)`)
      .eq('user_id', user.id)
      .eq('entry_type', 'attended')
      .order('event_date', { ascending: false, nullsFirst: false })
      .limit(8),
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
  const [{ count: friendsNew }, { count: songsHeard }, { data: memoryRows }, { data: friendsUpcomingRows }] = (await Promise.all([
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
    // Where the people you follow are going next.
    followedIds.length
      ? supabase
          .from('concert_entries')
          .select(`${ENTRY_FIELDS}, profiles!concert_entries_user_id_fkey(username, avatar_url)`)
          .in('user_id', followedIds)
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(12)
      : Promise.resolve({ data: [] }),
  ])).map(checked);
  const friendsGoing = groupFriendShows(friendsUpcomingRows ?? []).slice(0, 3);
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
    tagged = pendingTags(taggedAll, copies ?? [], sameDay ?? []);
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

  // "Recently": your latest shows after the one at the top, with their cover
  // photo (signed in one batch) or the artist's photo.
  const recentShows = (lastShowRows ?? []).filter((e) => e.id !== heroEntry?.id).slice(0, 6);
  const coverPaths = recentShows.map((e) => (e.entry_photos ?? []).find((p) => p.is_cover)?.url).filter(Boolean);
  const { data: signedCovers } = coverPaths.length
    ? await supabase.storage.from('entry-photos').createSignedUrls(coverPaths, 3600)
    : { data: [] };
  const signedByPath = new Map((signedCovers ?? []).map((c) => [c.path, c.signedUrl]));
  const recentTiles = recentShows.map((e) => {
    const cover = (e.entry_photos ?? []).find((p) => p.is_cover)?.url;
    return { entry: e, image: (cover && signedByPath.get(cover)) || e.artist_photo?.image_url || null };
  });

  // This year so far: events and who you saw most.
  const year = today.slice(0, 4);
  const { events: eventsThisYear, top: topThisYear } = thisYearSummary(attended ?? [], year);

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
            {eventsThisYear > 0 && (
              <span className="text-sm text-muted">
                {t('home.thisYear', { year, count: eventsThisYear })}
                {topThisYear && <>, {t('home.mostSeen', { name: topThisYear.name })}</>}
              </span>
            )}
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

      {recentTiles.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="home-recent">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-recent" className="marquee text-3xl">
              {t('home.recently')}
            </h2>
            <Link href="/collection" className="shrink-0 text-sm text-muted hover:text-foreground">
              {t('home.allShows')}
            </Link>
          </div>
          <ul className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {recentTiles.map(({ entry, image }) => (
              <li key={entry.id} className="w-32 shrink-0">
                <Link href={`/entry/${entry.id}`} className="group flex flex-col gap-1.5">
                  <span className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-surface">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <Music2 size={26} className="text-muted" />
                    )}
                  </span>
                  <span className="marquee truncate text-lg leading-tight group-hover:text-brand">
                    {billedName(entry) ?? t('common.unknownArtist')}
                  </span>
                  <span className="-mt-1 text-xs text-muted">{date(entry.event_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
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

      {friendsGoing.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="home-friends">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="home-friends" className="marquee text-3xl">
              {t('home.friendsGoing')}
            </h2>
            <Link href="/friends" className="shrink-0 text-sm text-muted hover:text-foreground">
              {t('home.allFriends')}
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {friendsGoing.map((show) => (
              <FriendShowRow key={show.key} show={show} upcoming />
            ))}
          </ul>
        </section>
      ) : (
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
      )}

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
