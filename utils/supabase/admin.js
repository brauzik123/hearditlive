import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Privileged server-only client (bypasses RLS). Used solely for writes to
// the shared music catalog, which browsers can read but not modify. Never
// import this from a client component — `server-only` turns that into a
// build error so the secret key can't leak into the browser bundle.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not set — catalog sync needs it on the server.');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
