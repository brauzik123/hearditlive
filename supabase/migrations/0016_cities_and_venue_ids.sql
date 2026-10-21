-- Cities and venues get stable identities instead of free text, so
-- "Warsaw" (from setlist.fm) and "Warszawa" (typed) are the same city.
--
-- cities: one row per GeoNames place (the same ids setlist.fm uses), with
-- names in each app language. Filled server-side from the GeoNames API.
create table if not exists cities (
  geoname_id   bigint primary key,
  name_en      text not null,
  name_pl      text,
  country_code text,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz not null default now()
);

alter table cities enable row level security;
drop policy if exists "cities readable" on cities;
create policy "cities readable" on cities for select using (true);

-- Venues point at their city. venues.setlistfm_id (unique) already exists
-- from the initial schema and is now actually filled, so every import of
-- the same venue lands on one row. venues.city (text) stays as the
-- fallback for places GeoNames doesn't know.
alter table venues add column if not exists city_id bigint references cities (geoname_id);
create index if not exists venues_city_idx on venues (city_id);

-- Venues are now created only through the server (/api/venues/resolve),
-- which validates setlist.fm and GeoNames ids. A client could otherwise
-- attach a bogus venue to a real setlist.fm id and hijack everyone's
-- imports of that venue.
revoke insert on venues from anon, authenticated;
