// Shows you plan to go to.

// Today in the viewer's time zone, as yyyy-mm-dd.
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// A plan still ahead of you: today or later, or no date yet.
export function isUpcoming(entry, today) {
  return entry.entry_type === 'planned' && (!entry.event_date || entry.event_date >= today);
}

// Soonest first, plans without a date last.
export function sortUpcoming(entries) {
  return [...entries].sort((a, b) => {
    if (!a.event_date || !b.event_date) return (a.event_date ? 0 : 1) - (b.event_date ? 0 : 1);
    return a.event_date.localeCompare(b.event_date);
  });
}
