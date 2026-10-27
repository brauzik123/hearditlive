import 'server-only';

// MusicBrainz, used only for band membership (Spotify doesn't expose it).
// Free, no key; their rules ask for a descriptive User-Agent and at most
// one request per second. Each artist is checked once per 30 days.
const BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'HeardItLive/0.1 (non-commercial concert diary)';
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;
async function mbFetch(path) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MusicBrainz error ${res.status}`);
  return res.json();
}

// The MusicBrainz id for an artist name, only on a confident exact match.
export async function findArtistMbid(name) {
  const data = await mbFetch(`/artist/?query=${encodeURIComponent(`artist:"${name}"`)}&fmt=json&limit=5`);
  const hit = (data.artists ?? []).find((a) => a.score >= 90 && a.name.toLowerCase() === name.toLowerCase());
  return hit?.id ?? null;
}

// Bands/groups this artist is (or was) a member of: [{ mbid, name }].
export async function getBandMemberships(mbid) {
  const data = await mbFetch(`/artist/${mbid}?inc=artist-rels&fmt=json`);
  return (data.relations ?? [])
    .filter((rel) => rel.type === 'member of band' && rel.direction === 'forward' && rel.artist?.id)
    .map((rel) => ({ mbid: rel.artist.id, name: rel.artist.name }));
}
