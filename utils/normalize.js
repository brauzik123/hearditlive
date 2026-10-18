// Shared name normalization used for matching heard song titles (from
// setlists) against Spotify catalog titles, which don't always agree on
// punctuation, casing, or "(feat. X)" / "- 2011 Remaster" style suffixes.
const VARIANT = 'live|remix|remaster(ed)?|acoustic|demo|edit|mono|stereo|sped up|slowed|instrumental|radio edit|extended|explicit|clean';

export function normalizeSongName(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/\((feat|ft|with)\.?\s[^)]*\)/g, '')
    .replace(new RegExp(`\\((\\d{4}\\s)?(${VARIANT})[^)]*\\)`, 'g'), '')
    .replace(new RegExp(`\\s[-–—]\\s*(\\d{4}\\s)?(${VARIANT}).*`, 'g'), '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
