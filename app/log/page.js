'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import { copyFromFriend, emptyForm, entryToForm, ENTRY_FORM_SELECT, STEPS } from './_lib/entryForm';
import { saveEntry } from './_lib/saveEntry';
import { EntryTypeToggle, StepProgress } from './_components/fields';
import { BasicsSection } from './_components/BasicsSection';
import { DetailsSection } from './_components/DetailsSection';
import { MediaSection } from './_components/MediaSection';
import { PeopleSection } from './_components/PeopleSection';

// Log a show, or edit one (?edit=<id>). Mobile walks through the sections
// one step at a time; desktop shows them as one long form.
export default function LogPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [myFestivals, setMyFestivals] = useState([]); // [{ name, city }]

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Festivals this user has logged before, most recent first, so a second
  // set from the same festival is one tap instead of retyping it.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('concert_entries')
        .select('event_date, festivals(name, city)')
        .eq('user_id', user.id)
        .not('festival_id', 'is', null)
        .order('event_date', { ascending: false, nullsFirst: false })
        .limit(200);
      const seen = new Map();
      (data ?? []).forEach((row) => {
        const name = row.festivals?.name;
        if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), row.festivals);
      });
      setMyFestivals([...seen.values()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Read ?edit= here rather than via useSearchParams: in this Next setup
    // the Suspense boundary useSearchParams requires left the page stuck
    // hidden. /log is prerendered, so this can't be initial state either
    // (it'd mismatch on hydration) — one extra render is the cost.
    const params = new URLSearchParams(window.location.search);

    // ?copy= comes from Home's "Friends marked you here": a friend's show,
    // pre-filled as a new show of your own.
    const copyId = params.get('copy');
    if (copyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingEntry(true);
      (async () => {
        const { data: entry, error: fetchError } = await supabase
          .from('concert_entries')
          .select(`${ENTRY_FORM_SELECT}, owner:profiles!concert_entries_user_id_fkey(id, username)`)
          .eq('id', copyId)
          .single();
        if (fetchError) setError(fetchError.message);
        else setForm(copyFromFriend(entryToForm(entry, { locale }), { sourceId: entry.id, friend: entry.owner }));
        setLoadingEntry(false);
      })();
      return;
    }

    const id = params.get('edit');
    if (!id) return;
    setEditId(id);
    setLoadingEntry(true);
    (async () => {
      const { data: entry, error: fetchError } = await supabase
        .from('concert_entries')
        .select(ENTRY_FORM_SELECT)
        .eq('id', id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        setLoadingEntry(false);
        return;
      }

      const loaded = entryToForm(entry, { locale, went: params.get('went') === '1' });
      setForm(loaded);
      setLoadingEntry(false);

      // Existing photos are private Storage paths; sign them so the editor
      // shows thumbnails instead of blank tiles.
      const paths = loaded.photos.map((p) => p.url);
      if (paths.length) {
        const { data: signed } = await supabase.storage.from('entry-photos').createSignedUrls(paths, 3600);
        const byPath = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
        setForm((current) => ({
          ...current,
          photos: current.photos.map((p) => (p.url ? { ...p, previewUrl: byPath.get(p.url) ?? null } : p)),
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const entryId = await saveEntry(supabase, { form, editId });
      // No router.refresh() here: firing it alongside push left the edit
      // flow stuck on "Saving" — the entry page is dynamic and always
      // renders fresh data anyway.
      router.push(`/entry/${entryId}`);
    } catch (err) {
      setError(err.message ?? t('log.saveFailed'));
      setSaving(false);
    }
  };

  if (loadingEntry) {
    return (
      <main className="flex items-center justify-center p-8">
        <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
      </main>
    );
  }

  const sections = [
    <BasicsSection key="basics" form={form} update={update} myFestivals={myFestivals} />,
    <DetailsSection key="details" form={form} update={update} />,
    <MediaSection key="media" form={form} update={update} />,
    <PeopleSection key="people" form={form} update={update} />,
  ];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 pb-36 md:py-10 md:pb-10">
      <h1 className="marquee text-5xl">{editId ? t('log.editTitle') : t('log.title')}</h1>

      <EntryTypeToggle value={form.entryType} onChange={(v) => update({ entryType: v })} />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {/* Mobile: one step at a time */}
      <div className="md:hidden">
        <StepProgress steps={STEPS.map((key) => t(`log.steps.${key}`))} current={step} />
      </div>
      <div className="flex flex-col gap-6 md:hidden">{sections[step]}</div>

      {/* Desktop: everything as one long form */}
      <div className="hidden flex-col gap-8 md:flex">
        {sections.map((section, i) => (
          <div key={STEPS[i]} className={i > 0 ? 'border-t border-border pt-8' : ''}>
            {section}
          </div>
        ))}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-full bg-brand py-3 font-bold text-brand-foreground transition hover:brightness-105 disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {editId ? t('log.saveChanges') : t('log.save')}
        </button>
      </div>

      <div className="fixed bottom-16 left-0 z-40 flex w-full gap-3 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        {step > 0 && (
          <button
            onClick={back}
            className="flex flex-1 items-center justify-center gap-1 rounded-full border border-border bg-surface py-3 font-medium"
          >
            <ChevronLeft size={16} /> {t('common.back')}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 font-bold text-brand-foreground"
          >
            {t('log.continue')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1 rounded-full bg-brand py-3 font-bold text-brand-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {editId ? t('log.saveChanges') : t('log.save')}
          </button>
        )}
      </div>
    </main>
  );
}
