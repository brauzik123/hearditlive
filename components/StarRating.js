'use client';

import { Star } from 'lucide-react';
import { useI18n } from '../i18n/client';
import { formatRating } from '../utils/rating';

const COUNT = 10;

function StarShape({ fill, size }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <Star size={size} className="absolute inset-0 text-border" strokeWidth={1.5} />
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <Star size={size} className="fill-brand text-brand" strokeWidth={1.5} />
      </span>
    </span>
  );
}

// Ten stars, each split into a left half (x.5) and right half (whole) as
// separate tap targets. Sized to fit a phone screen; arrow keys step by
// half a star. The rating is optional: `value` null means not rated, and
// tapping the current value again (or "Clear") goes back to that.
export default function StarRating({ value, onChange }) {
  const { t, locale } = useI18n();
  const current = value ?? 0;
  const pick = (next) => onChange(next === value ? null : next);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(COUNT, current + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(current <= 0.5 ? null : current - 0.5);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('log.ratingLabel')}
        aria-valuemin={0}
        aria-valuemax={COUNT}
        aria-valuenow={current}
        aria-valuetext={value == null ? t('log.noRating') : t('log.ratingValue', { stars: formatRating(value, locale) })}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md justify-between rounded-lg outline-offset-4"
      >
        {Array.from({ length: COUNT }, (_, i) => (
          <span key={i} className="relative aspect-square w-[9%]">
            <span className="absolute inset-0">
              <StarShape size="100%" fill={Math.max(0, Math.min(1, current - i))} />
            </span>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => pick(i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => pick(i + 1)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        ))}
      </div>
      <div className="flex items-baseline gap-3">
        {value == null ? (
          <p className="text-sm text-muted">{t('log.noRating')}</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              <span className="marquee text-3xl text-brand">{formatRating(value, locale)}</span> / {COUNT}
            </p>
            <button type="button" onClick={() => onChange(null)} className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              {t('log.clearRating')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
