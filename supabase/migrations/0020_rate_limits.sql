-- Request limits for the app's own API routes (setlist.fm search, catalog
-- sync, city search, ...), so one account can't burn through the external
-- APIs' quotas or get the whole app banned. Fixed windows: one counter row
-- per bucket per window. Server-only, like service_status.
create table if not exists api_usage (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

alter table api_usage enable row level security;
revoke all on api_usage from anon, authenticated;

-- p_rules: [{ "bucket": "setlistfm:<user id>", "max": 20, "window": 60 }, ...]
-- Counts the request against each rule in order and stops at the first one
-- that's over its limit (so a request refused per user doesn't also use up
-- the app-wide budget). Returns seconds until that window resets, or null
-- when the request is allowed.
create or replace function take_rate_limits(p_rules jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rule     jsonb;
  win      int;
  started  timestamptz;
  used     int;
begin
  for rule in select * from jsonb_array_elements(p_rules) loop
    win := (rule->>'window')::int;
    started := to_timestamp(floor(extract(epoch from now()) / win) * win);
    insert into api_usage (bucket, window_start, hits)
    values (rule->>'bucket', started, 1)
    on conflict (bucket, window_start) do update set hits = api_usage.hits + 1
    returning hits into used;
    if used > (rule->>'max')::int then
      return ceil(extract(epoch from started + make_interval(secs => win) - now()))::int;
    end if;
  end loop;

  -- Old windows are useless; sweep them now and then.
  if random() < 0.01 then
    delete from api_usage where window_start < now() - interval '2 days';
  end if;
  return null;
end;
$$;

revoke all on function take_rate_limits(jsonb) from public, anon, authenticated;
grant execute on function take_rate_limits(jsonb) to service_role;
