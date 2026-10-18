import { createClient } from '../../utils/supabase/server';
import { getSongsOverview } from '../../utils/songsData';
import SongsGrid from '../../components/SongsGrid';

export default async function SongsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No blocking sync here — render instantly from whatever's already
  // cached. SongsGrid kicks off background syncs for anything stale/new
  // and refreshes tiles as each one finishes.
  const artists = await getSongsOverview(supabase, user.id);
  return <SongsGrid artists={artists} basePath="/songs" />;
}
