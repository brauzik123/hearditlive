// Fonts ship with the app (Fontsource) instead of being fetched from Google
// at build time, so builds don't depend on Google Fonts being reachable.
// Marquee face for artist names, dates and numbers; a clean sans for the
// rest. Browsers download only the character sets a page uses, Polish
// letters (ą ć ę ł ń ó ś ź ż) included.
import '@fontsource-variable/big-shoulders/wght.css';
import '@fontsource-variable/instrument-sans/wght.css';
import './globals.css';
import ConditionalNavBar from '../components/ConditionalNavBar';
import { I18nProvider } from '../i18n/client';
import { getDateFormat, getDictionary, getLocale } from '../i18n/server';

// Installed on a phone (Add to Home Screen) the app runs full-screen: the
// page draws under the status bar, so content is padded by the safe areas.
export const viewport = {
  themeColor: '#1b1838',
  viewportFit: 'cover',
};

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: 'Heard It Live',
    description: getDictionary(locale).meta.description,
    appleWebApp: { title: 'Heard It Live', statusBarStyle: 'black-translucent' },
  };
}

export default async function RootLayout({ children }) {
  const [locale, dateFormat] = await Promise.all([getLocale(), getDateFormat()]);
  return (
    <html lang={locale}>
      <body className="font-sans pt-[env(safe-area-inset-top)] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pt-16">
        <I18nProvider locale={locale} dateFormat={dateFormat} dict={getDictionary(locale)}>
          <ConditionalNavBar />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
