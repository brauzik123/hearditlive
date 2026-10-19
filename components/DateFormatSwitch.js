'use client';

import { useRouter } from 'next/navigation';
import { useI18n, saveDateFormat } from '../i18n/client';
import { DATE_FORMATS, formatDate } from '../i18n/translate';

// Each option is labelled with today's date written that way, which says
// more than a pattern like "DD.MM.YYYY" would.
export default function DateFormatSwitch() {
  const { locale, dateFormat, t } = useI18n();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const choose = (next) => {
    if (next === dateFormat) return;
    saveDateFormat(next);
    router.refresh();
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t('settings.dateFormat')}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DATE_FORMATS.map((format) => (
          <label
            key={format}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 transition ${
              dateFormat === format ? 'border-brand bg-surface' : 'border-border hover:border-muted'
            }`}
          >
            <input
              type="radio"
              name="date-format"
              value={format}
              checked={dateFormat === format}
              onChange={() => choose(format)}
              className="sr-only"
            />
            <span className="font-semibold tabular-nums">{formatDate(today, locale, undefined, format)}</span>
            <span className="text-xs text-muted">{t(`settings.dateFormats.${format}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
