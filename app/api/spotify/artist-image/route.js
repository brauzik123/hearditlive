import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { ensureArtistImage } from '../../../../utils/spotify';

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { artistId } = await request.json();
  if (!artistId) return NextResponse.json({ error: 'artistId is required' }, { status: 400 });

  const { data: artist } = await supabase.from('artists').select('*').eq('id', artistId).maybeSingle();
  if (!artist) return NextResponse.json({ error: 'Artist not found' }, { status: 404 });

  try {
    const resolved = await ensureArtistImage(supabase, artist);
    return NextResponse.json({ imageUrl: resolved.image_url ?? null });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
