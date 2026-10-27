-- The artist played as a support act (opened for the headliner).
alter table concert_entries add column if not exists is_support boolean not null default false;
