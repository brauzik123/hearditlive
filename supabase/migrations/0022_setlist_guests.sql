-- A guest who came on stage for a song (setlist.fm's "with"): Żabson
-- joining Tezzus & diamond* for "Sexoholik". The song shows up on the
-- guest's Songs page, but a guest spot isn't a show of theirs.
-- entry_setlist.artist_id (0021) says whose song it is; for a guest playing
-- their own song that's the guest.
alter table entry_setlist add column if not exists guest_artist_id uuid references artists(id);
create index if not exists entry_setlist_guest_idx on entry_setlist (guest_artist_id) where guest_artist_id is not null;
