import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { rateLimit, takeBudget } from '../../../../utils/rateLimit';
import { blockSpotify, ensureArtistImage, needsArtistLookup, spotifyBlockedUntil, SpotifyRateLimitError } from '../../../../utils/spotify';

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const limited = await rateLimit(createAdminClient(), 'artistImage', user.id);
  if (limited) return limited;

  const { artistId } = await request.json();
  if (typeof artistId !== 'string') return NextResponse.json({ error: 'artistId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: artist } = await admin.from('artists').select('*').eq('id', artistId).maybeSingle();
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

  if (artist.image_url || !needsArtistLookup(artist)) {
    return NextResponse.json({ imageUrl: artist.image_url ?? null });
  }
  // Out of budget, or Spotify paused: the client stops asking for this visit.
  if ((await spotifyBlockedUntil(admin)) || (await takeBudget(admin, 'spotifyArtistLookup')) != null) {
    return NextResponse.json({ imageUrl: null, deferred: true });
  }
  try {
    const resolved = await ensureArtistImage(admin, artist);
    return NextResponse.json({ imageUrl: resolved.image_url ?? null });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) await blockSpotify(admin, err.retryAfterSeconds);
    return NextResponse.json({ imageUrl: null });
  }
}
