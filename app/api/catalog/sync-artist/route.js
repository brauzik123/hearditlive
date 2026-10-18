import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { ensureArtistSynced, resolveHeardSongsForArtist } from '../../../../utils/catalogSync';

// Rebuilds one artist's catalog from Spotify (if stale) and classifies the
// signed-in user's heard songs that aren't on the artist's own releases.
// Called in the background by the client so Songs pages render instantly
// from cache and refresh once this finishes.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { artistId } = await request.json();
  if (!artistId) return NextResponse.json({ error: 'artistId is required' }, { status: 400 });

  const [{ data: artist }, { data: entries }] = await Promise.all([
    supabase.from('artists').select('*').eq('id', artistId).maybeSingle(),
    supabase
      .from('concert_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('artist_id', artistId)
      .eq('entry_type', 'attended'),
  ]);
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

  try {
    const synced = await ensureArtistSynced(supabase, artist);
    const entryIds = (entries ?? []).map((e) => e.id);
    if (entryIds.length) {
      const { data: setlistRows } = await supabase.from('entry_setlist').select('song_name').in('entry_id', entryIds);
      const heardNames = Array.from(new Set((setlistRows ?? []).map((r) => r.song_name)));
      if (heardNames.length) await resolveHeardSongsForArtist(supabase, synced, heardNames);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message ?? 'Sync failed' }, { status: 502 });
  }
}
