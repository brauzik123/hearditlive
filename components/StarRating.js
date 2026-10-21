'use client';

import { Star } from 'lucide-react';
import { useI18n } from '../i18n/client';

const COUNT = 10;

// Ratings are 0.5–10 stars in half steps. Shown as "7.5", "8".
export const formatRating = (rating) =>
  Number(rating).toLocaleString(undefined, { maximumFractionDigits: 1 });

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
// half a star.
export default function StarRating({ value, onChange }) {
  const { t } = useI18n();

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(COUNT, value + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0.5, value - 0.5));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('log.ratingLabel')}
        aria-valuemin={0.5}
        aria-valuemax={COUNT}
        aria-valuenow={value}
        aria-valuetext={t('log.ratingValue', { stars: formatRating(value) })}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md justify-between rounded-lg outline-offset-4"
      >
        {Array.from({ length: COUNT }, (_, i) => (
          <span key={i} className="relative aspect-square w-[9%]">
            <span className="absolute inset-0">
              <StarShape size="100%" fill={Math.max(0, Math.min(1, value - i))} />
            </span>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onChange(i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onChange(i + 1)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        ))}
      </div>
      <p className="text-sm text-muted">
        <span className="marquee text-3xl text-brand">{formatRating(value)}</span> / {COUNT}
      </p>
    </div>
  );
}
