// Your festivals: how many editions (distinct years) and sets you've seen at
// each, most-visited first. Used by Stats and the Festivals button on Shows.
//
// entries: { festival_id, festivals: { name }, event_date }
export function summarizeFestivals(entries) {
  const byId = new Map();
  for (const e of entries) {
    if (!e.festival_id) continue;
    if (!byId.has(e.festival_id)) byId.set(e.festival_id, { id: e.festival_id, name: e.festivals?.name ?? '', years: new Set(), sets: 0 });
    const festival = byId.get(e.festival_id);
    festival.sets += 1;
    if (e.event_date) festival.years.add(e.event_date.slice(0, 4));
  }
  return [...byId.values()]
    .map((f) => ({ id: f.id, name: f.name, editions: f.years.size, sets: f.sets }))
    .sort((a, b) => b.editions - a.editions || b.sets - a.sets || a.name.localeCompare(b.name));
}
