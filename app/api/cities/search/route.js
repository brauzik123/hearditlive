import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { searchCities } from '../../../../utils/places';

// City suggestions for the log form ("Warsz…" → Warszawa, Polska).
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const lang = searchParams.get('lang') === 'pl' ? 'pl' : 'en';
  if (query.length < 2 || query.length > 80) return NextResponse.json({ cities: [] });

  try {
    return NextResponse.json({ cities: await searchCities(query, lang) });
  } catch (err) {
    console.error('city search failed:', err);
    return NextResponse.json({ cities: [] });
  }
}
