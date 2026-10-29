-- Who can see someone's Collection (songs heard) and Stats pages, on top of
-- who can see their profile. The stricter of the two wins, so these can
-- only narrow the profile setting. They hide the pages, not the shows
-- underneath (those follow the profile and each show's own setting).
alter table profiles
  add column if not exists songs_visibility text not null default 'public'
    check (songs_visibility in ('public', 'friends', 'private')),
  add column if not exists stats_visibility text not null default 'public'
    check (stats_visibility in ('public', 'friends', 'private'));

-- Readable like the other privacy settings (0007 lists columns explicitly).
grant select (songs_visibility, stats_visibility) on profiles to anon, authenticated;
