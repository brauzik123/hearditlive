// Server-only Spotify Web API client (Client Credentials flow). Spotify is
// the source of truth for the Songs catalog: it reflects exactly what's
// officially released on streaming, with canonical tracklists and cover
// art, so there's no edition-guessing involved.
//
// This app's Spotify access is restricted: list endpoints cap `limit` at 10
// and the batch /albums?ids= endpoint is forbidden, so releases are paged
// in parallel and albums are fetched one at a time with bounded concurrency.

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Spotify is not configured on this server yet.');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

// Spotify sometimes answers 429 with a Retry-After of minutes or hours;
// waiting that out would hang the request, so only short waits are retried
// and anything longer fails the sync (which then backs off — see
// catalogSync.js).
const MAX_RETRY_WAIT_S = 10;
const MAX_RETRIES = 3;

async function spotifyFetch(path, attempt = 0) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
    if (retryAfter > MAX_RETRY_WAIT_S || attempt >= MAX_RETRIES) {
      throw new Error(`Spotify rate limit (retry after ${retryAfter}s)`);
    }
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(path, attempt + 1);
  }
  if (!res.ok) throw new Error(`Spotify API error ${res.status} for ${path}`);
  return res.json();
}

// Runs fn over items with at most `limit` in flight, preserving order.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Prefers an exact (case-insensitive) name match over Spotify's top hit, so
// a common name doesn't silently resolve to a more popular namesake.
export async function searchArtist(name) {
  const data = await spotifyFetch(`/search?q=${encodeURIComponent(name)}&type=artist&limit=5`);
  const items = data.artists?.items ?? [];
  return items.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? items[0] ?? null;
}

export function bestImage(images) {
  if (!images?.length) return null;
  return images[0].url; // Spotify returns images sorted largest-first
}

const RECHECK_UNKNOWN_ARTIST_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Resolves spotify_id + a photo URL for an artist and caches it on the row.
// "Not on Spotify" is cached too (spotify_checked_at), otherwise every view
// of a local band would search Spotify again.
export async function ensureArtistImage(supabase, artist) {
  if (artist.spotify_id) return artist;
  const checkedRecently =
    artist.spotify_checked_at && Date.now() - new Date(artist.spotify_checked_at).getTime() < RECHECK_UNKNOWN_ARTIST_MS;
  if (checkedRecently) return artist;

  const match = await searchArtist(artist.name);
  const checkedAt = new Date().toISOString();
  if (!match) {
    await supabase.from('artists').update({ spotify_checked_at: checkedAt }).eq('id', artist.id);
    return { ...artist, spotify_checked_at: checkedAt };
  }

  const imageUrl = bestImage(match.images);
  await supabase
    .from('artists')
    .update({ spotify_id: match.id, image_url: imageUrl, spotify_checked_at: checkedAt })
    .eq('id', artist.id);
  return { ...artist, spotify_id: match.id, image_url: imageUrl, spotify_checked_at: checkedAt };
}

const PAGE_SIZE = 10;
const MAX_RELEASES = 300;

// All of an artist's own albums + singles/EPs. The first page reports the
// total, then the remaining pages are fetched in parallel.
export async function getArtistReleases(spotifyArtistId) {
  const path = (offset) =>
    `/artists/${spotifyArtistId}/albums?include_groups=album,single&limit=${PAGE_SIZE}&offset=${offset}`;
  const first = await spotifyFetch(path(0));
  const total = Math.min(first.total ?? 0, MAX_RELEASES);
  const offsets = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset);
  const pages = await mapLimit(offsets, 4, (offset) => spotifyFetch(path(offset)));
  return [first, ...pages].flatMap((page) => page.items ?? []);
}

// Full tracklist of one release, in play order across discs.
export async function getAlbumTracks(albumId) {
  const tracks = [];
  let url = `/albums/${albumId}/tracks?limit=50`;
  while (url) {
    const data = await spotifyFetch(url);
    tracks.push(...(data.items ?? []));
    url = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return tracks;
}

export async function searchTracks(songName, artistName) {
  const q = encodeURIComponent(`track:"${songName}" artist:"${artistName}"`);
  const data = await spotifyFetch(`/search?q=${q}&type=track&limit=10`);
  return data.tracks?.items ?? [];
}
