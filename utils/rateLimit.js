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
};

let warnedUnavailable = false;

// Returns a 429 response when the request is over a limit, otherwise null.
// If the limiter itself fails (e.g. the migration isn't applied yet) the
// request is let through: a broken limiter shouldn't take the app down.
export async function rateLimit(admin, name, userId) {
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
  if (retryAfter == null) return null;
  return NextResponse.json(
    { error: 'Too many requests. Try again in a moment.', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
