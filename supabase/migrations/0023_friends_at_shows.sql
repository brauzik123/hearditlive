-- Friends at shows: "who was there" can name a friend's account
-- (entry_attendees.user_id, which already exists), and a tagged friend can
-- copy the show into their own log.

-- Tagging shares that one show with the person tagged, whatever its privacy
-- setting, so they can see what they were tagged at and copy it. Same rules
-- as 0009 otherwise.
create or replace function entry_visible_to_viewer(e concert_entries)
returns boolean language sql stable security definer set search_path = public as $$
  select
    e.user_id = auth.uid()
    or exists (select 1 from entry_attendees a where a.entry_id = e.id and a.user_id = auth.uid())
    or (
      case (select profile_visibility from profiles where id = e.user_id)
        when 'private' then false
        when 'friends' then is_friend_of(e.user_id)
        else true
      end
      and
      case coalesce(e.visibility, 'inherit')
        when 'private' then false
        when 'friends' then is_friend_of(e.user_id)
        when 'public' then true
        else (
          select case p.default_entry_visibility
            when 'private' then false
            when 'friends' then is_friend_of(e.user_id)
            else true
          end
          from profiles p where p.id = e.user_id
        )
      end
    );
$$;

-- Only friends can be tagged, so nobody can push shows onto strangers.
drop policy if exists "entry_attendees owner write" on entry_attendees;
create policy "entry_attendees owner write" on entry_attendees for insert
  with check (
    exists (select 1 from concert_entries e where e.id = entry_id and e.user_id = auth.uid())
    and (user_id is null or is_friend_of(user_id))
  );

-- The person tagged can remove their own tag ("that wasn't me").
drop policy if exists "entry_attendees tagged delete" on entry_attendees;
create policy "entry_attendees tagged delete" on entry_attendees for delete
  using (user_id = auth.uid());

-- A show copied from a friend's: remembers where it came from, so the
-- "add to your shows" prompt goes away once it's added.
alter table concert_entries
  add column if not exists copied_from uuid references concert_entries(id) on delete set null;
