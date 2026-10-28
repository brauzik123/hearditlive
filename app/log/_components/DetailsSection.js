import { Heart, Star } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import StarRating from '../../../components/StarRating';
import { AutoGrowTextarea, Field, Section } from './fields';

export function DetailsSection({ form, update }) {
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
