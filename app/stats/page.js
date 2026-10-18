import Link from 'next/link';
import { ArrowLeft, Music, MapPin, Building2, Mic2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/server';

function topCounts(items, keyFn, limit = 5) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function RankedList({ items, renderCount }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted italic">Nothing here yet — log a few shows to see this fill in.</p>;
  }
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={`${item.name}-${i}`} className="flex items-center gap-3">
          <span className="text-xs text-muted w-4 shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <span className="text-xs text-muted shrink-0">{renderCount(item)}</span>
            </div>
            <div className="h-1.5 bg-surface-light rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function Stats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: attended } = await supabase
    .from('concert_entries')
    .select('id, artists(name), venues(name, city)')
    .eq('user_id', user.id)
    .eq('entry_type', 'attended');

  const entries = attended ?? [];
  const entryIds = entries.map((e) => e.id);

  const { data: setlistRows } = entryIds.length
    ? await supabase.from('entry_setlist').select('song_name').in('entry_id', entryIds)
    : { data: [] };

  const totalShows = entries.length;
  const artistCount = new Set(entries.map((e) => e.artists?.name).filter(Boolean)).size;
  const cityCount = new Set(entries.map((e) => e.venues?.city).filter(Boolean)).size;
  const songsHeard = (setlistRows ?? []).length;

  const summary = [
    { label: 'Shows logged', value: totalShows },
    { label: 'Artists seen', value: artistCount },
    { label: 'Songs heard live', value: songsHeard },
    { label: 'Cities visited', value: cityCount },
  ];

  const topArtists = topCounts(entries, (e) => e.artists?.name);
  const topSongs = topCounts(setlistRows ?? [], (s) => s.song_name);
  const topVenues = topCounts(entries, (e) => (e.venues?.name ? `${e.venues.name}, ${e.venues.city ?? ''}`.trim().replace(/,\s*$/, '') : null));
  const topCities = topCounts(entries, (e) => e.venues?.city);

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
        <ArrowLeft size={16} /> Back home
      </Link>

      <h1 className="text-2xl font-bold">Your Stats</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((stat) => (
          <div key={stat.label} className="bg-surface rounded-2xl p-4 text-center border border-border">
            <p className="text-2xl font-bold text-brand">{stat.value}</p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="bg-surface rounded-2xl p-6 border border-border">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Mic2 size={16} /> Most Seen Artists</h2>
        <RankedList items={topArtists} renderCount={(a) => `${a.count}x`} />
      </section>

      <section className="bg-surface rounded-2xl p-6 border border-border">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Music size={16} /> Most Heard Songs</h2>
        <RankedList items={topSongs} renderCount={(s) => `${s.count}x`} />
      </section>

      <section className="bg-surface rounded-2xl p-6 border border-border">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Building2 size={16} /> Most Visited Venues</h2>
        <RankedList items={topVenues} renderCount={(v) => `${v.count} shows`} />
      </section>

      <section className="bg-surface rounded-2xl p-6 border border-border">
        <h2 className="font-bold mb-4 flex items-center gap-2"><MapPin size={16} /> Top Cities</h2>
        <RankedList items={topCities} renderCount={(c) => `${c.count} shows`} />
      </section>
    </main>
  );
}
