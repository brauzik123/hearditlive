import 'server-only';
import { cookies, headers } from 'next/headers';
import en from './dictionaries/en';
import pl from './dictionaries/pl';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, formatDate, makeT, timeAgo } from './translate';

const DICTIONARIES = { en, pl };

// The language a user picked in Settings (cookie) wins; otherwise follow
// the browser's preferred language, so Polish browsers start in Polish.
export async function getLocale() {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (LOCALES.includes(saved)) return saved;

  const accept = (await headers()).get('accept-language') ?? '';
  const preferred = accept
    .split(',')
    .map((part) => part.trim().slice(0, 2).toLowerCase())
    .find((code) => LOCALES.includes(code));
  return preferred ?? DEFAULT_LOCALE;
}

export function getDictionary(locale) {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

// Everything a server component needs to render localized text.
export async function getI18n() {
  const locale = await getLocale();
  return {
    locale,
    t: makeT(getDictionary(locale), locale),
    date: (iso, options) => formatDate(iso, locale, options),
    ago: (iso) => timeAgo(iso, locale),
  };
}
