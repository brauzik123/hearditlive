import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { fetchAllIn } from '../../../../utils/fetchAll';
import { ensureArtistGroups, ensureArtistSynced, isInBackoff, resolveHeardSongsForArtist } from '../../../../utils/catalogSync';

// Rebuilds one artist's catalog from Spotify (if stale) and classifies the
// signed-in user's heard songs that aren't on the artist's own releases.
// Called in the background by the client so Songs pages render instantly
// from cache and refresh once this finishes.
//
// The user's session is only used to authenticate and read their own
// setlists; catalog writes go through the admin client, since browsers
// aren't allowed to modify the shared catalog.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { artistId, userId } = await request.json();
  if (typeof artistId !== 'string') return NextResponse.json({ error: 'artistId is required' }, { status: 400 });
  // Whose heard songs to classify: yours by default, or the person whose
  // Songs you're viewing. Their entries are read with *your* session, so
  // only concerts you're allowed to see are used.
  const ownerId = typeof userId === 'string' ? userId : user.id;

  const admin = createAdminClient();
  const [{ data: artist }, { data: entries }] = await Promise.all([
    admin.from('artists').select('*').eq('id', artistId).maybeSingle(),
    supabase
      .from('concert_entries')
      .select('id')
      .eq('user_id', ownerId)
      .eq('artist_id', artistId)
      .eq('entry_type', 'attended'),
  ]);
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

  try {
    const synced = await ensureArtistSynced(admin, artist);
    // Bands the artist is in (Quavo → Migos), so their songs heard at the
    // artist's shows can be grouped under the band.
    if (synced.catalog_synced_at && !isInBackoff(synced)) await ensureArtistGroups(admin, synced);
    // Classify heard songs only against a real catalog, and not while the
    // artist is backing off from a failure (another sync holding the claim,
    // or Spotify rate-limiting us) — those cases retry on a later visit.
    const entryIds = (entries ?? []).map((e) => e.id);
    if (entryIds.length && synced.catalog_synced_at && !isInBackoff(synced)) {
      const setlistRows = await fetchAllIn(() => supabase.from('entry_setlist').select('song_name'), 'entry_id', entryIds);
      const heardNames = Array.from(new Set(setlistRows.map((r) => r.song_name)));
      if (heardNames.length) await resolveHeardSongsForArtist(admin, synced, heardNames);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('catalog sync failed:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 502 });
  }
}
