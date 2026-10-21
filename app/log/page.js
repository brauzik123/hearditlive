'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Music, MapPin, Calendar, Star, Heart, X, Plus, ChevronLeft, ChevronRight, Check, Users,
  Tag as TagIcon, Lock, Globe, Loader2, Search, ImagePlus, Tent,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';
import { newId } from '../../utils/id';
import { shrinkImage } from '../../utils/image';
import { cityName } from '../../utils/placeNames';
import StarRating from '../../components/StarRating';

const STEPS = ['basics', 'details', 'media', 'people'];
const MAX_PHOTOS = 8;
const TICKET_STATUSES = ['bought', 'not_yet', 'interested'];

const emptyForm = {
  entryType: 'attended',
  artist: '',
  venue: '',
  city: '',
  cityGeonameId: null, // GeoNames id once a city is picked or imported
  setlistfmVenueId: null, // setlist.fm venue id from an import
  date: '',
  tourName: '',
  isFestival: false,
  festivalName: '',
  ticketStatus: 'not_yet',
  rating: 8,
  description: '',
  isFavorite: false,
  photos: [], // { id, url (stored path) | blob (new), previewUrl, caption }
  coverId: null, // id of the photo used as the cover, or null for none
  setlist: [],
  attendees: [],
  tags: [],
  visibility: 'inherit',
  setlistfmId: null,
  setlistfmUrl: null,
};

export default function LogPage() {
  return <LogEntry />;
}

// ilike treats _ and % as wildcards; escape them for exact name matches.
const exact = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

async function resolveArtist(supabase, name) {
  const { data: existing } = await supabase.from('artists').select('id').ilike('name', exact(name)).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('artists').insert({ name }).select('id').single();
  if (error) throw error;
  return created.id;
}

