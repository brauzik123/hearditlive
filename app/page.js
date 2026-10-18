import Link from 'next/link';
import { Music, MapPin, Star, Ticket, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { createClient } from '../utils/supabase/server';

const ticketStatusLabel = {
  interested: 'Interested',
  bought: 'Tickets bought',
  confirmed: 'Confirmed',
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: attended }, { data: mostRecentRows }, { data: upcoming }] = await Promise.all([
    supabase
      .from('concert_entries')
      .select('artist_id, artists(name), venues(city)')
      .eq('user_id', user.id)
      .eq('entry_type', 'attended'),
    supabase
      .from('concert_entries')
      .select('id, event_date, rating, artists(name), venues(name, city)')
      .eq('user_id', user.id)
      .eq('entry_type', 'attended')
      .order('event_date', { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from('concert_entries')
      .select('id, event_date, ticket_status, artists(name), venues(name, city)')
      .eq('user_id', user.id)
      .eq('entry_type', 'planned')
      .order('event_date', { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const totalShows = attended?.length ?? 0;
  const artistCount = new Set((attended ?? []).map((e) => e.artist_id).filter(Boolean)).size;
  const cityCount = new Set((attended ?? []).map((e) => e.venues?.city).filter(Boolean)).size;

  const mostRecent = mostRecentRows?.[0];

  const statPreview = [
    { label: 'Shows logged', value: totalShows },
    { label: 'Artists seen', value: artistCount },
    { label: 'Cities', value: cityCount },
  ];

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">

      {/* Stats preview */}
      <section className="bg-surface rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Your Stats</h2>
          <Link href="/stats" className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition">
            See more <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {statPreview.map((stat) => (
            <div key={stat.label} className="bg-surface-light rounded-xl p-4 text-center border border-border">
              <p className="text-2xl font-bold text-brand">{stat.value}</p>
              <p className="text-xs text-muted mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Most recent concert */}
      <section className="bg-surface rounded-2xl p-6 border border-border">
        <h2 className="text-lg font-bold mb-4">Most Recent Concert</h2>
        {mostRecent ? (
          <Link href={`/entry/${mostRecent.id}`} className="flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-surface-light border border-border flex items-center justify-center shrink-0">
              <ImageIcon size={24} className="text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{mostRecent.artists?.name ?? 'Unknown artist'}</p>
              <p className="text-sm text-muted flex items-center gap-1 mt-1">
                <MapPin size={14} /> {mostRecent.venues?.name}
                {mostRecent.venues?.city ? `, ${mostRecent.venues.city}` : ''}
              </p>
              {mostRecent.event_date && (
                <p className="text-sm text-muted mt-1">
                  {new Date(mostRecent.event_date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
            {mostRecent.rating != null && (
              <div className="flex items-center gap-1 text-brand font-bold shrink-0">
                <Star size={16} className="fill-brand" /> {mostRecent.rating}/10
              </div>
            )}
          </Link>
        ) : (
          <div className="flex items-center justify-center h-24 text-muted italic">
            No past concerts logged yet.
          </div>
        )}
      </section>

      {/* Upcoming concerts */}
      <section className="bg-surface rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Upcoming Concerts</h2>
          <Link href="/log" className="text-sm text-muted hover:text-foreground transition">
            + Add
          </Link>
        </div>

        {!upcoming || upcoming.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted italic">
            No upcoming shows planned.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((show) => (
              <Link
                key={show.id}
                href={`/entry/${show.id}`}
                className="flex items-center gap-4 bg-surface-light rounded-xl p-4 border border-border hover:border-muted transition"
              >
                <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border">
                  <Music size={18} className="text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{show.artists?.name ?? 'Unknown artist'}</p>
                  <p className="text-sm text-muted truncate">
                    {show.venues?.name}
                    {show.event_date
                      ? ` · ${new Date(show.event_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                      : ''}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-brand shrink-0">
                  <Ticket size={14} /> {ticketStatusLabel[show.ticket_status] ?? 'Planned'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
