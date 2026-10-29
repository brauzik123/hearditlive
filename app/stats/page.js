import { createClient } from '../../utils/supabase/server';
import StatsView from '../../components/StatsView';

// Your own Stats.
export default async function Stats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <StatsView userId={user.id} />;
}