// Venues are matched and created on the server (see /api/venues/resolve).
async function resolveVenue(form) {
  const res = await fetch('/api/venues/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.venue.trim(),
      cityText: form.city.trim(),
      cityGeonameId: form.cityGeonameId,
      setlistfmVenueId: form.setlistfmVenueId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.id;
}

async function resolveFestival(supabase, name, city) {
  const { data: existing } = await supabase.from('festivals').select('id').ilike('name', exact(name)).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from('festivals')
    .insert({ name, city: city || null })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function resolveTag(supabase, userId, name) {
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', exact(name))
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('tags').insert({ user_id: userId, name }).select('id').single();
  if (error) throw error;
  return created.id;
}

function LogEntry() {
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
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditId(id);
    setLoadingEntry(true);
    (async () => {
      const { data: entry, error: fetchError } = await supabase
        .from('concert_entries')
        .select(
          `*, artists(name), venues(name, city, city_id, setlistfm_id, cities(name_en, name_pl)), festivals(name),
           entry_photos(id, url, caption, position, is_cover),
           entry_setlist(song_name, position, is_encore, is_cover, cover_original_artist),
           entry_attendees(guest_name),
           entry_tags(tags(name))`
        )
        .eq('id', id)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        setLoadingEntry(false);
        return;
      }

      const photos = (entry.entry_photos ?? [])
        .sort((a, b) => a.position - b.position)
        .map((p) => ({ id: p.id, url: p.url, caption: p.caption ?? '', blob: null, previewUrl: null, isCover: p.is_cover }));

      setForm({
        // ?went=1 comes from Home's "Were you there?": the planned show
        // becomes an attended one, ready for a rating and setlist.
        entryType: new URLSearchParams(window.location.search).get('went') === '1' ? 'attended' : entry.entry_type,
        artist: entry.artists?.name ?? '',
        venue: entry.venues?.name ?? '',
        city: entry.venues ? cityName(entry.venues, locale) : '',
        cityGeonameId: entry.venues?.city_id ?? null,
        setlistfmVenueId: entry.venues?.setlistfm_id ?? null,
        date: entry.event_date ?? '',
        tourName: entry.tour_name ?? '',
        isFestival: !!entry.festivals,
        festivalName: entry.festivals?.name ?? '',
        ticketStatus: TICKET_STATUSES.includes(entry.ticket_status) ? entry.ticket_status : 'not_yet',
        rating: entry.rating ?? 8,
        description: entry.description ?? '',
        isFavorite: entry.is_favorite,
        photos,
        coverId: photos.find((p) => p.isCover)?.id ?? null,
        setlist: (entry.entry_setlist ?? [])
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: newId(),
            name: s.song_name,
            isEncore: !!s.is_encore,
            isCover: !!s.is_cover,
            coverOriginalArtist: s.cover_original_artist ?? null,
          })),
        attendees: (entry.entry_attendees ?? []).map((a) => a.guest_name).filter(Boolean),
        tags: (entry.entry_tags ?? []).map((tag) => tag.tags?.name).filter(Boolean),
        visibility: entry.visibility ?? 'inherit',
        setlistfmId: entry.setlistfm_id ?? null,
        setlistfmUrl: entry.setlistfm_url ?? null,
      });
      setLoadingEntry(false);

      // Existing photos are private Storage paths; sign them so the editor
      // shows thumbnails instead of blank tiles.
      const paths = photos.map((p) => p.url);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');

      const artistId = form.artist.trim() ? await resolveArtist(supabase, form.artist.trim()) : null;
      const venueId = form.venue.trim() ? await resolveVenue(form) : null;
      const festivalId =
        form.isFestival && form.festivalName.trim()
          ? await resolveFestival(supabase, form.festivalName.trim(), form.city.trim())
          : null;

      const entryPayload = {
        user_id: user.id,
        entry_type: form.entryType,
        artist_id: artistId,
        venue_id: venueId,
        festival_id: festivalId,
        event_date: form.date || null,
        tour_name: form.tourName.trim() || null,
        rating: form.entryType === 'attended' ? form.rating : null,
        description: form.description.trim() || null,
        ticket_status: form.entryType === 'planned' ? form.ticketStatus : null,
        is_favorite: form.isFavorite,
        visibility: form.visibility,
        setlistfm_id: form.setlistfmId,
        setlistfm_url: form.setlistfmUrl,
      };

      let entryId = editId;
      if (editId) {
        const { error: updateError } = await supabase.from('concert_entries').update(entryPayload).eq('id', editId);
        if (updateError) throw updateError;
        await Promise.all([
          supabase.from('entry_photos').delete().eq('entry_id', editId),
          supabase.from('entry_setlist').delete().eq('entry_id', editId),
          supabase.from('entry_attendees').delete().eq('entry_id', editId),
          supabase.from('entry_tags').delete().eq('entry_id', editId),
        ]);
      } else {
        const { data: created, error: insertError } = await supabase
          .from('concert_entries')
          .insert(entryPayload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        entryId = created.id;
      }

      // Cover first, then the rest in the order shown. New photos are
      // already shrunk in the browser; existing ones keep their path.
      const ordered = [
        ...form.photos.filter((p) => p.id === form.coverId),
        ...form.photos.filter((p) => p.id !== form.coverId),
      ];
      const photoRows = [];
      for (let i = 0; i < ordered.length; i++) {
        const photo = ordered[i];
        let url = photo.url;
        if (photo.blob) {
          const path = `${user.id}/${entryId}/${newId()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('entry-photos')
            .upload(path, photo.blob, { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;
          url = path;
        }
        photoRows.push({
          entry_id: entryId,
          url,
          caption: photo.caption.trim() || null,
          position: i,
          is_cover: photo.id === form.coverId,
        });
      }
      if (photoRows.length) {
        const { error: photosError } = await supabase.from('entry_photos').insert(photoRows);
        if (photosError) throw photosError;
      }

      const setlistRows = form.setlist
        .filter((s) => s.name.trim())
        .map((s, i) => ({
          entry_id: entryId,
          song_name: s.name.trim(),
          position: i,
          is_encore: !!s.isEncore,
          is_cover: !!s.isCover,
          cover_original_artist: s.coverOriginalArtist || null,
        }));
      if (setlistRows.length) {
        const { error: setlistError } = await supabase.from('entry_setlist').insert(setlistRows);
        if (setlistError) throw setlistError;
      }

      const attendeeRows = form.attendees.map((name) => ({ entry_id: entryId, guest_name: name }));
      if (attendeeRows.length) {
        const { error: attendeesError } = await supabase.from('entry_attendees').insert(attendeeRows);
        if (attendeesError) throw attendeesError;
      }

      if (form.tags.length) {
        const tagIds = await Promise.all(form.tags.map((name) => resolveTag(supabase, user.id, name)));
        const { error: tagsError } = await supabase
          .from('entry_tags')
          .insert(tagIds.map((tag_id) => ({ entry_id: entryId, tag_id })));
        if (tagsError) throw tagsError;
      }

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
    <MediaSetlistSection key="media" form={form} update={update} />,
    <FriendsPrivacySection key="people" form={form} update={update} />,
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

function EntryTypeToggle({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" className="flex rounded-full border border-border bg-surface p-1">
      {[
        { id: 'attended', label: t('log.went') },
        { id: 'planned', label: t('log.going') },
      ].map((opt) => (
        <button
          key={opt.id}
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
            value === opt.id ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StepProgress({ steps, current }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1">
          <div className={`h-1.5 rounded-full ${i <= current ? 'bg-brand' : 'bg-surface-light'}`} />
          <span className={`text-[10px] ${i === current ? 'text-foreground' : 'text-muted'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="marquee text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        {Icon && <Icon size={14} />} {label}
      </span>
      {children}
    </label>
  );
}

// Textarea that grows with its content instead of scrolling inside itself.
function AutoGrowTextarea({ value, onChange, className = '', minRows = 2, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      className={`field resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}

function BasicsSection({ form, update, myFestivals }) {
  const { t } = useI18n();
  const attended = form.entryType === 'attended';
  return (
    <Section title={t('log.steps.basics')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t('log.artist')} icon={Music}>
          <input
            className="field"
            placeholder={t('log.artistPlaceholder')}
            value={form.artist}
            onChange={(e) => update({ artist: e.target.value })}
          />
        </Field>
        <Field label={attended ? t('log.date') : t('log.dateIfKnown')} icon={Calendar}>
          <input type="date" className="field" value={form.date} onChange={(e) => update({ date: e.target.value })} />
        </Field>
      </div>

      {/* setlist.fm right after artist + date: one tap fills in most of
          the rest. Upcoming shows have no setlist yet. */}
      {attended && <SetlistfmImport form={form} update={update} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CityInput form={form} update={update} />
        <VenueInput form={form} update={update} />
        <Field label={t('log.tour')}>
          <input
            className="field"
            placeholder={t('log.tourPlaceholder')}
            value={form.tourName}
            onChange={(e) => update({ tourName: e.target.value })}
          />
        </Field>
      </div>

      {!attended && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm text-muted">{t('log.ticketStatus')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {TICKET_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={form.ticketStatus === status}
                onClick={() => update({ ticketStatus: status })}
                className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                  form.ticketStatus === status
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'border-border text-muted hover:text-foreground'
                }`}
              >
                {t(`ticketStatus.${status}`)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <FestivalField form={form} update={update} myFestivals={myFestivals} />
    </Section>
  );
}

function FestivalField({ form, update, myFestivals }) {
  const { t } = useI18n();
  const choose = (festival) =>
    update({ isFestival: true, festivalName: festival.name, city: form.city || festival.city || '' });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isFestival}
          onChange={(e) => update({ isFestival: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        <Tent size={15} className="text-muted" /> {t('log.isFestival')}
      </label>

      {form.isFestival && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          {myFestivals.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">{t('log.yourFestivals')}</span>
              <div className="flex flex-wrap gap-2">
                {myFestivals.map((festival) => {
                  const active = form.festivalName.trim().toLowerCase() === festival.name.toLowerCase();
                  return (
                    <button
                      key={festival.name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose(festival)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active ? 'border-brand bg-brand font-semibold text-brand-foreground' : 'border-border hover:border-brand'
                      }`}
                    >
                      {festival.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Field label={myFestivals.length ? t('log.festivalOther') : t('log.festivalName')}>
            <input
              className="field"
              placeholder={t('log.festivalPlaceholder')}
              value={form.festivalName}
              onChange={(e) => update({ festivalName: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function DetailsSection({ form, update }) {
  const { t } = useI18n();
  return (
    <Section title={t('log.steps.details')}>
      {form.entryType === 'attended' && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Star size={14} /> {t('log.ratingLabel')}
          </span>
          <StarRating value={form.rating} onChange={(rating) => update({ rating })} />
        </div>
      )}

      <Field label={form.entryType === 'attended' ? t('log.memories') : t('log.notes')}>
        <AutoGrowTextarea
          minRows={4}
          placeholder={form.entryType === 'attended' ? t('log.memoriesPlaceholder') : t('log.notesPlaceholder')}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isFavorite}
          onChange={(e) => update({ isFavorite: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        <Heart size={14} className={form.isFavorite ? 'fill-brand text-brand' : 'text-muted'} />
        {t('log.favorite')}
      </label>
    </Section>
  );
}

function MediaSetlistSection({ form, update }) {
  const { t } = useI18n();
  const [photoError, setPhotoError] = useState('');
  const [processing, setProcessing] = useState(false);

  const room = MAX_PHOTOS - form.photos.length;

  // Shrinks each picked file before it goes anywhere; `asCover` makes the
  // first one the cover (the cover slot's own picker).
  const addPhotos = async (fileList, asCover = false) => {
    setPhotoError('');
    const files = Array.from(fileList).slice(0, Math.max(room, 0));
    if (fileList.length > files.length) setPhotoError(t('log.photoLimit', { count: MAX_PHOTOS }));
    if (!files.length) return;
    setProcessing(true);
    const added = [];
    for (const file of files) {
      try {
        const blob = await shrinkImage(file);
        added.push({ id: newId(), url: null, blob, previewUrl: URL.createObjectURL(blob), caption: '' });
      } catch {
        setPhotoError(t('log.photoUnsupported'));
      }
    }
    setProcessing(false);
    if (!added.length) return;
    update({
      photos: [...form.photos, ...added],
      ...(asCover ? { coverId: added[0].id } : {}),
    });
  };

  const updateCaption = (id, caption) =>
    update({ photos: form.photos.map((p) => (p.id === id ? { ...p, caption } : p)) });
  const removePhoto = (id) =>
    update({
      photos: form.photos.filter((p) => p.id !== id),
      ...(form.coverId === id ? { coverId: null } : {}),
    });
  const toggleCover = (id) => update({ coverId: form.coverId === id ? null : id });

  const cover = form.photos.find((p) => p.id === form.coverId);
  const others = form.photos.filter((p) => p.id !== form.coverId);

  const addSong = () =>
    update({
      setlist: [...form.setlist, { id: newId(), name: '', isEncore: false, isCover: false, coverOriginalArtist: null }],
    });
  const updateSong = (id, name) => update({ setlist: form.setlist.map((s) => (s.id === id ? { ...s, name } : s)) });
  const removeSong = (id) => update({ setlist: form.setlist.filter((s) => s.id !== id) });

  return (
    <Section title={t('log.steps.media')}>
      {/* Cover: the one photo that represents the show in your collection. */}
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold">{t('log.cover')}</p>
          <p className="text-xs text-muted">{t('log.coverHint')}</p>
        </div>
        {cover ? (
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-xl bg-surface">
              {cover.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.previewUrl} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="aspect-[4/3] w-full" />
              )}
              <button
                type="button"
                onClick={() => toggleCover(cover.id)}
                className="absolute right-2 top-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium"
              >
                {t('log.coverNone')}
              </button>
            </div>
            <AutoGrowTextarea
              minRows={1}
              placeholder={t('log.caption')}
              aria-label={t('log.caption')}
              value={cover.caption}
              onChange={(e) => updateCaption(cover.id, e.target.value)}
            />
          </div>
        ) : (
          <PhotoPicker
            disabled={room <= 0 || processing}
            onPick={(files) => addPhotos(files, true)}
            className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted transition hover:border-brand hover:text-foreground"
          >
            <ImagePlus size={26} />
            <span className="text-sm">{t('log.coverAdd')}</span>
          </PhotoPicker>
        )}
      </div>

      {/* Everything else. Any of these can be promoted to the cover. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">{t('log.otherPhotos')}</p>
          <span className="text-xs text-muted">
            {form.photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        {others.map((photo) => (
          <div key={photo.id} className="flex gap-3 rounded-xl border border-border p-2">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
              {photo.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <AutoGrowTextarea
                minRows={2}
                placeholder={t('log.caption')}
                aria-label={t('log.caption')}
                value={photo.caption}
                onChange={(e) => updateCaption(photo.id, e.target.value)}
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleCover(photo.id)}
                  className="flex items-center gap-1 text-xs font-medium text-brand hover:brightness-110"
                >
                  <Star size={12} /> {t('log.makeCover')}
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  aria-label={t('log.removePhoto')}
                  className="rounded-full p-1 text-muted hover:text-danger"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {room > 0 && (
          <PhotoPicker
            multiple
            disabled={processing}
            onPick={(files) => addPhotos(files)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted transition hover:border-brand hover:text-foreground"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {t('log.addPhoto')}
          </PhotoPicker>
        )}
        {photoError && (
          <p role="alert" className="text-xs text-danger">
            {photoError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t('entry.setlist')}</p>
        {form.setlist.length === 0 && (
          <p className="text-xs text-muted">
            {form.entryType === 'attended' ? t('log.setlistEmpty') : t('log.setlistEmptyPlanned')}
          </p>
        )}
        {form.setlist.map((song, i) => (
          <div key={song.id} className="flex items-center gap-2">
            <span className="marquee w-6 shrink-0 text-right text-lg text-muted">{i + 1}</span>
            <input
              className="field"
              placeholder={t('log.songName')}
              value={song.name}
              onChange={(e) => updateSong(song.id, e.target.value)}
            />
            {song.isEncore && <span className="shrink-0 text-xs text-brand">{t('entry.encore')}</span>}
            <button
              onClick={() => removeSong(song.id)}
              aria-label={t('log.removeSong')}
              className="shrink-0 text-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button onClick={addSong} className="flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-foreground">
          <Plus size={14} /> {t('log.addSong')}
        </button>
      </div>
    </Section>
  );
}

function PhotoPicker({ onPick, multiple = false, disabled, className, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className={`${className} disabled:opacity-50`}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

// setlist.fm dates arrive as dd-MM-yyyy.
function setlistfmDateToIso(value) {
  const [day, month, year] = (value ?? '').split('-');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function SetlistfmImport({ form, update }) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [importedCount, setImportedCount] = useState(null);

  const search = async () => {
    setOpen(true);
    setImportedCount(null);
    if (!form.artist.trim()) {
      setError(t('log.importNeedsArtist'));
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const params = new URLSearchParams({ artist: form.artist.trim() });
      if (form.date) params.set('date', form.date);
      const res = await fetch(`/api/setlistfm/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('log.importFailed'));
      setResults(data.setlists);
    } catch (err) {
      setError(err.message ?? t('log.importFailed'));
    } finally {
      setLoading(false);
    }
  };

  const choose = (setlist) => {
    const songs = [];
    setlist.sets.forEach((set) => {
      set.songs.forEach((song) => {
        songs.push({
          id: newId(),
          name: song.name,
          isEncore: set.isEncore,
          isCover: song.isCover,
          coverOriginalArtist: song.coverOriginalArtist,
        });
      });
    });
    // The chosen setlist is the source of truth for the show's details:
    // override what was typed rather than leave e.g. a London venue on a
    // Paris setlist.
    update({
      setlist: songs,
      setlistfmId: setlist.id,
      setlistfmUrl: setlist.url,
      tourName: setlist.tourName || form.tourName,
      venue: setlist.venueName || form.venue,
      city: setlist.city || form.city,
      cityGeonameId: setlist.cityGeonameId ?? form.cityGeonameId,
      setlistfmVenueId: setlist.venueId ?? null,
      date: setlistfmDateToIso(setlist.eventDate) ?? form.date,
    });
    setImportedCount(songs.length);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-brand/60 bg-surface/50 p-3">
      <button
        type="button"
        onClick={search}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{t('log.importCta')}</span>
          <span className="block text-xs text-muted">{t('log.importHint')}</span>
        </span>
      </button>

      {importedCount != null && !open && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-brand">
          <Check size={14} /> {t('log.importDone', { count: importedCount })}
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">
              {t('log.importMatchesFrom')}{' '}
              <a href="https://www.setlist.fm/" target="_blank" rel="noopener" className="text-brand underline-offset-2 hover:underline">
                setlist.fm
              </a>
            </p>
            <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {!loading && error && <p className="text-xs text-danger">{error}</p>}
          {!loading && !error && results?.length === 0 && <p className="text-xs text-muted">{t('log.importNone')}</p>}
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {!loading &&
              results?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => choose(s)}
                  className="rounded-lg border border-border bg-surface-light p-2.5 text-left transition hover:border-brand"
                >
                  <p className="text-sm font-medium">{date(setlistfmDateToIso(s.eventDate)) || s.eventDate}</p>
                  <p className="truncate text-xs text-muted">
                    {s.venueName}
                    {s.city ? `, ${s.city}` : ''}
                  </p>
                  {s.tourName && <p className="truncate text-xs text-muted">{s.tourName}</p>}
                  <p className="text-xs text-muted">{t('log.songCount', { count: s.songCount })}</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipInput({ items, onAdd, onRemove, placeholder, icon: Icon }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value.trim();
    if (v) {
      onAdd(v);
      setValue('');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          onClick={submit}
          aria-label={t('common.add')}
          className="rounded-lg border border-border bg-surface-light px-3 transition hover:border-brand"
        >
          <Plus size={16} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-light px-3 py-1 text-xs">
              {Icon && <Icon size={12} />} {item}
              <button onClick={() => onRemove(item)} aria-label={t('common.remove')} className="text-muted hover:text-foreground">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FriendsPrivacySection({ form, update }) {
  const { t } = useI18n();
  return (
    <Section title={t('log.steps.people')}>
      <Field label={t('log.whoElse')} icon={Users}>
        <ChipInput
          items={form.attendees}
          onAdd={(v) => update({ attendees: [...form.attendees, v] })}
          onRemove={(v) => update({ attendees: form.attendees.filter((a) => a !== v) })}
          placeholder={t('log.whoElsePlaceholder')}
        />
      </Field>

      <Field label={t('log.tags')} icon={TagIcon}>
        <ChipInput
          items={form.tags}
          onAdd={(v) => update({ tags: [...form.tags, v] })}
          onRemove={(v) => update({ tags: form.tags.filter((tag) => tag !== v) })}
          placeholder={t('log.tagsPlaceholder')}
        />
      </Field>

      <Field label={t('log.whoCanSee')} icon={form.visibility === 'private' ? Lock : Globe}>
        <select className="field" value={form.visibility} onChange={(e) => update({ visibility: e.target.value })}>
          <option value="inherit">{t('log.visibilityDefault')}</option>
          <option value="public">{t('visibility.public')}</option>
          <option value="friends">{t('visibility.friends')}</option>
          <option value="private">{t('visibility.private')}</option>
        </select>
      </Field>
    </Section>
  );
}

// Suggestion list under an input; closes on pick or outside tap.
function Suggestions({ items, onPick, render }) {
  if (!items.length) return null;
  return (
    <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-light"
          >
            {render(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}

// City with GeoNames suggestions. Picking one links the city to its
// GeoNames id, so the same city always counts once whatever it's called.
function CityInput({ form, update }) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const query = form.city.trim();

  useEffect(() => {
    if (!focused || form.cityGeonameId || query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/search?${new URLSearchParams({ q: query, lang: locale })}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.cities ?? []);
      } catch {
        // Aborted or offline: keep the field as plain text.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused, form.cityGeonameId, locale]);

  const visible = focused && !form.cityGeonameId && query.length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        <MapPin size={14} /> {t('log.city')}
      </span>
      <div className="relative">
        <input
          className="field"
          placeholder={t('log.cityPlaceholder')}
          value={form.city}
          aria-label={t('log.city')}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => update({ city: e.target.value, cityGeonameId: null })}
        />
        <Suggestions
          items={visible}
          onPick={(city) => {
            update({ city: city.name, cityGeonameId: city.geonameId });
            setFocused(false);
          }}
          render={(city) => (
            <>
              <span className="font-medium">{city.name}</span>
              <span className="text-muted">{[city.region, city.country].filter(Boolean).map((p) => `, ${p}`).join('')}</span>
            </>
          )}
        />
      </div>
      {form.cityGeonameId ? (
        <span className="flex items-center gap-1 text-xs text-brand">
          <Check size={12} /> {t('log.cityLinked')}
        </span>
      ) : (
        query.length >= 2 && !focused && <span className="text-xs text-muted">{t('log.cityUnlinked')}</span>
      )}
    </div>
  );
}

// Venue with suggestions from venues already in the app (in the chosen
// city when there is one), so "Progresja" isn't saved three ways.
function VenueInput({ form, update }) {
  const { t, locale } = useI18n();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState([]);
  const query = form.venue.trim();

  useEffect(() => {
    if (!focused || query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let request = createClient()
        .from('venues')
        .select('name, city, city_id, cities(name_en, name_pl)')
        .ilike('name', `%${exact(query)}%`)
        .limit(6);
      if (form.cityGeonameId) request = request.eq('city_id', form.cityGeonameId);
      const { data } = await request;
      if (!cancelled) setResults(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, focused, form.cityGeonameId]);

  // Hide the suggestion that's exactly what's typed already.
  const visible = focused
    ? results.filter((v) => !(v.name.toLowerCase() === query.toLowerCase() && (!form.cityGeonameId || v.city_id === form.cityGeonameId)))
    : [];

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        <MapPin size={14} /> {t('log.venue')}
      </span>
      <div className="relative">
        <input
          className="field"
          placeholder={t('log.venuePlaceholder')}
          value={form.venue}
          aria-label={t('log.venue')}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // A hand-edited venue is no longer the imported setlist.fm one.
          onChange={(e) => update({ venue: e.target.value, setlistfmVenueId: null })}
        />
        <Suggestions
          items={visible}
          onPick={(venue) => {
            update({
              venue: venue.name,
              setlistfmVenueId: null,
              ...(venue.city_id && !form.cityGeonameId
                ? { city: cityName(venue, locale), cityGeonameId: venue.city_id }
                : {}),
            });
            setFocused(false);
          }}
          render={(venue) => (
            <>
              <span className="font-medium">{venue.name}</span>
              {cityName(venue, locale) && <span className="text-muted">, {cityName(venue, locale)}</span>}
            </>
          )}
        />
      </div>
    </div>
  );
}
