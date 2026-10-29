import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../../../utils/supabase/server';
import { getProfileAccess } from '../../../../utils/profileAccess';
import StatsView from '../../../../components/StatsView';

// Someone else's Stats, when their profile and Stats settings allow it.
export default async function OtherStatsPage({ params }) {
  const { username } = await params;
  const supabase = await createClient();

  const access = await getProfileAccess(supabase, username);
  if (!access) notFound();
  if (access.isSelf) redirect('/stats');
  if (!access.canViewStats) redirect(`/u/${access.profile.username}`);

  return <StatsView userId={access.profile.id} owner={{ username: access.profile.username }} />;
}
