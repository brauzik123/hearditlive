import { Big_Shoulders, Instrument_Sans } from 'next/font/google';
import './globals.css';
import ConditionalNavBar from '../components/ConditionalNavBar';
import { I18nProvider } from '../i18n/client';
import { getDateFormat, getDictionary, getLocale } from '../i18n/server';

// Marquee face for artist names, dates and numbers; a clean sans for the
// rest. Both include latin-ext for Polish (ą ć ę ł ń ó ś ź ż).
const marquee = Big_Shoulders({
  variable: '--font-marquee',
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800', '900'],
  // No metric overrides exist for this face; skip the fallback adjustment.
  adjustFontFallback: false,
});

const body = Instrument_Sans({
  variable: '--font-body',
  subsets: ['latin', 'latin-ext'],
});

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: 'Heard It Live',
    description: getDictionary(locale).meta.description,
  };
}

export default async function RootLayout({ children }) {
  const [locale, dateFormat] = await Promise.all([getLocale(), getDateFormat()]);
  return (
    <html lang={locale} className={`${marquee.variable} ${body.variable}`}>
      <body className="font-sans pb-20 md:pb-0 md:pt-16">
        <I18nProvider locale={locale} dateFormat={dateFormat} dict={getDictionary(locale)}>
          <ConditionalNavBar />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
