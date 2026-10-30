// Shared name normalization used for matching heard song titles (from
// setlists) against Spotify catalog titles, which don't always agree on
// punctuation, casing, or "(feat. X)" / "- 2011 Remaster" / "- ChoppedNotSlopped"
// style suffixes.
const VARIANT = 'live|remix|remaster(ed)?|acoustic|demo|edit|mono|stereo|sped up|slowed|chopped|screwed|instrumental|radio edit|extended|explicit|clean|bonus( track)?';

// Round or square brackets: Spotify writes both "(with Gunna)" and
// "[with Future & feat. Don Toliver]", "(Remastered)" and "[Bonus]".
export function normalizeSongName(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[([](feat|ft|with)\.?\s[^)\]]*[)\]]/g, '')
    .replace(new RegExp(`[(\\[](\\d{4}\\s)?(${VARIANT})[^)\\]]*[)\\]]`, 'g'), '')
    .replace(new RegExp(`\\s[-–—]\\s*(\\d{4}\\s)?(${VARIANT}).*`, 'g'), '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Whether two artist names are the same artist name, ignoring capitals,
// accents, punctuation, "&" vs "and" and a leading "The" ("Beyoncé" =
// "Beyonce", "Florence + the Machine" = "Florence and The Machine").
export function sameArtistName(a, b) {
  const key = (name) =>
    (name ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[&+]/g, ' and ')
      .replace(/^\s*the\s+/, '')
      .replace(/[^a-z0-9]+/g, '');
  const ka = key(a);
  return ka !== '' && ka === key(b);
}
