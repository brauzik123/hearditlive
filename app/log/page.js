'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Music, MapPin, Calendar, Star, Ticket, Heart, X, Plus,
  ChevronLeft, ChevronRight, Check, Users, Tag as TagIcon, Lock, Globe, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { createClient } from '../../utils/supabase/client';

const STEPS = ['Basics', 'Details', 'Photos & Setlist', 'Friends & Privacy'];

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
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [savedDraft, setSavedDraft] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
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
    })();
  }, []);

  const next = () => {
    if (step === 0) setSavedDraft(true);
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

      router.push(`/entry/${entryId}`);
      router.refresh();
    } catch (err) {
      setError(err.message ?? 'Something went wrong while saving.');
      setSaving(false);
    }
  };

  if (loadingEntry) {
    return (
      <main className="p-8 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" />
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-6 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl font-bold">{editId ? 'Edit Concert' : 'Log a Concert'}</h1>
        <p className="text-sm text-muted mt-1">
          Attended it already, or still planning to go?
        </p>
      </div>

      <EntryTypeToggle value={form.entryType} onChange={(v) => update({ entryType: v })} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Mobile: step progress */}
      <div className="md:hidden">
        <StepProgress steps={STEPS} current={step} />
        {savedDraft && step > 0 && (
          <p className="text-xs text-brand mt-2 flex items-center gap-1">
            <Check size={12} /> Saved as a draft — you can finish this later.
          </p>
        )}
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
          className="flex items-center justify-center gap-2 bg-brand text-brand-foreground font-bold rounded-full py-3 hover:opacity-90 transition disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {editId ? 'Save Changes' : 'Save Entry'}
        </button>
      </div>

      {/* Mobile wizard nav */}
      <div className="md:hidden fixed bottom-16 left-0 w-full bg-background border-t border-border p-3 flex gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="flex-1 flex items-center justify-center gap-1 bg-surface border border-border rounded-full py-3 font-medium"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1 bg-brand text-brand-foreground rounded-full py-3 font-bold"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 bg-brand text-brand-foreground rounded-full py-3 font-bold disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {editId ? 'Save Changes' : 'Save Entry'}
          </button>
        )}
      </div>
    </main>
  );
}

