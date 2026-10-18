-- HeardItLive database schema
-- Run this in the Supabase SQL editor (or `supabase db push` once you have
-- the CLI linked to your project). Written to run top-to-bottom on a fresh
-- Supabase project (auth.users already exists, provided by Supabase Auth).

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
-- PROFILES
-- One row per auth.users row. Holds everything public-facing about a user.
-- ============================================================
create table profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  username                  text unique not null,
  display_name              text,
  bio                       text,
  avatar_url                text,
  friend_code               text unique not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),

  -- profile_visibility gates the whole profile.
  -- public: anyone can view. friends: only mutual follows. private: only owner.
  profile_visibility        text not null default 'public'
                             check (profile_visibility in ('public', 'friends', 'private')),

  -- Default visibility applied to new entries (entries can override this individually).
  default_entry_visibility  text not null default 'public'
                             check (default_entry_visibility in ('public', 'friends', 'private')),

  -- If true, non-owners never see photos/description text on entries,
  -- even when the entry itself is visible to them (rating/artist/venue/date still show).
  hide_entry_media_default  boolean not null default false,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index profiles_username_idx on profiles (lower(username));

-- Auto-create a profile row whenever a new auth user signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- FOLLOWS
-- One-directional, TikTok-style. A "friendship" is just two accepted
-- rows in both directions -- there's no separate friends table.
-- ============================================================
create table follows (
  follower_id   uuid not null references profiles(id) on delete cascade,
  followee_id   uuid not null references profiles(id) on delete cascade,

  -- 'accepted' immediately unless followee's profile_visibility = 'private',
  -- in which case it starts 'pending' until the followee approves it.
  status        text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),

  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on follows (followee_id, status);

-- Convenience view: mutual accepted follows = friends.
create view friendships as
  select a.follower_id as user_id, a.followee_id as friend_id
  from follows a
  join follows b
    on a.follower_id = b.followee_id
   and a.followee_id = b.follower_id
  where a.status = 'accepted' and b.status = 'accepted';

-- ============================================================
-- ARTISTS / VENUES
-- Normalized so stats (most-seen artist, most-visited venue) are cheap
-- and so entries can eventually be matched against setlist.fm.
-- ============================================================
create table artists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  setlistfm_mbid  text unique, -- MusicBrainz id, used by setlist.fm's API
  image_url       text,
  created_at      timestamptz not null default now()
);

create index artists_name_idx on artists (lower(name));

create table venues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  city            text,
  state           text,
  country         text,
  setlistfm_id    text unique,
  created_at      timestamptz not null default now()
);

create index venues_name_idx on venues (lower(name));
create index venues_city_idx on venues (lower(city));

create table festivals (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  setlistfm_id    text unique, -- set when pulled from setlist.fm, null when typed manually
  start_date      date,
  end_date        date,
  venue_id        uuid references venues(id),
  city            text,
  country         text,
  created_at      timestamptz not null default now()
);

create index festivals_name_idx on festivals (lower(name));

-- ============================================================
-- CONCERT ENTRIES
-- The core object: either something you attended or something you're
-- planning to go to.
-- ============================================================
create table concert_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,

  entry_type        text not null check (entry_type in ('attended', 'planned')),

  artist_id         uuid references artists(id),
  venue_id          uuid references venues(id),

  event_date        date,             -- nullable: planned entries may not have a firm date yet
  tour_name         text,
  album_name        text,             -- "tour in support of" album, optional
  festival_id       uuid references festivals(id), -- set when this was a festival set, null otherwise

  rating            smallint check (rating between 1 and 10), -- only meaningful for entry_type = 'attended'
  description       text,

  -- only meaningful for entry_type = 'planned'
  ticket_status     text check (ticket_status in ('interested', 'bought', 'confirmed')),

  is_favorite       boolean not null default false,

  -- 'inherit' = fall back to profiles.default_entry_visibility
  visibility        text not null default 'inherit'
                     check (visibility in ('inherit', 'public', 'friends', 'private')),
  hide_media        boolean, -- null = fall back to profiles.hide_entry_media_default

  setlistfm_id      text, -- link back to the exact setlist.fm setlist, if matched

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index concert_entries_user_idx on concert_entries (user_id, event_date desc);
create index concert_entries_artist_idx on concert_entries (artist_id);
create index concert_entries_venue_idx on concert_entries (venue_id);
create index concert_entries_festival_idx on concert_entries (festival_id);

