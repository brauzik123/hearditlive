-- Cities and venues get stable identities instead of free text, so
-- "Warsaw" (from setlist.fm) and "Warszawa" (typed) are the same city.
--
-- cities: one row per GeoNames place (the same ids setlist.fm uses), with
-- names in each app language. Filled server-side from the GeoNames API.
create table cities (
  geoname_id   bigint primary key,
  name_en      text not null,
  name_pl      text,
  country_code text,
  lat          double precision,
  lng          double precision,
  created_at   timestamptz not null default now()
);

alter table cities enable row level security;
create policy "cities readable" on cities for select using (true);

-- Venues point at their city, and remember setlist.fm's venue id so every
-- import of the same venue lands on one row. venues.city (text) stays as
-- the fallback for places GeoNames doesn't know.
alter table venues
  add column city_id bigint references cities (geoname_id),
  add column setlistfm_id text unique;
create index venues_city_idx on venues (city_id);

-- Venues are now created only through the server (/api/venues/resolve),
-- which validates setlist.fm and GeoNames ids. A client could otherwise
-- attach a bogus venue to a real setlist.fm id and hijack everyone's
-- imports of that venue.
revoke insert on venues from anon, authenticated;
