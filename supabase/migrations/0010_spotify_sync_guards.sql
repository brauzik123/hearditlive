-- Bookkeeping that keeps Spotify traffic bounded:
--   spotify_checked_at  last time we searched Spotify for this artist, so an
--                       artist Spotify doesn't know isn't re-searched on every
--                       page view (retried after 30 days)
--   sync_started_at     claim on an in-progress catalog sync, so concurrent
--                       requests for the same artist don't all hit Spotify
--   sync_failed_at /    exponential backoff after a failed sync, so a Spotify
--   sync_fail_count     outage doesn't turn every page view into a retry
alter table artists
  add column spotify_checked_at timestamptz,
  add column sync_started_at timestamptz,
  add column sync_failed_at timestamptz,
  add column sync_fail_count int not null default 0;
