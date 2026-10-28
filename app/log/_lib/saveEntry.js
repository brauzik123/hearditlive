import { newId } from '../../../utils/id';
import { sameArtistName } from '../../../utils/normalize';
import { billedNames, entryPayload, exact, photosInSaveOrder, setlistRows } from './entryForm';

// Writes a log entry (new or edited) and everything attached to it.
// Returns the entry id.

async function resolveArtist(supabase, name) {
  const { data: existing } = await supabase.from('artists').select('id').ilike('name', exact(name)).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('artists').insert({ name }).select('id').single();
  if (error) throw error;
  return created.id;
}

// Venues are matched and created on the server (see /api/venues/resolve).
async function resolveVenue(form) {
  const res = await fetch('/api/venues/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.venue.trim(),
      cityText: form.city.trim(),
      cityGeonameId: form.cityGeonameId,
      setlistfmVenueId: form.setlistfmVenueId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.id;
}

async function resolveFestival(supabase, name, city) {
  const { data: existing } = await supabase.from('festivals').select('id').ilike('name', exact(name)).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from('festivals')
    .insert({ name, city: city || null })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function resolveTag(supabase, userId, name) {
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', exact(name))
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('tags').insert({ user_id: userId, name }).select('id').single();
  if (error) throw error;
  return created.id;
}

export async function saveEntry(supabase, { form, editId }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  // Billed artists in order; the first is the entry's artist, the rest go
  // to entry_co_artists (joint shows).
  const names = billedNames(form);
  const billed = [];
  for (const name of names) billed.push({ name, id: await resolveArtist(supabase, name) });
  const artistId = billed[0]?.id ?? null;
  const venueId = form.venue.trim() ? await resolveVenue(form) : null;
  const festivalId =
    form.isFestival && form.festivalName.trim()
      ? await resolveFestival(supabase, form.festivalName.trim(), form.city.trim())
      : null;
  const payload = entryPayload(form, { userId: user.id, artistId, venueId, festivalId });

  let entryId = editId;
  if (editId) {
    const { error: updateError } = await supabase.from('concert_entries').update(payload).eq('id', editId);
    if (updateError) throw updateError;
    await Promise.all([
      supabase.from('entry_photos').delete().eq('entry_id', editId),
      supabase.from('entry_setlist').delete().eq('entry_id', editId),
      supabase.from('entry_attendees').delete().eq('entry_id', editId),
      supabase.from('entry_tags').delete().eq('entry_id', editId),
      supabase.from('entry_co_artists').delete().eq('entry_id', editId),
    ]);
  } else {
    const { data: created, error: insertError } = await supabase.from('concert_entries').insert(payload).select('id').single();
    if (insertError) throw insertError;
    entryId = created.id;
  }

  // New photos are already shrunk in the browser; existing ones keep their path.
  const photoRows = [];
  const ordered = photosInSaveOrder(form);
  for (let i = 0; i < ordered.length; i++) {
    const photo = ordered[i];
    let url = photo.url;
    if (photo.blob) {
      const path = `${user.id}/${entryId}/${newId()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('entry-photos')
        .upload(path, photo.blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      url = path;
    }
    photoRows.push({
      entry_id: entryId,
      url,
      caption: photo.caption.trim() || null,
      position: i,
      is_cover: photo.id === form.coverId,
    });
  }
  if (photoRows.length) {
    const { error: photosError } = await supabase.from('entry_photos').insert(photoRows);
    if (photosError) throw photosError;
  }

  const coRows = billed
    .slice(1)
    .filter((a, i, list) => a.id !== artistId && list.findIndex((b) => b.id === a.id) === i)
    .map((a, i) => ({ entry_id: entryId, artist_id: a.id, position: i + 1 }));
  if (coRows.length) {
    const { error: coError } = await supabase.from('entry_co_artists').insert(coRows);
    if (coError) throw coError;
  }

  const artistIdFor = (name) => billed.find((a) => sameArtistName(a.name, name))?.id ?? null;
  const songs = setlistRows(form, entryId, artistIdFor);
  if (songs.length) {
    const { error: setlistError } = await supabase.from('entry_setlist').insert(songs);
    if (setlistError) throw setlistError;
  }

  const attendeeRows = form.attendees.map((name) => ({ entry_id: entryId, guest_name: name }));
  if (attendeeRows.length) {
    const { error: attendeesError } = await supabase.from('entry_attendees').insert(attendeeRows);
    if (attendeesError) throw attendeesError;
  }

  if (form.tags.length) {
    const tagIds = await Promise.all(form.tags.map((name) => resolveTag(supabase, user.id, name)));
    const { error: tagsError } = await supabase.from('entry_tags').insert(tagIds.map((tag_id) => ({ entry_id: entryId, tag_id })));
    if (tagsError) throw tagsError;
  }

  return entryId;
}
