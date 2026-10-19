-- App-wide pause for external services. When Spotify rate-limits the app
-- with a long Retry-After (development-mode apps can be blocked for ~24h),
-- every sync checks this first instead of each artist hitting Spotify,
-- failing, and backing off on its own. Server-only: no client policies.
create table service_status (
  service       text primary key,
  blocked_until timestamptz
);

alter table service_status enable row level security;
