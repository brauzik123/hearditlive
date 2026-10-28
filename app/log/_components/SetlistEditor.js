import { useState } from 'react';
import { MoreHorizontal, Plus, UserPlus, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { newId } from '../../../utils/id';
import { applyOwnerChoice, billedNames, ownerChoice, ownerLabel } from '../_lib/entryForm';

// The setlist: song names, plus per song who it's by (worked out
// automatically, one of the billed artists, the guest's own song, or a
// cover) and an optional guest who came on stage for it.
export function SetlistEditor({ form, update }) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState(null); // song whose "whose song" panel is open

  const patchSong = (id, patch) => update({ setlist: form.setlist.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const addSong = () =>
    update({
      setlist: [
        ...form.setlist,
        { id: newId(), name: '', isEncore: false, isCover: false, coverOriginalArtist: null, ownerName: null, guestName: null },
      ],
    });
  const removeSong = (id) => update({ setlist: form.setlist.filter((s) => s.id !== id) });
  // Removing a guest also drops them as the song's owner (their own song).
  const removeGuest = (song) =>
    patchSong(song.id, { guestName: null, ...(ownerChoice(song) === 'guest' ? { ownerName: null } : {}) });

  const billed = billedNames(form);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t('entry.setlist')}</p>
      {form.setlist.length === 0 && (
        <p className="text-xs text-muted">
          {form.entryType === 'attended' ? t('log.setlistEmpty') : t('log.setlistEmptyPlanned')}
        </p>
      )}
      {form.setlist.map((song, i) => {
        const label = ownerLabel(song);
        const open = openId === song.id;
        return (
          <div key={song.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="marquee w-6 shrink-0 text-right text-lg text-muted">{i + 1}</span>
              <input
                className="field"
                placeholder={t('log.songName')}
                value={song.name}
                onChange={(e) => patchSong(song.id, { name: e.target.value })}
              />
              {song.isEncore && <span className="shrink-0 text-xs text-brand">{t('entry.encore')}</span>}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : song.id)}
                aria-expanded={open}
                aria-label={t('log.songOwner')}
                title={t('log.songOwner')}
                className={`flex max-w-28 shrink-0 items-center truncate text-xs hover:text-foreground ${open ? 'text-brand' : 'text-muted'}`}
              >
                {label?.artist ??
                  (label ? (
                    label.cover ? t('log.coverOfShort', { artist: label.cover }) : t('log.ownerCover')
                  ) : (
                    <MoreHorizontal size={16} />
                  ))}
              </button>
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
                type="button"
                onClick={() => removeSong(song.id)}
                aria-label={t('log.removeSong')}
                className="shrink-0 text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {open && <OwnerPanel song={song} billed={billed} onChange={(patch) => patchSong(song.id, patch)} />}

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
                  onChange={(e) =>
                    patchSong(song.id, {
                      guestName: e.target.value,
                      // Keep "the guest's own song" pointing at the guest as it's retyped.
                      ...(ownerChoice(song) === 'guest' ? { ownerName: e.target.value } : {}),
                    })
                  }
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
        );
      })}
      <button
        type="button"
        onClick={addSong}
        className="flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-foreground"
      >
        <Plus size={14} /> {t('log.addSong')}
      </button>
    </div>
  );
}

// "Whose song": automatic, a billed artist, the guest's own song, or a cover.
function OwnerPanel({ song, billed, onChange }) {
  const { t } = useI18n();
  const choice = ownerChoice(song);
  const guest = song.guestName?.trim();
  // An owner no longer in the list (e.g. a removed co-artist) still shows.
  const artists = choice.startsWith('artist:') && !billed.includes(song.ownerName) ? [...billed, song.ownerName] : billed;

  return (
    <div className="ml-8 flex flex-col gap-2 rounded-lg border border-border bg-surface/60 p-2.5">
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t('log.songOwner')}
        <select className="field py-1.5 text-sm" value={choice} onChange={(e) => onChange(applyOwnerChoice(song, e.target.value))}>
          <option value="auto">{t('log.ownerAuto')}</option>
          {artists.map((name) => (
            <option key={name} value={`artist:${name}`}>
              {name}
            </option>
          ))}
          {guest && <option value="guest">{t('log.ownerGuest', { name: guest })}</option>}
          <option value="cover">{t('log.ownerCover')}</option>
        </select>
      </label>
      {choice === 'cover' && (
        <input
          className="field py-1.5 text-sm"
          placeholder={t('log.coverArtistPlaceholder')}
          aria-label={t('log.coverArtist')}
          value={song.coverOriginalArtist ?? ''}
          onChange={(e) => onChange({ coverOriginalArtist: e.target.value })}
        />
      )}
      <p className="text-xs text-muted">{t('log.ownerHint')}</p>
    </div>
  );
}
