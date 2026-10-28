-- Shows billed to more than one artist: a joint tour ("Żabson & Young
-- Igi" for their collab album) or a duo setlist.fm files as one act
-- ("Tezzus & diamond*"). concert_entries.artist_id stays the first-billed
-- artist; this table holds the others, in billing order. The show counts
-- once, and as a show for each billed artist.
create table if not exists entry_co_artists (
  entry_id  uuid not null references concert_entries(id) on delete cascade,
  artist_id uuid not null references artists(id),
  position  int not null default 1,
  primary key (entry_id, artist_id)
);

create index if not exists entry_co_artists_artist_idx on entry_co_artists (artist_id);

alter table entry_co_artists enable row level security;

-- Same visibility as the show itself, like the setlist.
drop policy if exists "entry_co_artists readable" on entry_co_artists;
create policy "entry_co_artists readable" on entry_co_artists for select
  using (exists (select 1 from concert_entries e where e.id = entry_id and entry_visible_to_viewer(e)));
drop policy if exists "entry_co_artists owner write" on entry_co_artists;
create policy "entry_co_artists owner write" on entry_co_artists for insert
  with check (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));
drop policy if exists "entry_co_artists owner delete" on entry_co_artists;
create policy "entry_co_artists owner delete" on entry_co_artists for delete
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

-- Whose song a setlist line is, when the show has several billed artists
-- and it's known (setlist.fm credits each song). Null = work it out from
-- the artists' catalogs.
alter table entry_setlist add column if not exists artist_id uuid references artists(id);
