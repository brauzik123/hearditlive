import { NextResponse } from 'next/server';

// Per-route request limits, counted in the database (take_rate_limits) so
// they hold across server restarts and instances. "user" rules are per
// account; "all" rules are app-wide budgets for an external API.
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LIMITS = {
  // setlist.fm allows 1440 requests a day for the whole app.
  setlistSearch: [
    { scope: 'user', max: 20, window: MINUTE },
    { scope: 'user', max: 200, window: DAY },
    { scope: 'all', max: 1200, window: DAY },
  ],
  // Opening Songs fires one sync per artist that needs it; most are no-ops.
  syncArtist: [
    { scope: 'user', max: 60, window: MINUTE },
    { scope: 'user', max: 1000, window: DAY },
  ],
  artistImage: [{ scope: 'user', max: 60, window: MINUTE }],
  // GeoNames' free tier allows 1000 credits an hour.
  citySearch: [
    { scope: 'user', max: 60, window: MINUTE },
    { scope: 'all', max: 900, window: HOUR },
  ],
  venueResolve: [{ scope: 'user', max: 30, window: MINUTE }],
  accountDelete: [{ scope: 'user', max: 5, window: HOUR }],
  // Spotify's limit is unpublished and going over it has cost a block of
  // almost a day, twice, so the whole app spends it slowly. A full sync is
  // dozens of requests; a backlog of new artists drains over a day or two.
  spotifyFullSync: [
    { scope: 'all', max: 1, window: 2 * MINUTE },
    { scope: 'all', max: 10, window: HOUR },
    { scope: 'all', max: 40, window: DAY },
  ],
  // One Spotify search per artist without a photo.
  spotifyArtistLookup: [
    { scope: 'all', max: 15, window: MINUTE },
    { scope: 'all', max: 300, window: DAY },
  ],
  // A batch of track searches for heard songs (MAX_SONG_LOOKUPS_PER_SYNC).
  spotifySongLookups: [
    { scope: 'all', max: 1, window: 20 },
    { scope: 'all', max: 60, window: DAY },
  ],
};

let warnedUnavailable = false;

// Seconds until the limit resets, or null when within it. If the limiter
// itself fails (e.g. the migration isn't applied yet) the request is let
// through: a broken limiter shouldn't take the app down.
async function take(admin, name, userId) {
  const rules = LIMITS[name].map(({ scope, max, window }) => ({
    bucket: `${name}:${scope === 'user' ? userId : 'all'}:${window}`,
    max,
    window,
  }));
  const { data: retryAfter, error } = await admin.rpc('take_rate_limits', { p_rules: rules });
  if (error) {
    if (!warnedUnavailable) console.warn('rate limiter unavailable, allowing requests:', error.message);
    warnedUnavailable = true;
    return null;
  }
  return retryAfter ?? null;
}

// For an app-wide budget spent inside a request: seconds to wait, or null
// when there's budget left (which this call uses up).
export function takeBudget(admin, name) {
  return take(admin, name);
}

// Returns a 429 response when the request is over a limit, otherwise null.
export async function rateLimit(admin, name, userId) {
  const retryAfter = await take(admin, name, userId);
  if (retryAfter == null) return null;
  return NextResponse.json(
    { error: 'Too many requests. Try again in a moment.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
