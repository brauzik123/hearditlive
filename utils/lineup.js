// "Your lineup" on Stats: your artists billed like a festival poster.
//
// Ranked by shows seen. With only one or two shows per artist ties are
// common, so they're broken by what makes someone more of a headliner for
// you: more sets as the main act (a support slot ranks below the act it
// opened for), then more songs heard, then the most recent show, and only
// then the name.

export const TIER_SIZES = [1, 3, 5, 8]; // headliner, then each smaller row
export const LINEUP_SIZE = TIER_SIZES.reduce((a, b) => a + b, 0);

// entries: attended shows with { id, artist_id, artists: { name }, is_support, event_date }
// songCountByEntry: Map of entry id -> songs in its setlist
export function rankArtists(entries, songCountByEntry = new Map()) {
  const byArtist = new Map();
  for (const entry of entries) {
    const name = entry.artists?.name;
    if (!name) continue;
    const key = entry.artist_id ?? name.toLowerCase();
    if (!byArtist.has(key)) byArtist.set(key, { name, shows: 0, headline: 0, songs: 0, latest: '' });
    const artist = byArtist.get(key);
    artist.shows += 1;
    if (!entry.is_support) artist.headline += 1;
    artist.songs += songCountByEntry.get(entry.id) ?? 0;
    if ((entry.event_date ?? '') > artist.latest) artist.latest = entry.event_date;
  }
  return [...byArtist.values()].sort(
    (a, b) =>
      b.shows - a.shows ||
      b.headline - a.headline ||
      b.songs - a.songs ||
      b.latest.localeCompare(a.latest) ||
      a.name.localeCompare(b.name)
  );
}

// Splits ranked artists into poster rows: [{ tier, artists }].
export function billing(ranked) {
  const rows = [];
  let start = 0;
  TIER_SIZES.forEach((size, tier) => {
    const slice = ranked.slice(start, start + size);
    if (slice.length) rows.push({ tier, artists: slice });
    start += size;
  });
  return rows;
}
