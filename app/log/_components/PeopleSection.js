import { Globe, Lock, Tag as TagIcon, Users } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { ChipInput, Field, Section } from './fields';

export function PeopleSection({ form, update }) {
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
