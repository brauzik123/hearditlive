'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Music, MapPin, Calendar, Star, Ticket, Heart, X, Plus,
  ChevronLeft, ChevronRight, Check, Users, Tag as TagIcon, Lock, Globe, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';
import { useI18n } from '../../i18n/client';

const STEPS = ['basics', 'details', 'media', 'people'];

const emptyForm = {
  entryType: 'attended',
  artist: '',
  venue: '',
  city: '',
  date: '',
  tourName: '',
  isFestival: false,
  festivalName: '',
  ticketStatus: 'interested',
  rating: 8,
  description: '',
  isFavorite: false,
  photos: [],
  setlist: [],
  attendees: [],
  tags: [],
  visibility: 'inherit',
  setlistfmId: null,
};

export default function LogPage() {
  return <LogEntry />;
}

async function resolveArtist(supabase, name) {
  const { data: existing } = await supabase.from('artists').select('id').ilike('name', name).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('artists').insert({ name }).select('id').single();
  if (error) throw error;
  return created.id;
}

async function resolveVenue(supabase, name, city) {
  let query = supabase.from('venues').select('id').ilike('name', name);
  query = city ? query.ilike('city', city) : query.is('city', null);
  const { data: existing } = await query.limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase.from('venues').insert({ name, city: city || null }).select('id').single();
  if (error) throw error;
  return created.id;
}

