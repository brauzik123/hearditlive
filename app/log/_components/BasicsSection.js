import { Music, Calendar, Mic2, Tent, Plus, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { TICKET_STATUSES } from '../_lib/entryForm';
import { Field, Section } from './fields';
import { CityInput, VenueInput } from './PlaceInputs';
import { SetlistfmImport } from './SetlistfmImport';
import { DateField } from './DateField';
import { DuplicateWarning } from './DuplicateWarning';

export function BasicsSection({ form, update, myFestivals, editId }) {
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
          <DateField
            value={form.date}
            onChange={(date) => update({ date })}
            label={attended ? t('log.date') : t('log.dateIfKnown')}
          />
        </Field>
      </div>

      <CoArtistsField form={form} update={update} />

      <DuplicateWarning form={form} editId={editId} />

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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isSupport}
          onChange={(e) => update({ isSupport: e.target.checked })}
          className="h-4 w-4 accent-brand"
        />
        <Mic2 size={15} className="text-muted" /> {t('log.isSupport')}
      </label>

      <FestivalField form={form} update={update} myFestivals={myFestivals} />
    </Section>
  );
}

export function FestivalField({ form, update, myFestivals }) {
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

// Other billed artists of a joint show ("Żabson & Young Igi"). The show
// counts for each of them; each song still counts only for whoever it's by.
function CoArtistsField({ form, update }) {
  const { t } = useI18n();
  const setAt = (i, value) => update({ coArtists: form.coArtists.map((name, j) => (j === i ? value : name)) });
  const removeAt = (i) => update({ coArtists: form.coArtists.filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col gap-2">
      {form.coArtists.map((name, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="marquee shrink-0 text-xl text-muted" aria-hidden="true">
            &amp;
          </span>
          <input
            className="field"
            placeholder={t('log.coArtistPlaceholder')}
            aria-label={t('log.coArtist')}
            value={name}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label={t('log.removeCoArtist')}
            className="shrink-0 rounded-full p-1 text-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update({ coArtists: [...form.coArtists, ''] })}
        className="flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-foreground"
      >
        <Plus size={14} /> {t('log.addCoArtist')}
      </button>
    </div>
  );
}
