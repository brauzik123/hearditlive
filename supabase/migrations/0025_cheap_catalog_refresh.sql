-- Cheaper catalog refreshes: a full re-download only every 90 days. In
-- between (after 30 days) one Spotify request reads the artist's release
-- count; if it still equals the count from the last full sync, nothing new
-- came out and nothing else is fetched.
alter table artists
  add column if not exists releases_total int,        -- Spotify release count at the last full sync
  add column if not exists catalog_checked_at timestamptz; -- last cheap "anything new?" check
