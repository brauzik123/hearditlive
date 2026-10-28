import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { rateLimit } from '../../../../utils/rateLimit';
import { blockSpotify, ensureArtistImage, spotifyBlockedUntil, SpotifyRateLimitError } from '../../../../utils/spotify';

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

  if (artist.image_url || (await spotifyBlockedUntil(admin))) {
    return NextResponse.json({ imageUrl: artist.image_url ?? null });
  }
  try {
    const resolved = await ensureArtistImage(admin, artist);
    return NextResponse.json({ imageUrl: resolved.image_url ?? null });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) await blockSpotify(admin, err.retryAfterSeconds);
    return NextResponse.json({ imageUrl: null });
  }
}
