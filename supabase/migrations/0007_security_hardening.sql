-- Security hardening pass.

-- ------------------------------------------------------------
-- 1. Friend codes are secrets, not public profile data.
-- "profiles readable by anyone" (0004) exposed every column, so anyone —
-- even signed-out visitors — could list every user's friend_code. Profiles
-- stay readable, but friend_code is only reachable through two functions:
-- your own code, and an exact-match lookup by code.
-- ------------------------------------------------------------
revoke select on profiles from anon, authenticated;
grant select (id, username, display_name, bio, avatar_url, profile_visibility,
              default_entry_visibility, hide_entry_media_default, created_at, updated_at)
  on profiles to anon, authenticated;

create function my_friend_code()
returns text language sql stable security definer set search_path = public as $$
  select friend_code from profiles where id = auth.uid();
$$;

create function find_profile_by_friend_code(code text)
returns table (id uuid, username text, profile_visibility text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.profile_visibility
  from profiles p
  where auth.uid() is not null and p.friend_code = code;
$$;

revoke all on function my_friend_code() from public, anon;
revoke all on function find_profile_by_friend_code(text) from public, anon;
grant execute on function my_friend_code() to authenticated;
grant execute on function find_profile_by_friend_code(text) to authenticated;

-- ------------------------------------------------------------
-- 2. Follow requests can't be self-approved.
-- The status used to come from the client, and the follower could also
-- update their own row — so following a private profile could skip the
-- request entirely. Now the database decides the initial status, and only
-- the followed user can accept.
-- ------------------------------------------------------------
create function enforce_follow_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := case
      when (select profile_visibility from profiles where id = new.followee_id) = 'private' then 'pending'
      else 'accepted'
    end;
  elsif new.follower_id <> old.follower_id or new.followee_id <> old.followee_id then
    raise exception 'follow participants cannot be changed';
  end if;
  return new;
end;
$$;

create trigger follows_enforce_rules
  before insert or update on follows
  for each row execute function enforce_follow_rules();

drop policy "follows update by participants" on follows;
create policy "follows accept by followee"
  on follows for update
  using (followee_id = auth.uid());

-- ------------------------------------------------------------
-- 3. Uploads: images only, capped size (enforced by Storage itself, so a
-- client can't bypass it by skipping the app's file picker).
-- ------------------------------------------------------------
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id = 'entry-photos';

update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

-- ------------------------------------------------------------
-- 4. New artists: clients may only supply the name and MusicBrainz id.
-- Photo/Spotify id are filled in server-side by the catalog sync.
-- ------------------------------------------------------------
revoke insert on artists from anon, authenticated;
grant insert (name, setlistfm_mbid) on artists to authenticated;
