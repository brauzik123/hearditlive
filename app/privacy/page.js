import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getI18n } from '../../i18n/server';
import { PRIVACY, PRIVACY_UPDATED } from '../../i18n/privacy';

export async function generateMetadata() {
  const { locale } = await getI18n();
  return { title: `${PRIVACY[locale].title} · Heard It Live` };
}

// Public page (see OPEN_PATHS in utils/supabase/proxy.js): readable before
// signing up. The contact address comes from CONTACT_EMAIL so it isn't
// hard-coded into the repository.
export default async function Privacy() {
  const { locale, t, date } = await getI18n();
  const content = PRIVACY[locale];
  const contact = process.env.CONTACT_EMAIL;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6 md:py-10">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="marquee text-5xl">{content.title}</h1>
        <p className="max-w-prose leading-relaxed text-foreground/90">{content.intro}</p>
        <p className="text-sm text-muted">
          {content.updated}: {date(PRIVACY_UPDATED)}
        </p>
      </header>

      {content.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="marquee text-3xl">{section.title}</h2>
          <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 leading-relaxed text-foreground/90 marker:text-brand">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2 border-t border-dashed border-border pt-6">
        <h2 className="marquee text-3xl">{content.contactLabel}</h2>
        {contact ? (
          <a href={`mailto:${contact}`} className="self-start text-brand underline-offset-4 hover:underline">
            {contact}
          </a>
        ) : (
          <p className="text-foreground/90">{content.contactFallback}</p>
        )}
      </section>
    </main>
  );
}
