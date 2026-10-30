// When an artist's catalog needs Spotify again, and how much of it.
//   'skip'  — synced or checked within the last 30 days
//   'light' — 30–90 days since the full sync: one request for the release
//             count; a full sync only if it changed (something came out)
//   'full'  — never synced, over 90 days old, or no count to compare with
// Keeps Spotify use low: an established artist costs 1 request a month
// instead of a full re-download.

const DAY = 24 * 60 * 60 * 1000;
export const CHECK_EVERY_MS = 30 * DAY;
export const FULL_SYNC_EVERY_MS = 90 * DAY;

const age = (iso, now) => (iso ? now - new Date(iso).getTime() : Infinity);

export function refreshPlan(artist, now = Date.now()) {
  if (!artist.catalog_synced_at) return 'full';
  const sinceSync = age(artist.catalog_synced_at, now);
  if (sinceSync < CHECK_EVERY_MS) return 'skip';
  if (sinceSync >= FULL_SYNC_EVERY_MS || artist.releases_total == null) return 'full';
  if (age(artist.catalog_checked_at, now) < CHECK_EVERY_MS) return 'skip';
  return 'light';
}
