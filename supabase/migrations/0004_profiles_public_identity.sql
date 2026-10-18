-- Profile identity (username/bio/avatar/friend_code/visibility settings) is
-- always readable, matching how private accounts work elsewhere (Instagram
-- etc): the profile card and follow button are visible to anyone, only the
-- concert entries themselves are gated by entry_visible_to_viewer/RLS above.
drop policy if exists "profiles readable unless private" on profiles;

create policy "profiles readable by anyone"
  on profiles for select
  using (true);
