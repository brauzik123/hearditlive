import { useState } from 'react';
import { ChevronDown, Plus, UserPlus, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { newId } from '../../../utils/id';
import { applyOwnerChoice, billedNames, ownerChoice } from '../_lib/entryForm';

// The setlist. Under each song, a line of text chips that reads like a
// sentence: "by Tezzus ▾" (whose song it is, tap to change) and "+ guest" /
// "with Żabson" (someone who joined on stage).
export function SetlistEditor({ form, update }) {
  const { t } = useI18n();
  const [ownerOpen, setOwnerOpen] = useState(null); // song id with the "by" picker open
  const [guestEditing, setGuestEditing] = useState(null); // song id with the guest field open

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
  const removeGuest = (song) => {
    patchSong(song.id, { guestName: null, ...(ownerChoice(song) === 'guest' ? { ownerName: null } : {}) });
    setGuestEditing(null);
  };

  const billed = billedNames(form);

  // What the "by" chip says.
  const byText = (song) => {
    const choice = ownerChoice(song);
    if (choice === 'cover') {
      return song.coverOriginalArtist?.trim() ? t('log.byCoverOf', { artist: song.coverOriginalArtist.trim() }) : t('log.byCover');
    }
    if (choice === 'guest') return t('log.byGuest', { name: song.guestName.trim() });
    if (choice.startsWith('artist:')) return t('log.by', { name: song.ownerName });
    // Automatic: on a one-artist show that's simply the artist.
    return billed.length === 1 ? t('log.by', { name: billed[0] }) : t('log.byAuto');
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">{t('entry.setlist')}</p>
        <p className="text-xs text-muted">
          {form.setlist.length === 0
            ? form.entryType === 'attended'
              ? t('log.setlistEmpty')
              : t('log.setlistEmptyPlanned')
            : t('log.setlistHint')}
        </p>
      </div>

      {form.setlist.map((song, i) => {
        const pickingOwner = ownerOpen === song.id;
        const hasGuest = song.guestName != null;
        const editingGuest = guestEditing === song.id || (hasGuest && !song.guestName.trim());
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
              <button
                type="button"
                onClick={() => removeSong(song.id)}
                aria-label={t('log.removeSong')}
                className="shrink-0 rounded-full p-1 text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* The sentence under the song. */}
            <div className="ml-8 flex flex-wrap items-center gap-1.5">
              {song.isEncore && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs text-brand">{t('entry.encore')}</span>}
              <Chip active={pickingOwner} onClick={() => setOwnerOpen(pickingOwner ? null : song.id)} aria-expanded={pickingOwner}>
                {byText(song)} <ChevronDown size={12} className={`transition ${pickingOwner ? 'rotate-180' : ''}`} />
              </Chip>
              {hasGuest && !editingGuest ? (
                <span className="flex items-center rounded-full border border-brand/60 text-xs">
                  <button type="button" onClick={() => setGuestEditing(song.id)} className="flex items-center gap-1 py-1 pl-2.5 pr-1">
                    <UserPlus size={12} className="text-brand" /> {t('log.withGuest', { name: song.guestName.trim() })}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGuest(song)}
                    aria-label={t('log.removeGuest')}
                    className="py-1 pl-1 pr-2 text-muted hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                !hasGuest && (
                  <Chip
                    onClick={() => {
                      patchSong(song.id, { guestName: '' });
                      setGuestEditing(song.id);
                    }}
                  >
                    <Plus size={12} /> {t('log.addGuestShort')}
                  </Chip>
                )
              )}
            </div>

            {pickingOwner && (
              <OwnerPicker
                song={song}
                billed={billed}
                onChange={(patch) => patchSong(song.id, patch)}
                onDone={() => setOwnerOpen(null)}
              />
            )}

            {editingGuest && (
              <div className="ml-8 flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted">{t('log.guestWith')}</span>
                <input
                  className="field py-1.5 text-sm"
                  placeholder={t('log.guestPlaceholder')}
                  aria-label={t('log.guest')}
                  value={song.guestName ?? ''}
                  autoFocus
                  onChange={(e) =>
                    patchSong(song.id, {
                      guestName: e.target.value,
                      // Keep "the guest's own song" pointing at the guest as it's retyped.
                      ...(ownerChoice(song) === 'guest' ? { ownerName: e.target.value } : {}),
                    })
                  }
                  onBlur={() => song.guestName?.trim() && setGuestEditing(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (song.guestName?.trim()) setGuestEditing(null);
                    }
                  }}
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

function Chip({ active = false, children, ...props }) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
        active ? 'border-brand text-foreground' : 'border-border text-muted hover:border-brand hover:text-foreground'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

// "Whose song is it?": one tap on a choice. Automatic, a billed artist,
// the guest's own song, or a cover (with the original artist).
function OwnerPicker({ song, billed, onChange, onDone }) {
  const { t } = useI18n();
  const choice = ownerChoice(song);
  const guest = song.guestName?.trim();
  // An owner no longer billed (e.g. a removed co-artist) stays visible.
  const artists = choice.startsWith('artist:') && !billed.includes(song.ownerName) ? [...billed, song.ownerName] : billed;
  const options = [
    { value: 'auto', label: t('log.ownerAuto') },
    ...artists.map((name) => ({ value: `artist:${name}`, label: name })),
    ...(guest ? [{ value: 'guest', label: t('log.ownerGuestShort', { name: guest }) }] : []),
    { value: 'cover', label: t('log.ownerCover') },
  ];

  const pick = (value) => {
    onChange(applyOwnerChoice(song, value));
    if (value !== 'cover') onDone();
  };

  return (
    <div className="ml-8 flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-2.5">
      <p className="text-xs font-semibold">{t('log.songOwnerQuestion')}</p>
      <div role="radiogroup" aria-label={t('log.songOwnerQuestion')} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={choice === option.value}
            onClick={() => pick(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              choice === option.value
                ? 'border-brand bg-brand font-semibold text-brand-foreground'
                : 'border-border hover:border-brand'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {choice === 'cover' && (
        <input
          className="field py-1.5 text-sm"
          placeholder={t('log.coverArtistPlaceholder')}
          aria-label={t('log.coverArtist')}
          value={song.coverOriginalArtist ?? ''}
          autoFocus
          onChange={(e) => onChange({ coverOriginalArtist: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onDone())}
        />
      )}
      {choice === 'auto' && billed.length > 1 && <p className="text-xs text-muted">{t('log.ownerAutoHint')}</p>}
    </div>
  );
}
