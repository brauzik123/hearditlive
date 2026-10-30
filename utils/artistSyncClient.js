// The browser's side of downloading a discography. The server hands out
// full syncs one at a time (see LIMITS.spotifyFullSync) and says how long to
// wait when it's not this artist's turn yet.

// A wait longer than this means a limit for the hour or day, or Spotify's own
// pause: stop for now, the next visit picks it up.
export const MAX_WAIT_S = 300;

// 'done', 'paused', or how many ms to wait before asking again.
export function nextSyncStep(result) {
  if (!result?.deferred) return 'done';
  const wait = Number(result.retryAfter);
  if (!Number.isFinite(wait) || wait > MAX_WAIT_S) return 'paused';
  return (Math.max(wait, 1) + 2) * 1000; // a moment after the window opens
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Asks for one artist until it's done, paused, or the page is gone
// ('stopped'). A failed request counts as done: the tile keeps whatever it
// already showed.
export async function syncArtistPaced(artistId, userId, { isStopped = () => false, onWait = () => {}, wait = sleep } = {}) {
  while (!isStopped()) {
    let result = null;
    try {
      const res = await fetch('/api/catalog/sync-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, userId }),
      });
      result = await res.json();
    } catch {
      return 'done';
    }
    const step = nextSyncStep(result);
    if (step === 'done' || step === 'paused') return step;
    onWait();
    await wait(step);
  }
  return 'stopped';
}
