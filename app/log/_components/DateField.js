import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useI18n } from '../../../i18n/client';
import { datePlaceholder, formatDateInput, maskDateInput, parseDateInput } from '../../../utils/dateInput';

// A typed date ("21-10-2026", or the order picked in Settings) with a
// calendar button for the device's own date picker. `value` and `onChange`
// use ISO dates ("2026-10-21"), or "" for no date.
export function DateField({ value, onChange, label }) {
  const { t, locale, dateFormat } = useI18n();
  const [text, setText] = useState(() => formatDateInput(value, dateFormat));
  const [shown, setShown] = useState(value);
  const [touched, setTouched] = useState(false);

  // The date can change from outside (setlist.fm import, the calendar):
  // show it, unless what's typed already means the same date.
  if (value !== shown) {
    setShown(value);
    if (parseDateInput(text, dateFormat) !== value) setText(formatDateInput(value, dateFormat));
  }

  const type = (raw) => {
    const masked = maskDateInput(raw, dateFormat);
    setText(masked);
    if (!masked) onChange('');
    else {
      const iso = parseDateInput(masked, dateFormat);
      if (iso) onChange(iso);
    }
  };

  const invalid = touched && text && !parseDateInput(text, dateFormat);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          className={`field pr-11 ${invalid ? 'border-danger' : ''}`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={datePlaceholder(dateFormat, locale)}
          aria-label={label}
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(e) => type(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {/* The device's date picker: an invisible native date input over the
            calendar icon, so a tap opens it everywhere (iPhone wheel included). */}
        <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted">
          <CalendarDays size={18} />
          <input
            type="date"
            tabIndex={-1}
            aria-label={t('log.pickDate')}
            value={value || ''}
            onChange={(e) => {
              setTouched(false);
              onChange(e.target.value);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </span>
      </div>
      {invalid && <span className="text-xs text-danger">{t('log.dateInvalid', { format: datePlaceholder(dateFormat, locale) })}</span>}
    </div>
  );
}
