// Small pieces of Home: the next round number to reach, and shows from
// today's date in earlier years.

const MILESTONES = [5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

// The next milestone above `count` and how far off it is, e.g. 23 events →
// { target: 25, remaining: 2 }. Past the last one, every further 500.
export function nextMilestone(count) {
  const target = MILESTONES.find((m) => m > count) ?? (Math.floor(count / 500) + 1) * 500;
  return { target, remaining: target - count };
}

// Shows on today's day and month in earlier years, most recent first, with
// how many years ago. `today` is "YYYY-MM-DD".
export function onThisDay(entries, today) {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);
  return entries
    .filter((e) => e.event_date && e.event_date.slice(5) === monthDay && Number(e.event_date.slice(0, 4)) < year)
    .map((e) => ({ ...e, yearsAgo: year - Number(e.event_date.slice(0, 4)) }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo);
}

// "YYYY-MM-DD" `days` days before the given date.
export function daysBefore(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
