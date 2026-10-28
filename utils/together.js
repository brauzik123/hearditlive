import { outingKey } from './outings';

// Who you go to shows with, from "who was there" on your own shows.
// Counted like Stats: a festival edition is one event together if you were
// together at any set (people split up at festivals), and so is one night
// at one venue. `shows` is how many sets you were marked together at.
//
// entries: { id, festival_id, event_date, venue_id,
//   entry_attendees: [{ user_id, guest_name, profiles: { username, avatar_url } }] }
export function togetherCounts(entries) {
  const people = new Map();
  for (const entry of entries) {
    for (const a of entry.entry_attendees ?? []) {
      const name = a.profiles?.username ?? a.guest_name?.trim();
      if (!name) continue;
      const key = a.user_id ?? `name:${name.toLowerCase()}`;
      if (!people.has(key)) {
        people.set(key, { name, userId: a.user_id ?? null, avatar: a.profiles?.avatar_url ?? null, events: new Set(), shows: 0 });
      }
      const person = people.get(key);
      person.events.add(outingKey(entry));
      person.shows += 1;
    }
  }
  return [...people.values()]
    .map((p) => ({ ...p, events: p.events.size }))
    .sort((a, b) => b.events - a.events || b.shows - a.shows || a.name.localeCompare(b.name));
}
