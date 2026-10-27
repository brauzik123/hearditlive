-- Band membership (from MusicBrainz): Quavo → Migos. A solo artist's
-- concerts often include their band's songs; with this, those land under
-- the band on the artist's Songs page instead of "Other songs".
-- Written server-side only; readable by everyone like the rest of the
-- music catalog.
create table if not exists artist_groups (
  artist_id uuid not null references artists (id) on delete cascade,
  group_id  uuid not null references artists (id) on delete cascade,
  primary key (artist_id, group_id),
  check (artist_id <> group_id)
);

alter table artist_groups enable row level security;
drop policy if exists "artist_groups readable" on artist_groups;
create policy "artist_groups readable" on artist_groups for select using (true);

-- When memberships were last looked up (re-checked after 30 days).
alter table artists add column if not exists groups_checked_at timestamptz;