function EntryTypeToggle({ value, onChange }) {
  return (
    <div className="flex bg-surface border border-border rounded-full p-1">
      {[
        { id: 'attended', label: 'I went' },
        { id: 'planned', label: "I'm planning to go" },
      ].map((opt) => (
        <button
          key={opt.id}
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
      <h2 className="font-bold text-lg md:hidden">{title}</h2>
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

const inputClass =
  'bg-surface border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-brand transition w-full';

function BasicsSection({ form, update }) {
  return (
    <Section title="Basics">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Artist" icon={Music}>
          <input
            className={inputClass}
            placeholder="e.g. Fontaines D.C."
            value={form.artist}
            onChange={(e) => update({ artist: e.target.value })}
          />
        </Field>
        <Field label="Venue" icon={MapPin}>
          <input
            className={inputClass}
            placeholder="e.g. Roundhouse"
            value={form.venue}
            onChange={(e) => update({ venue: e.target.value })}
          />
        </Field>
        <Field label="City">
          <input
            className={inputClass}
            placeholder="e.g. London"
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </Field>
        <Field label={form.entryType === 'attended' ? 'Date' : 'Date (if known)'} icon={Calendar}>
          <input
            type="date"
            className={inputClass}
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </Field>
        <Field label="Tour name (optional)">
          <input
            className={inputClass}
            placeholder="e.g. Skinty Fia Tour"
            value={form.tourName}
            onChange={(e) => update({ tourName: e.target.value })}
          />
        </Field>

        {form.entryType === 'planned' && (
          <Field label="Ticket status" icon={Ticket}>
            <select
              className={inputClass}
              value={form.ticketStatus}
              onChange={(e) => update({ ticketStatus: e.target.value })}
            >
              <option value="interested">Just interested</option>
              <option value="bought">Tickets bought</option>
              <option value="confirmed">Confirmed / going</option>
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
        This was/is a festival
      </label>

      {form.isFestival && (
        <Field label="Festival name">
          <input
            className={inputClass}
            placeholder="e.g. Glastonbury 2027 (search setlist.fm or type your own)"
            value={form.festivalName}
            onChange={(e) => update({ festivalName: e.target.value })}
          />
        </Field>
      )}
    </Section>
  );
}

function DetailsSection({ form, update }) {
  return (
    <Section title="Details">
      {form.entryType === 'attended' && (
        <Field label={`Rating: ${form.rating}/10`} icon={Star}>
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

      <Field label={form.entryType === 'attended' ? 'Description / memories' : 'Notes'}>
        <textarea
          className={inputClass}
          rows={4}
          placeholder={
            form.entryType === 'attended'
              ? 'What made this show special?'
              : 'Anything you want to remember about this plan?'
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
        Add to favorites
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

  return (
    <Section title="Photos & Setlist">
      <div>
        <p className="text-sm text-muted mb-2">Photos</p>
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
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                placeholder="Caption / @tag"
                value={photo.caption}
                onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                className="bg-surface border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:border-brand"
              />
            </div>
          ))}
          <label className="aspect-square bg-surface border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted hover:border-brand hover:text-foreground transition cursor-pointer">
            <Plus size={20} />
            <span className="text-xs">Add photo</span>
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
          <p className="text-sm text-muted">Setlist</p>
          <SetlistfmImport form={form} update={update} />
        </div>
        <div className="flex flex-col gap-2">
          {form.setlist.map((song, i) => (
            <div key={song.id} className="flex items-center gap-2">
              <span className="text-xs text-muted w-5 shrink-0">{i + 1}.</span>
              <input
                className={inputClass}
                placeholder="Song name"
                value={song.name}
                onChange={(e) => updateSong(song.id, e.target.value)}
              />
              {song.isEncore && <span className="text-[10px] text-muted uppercase tracking-wide shrink-0">encore</span>}
              <button onClick={() => removeSong(song.id)} className="text-muted hover:text-foreground shrink-0">
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={addSong}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition self-start"
          >
            <Plus size={14} /> Add song
          </button>
        </div>
      </div>
    </Section>
  );
}

function SetlistfmImport({ form, update }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const search = async () => {
    if (!form.artist.trim()) {
      setError('Enter an artist first.');
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
      if (!res.ok) throw new Error(data.error ?? 'Search failed.');
      setResults(data.setlists);
    } catch (err) {
      setError(err.message ?? 'Search failed.');
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
    update({
      setlist: songs,
      setlistfmId: setlist.id,
      tourName: form.tourName || setlist.tourName || '',
      venue: form.venue || setlist.venueName || '',
      city: form.city || setlist.city || '',
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={search} className="text-xs text-brand hover:opacity-80 transition">
        Import from setlist.fm
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">setlist.fm matches</p>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-muted" />
            </div>
          )}

          {!loading && error && <p className="text-xs text-red-400">{error}</p>}

          {!loading && !error && results?.length === 0 && (
            <p className="text-xs text-muted italic">No matching setlists found. Try a different date, or add songs manually.</p>
          )}

          {!loading &&
            results?.map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s)}
                className="text-left bg-surface-light border border-border rounded-lg p-2.5 hover:border-brand transition"
              >
                <p className="text-sm font-medium">{s.eventDate}</p>
                <p className="text-xs text-muted truncate">
                  {s.venueName}
                  {s.city ? `, ${s.city}` : ''}
                </p>
                <p className="text-xs text-muted">
                  {s.tourName ? `${s.tourName} · ` : ''}
                  {s.songCount} songs
                </p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function ChipInput({ items, onAdd, onRemove, placeholder, icon: Icon }) {
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
        <button onClick={submit} className="bg-surface border border-border rounded-lg px-3 hover:border-brand transition">
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
              <button onClick={() => onRemove(item)} className="text-muted hover:text-foreground">
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
  return (
    <Section title="Friends & Privacy">
      <Field label="Who else was there? (friend username or name)" icon={Users}>
        <ChipInput
          items={form.attendees}
          onAdd={(v) => update({ attendees: [...form.attendees, v] })}
          onRemove={(v) => update({ attendees: form.attendees.filter((a) => a !== v) })}
          placeholder="Add a friend or type a name"
        />
      </Field>

      <Field label="Custom tags" icon={TagIcon}>
        <ChipInput
          items={form.tags}
          onAdd={(v) => update({ tags: [...form.tags, v] })}
          onRemove={(v) => update({ tags: form.tags.filter((t) => t !== v) })}
          placeholder="e.g. Front row, Road trip..."
        />
      </Field>

      <Field label="Who can see this entry?" icon={form.visibility === 'private' ? Lock : Globe}>
        <select
          className={inputClass}
          value={form.visibility}
          onChange={(e) => update({ visibility: e.target.value })}
        >
          <option value="inherit">Use my default privacy setting</option>
          <option value="public">Anyone</option>
          <option value="friends">Friends only</option>
          <option value="private">Only me</option>
        </select>
      </Field>
    </Section>
  );
}
