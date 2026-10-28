import { sameArtistName } from './normalize';

// A show's billed artists: concert_entries.artist_id is the first-billed,
// entry_co_artists holds the rest (joint tours, duos). Expects
// artist_id, artists(name) and entry_co_artists(artist_id, position, artists(name)).

// Supabase select fragment for the co-billed artists.
export const CO_ARTISTS_FIELDS = 'entry_co_artists(artist_id, position, artists(name))';

export function billedArtists(entry) {
  const first = entry.artists?.name ? [{ id: entry.artist_id ?? null, name: entry.artists.name }] : [];
  const rest = [...(entry.entry_co_artists ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((c) => c.artists?.name)
    .map((c) => ({ id: c.artist_id, name: c.artists.name }));
  return [...first, ...rest];
}

// "Żabson & Young Igi", or null when the show has no artist.
export function billedName(entry) {
  const names = billedArtists(entry).map((a) => a.name);
  return names.length ? names.join(' & ') : null;
}

// Whether a show is billed to this artist (first-billed or co-billed).
export function isBilled(entry, artistId) {
  return billedArtists(entry).some((a) => a.id === artistId);
}

// setlist.fm files some duos as one act ("Tezzus & diamond*") but credits
// each song to one of them. Split the act only when every part of its name
// is credited with songs, so a band like "Simon & Garfunkel" stays one act.
export function splitJointAct(actName, songOwnerNames) {
  const parts = actName
    .split(/\s*(?:&|\+|,|\bx\b|\band\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [actName];
  const credited = parts.every((part) => songOwnerNames.some((owner) => sameArtistName(owner, part)));
  return credited ? parts : [actName];
}

// Whether a heard song counts for `artistId` at a show billed to `billedIds`
// (first-billed first). `ownerId` is the song's known owner (setlist.fm
// credit), `inCatalog(artistId)` says whether it's on that artist's
// releases. On a joint show a song goes to its owner, else to whichever
// billed artist has it, else (nobody's catalog) to the first-billed only —
// so nothing is counted twice by accident.
export function songCountsFor({ ownerId, inCatalog }, artistId, billedIds) {
  if (ownerId) return ownerId === artistId;
  if (billedIds.length <= 1) return true;
  if (inCatalog(artistId)) return true;
  if (billedIds.some((id) => id !== artistId && inCatalog(id))) return false;
  return artistId === billedIds[0];
}
