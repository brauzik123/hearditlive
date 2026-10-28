'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';
import Avatar from './Avatar';

// On your own show: friends who logged the same show (same artist, same
// date). One tap adds them to "who was there", so it counts as a show
// together.
export default function FriendsAlsoThere({ entryId, friends }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(null);

  const add = async (friendId) => {
    setBusy(friendId);
    await createClient().from('entry_attendees').insert({ entry_id: entryId, user_id: friendId });
    setBusy(null);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-brand/60 bg-surface/50 p-3">
      <p className="text-sm font-semibold">{t('entry.friendsAlsoLogged')}</p>
      <div className="flex flex-wrap gap-2">
        {friends.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => add(f.id)}
            disabled={busy === f.id}
            className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-sm transition hover:border-brand disabled:opacity-60"
          >
            <Avatar username={f.username} src={f.avatar_url} size={24} /> {f.username}
            {busy === f.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} className="text-brand" />}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{t('entry.friendsAlsoLoggedHint')}</p>
    </section>
  );
}
