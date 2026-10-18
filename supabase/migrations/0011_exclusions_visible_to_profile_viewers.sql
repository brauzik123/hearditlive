-- Songs collections are viewable by others (/u/[username]/songs). For
-- their totals to match what the owner sees, viewers need the owner's
-- "don't count this song" choices — but only when the profile itself is
-- visible to them (same rule as entries: public, or friends-only + mutual
-- follow; private stays owner-only). Writes remain owner-only.
create policy "song_count_exclusions readable by profile viewers"
  on song_count_exclusions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = song_count_exclusions.user_id
        and (
          p.profile_visibility = 'public'
          or (p.profile_visibility = 'friends' and is_friend_of(p.id))
        )
    )
  );
