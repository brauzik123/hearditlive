-- Profile visibility now gates every entry. Previously an entry's own
-- setting (default "public") was checked alone, so a profile set to
-- "Private — only you" still exposed its concerts, setlists and photos to
-- everyone, including signed-out visitors.
--
-- Profile setting is the ceiling; the entry setting can only restrict further:
--   private profile -> owner only
--   friends profile -> owner + mutual follows
--   public profile  -> whatever the entry (or the default) allows
create or replace function entry_visible_to_viewer(e concert_entries)
returns boolean language sql stable security definer set search_path = public as $$
  select
    e.user_id = auth.uid()
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
