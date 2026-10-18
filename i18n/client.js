'use client';

import { createContext, useContext, useMemo } from 'react';
import { LOCALE_COOKIE, formatDate, makeT, timeAgo } from './translate';

const I18nContext = createContext(null);

// The root layout picks the locale on the server and hands the dictionary
// down, so client components translate without loading anything.
export function I18nProvider({ locale, dict, children }) {
  const value = useMemo(
    () => ({
      locale,
      t: makeT(dict, locale),
      date: (iso, options) => formatDate(iso, locale, options),
      ago: (iso) => timeAgo(iso, locale),
    }),
    [locale, dict]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

// Saves the choice for a year; callers then router.refresh() so server
// components re-render in the new language.
export function saveLocale(locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
