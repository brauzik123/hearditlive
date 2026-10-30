// Sort orders for the Collection grid. Ties, and artists without a
// percentage yet, fall back to the most-heard order.
export const SONG_SORTS = ['heard', 'plays', 'pct', 'name'];

const byPlays = (a, b) => b.totalHeard - a.totalHeard;

export function sortSongArtists(artists, sort) {
  const compare = {
    heard: (a, b) => b.distinctHeard - a.distinctHeard || byPlays(a, b),
    plays: (a, b) => byPlays(a, b) || b.distinctHeard - a.distinctHeard,
    pct: (a, b) => (b.pct ?? -1) - (a.pct ?? -1) || byPlays(a, b),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort];
  return compare ? [...artists].sort(compare) : artists;
}
