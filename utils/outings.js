// An "outing" is one trip out: every set seen at the same festival in the
// same year counts once (Open'er 2026 with 9 sets = 1 outing); any other
// show is its own outing. Used wherever counting sets would inflate
// numbers — events attended, venues visited, cities visited.
//
// Entries need: id, festival_id, event_date.
export function outingKey(entry) {
  if (!entry.festival_id) return `show:${entry.id}`;
  const year = entry.event_date ? entry.event_date.slice(0, 4) : 'undated';
  return `festival:${entry.festival_id}:${year}`;
}

export function countOutings(entries) {
  return new Set(entries.map(outingKey)).size;
}

// Groups entries by `keyFn`, counting distinct outings per group (so a
// venue that hosted 9 sets of one festival counts as 1 visit). Returns the
// top `limit` as { name, count }, most visited first.
export function topByOutings(entries, keyFn, labelFn, limit) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFn(entry);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { name: labelFn(entry), outings: new Set() });
    groups.get(key).outings.add(outingKey(entry));
  }
  return [...groups.values()]
    .map(({ name, outings }) => ({ name, count: outings.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}
