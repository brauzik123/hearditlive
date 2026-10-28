import { useState } from 'react';
import { ImagePlus, Loader2, Plus, Star, UserPlus, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { newId } from '../../../utils/id';
import { shrinkImage } from '../../../utils/image';
import { MAX_PHOTOS } from '../_lib/entryForm';
import { AutoGrowTextarea, PhotoPicker, Section } from './fields';

export function MediaSection({ form, update }) {
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
      setlist: [...form.setlist, { id: newId(), name: '', isEncore: false, isCover: false, coverOriginalArtist: null, ownerName: null, guestName: null }],
    });
  const patchSong = (id, patch) => update({ setlist: form.setlist.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const updateSong = (id, name) => patchSong(id, { name });
  // Removing a guest also drops them as the song's owner (their own song).
  const removeGuest = (song) =>
    patchSong(song.id, { guestName: null, ...(song.ownerName === song.guestName ? { ownerName: null } : {}) });
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
          <div key={song.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="marquee w-6 shrink-0 text-right text-lg text-muted">{i + 1}</span>
              <input
                className="field"
                placeholder={t('log.songName')}
                value={song.name}
                onChange={(e) => updateSong(song.id, e.target.value)}
              />
              {song.ownerName && form.coArtists.length > 0 && song.ownerName !== song.guestName && (
                <span className="max-w-24 shrink-0 truncate text-xs text-muted">{song.ownerName}</span>
              )}
              {song.isEncore && <span className="shrink-0 text-xs text-brand">{t('entry.encore')}</span>}
              {song.guestName == null && (
                <button
                  type="button"
                  onClick={() => patchSong(song.id, { guestName: '' })}
                  aria-label={t('log.addGuest')}
                  title={t('log.addGuest')}
                  className="shrink-0 text-muted hover:text-foreground"
                >
                  <UserPlus size={16} />
                </button>
              )}
              <button
                onClick={() => removeSong(song.id)}
                aria-label={t('log.removeSong')}
                className="shrink-0 text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            {/* A guest who came on stage for this song. */}
            {song.guestName != null && (
              <div className="ml-8 flex items-center gap-2">
                <UserPlus size={14} className="shrink-0 text-brand" />
                <input
                  className="field py-1.5 text-sm"
                  placeholder={t('log.guestPlaceholder')}
                  aria-label={t('log.guest')}
                  value={song.guestName}
                  autoFocus={!song.guestName}
                  onChange={(e) => patchSong(song.id, { guestName: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeGuest(song)}
                  aria-label={t('log.removeGuest')}
                  className="shrink-0 text-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        <button onClick={addSong} className="flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-foreground">
          <Plus size={14} /> {t('log.addSong')}
        </button>
      </div>
    </Section>
  );
}
