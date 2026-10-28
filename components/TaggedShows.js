'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';
import TicketStub from './TicketStub';

// Friends' shows you were marked at but haven't logged yourself: add it to
// your shows (opens the form pre-filled with the shared parts), or remove
// the tag if you weren't there.
export default function TaggedShows({ entries, userId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(null);

  const notMe = async (entryId) => {
    setBusy(entryId);
    await createClient().from('entry_attendees').delete().eq('entry_id', entryId).eq('user_id', userId);
    setBusy(null);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="marquee text-3xl">{t('home.taggedTitle')}</h2>
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-2">
          <TicketStub entry={entry} byline={t('home.taggedBy', { name: entry.profiles?.username })} asLink={false} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/log?copy=${entry.id}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2 text-sm font-bold text-brand-foreground transition hover:brightness-105"
            >
              <Plus size={15} /> {t('home.taggedAdd')}
            </button>
            <button
              type="button"
              onClick={() => notMe(entry.id)}
              disabled={busy === entry.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-60"
            >
              {busy === entry.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
              {t('home.taggedNotMe')}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
