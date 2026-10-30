// The people on your shows: friends by account, everyone else by the name
// you typed. Expects entries with entry_attendees(guest_name, user_id,
// profiles(username)).

const nameOf = (attendee) => attendee.profiles?.username ?? attendee.guest_name ?? null;
const keyOf = (name) => name.trim().toLowerCase();

// Everyone who was at these shows, alphabetically, each once.
export function attendeeNamesOf(entries) {
  const names = new Map();
  for (const entry of entries) {
    for (const attendee of entry.entry_attendees ?? []) {
      const name = nameOf(attendee);
      if (name && !names.has(keyOf(name))) names.set(keyOf(name), name.trim());
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

// Whether at least one of the chosen people was there (none chosen = yes).
export function hasAnyAttendee(entry, chosen) {
  if (!chosen.length) return true;
  const wanted = new Set(chosen.map(keyOf));
  return (entry.entry_attendees ?? []).some((attendee) => {
    const name = nameOf(attendee);
    return name && wanted.has(keyOf(name));
  });
}

// Names typed for people without a linked account, most-used first, each
// with how many shows it's on: the ones that can become a friend's account.
export function groupGuestNames(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.user_id || !row.guest_name?.trim()) continue;
    const key = keyOf(row.guest_name);
    const group = groups.get(key) ?? { name: row.guest_name.trim(), count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Who you were with at this festival: the people on your other shows from
// the same festival and, when the date is known, the same year (last year's
// group may not be this year's). As form attendees: [{ name, userId }].
export function festivalCompanions(entries, festivalName, isoDate) {
  const festival = festivalName?.trim().toLowerCase();
  if (!festival) return [];
  const year = isoDate?.slice(0, 4);
  const people = new Map();
  for (const entry of entries) {
    if (entry.festivals?.name?.trim().toLowerCase() !== festival) continue;
    if (year && entry.event_date && entry.event_date.slice(0, 4) !== year) continue;
    for (const attendee of entry.entry_attendees ?? []) {
      const name = nameOf(attendee);
      if (!name) continue;
      const key = attendee.user_id ?? keyOf(name);
      if (!people.has(key)) people.set(key, { name: name.trim(), userId: attendee.user_id ?? null });
    }
  }
  return [...people.values()];
}
