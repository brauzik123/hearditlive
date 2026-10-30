// Shared name normalization used for matching heard song titles (from
// setlists) against Spotify catalog titles, which don't always agree on
// punctuation, casing, or "(feat. X)" / "- 2011 Remaster" / "- ChoppedNotSlopped"
// style suffixes.
const VARIANT = 'live|remix|remaster(ed)?|acoustic|demo|edit|mono|stereo|sped up|slowed|chopped|screwed|instrumental|radio edit|extended|explicit|clean|bonus( track)?';

// Round or square brackets: Spotify writes both "(with Gunna)" and
// "[with Future & feat. Don Toliver]", "(Remastered)" and "[Bonus]".
// Also dropped: an unbracketed "feat. X" ("WISH FEAT. KIDDO MARV") and a
// stylized second title after "|" ("SWITCH IT UP | ZWITCH 1T UP"), which
// setlists spell however they like.
export function normalizeSongName(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/\s+\|.*$/, '')
    .replace(/[([](feat|ft|with)\.?\s[^)\]]*[)\]]/g, '')
    .replace(new RegExp(`[(\\[](\\d{4}\\s)?(${VARIANT})[^)\\]]*[)\\]]`, 'g'), '')
    .replace(new RegExp(`\\s[-–—]\\s*(\\d{4}\\s)?(${VARIANT}).*`, 'g'), '')
    // After the bracketed ones, so "[with Future & feat. X]" goes whole.
    .replace(/\s(feat\.|ft\.|featuring)\s.*$/, '')
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

// Edit distance between two strings (letters added, removed or changed).
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// For a heard title (normalized) that matches nothing exactly, the one
// catalog title spelled almost the same ("anotha late night" / "anotha late
// nite"), or null. Short titles never match this way ("run" isn't "fun"),
// and a tie between two candidates isn't guessed.
export function closeSongKey(key, catalogKeys) {
  const allowed = key.length >= 16 ? 3 : key.length >= 12 ? 2 : key.length >= 8 ? 1 : 0;
  if (!allowed) return null;
  let best = null;
  let bestDistance = allowed + 1;
  let tie = false;
  for (const candidate of catalogKeys) {
    if (Math.abs(candidate.length - key.length) > allowed) continue;
    const d = editDistance(key, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
      tie = false;
    } else if (d === bestDistance) {
      tie = true;
    }
  }
  return best && !tie ? best : null;
}
