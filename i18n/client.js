'use client';

import { createContext, useContext, useMemo } from 'react';
import { DATE_FORMAT_COOKIE, LOCALE_COOKIE, formatDate, makeT, stubDate, timeAgo } from './translate';

const I18nContext = createContext(null);

// The root layout picks the locale and date format on the server and hands
// them down, so client components translate without loading anything.
export function I18nProvider({ locale, dateFormat, dict, children }) {
  const value = useMemo(
    () => ({
      locale,
      dateFormat,
      t: makeT(dict, locale),
      date: (iso, options) => formatDate(iso, locale, options, dateFormat),
      stub: (iso) => stubDate(iso, locale, dateFormat),
      ago: (iso) => timeAgo(iso, locale),
    }),
    [locale, dateFormat, dict]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

// Preferences are saved for a year; callers then router.refresh() so
// server components re-render with the new value.
function savePreference(name, value) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export const saveLocale = (locale) => savePreference(LOCALE_COOKIE, locale);
export const saveDateFormat = (format) => savePreference(DATE_FORMAT_COOKIE, format);
