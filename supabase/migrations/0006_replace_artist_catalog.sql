-- Catalog is now sourced from Spotify (exact streaming tracklists + official
-- cover art) instead of MusicBrainz. Each sync rebuilds an artist's whole
-- catalog in one atomic call, so stale rows from an older sync (or a
-- superseded edition, e.g. a standard album later replaced by its deluxe)
-- never linger, and a failed sync never leaves a half-written catalog.
create or replace function replace_artist_catalog(p_artist_id uuid, p_albums jsonb, p_songs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

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

revoke all on function replace_artist_catalog(uuid, jsonb, jsonb) from public, anon;
grant execute on function replace_artist_catalog(uuid, jsonb, jsonb) to authenticated;

-- Existing catalogs were built from MusicBrainz; mark them stale so each
-- artist rebuilds from Spotify on next view.
update artists set catalog_synced_at = null where catalog_synced_at is not null;
