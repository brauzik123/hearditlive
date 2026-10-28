import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../utils/supabase/admin';
import { rateLimit } from '../../../../utils/rateLimit';
import { ensureCity } from '../../../../utils/places';

const exact = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// Finds or creates the venue for a show and returns its id. Matching, in
// order: setlist.fm venue id; same name in the same GeoNames city; same
// name and city text (for places GeoNames doesn't know). Runs server-side
// so clients can't attach made-up venues to real setlist.fm ids.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const limited = await rateLimit(createAdminClient(), 'venueResolve', user.id);
  if (limited) return limited;

  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const cityText = typeof body.cityText === 'string' ? body.cityText.trim().slice(0, 120) : '';
  const setlistfmId = typeof body.setlistfmVenueId === 'string' && /^[0-9a-f]{6,12}$/i.test(body.setlistfmVenueId)
    ? body.setlistfmVenueId
    : null;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const admin = createAdminClient();
  try {
    let city = null;
    if (body.cityGeonameId) city = await ensureCity(admin, body.cityGeonameId);

    if (setlistfmId) {
      const { data } = await admin.from('venues').select('id').eq('setlistfm_id', setlistfmId).maybeSingle();
      if (data) return NextResponse.json({ id: data.id });
    }

    let query = admin.from('venues').select('id, setlistfm_id').ilike('name', exact(name));
    if (city) query = query.eq('city_id', city.geoname_id);
    else query = cityText ? query.ilike('city', exact(cityText)).is('city_id', null) : query.is('city', null);
    const { data: match } = await query.limit(1).maybeSingle();
    if (match) {
      if (setlistfmId && !match.setlistfm_id) {
        await admin.from('venues').update({ setlistfm_id: setlistfmId }).eq('id', match.id);
      }
      return NextResponse.json({ id: match.id });
    }

    const { data: created, error } = await admin
      .from('venues')
      .insert({
        name,
        city: city?.name_en ?? (cityText || null),
        city_id: city?.geoname_id ?? null,
        setlistfm_id: setlistfmId,
      })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ id: created.id });
  } catch (err) {
    console.error('venue resolve failed:', err);
    return NextResponse.json({ error: 'Could not save the venue.' }, { status: 500 });
  }
}
