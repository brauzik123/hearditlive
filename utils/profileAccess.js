// Who's looking at whose profile, and whether they may see its content.
// Mirrors the database rule (entry_visible_to_viewer): public profiles are
// open, friends-only needs a mutual follow, private is owner-only. The
// database enforces this regardless; this decides what the page renders.
export async function getProfileAccess(supabase, username) {
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // ilike matches case-insensitively, but treats _ and % as wildcards —
  // escape them so "qa_bob" can't also match "qaxbob".
  const pattern = username.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, profile_visibility')
    .ilike('username', pattern)
    .maybeSingle();
  if (!profile) return null;

  const isSelf = viewer?.id === profile.id;
  let isFriend = false;
  if (viewer && !isSelf) {
    const { data } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', profile.id)
      .eq('friend_id', viewer.id)
      .maybeSingle();
    isFriend = !!data;
  }

  const canViewContent =
    isSelf || profile.profile_visibility === 'public' || (profile.profile_visibility === 'friends' && isFriend);

  return { viewer, profile, isSelf, isFriend, canViewContent };
}
