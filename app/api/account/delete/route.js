import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { createAdminClient } from '../../../../utils/supabase/admin';

// Storage files don't cascade with database rows, so collect every file
// under the user's folder first. Photo paths are {userId}/{entryId}/{file},
// avatars are {userId}/{file}.
async function listUserFiles(admin, bucket, userId) {
  const paths = [];
  const { data: top } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  for (const item of top ?? []) {
    if (item.id) {
      paths.push(`${userId}/${item.name}`);
    } else {
      const { data: nested } = await admin.storage.from(bucket).list(`${userId}/${item.name}`, { limit: 1000 });
      (nested ?? []).forEach((file) => paths.push(`${userId}/${item.name}/${file.name}`));
    }
  }
  return paths;
}

// Permanently deletes the signed-in user's account. Deleting the auth user
// cascades to their profile and from there to every entry, setlist, photo
// row, tag, follow and exclusion they own.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // The client must echo the username back, so a stray request can't wipe
  // an account without the user having typed it.
  const { confirmUsername } = await request.json();
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
  if (!profile || typeof confirmUsername !== 'string' || confirmUsername.trim().toLowerCase() !== profile.username.toLowerCase()) {
    return NextResponse.json({ error: 'Username did not match.' }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    for (const bucket of ['entry-photos', 'avatars']) {
      const paths = await listUserFiles(admin, bucket, user.id);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (err) {
    console.error('account deletion failed:', err);
    return NextResponse.json({ error: 'Could not delete the account. Please try again.' }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