-- ============================================================
-- ENTRY PHOTOS (+ tagging friends in a photo, e.g. "@ Alice")
-- ============================================================
create table entry_photos (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references concert_entries(id) on delete cascade,
  url           text not null,
  caption       text,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index entry_photos_entry_idx on entry_photos (entry_id, position);

create table photo_tags (
  id                uuid primary key default gen_random_uuid(),
  photo_id          uuid not null references entry_photos(id) on delete cascade,
  tagged_user_id    uuid references profiles(id) on delete cascade, -- set when the tagged person has an account
  tagged_name       text,                                           -- free-text fallback otherwise
  created_at        timestamptz not null default now(),
  check (tagged_user_id is not null or tagged_name is not null)
);

create index photo_tags_photo_idx on photo_tags (photo_id);

-- ============================================================
-- ENTRY ATTENDEES ("who was with you")
-- ============================================================
create table entry_attendees (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references concert_entries(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade, -- set when they have an account
  guest_name    text,                                           -- free-text fallback otherwise
  created_at    timestamptz not null default now(),
  check (user_id is not null or guest_name is not null)
);

create index entry_attendees_entry_idx on entry_attendees (entry_id);
create unique index entry_attendees_unique_user on entry_attendees (entry_id, user_id) where user_id is not null;

-- ============================================================
-- SETLISTS
-- songs is a light catalog table; entry_setlist is the per-entry ordering.
-- song_name is denormalized so an entry's setlist still renders even if
-- it was typed in manually and never matched to a canonical song row.
-- ============================================================
create table songs (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid references artists(id),
  name            text not null,
  created_at      timestamptz not null default now(),
  unique (artist_id, name)
);

create table entry_setlist (
  id                      uuid primary key default gen_random_uuid(),
  entry_id                uuid not null references concert_entries(id) on delete cascade,
  song_id                 uuid references songs(id),
  song_name               text not null,
  position                int not null default 0,
  is_encore               boolean not null default false,
  is_cover                boolean not null default false,
  cover_original_artist   text
);

create index entry_setlist_entry_idx on entry_setlist (entry_id, position);
create index entry_setlist_song_idx on entry_setlist (song_id);

-- ============================================================
-- CUSTOM TAGS / FILTERS
-- User-defined labels they can slap on any entry and filter by later.
-- ============================================================
create table tags (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  color         text,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

create table entry_tags (
  entry_id    uuid not null references concert_entries(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

-- ============================================================
-- LINKED MUSIC ACCOUNTS (Spotify / Apple Music)
-- Tokens should really be handled by a server-side function/edge function
-- rather than read directly by the client -- RLS below only allows the
-- owner to see their own row, but treat this table as sensitive.
-- ============================================================
create table linked_music_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  provider          text not null check (provider in ('spotify', 'apple_music')),
  external_user_id  text,
  access_token      text,
  refresh_token     text,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, provider)
);

-- ============================================================
-- updated_at maintenance
-- ============================================================
create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger concert_entries_set_updated_at
  before update on concert_entries
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table follows enable row level security;
alter table artists enable row level security;
alter table venues enable row level security;
alter table festivals enable row level security;
alter table concert_entries enable row level security;
alter table entry_photos enable row level security;
alter table photo_tags enable row level security;
alter table entry_attendees enable row level security;
alter table songs enable row level security;
alter table entry_setlist enable row level security;
alter table tags enable row level security;
alter table entry_tags enable row level security;
alter table linked_music_accounts enable row level security;

-- --- helper: is viewer a friend of target user? ---
create function is_friend_of(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where user_id = target_user and friend_id = auth.uid()
  );
$$;

-- --- profiles ---
-- Anyone signed in can see a profile row exists (needed for search/follow),
-- but the app layer should respect profile_visibility when deciding what
-- to render. We still enforce the hard cases (private) at the DB level:
create policy "profiles readable unless private"
  on profiles for select
  using (
    profile_visibility <> 'private'
    or id = auth.uid()
    or is_friend_of(id)
  );

create policy "profiles self update"
  on profiles for update
  using (id = auth.uid());

-- --- follows ---
create policy "follows readable by participants"
  on follows for select
  using (follower_id = auth.uid() or followee_id = auth.uid());

create policy "follows readable for public counts"
  on follows for select
  using (status = 'accepted');

create policy "follows insert by follower"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "follows update by participants"
  on follows for update
  using (follower_id = auth.uid() or followee_id = auth.uid());

create policy "follows delete by participants"
  on follows for delete
  using (follower_id = auth.uid() or followee_id = auth.uid());

-- --- artists / venues: shared reference data, world-readable, no direct writes from the client ---
create policy "artists readable" on artists for select using (true);
create policy "venues readable" on venues for select using (true);
create policy "festivals readable" on festivals for select using (true);

-- --- concert_entries ---
create function entry_visible_to_viewer(e concert_entries)
returns boolean language sql stable security definer set search_path = public as $$
  select
    e.user_id = auth.uid()
    or (
      case coalesce(e.visibility, 'inherit')
        when 'private' then false
        when 'friends' then is_friend_of(e.user_id)
        when 'public' then true
        else ( -- 'inherit'
          select case p.default_entry_visibility
            when 'private' then false
            when 'friends' then is_friend_of(e.user_id)
            else true
          end
          from profiles p where p.id = e.user_id
        )
      end
    );
$$;

create policy "entries readable per visibility"
  on concert_entries for select
  using (entry_visible_to_viewer(concert_entries));

create policy "entries owner write"
  on concert_entries for insert
  with check (user_id = auth.uid());

create policy "entries owner update"
  on concert_entries for update
  using (user_id = auth.uid());

create policy "entries owner delete"
  on concert_entries for delete
  using (user_id = auth.uid());

-- --- entry_photos / entry_attendees / entry_setlist / entry_tags ---
-- All follow the parent entry's visibility, writes restricted to the entry owner.
create policy "entry_photos readable"
  on entry_photos for select
  using (
    exists (select 1 from concert_entries e where e.id = entry_photos.entry_id and e.user_id = auth.uid())
    or (
      exists (
        select 1 from concert_entries e
        where e.id = entry_photos.entry_id and entry_visible_to_viewer(e)
      )
      and not coalesce(
        (select coalesce(e.hide_media, p.hide_entry_media_default)
         from concert_entries e join profiles p on p.id = e.user_id
         where e.id = entry_photos.entry_id),
        false
      )
    )
  );

create policy "entry_photos owner write"
  on entry_photos for insert
  with check (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "entry_photos owner update"
  on entry_photos for update
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "entry_photos owner delete"
  on entry_photos for delete
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "photo_tags readable" on photo_tags for select
  using (exists (
    select 1 from entry_photos ph join concert_entries e on e.id = ph.entry_id
    where ph.id = photo_tags.photo_id and entry_visible_to_viewer(e)
  ));
create policy "photo_tags owner write" on photo_tags for insert
  with check (exists (
    select 1 from entry_photos ph join concert_entries e on e.id = ph.entry_id
    where ph.id = photo_id and e.user_id = auth.uid()
  ));
create policy "photo_tags owner delete" on photo_tags for delete
  using (exists (
    select 1 from entry_photos ph join concert_entries e on e.id = ph.entry_id
    where ph.id = photo_id and e.user_id = auth.uid()
  ));

create policy "entry_attendees readable" on entry_attendees for select
  using (exists (select 1 from concert_entries e where e.id = entry_id and entry_visible_to_viewer(e)));
create policy "entry_attendees owner write" on entry_attendees for insert
  with check (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "entry_attendees owner delete" on entry_attendees for delete
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "entry_setlist readable" on entry_setlist for select
  using (exists (select 1 from concert_entries e where e.id = entry_id and entry_visible_to_viewer(e)));
create policy "entry_setlist owner write" on entry_setlist for insert
  with check (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "entry_setlist owner update" on entry_setlist for update
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "entry_setlist owner delete" on entry_setlist for delete
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "songs readable" on songs for select using (true);

-- --- tags / entry_tags: private to the owner ---
create policy "tags owner rw" on tags for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entry_tags readable" on entry_tags for select
  using (exists (select 1 from concert_entries e where e.id = entry_id and entry_visible_to_viewer(e)));
create policy "entry_tags owner write" on entry_tags for insert
  with check (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "entry_tags owner delete" on entry_tags for delete
  using (exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid()));

-- --- linked_music_accounts: strictly owner-only ---
create policy "linked_music_accounts owner rw" on linked_music_accounts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
