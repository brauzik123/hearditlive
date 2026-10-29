// Guests you've seen come on stage at other artists' shows (setlist lines
// with a guest): how many shows they joined and for how many songs. Not
// shows of theirs, so they never count toward the lineup or show totals.
//
// rows: entry_setlist rows { entry_id, guest_artist_id, guest: { name } }
export function guestAppearances(rows) {
  const guests = new Map();
  for (const row of rows) {
    const name = row.guest?.name;
    if (!row.guest_artist_id || !name) continue;
    if (!guests.has(row.guest_artist_id)) guests.set(row.guest_artist_id, { name, shows: new Set(), songs: 0 });
    const guest = guests.get(row.guest_artist_id);
    guest.shows.add(row.entry_id);
    guest.songs += 1;
  }
  return [...guests.values()]
    .map((g) => ({ ...g, shows: g.shows.size }))
    .sort((a, b) => b.shows - a.shows || b.songs - a.songs || a.name.localeCompare(b.name));
}
