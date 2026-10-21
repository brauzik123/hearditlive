-- setlist.fm's API terms require attribution, using the link each API
-- response contains, wherever their data is shown. Keep that link with
-- every imported setlist so the entry page can credit it.
alter table concert_entries add column if not exists setlistfm_url text;
