-- The shared music catalog (artist photos/Spotify ids, songs, albums) was
-- writable by any signed-in user straight from the browser, so anyone could
-- rename songs, swap cover art, or wipe an artist's catalog for everyone.
-- Catalog writes now happen only on the server with the secret key
-- (utils/supabase/admin.js); browsers can read but not write.
--
-- Requires SUPABASE_SECRET_KEY in the server environment.

drop policy "artists updatable by authenticated users" on artists;
drop policy "songs updatable by authenticated users" on songs;
drop policy "songs insertable by authenticated users" on songs;
drop policy "albums insertable by authenticated users" on albums;
drop policy "albums updatable by authenticated users" on albums;

create or replace function replace_artist_catalog(p_artist_id uuid, p_albums jsonb, p_songs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update entry_setlist set song_id = null
  where song_id in (select id from songs where artist_id = p_artist_id);
  delete from songs where artist_id = p_artist_id;
  delete from albums where artist_id = p_artist_id;

  insert into albums (artist_id, spotify_album_id, name, bucket, release_date, image_url, total_tracks)
  select p_artist_id,
         a->>'spotify_album_id',
         a->>'name',
         'album',
         (a->>'release_date')::date,
         a->>'image_url',
         (a->>'total_tracks')::int
  from jsonb_array_elements(p_albums) a
  on conflict do nothing;

  insert into songs (artist_id, name, album_id, spotify_track_id, track_number, is_feature)
  select p_artist_id,
         s->>'name',
         al.id,
         s->>'spotify_track_id',
         (s->>'track_number')::int,
         coalesce((s->>'is_feature')::boolean, false)
  from jsonb_array_elements(p_songs) s
  left join albums al on al.artist_id = p_artist_id and al.spotify_album_id = s->>'spotify_album_id'
  on conflict do nothing;

  update artists set catalog_synced_at = now() where id = p_artist_id;
end;
$$;

revoke all on function replace_artist_catalog(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function replace_artist_catalog(uuid, jsonb, jsonb) to service_role;