async function resolveFestival(supabase, name, city) {
  const { data: existing } = await supabase.from('festivals').select('id').ilike('name', name).limit(1).maybeSingle();
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
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

function LogEntry() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useI18n();
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

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
          `*, artists(name), venues(name, city), festivals(name),
           entry_photos(id, url, caption, position),
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

      setForm({
        entryType: entry.entry_type,
        artist: entry.artists?.name ?? '',
        venue: entry.venues?.name ?? '',
        city: entry.venues?.city ?? '',
        date: entry.event_date ?? '',
        tourName: entry.tour_name ?? '',
        isFestival: !!entry.festivals,
        festivalName: entry.festivals?.name ?? '',
        ticketStatus: entry.ticket_status ?? 'interested',
        rating: entry.rating ?? 8,
        description: entry.description ?? '',
        isFavorite: entry.is_favorite,
        photos: (entry.entry_photos ?? [])
          .sort((a, b) => a.position - b.position)
          .map((p) => ({ id: p.id, url: p.url, caption: p.caption ?? '', file: null, previewUrl: null })),
        setlist: (entry.entry_setlist ?? [])
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: crypto.randomUUID(),
            name: s.song_name,
            isEncore: !!s.is_encore,
            isCover: !!s.is_cover,
            coverOriginalArtist: s.cover_original_artist ?? null,
          })),
        attendees: (entry.entry_attendees ?? []).map((a) => a.guest_name).filter(Boolean),
        tags: (entry.entry_tags ?? []).map((t) => t.tags?.name).filter(Boolean),
        visibility: entry.visibility ?? 'inherit',
        setlistfmId: entry.setlistfm_id ?? null,
      });
      setLoadingEntry(false);

      // Existing photos are private Storage paths; sign them so the editor
      // shows thumbnails instead of blank tiles.
      const paths = (entry.entry_photos ?? []).map((p) => p.url);
      if (paths.length) {
        const { data: signed } = await supabase.storage.from('entry-photos').createSignedUrls(paths, 3600);
        const byPath = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
        setForm((current) => ({
          ...current,
          photos: current.photos.map((p) => (p.url ? { ...p, previewUrl: byPath.get(p.url) ?? null } : p)),
        }));
      }
    })();
  }, []);

  const next = () => {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');

      let artistId = null;
      if (form.artist.trim()) {
        artistId = await resolveArtist(supabase, form.artist.trim());
      }

      let venueId = null;
      if (form.venue.trim()) {
        venueId = await resolveVenue(supabase, form.venue.trim(), form.city.trim());
      }

      let festivalId = null;
      if (form.isFestival && form.festivalName.trim()) {
        festivalId = await resolveFestival(supabase, form.festivalName.trim(), form.city.trim());
      }

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
      };

      let entryId = editId;
      if (editId) {
        const { error: updateError } = await supabase
          .from('concert_entries')
          .update(entryPayload)
          .eq('id', editId);
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

      // Photos: keep existing storage paths, upload any newly-added files.
      const photoRows = [];
      for (let i = 0; i < form.photos.length; i++) {
        const photo = form.photos[i];
        let url = photo.url;
        if (photo.file) {
          const path = `${user.id}/${entryId}/${crypto.randomUUID()}-${photo.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('entry-photos')
            .upload(path, photo.file);
          if (uploadError) throw uploadError;
          url = path;
        }
        photoRows.push({ entry_id: entryId, url, caption: photo.caption || null, position: i });
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
      <main className="p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" aria-label={t('common.loading')} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 pb-36 md:py-10 md:pb-10">
      <h1 className="marquee text-5xl">{editId ? t('log.editTitle') : t('log.title')}</h1>

      <EntryTypeToggle value={form.entryType} onChange={(v) => update({ entryType: v })} />

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {/* Mobile: step progress */}
      <div className="md:hidden">
        <StepProgress steps={STEPS.map((key) => t(`log.steps.${key}`))} current={step} />
      </div>

      {/* Mobile wizard: one step at a time */}
      <div className="md:hidden flex flex-col gap-6">
        {step === 0 && <BasicsSection form={form} update={update} />}
        {step === 1 && <DetailsSection form={form} update={update} />}
        {step === 2 && <MediaSetlistSection form={form} update={update} />}
        {step === 3 && <FriendsPrivacySection form={form} update={update} />}
      </div>

      {/* Desktop: everything as one long form */}
      <div className="hidden md:flex flex-col gap-8">
        <BasicsSection form={form} update={update} />
        <Divider />
        <DetailsSection form={form} update={update} />
        <Divider />
        <MediaSetlistSection form={form} update={update} />
        <Divider />
        <FriendsPrivacySection form={form} update={update} />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-brand text-brand-foreground font-bold rounded-full py-3 hover:brightness-105 transition disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {editId ? t('log.saveChanges') : t('log.save')}
        </button>
      </div>

      {/* Mobile wizard nav */}
      <div className="md:hidden fixed bottom-16 left-0 z-40 w-full bg-background/95 backdrop-blur border-t border-border p-3 flex gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="flex-1 flex items-center justify-center gap-1 bg-surface border border-border rounded-full py-3 font-medium"
          >
            <ChevronLeft size={16} /> {t('common.back')}
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1 bg-brand text-brand-foreground rounded-full py-3 font-bold"
          >
            {t('log.continue')} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 bg-brand text-brand-foreground rounded-full py-3 font-bold disabled:opacity-60"
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
    <div role="radiogroup" className="flex bg-surface border border-border rounded-full p-1">
      {[
        { id: 'attended', label: t('log.went') },
        { id: 'planned', label: t('log.going') },
      ].map((opt) => (
        <button
          key={opt.id}
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 py-2 rounded-full text-sm font-bold transition ${
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
        <div key={label} className="flex-1 flex flex-col gap-1">
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

function Divider() {
  return <hr className="border-border" />;
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted flex items-center gap-1.5">
        {Icon && <Icon size={14} />} {label}
      </span>
      {children}
    </label>
  );
}

const inputClass = 'field';

function BasicsSection({ form, update }) {
  const { t } = useI18n();
  return (
    <Section title={t('log.steps.basics')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('log.artist')} icon={Music}>
          <input
            className={inputClass}
            placeholder={t('log.artistPlaceholder')}
            value={form.artist}
            onChange={(e) => update({ artist: e.target.value })}
          />
        </Field>
        <Field label={t('log.venue')} icon={MapPin}>
          <input
            className={inputClass}
            placeholder={t('log.venuePlaceholder')}
            value={form.venue}
            onChange={(e) => update({ venue: e.target.value })}
          />
        </Field>
        <Field label={t('log.city')}>
          <input
            className={inputClass}
            placeholder={t('log.cityPlaceholder')}
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </Field>
        <Field label={form.entryType === 'attended' ? t('log.date') : t('log.dateIfKnown')} icon={Calendar}>
          <input
            type="date"
            className={inputClass}
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </Field>
        <Field label={t('log.tour')}>
          <input
            className={inputClass}
            placeholder={t('log.tourPlaceholder')}
            value={form.tourName}
            onChange={(e) => update({ tourName: e.target.value })}
          />
        </Field>

        {form.entryType === 'planned' && (
          <Field label={t('log.ticketStatus')} icon={Ticket}>
            <select
              className={inputClass}
              value={form.ticketStatus}
              onChange={(e) => update({ ticketStatus: e.target.value })}
            >
              <option value="interested">{t('ticketStatus.interested')}</option>
              <option value="bought">{t('ticketStatus.bought')}</option>
              <option value="confirmed">{t('ticketStatus.confirmed')}</option>
            </select>
          </Field>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isFestival}
          onChange={(e) => update({ isFestival: e.target.checked })}
          className="accent-brand"
        />
        {t('log.isFestival')}
      </label>

      {form.isFestival && (
        <Field label={t('log.festivalName')}>
          <input
            className={inputClass}
            placeholder={t('log.festivalPlaceholder')}
            value={form.festivalName}
            onChange={(e) => update({ festivalName: e.target.value })}
          />
        </Field>
      )}
    </Section>
  );
}

function DetailsSection({ form, update }) {
  const { t } = useI18n();
  return (
    <Section title={t('log.steps.details')}>
      {form.entryType === 'attended' && (
        <Field label={t('log.rating', { rating: form.rating })} icon={Star}>
          <input
            type="range"
            min="1"
            max="10"
            value={form.rating}
            onChange={(e) => update({ rating: Number(e.target.value) })}
            className="accent-brand"
          />
        </Field>
      )}

      <Field label={form.entryType === 'attended' ? t('log.memories') : t('log.notes')}>
        <textarea
          className={inputClass}
          rows={4}
          placeholder={
            form.entryType === 'attended'
              ? t('log.memoriesPlaceholder')
              : t('log.notesPlaceholder')
          }
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isFavorite}
          onChange={(e) => update({ isFavorite: e.target.checked })}
          className="accent-brand"
        />
        <Heart size={14} className={form.isFavorite ? 'fill-brand text-brand' : 'text-muted'} />
        {t('log.favorite')}
      </label>
    </Section>
  );
}

function MediaSetlistSection({ form, update }) {
  const addPhotos = (fileList) => {
    const newPhotos = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      url: null,
      caption: '',
    }));
    update({ photos: [...form.photos, ...newPhotos] });
  };
  const updatePhotoCaption = (id, caption) =>
    update({ photos: form.photos.map((p) => (p.id === id ? { ...p, caption } : p)) });
  const removePhoto = (id) => update({ photos: form.photos.filter((p) => p.id !== id) });

  const addSong = () =>
    update({
      setlist: [...form.setlist, { id: crypto.randomUUID(), name: '', isEncore: false, isCover: false, coverOriginalArtist: null }],
    });
  const updateSong = (id, name) =>
    update({ setlist: form.setlist.map((s) => (s.id === id ? { ...s, name } : s)) });
  const removeSong = (id) => update({ setlist: form.setlist.filter((s) => s.id !== id) });
  const { t } = useI18n();

  return (
    <Section title={t('log.steps.media')}>
      <div>
        <p className="text-sm text-muted mb-2">{t('log.photos')}</p>
        <div className="grid grid-cols-3 gap-3">
          {form.photos.map((photo) => (
            <div key={photo.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-square bg-surface-light border border-border rounded-lg overflow-hidden flex items-center justify-center">
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={20} className="text-muted" />
                )}
                <button
                  onClick={() => removePhoto(photo.id)}
                  aria-label={t('log.removePhoto')}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                placeholder={t('log.caption')}
                value={photo.caption}
                onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                className="bg-surface-light border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-brand"
              />
            </div>
          ))}
          <label className="aspect-square bg-surface border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted hover:border-brand hover:text-foreground transition cursor-pointer">
            <Plus size={20} />
            <span className="text-xs">{t('log.addPhoto')}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files.length && addPhotos(e.target.files)}
            />
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted">{t('entry.setlist')}</p>
          <SetlistfmImport form={form} update={update} />
        </div>
        <div className="flex flex-col gap-2">
          {form.setlist.map((song, i) => (
            <div key={song.id} className="flex items-center gap-2">
              <span className="text-xs text-muted w-5 shrink-0">{i + 1}.</span>
              <input
                className={inputClass}
                placeholder={t('log.songName')}
                value={song.name}
                onChange={(e) => updateSong(song.id, e.target.value)}
              />
              {song.isEncore && <span className="text-xs text-brand shrink-0">{t('entry.encore')}</span>}
              <button onClick={() => removeSong(song.id)} aria-label={t('log.removeSong')} className="text-muted hover:text-foreground shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={addSong}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition self-start"
          >
            <Plus size={14} /> {t('log.addSong')}
          </button>
        </div>
      </div>
    </Section>
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

  const search = async () => {
    if (!form.artist.trim()) {
      setError(t('log.importNeedsArtist'));
      setOpen(true);
      return;
    }
    setOpen(true);
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
          id: crypto.randomUUID(),
          name: song.name,
          isEncore: set.isEncore,
          isCover: song.isCover,
          coverOriginalArtist: song.coverOriginalArtist,
        });
      });
    });
    // The chosen setlist is the source of truth for the show's details:
    // override what was typed rather than leave e.g. a London venue on a
    // Paris setlist. setlist.fm dates come as dd-MM-yyyy.
    update({
      setlist: songs,
      setlistfmId: setlist.id,
      tourName: setlist.tourName || form.tourName,
      venue: setlist.venueName || form.venue,
      city: setlist.city || form.city,
      date: setlistfmDateToIso(setlist.eventDate) ?? form.date,
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={search} className="text-sm font-medium text-brand hover:brightness-110 transition">
        {t('log.import')}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">{t('log.importMatches')}</p>
            <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-muted" />
            </div>
          )}

          {!loading && error && <p className="text-xs text-danger">{error}</p>}

          {!loading && !error && results?.length === 0 && (
            <p className="text-xs text-muted">{t('log.importNone')}</p>
          )}

          {!loading &&
            results?.map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s)}
                className="text-left bg-surface-light border border-border rounded-lg p-2.5 hover:border-brand transition"
              >
                <p className="text-sm font-medium">{date(setlistfmDateToIso(s.eventDate)) || s.eventDate}</p>
                <p className="text-xs text-muted truncate">
                  {s.venueName}
                  {s.city ? `, ${s.city}` : ''}
                </p>
                {s.tourName && <p className="text-xs text-muted truncate">{s.tourName}</p>}
                <p className="text-xs text-muted">{t('log.songCount', { count: s.songCount })}</p>
              </button>
            ))}
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
          className={inputClass}
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
        <button onClick={submit} aria-label={t('common.add')} className="bg-surface-light border border-border rounded-lg px-3 hover:border-brand transition">
          <Plus size={16} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 bg-surface-light border border-border rounded-full px-3 py-1 text-xs"
            >
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
          onRemove={(v) => update({ tags: form.tags.filter((t) => t !== v) })}
          placeholder={t('log.tagsPlaceholder')}
        />
      </Field>

      <Field label={t('log.whoCanSee')} icon={form.visibility === 'private' ? Lock : Globe}>
        <select
          className={inputClass}
          value={form.visibility}
          onChange={(e) => update({ visibility: e.target.value })}
        >
          <option value="inherit">{t('log.visibilityDefault')}</option>
          <option value="public">{t('visibility.public')}</option>
          <option value="friends">{t('visibility.friends')}</option>
          <option value="private">{t('visibility.private')}</option>
        </select>
      </Field>
    </Section>
  );
}
