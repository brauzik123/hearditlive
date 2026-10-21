import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

const SETLISTFM_BASE = 'https://api.setlist.fm/rest/1.0';
const MIN_INTERVAL_MS = 1100; // stay under setlist.fm's free non-commercial rate limit (~1 req/sec)

// Module-level throttle. Only holds for the life of this dev-server process —
// good enough here since calls only ever happen one-at-a-time, on-demand,
// triggered by a user clicking "Import from setlist.fm" for one entry.
let lastRequestAt = 0;

async function throttledFetch(url) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();

  return fetch(url, {
    headers: {
      'x-api-key': process.env.SETLISTFM_API_KEY,
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });
}

function toDdMmYyyy(isoDate) {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

export async function GET(request) {
  if (!process.env.SETLISTFM_API_KEY) {
    return NextResponse.json({ error: 'setlist.fm is not configured on this server yet.' }, { status: 503 });
  }

  // Require a signed-in user — this endpoint is for the log-entry flow only,
  // never called in bulk/background, per setlist.fm's non-commercial terms.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist')?.trim();
  const date = searchParams.get('date')?.trim(); // expects YYYY-MM-DD

  if (!artist) {
    return NextResponse.json({ error: 'artist is required' }, { status: 400 });
  }

  const params = new URLSearchParams({ artistName: artist });
  const ddmmyyyy = toDdMmYyyy(date);
  if (ddmmyyyy) params.set('date', ddmmyyyy);

  const res = await throttledFetch(`${SETLISTFM_BASE}/search/setlists?${params.toString()}`);

  if (res.status === 404) {
    return NextResponse.json({ setlists: [] });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `setlist.fm returned ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const setlists = (data.setlist ?? []).map((s) => ({
    id: s.id,
    // Attribution link setlist.fm's API terms require us to show with
    // their data.
    url: s.url ?? 'https://www.setlist.fm/',
    eventDate: s.eventDate,
    artistName: s.artist?.name,
    venueName: s.venue?.name,
    venueId: s.venue?.id ?? null,
    city: s.venue?.city?.name,
    // setlist.fm city ids are GeoNames ids — the same ones we use.
    cityGeonameId: s.venue?.city?.id ? Number(s.venue.city.id) : null,
    tourName: s.tour?.name ?? null,
    songCount: (s.sets?.set ?? []).reduce((n, set) => n + (set.song?.length ?? 0), 0),
    sets: (s.sets?.set ?? []).map((set) => ({
      isEncore: !!set.encore,
      songs: (set.song ?? []).map((song) => ({
        name: song.name,
        isCover: !!song.cover,
        coverOriginalArtist: song.cover?.name ?? null,
      })),
    })),
  }));

  return NextResponse.json({ setlists });
}
