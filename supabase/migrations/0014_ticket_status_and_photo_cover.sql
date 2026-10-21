-- Planned shows: ticket answers are now "got a ticket" / "not yet" /
-- "thinking about it". The old 'confirmed' ("going") meant the same as
-- having a ticket, so it folds into 'bought'.
update concert_entries set ticket_status = 'bought' where ticket_status = 'confirmed';
alter table concert_entries drop constraint if exists concert_entries_ticket_status_check;
alter table concert_entries
  add constraint concert_entries_ticket_status_check
  check (ticket_status in ('bought', 'not_yet', 'interested'));

-- The cover is chosen explicitly (or not at all) instead of being
-- whichever photo happens to be first. Existing entries keep their first
-- photo as the cover, matching what they showed before.
alter table entry_photos add column is_cover boolean not null default false;
update entry_photos p set is_cover = true
where p.position = (select min(position) from entry_photos q where q.entry_id = p.entry_id);
create unique index entry_photos_one_cover on entry_photos (entry_id) where is_cover;
