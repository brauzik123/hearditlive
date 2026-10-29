// Tags are your own labels for shows ("front row", "road trip"); each
// user has their own set. Expects entries with entry_tags(tags(name)).

// Every tag used on these shows, alphabetically, each once.
export function tagNamesOf(entries) {
  const names = new Set();
  for (const entry of entries) for (const t of entry.entry_tags ?? []) if (t.tags?.name) names.add(t.tags.name);
  return [...names].sort((a, b) => a.localeCompare(b));
}

// Whether a show has at least one of the chosen tags (none chosen = yes).
export function hasAnyTag(entry, chosen) {
  if (!chosen.length) return true;
  return (entry.entry_tags ?? []).some((t) => chosen.includes(t.tags?.name));
}
