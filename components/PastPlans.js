'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import { useI18n } from '../i18n/client';
import TicketStub from './TicketStub';

// Planned shows whose date has passed: confirm you went (opens the entry
// switched to "I went", ready for a rating and setlist) or drop it.
export default function PastPlans({ entries }) {
  const { t } = useI18n();
  const router = useRouter();
  const [armed, setArmed] = useState(null); // entry id awaiting a 2nd tap
  const [busy, setBusy] = useState(null);

  const dismiss = async (id) => {
    if (armed !== id) {
      setArmed(id);
      setTimeout(() => setArmed((current) => (current === id ? null : current)), 4000);
      return;
    }
    setBusy(id);
    await createClient().from('concert_entries').delete().eq('id', id);
    setBusy(null);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="marquee text-3xl">{t('home.pastPlansTitle')}</h2>
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-2">
          <TicketStub entry={entry} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/log?edit=${entry.id}&went=1`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2 text-sm font-bold text-brand-foreground transition hover:brightness-105"
            >
              <Check size={15} /> {t('home.pastPlansYes')}
            </button>
            <button
              type="button"
              onClick={() => dismiss(entry.id)}
              disabled={busy === entry.id}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-sm transition disabled:opacity-60 ${
                armed === entry.id ? 'border-danger bg-danger/10 text-danger' : 'border-border text-muted hover:text-foreground'
              }`}
            >
              {busy === entry.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
              {armed === entry.id ? t('home.pastPlansNoConfirm') : t('home.pastPlansNo')}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
