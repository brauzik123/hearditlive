-- A name you typed for someone ("Ola") becomes their account once they have
-- one, on all your shows at once. Security definer because updating
-- entry_attendees isn't allowed directly (rows are only inserted and deleted).
-- Only your own shows change, and only to someone who is your friend, the
-- same rule as tagging a friend by hand.
create or replace function link_guest_to_friend(p_guest text, p_friend uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  linked int;
begin
  if me is null or not is_friend_of(p_friend) then
    raise exception 'Only a friend can be linked.';
  end if;

  -- The friend is already tagged on that show: the typed name is a duplicate.
  delete from entry_attendees a
  using concert_entries e
  where a.entry_id = e.id
    and e.user_id = me
    and a.user_id is null
    and lower(trim(a.guest_name)) = lower(trim(p_guest))
    and exists (select 1 from entry_attendees t where t.entry_id = a.entry_id and t.user_id = p_friend);

  -- The same name twice on one show ("Ola", "ola") would break the unique
  -- (entry, user) index below; keep one.
  delete from entry_attendees a
  using concert_entries e, entry_attendees b
  where a.entry_id = e.id
    and e.user_id = me
    and a.user_id is null
    and b.entry_id = a.entry_id
    and b.user_id is null
    and b.id < a.id
    and lower(trim(a.guest_name)) = lower(trim(p_guest))
    and lower(trim(b.guest_name)) = lower(trim(p_guest));

  update entry_attendees a
  set user_id = p_friend, guest_name = null
  from concert_entries e
  where a.entry_id = e.id
    and e.user_id = me
    and a.user_id is null
    and lower(trim(a.guest_name)) = lower(trim(p_guest));
  get diagnostics linked = row_count;

  -- The same person tagged by name in your photos.
  update photo_tags pt
  set tagged_user_id = p_friend, tagged_name = null
  from entry_photos p, concert_entries e
  where pt.photo_id = p.id
    and p.entry_id = e.id
    and e.user_id = me
    and pt.tagged_user_id is null
    and lower(trim(pt.tagged_name)) = lower(trim(p_guest));

  return linked;
end;
$$;

revoke all on function link_guest_to_friend(text, uuid) from public, anon;
grant execute on function link_guest_to_friend(text, uuid) to authenticated;
