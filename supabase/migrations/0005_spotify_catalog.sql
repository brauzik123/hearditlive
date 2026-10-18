-- Spotify catalog integration: lets us show an artist's real discography
-- (albums/EPs always, singles/features only when the user actually heard
-- them live) with photos, and compute "% of catalog heard" stats.

alter table artists
  add column spotify_id text unique,
  add column catalog_synced_at timestamptz;

-- One row per real Spotify release we've bulk-synced for a tracked artist.
-- Only 'album' (incl. EPs, Spotify doesn't distinguish) and 'single' groups
-- are bulk-synced; 'appears_on'/compilation features are resolved lazily
-- per heard song instead (see songs.is_feature below) since fetching an
-- artist's entire "appears on" universe up front is wasteful.
create table albums (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid not null references artists(id) on delete cascade,
  spotify_album_id text not null,
  name            text not null,
  bucket          text not null check (bucket in ('album', 'single')),
  release_date    date,
  image_url       text,
  total_tracks    int,
  created_at      timestamptz not null default now(),
  unique (artist_id, spotify_album_id)
);

create index albums_artist_idx on albums (artist_id, bucket);

-- Extend the existing songs catalog table. A row here represents a Spotify
-- track as attributed to a specific *viewing* artist (artist_id) -- i.e.
-- "artist_id's page shows this song". album_id is set when the track
-- belongs to one of that artist's own bulk-synced albums/singles;
-- is_feature=true when the track was resolved as a guest appearance on
-- someone else's release (album_id stays null in that case -- features are
-- grouped into a synthetic "Features" bucket in the UI, not a real album).
alter table songs
  add column album_id uuid references albums(id) on delete set null,
  add column spotify_track_id text,
  add column track_number int,
  add column is_feature boolean not null default false;

create unique index songs_artist_spotify_track_idx
  on songs (artist_id, spotify_track_id)
  where spotify_track_id is not null;

-- Per-user override: when a heard song couldn't be matched to any Spotify
-- track (the "Others" bucket), the user can opt it out of their totals.
create table song_count_exclusions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  artist_id   uuid not null references artists(id) on delete cascade,
  song_name   text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, artist_id, song_name)
);

alter table albums enable row level security;
alter table song_count_exclusions enable row level security;

-- albums/songs are shared reference data, same pattern as artists/venues.
create policy "albums readable" on albums for select using (true);
create policy "albums insertable by authenticated users"
  on albums for insert
  with check (auth.uid() is not null);
create policy "albums updatable by authenticated users"
  on albums for update
  using (auth.uid() is not null);

create policy "song_count_exclusions owner rw" on song_count_exclusions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Needed so the catalog sync can write back spotify_id/image/track metadata
-- onto rows it (or another user) already inserted.
create policy "artists updatable by authenticated users"
  on artists for update
  using (auth.uid() is not null);

create policy "songs updatable by authenticated users"
  on songs for update
  using (auth.uid() is not null);
