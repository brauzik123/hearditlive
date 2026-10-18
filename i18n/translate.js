// Shared by server and client: builds t() for a locale's dictionary.
//
//   t('home.title')                       -> string
//   t('home.greeting', { name })          -> "{name}" placeholders filled in
//   t('stats.shows', { count: 3 })        -> plural form picked by count
//
// A plural entry is an object keyed by Intl.PluralRules categories
// (one / few / many / other). Polish needs all of them:
// 1 koncert, 2 koncerty, 5 koncertów; English only uses one / other.
export const LOCALES = ['en', 'pl'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_COOKIE = 'lang';

export function makeT(dict, locale) {
  const plurals = new Intl.PluralRules(locale);

  return function t(key, vars) {
    let value = key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);

    if (value && typeof value === 'object') {
      const count = vars?.count ?? 0;
      value = value[plurals.select(count)] ?? value.other;
    }
    if (typeof value !== 'string') {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing ${locale}:${key}`);
      return key;
    }
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match));
  };
}

const INTL_LOCALE = { en: 'en-GB', pl: 'pl-PL' };

export function formatDate(isoDate, locale, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!isoDate) return '';
  // Dates like "2024-09-03" have no time; pin them to UTC noon so no
  // timezone can roll them over to the neighbouring day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T12:00:00Z`) : new Date(isoDate);
  return date.toLocaleDateString(INTL_LOCALE[locale] ?? locale, options);
}

export function timeAgo(isoTimestamp, locale) {
  const seconds = (new Date(isoTimestamp).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale] ?? locale, { numeric: 'auto' });
  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}
