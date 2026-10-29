import { billedName } from './showArtists';

// Friends' shows as one row per concert: when several friends logged the
// same show (same date, same artists), it reads "qa_alice and ola" once
// instead of two near-identical tickets. Keeps the order it's given.
//
// entries: concert_entries with ticket fields plus
//   profiles!concert_entries_user_id_fkey(username, avatar_url)
export function groupFriendShows(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const artist = billedName(entry);
    const key = `${entry.event_date ?? entry.id}|${(artist ?? '').toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, entryId: entry.id, date: entry.event_date, artist, venues: entry.venues, isSupport: !!entry.is_support, people: [] });
    }
    const group = groups.get(key);
    const person = entry.profiles;
    if (person?.username && !group.people.some((p) => p.username === person.username)) {
      group.people.push({ username: person.username, avatarUrl: person.avatar_url ?? null });
    }
  }
  return [...groups.values()];
}
