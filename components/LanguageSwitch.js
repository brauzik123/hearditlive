'use client';

import { useRouter } from 'next/navigation';
import { useI18n, saveLocale } from '../i18n/client';

const OPTIONS = [
  { locale: 'pl', label: 'Polski' },
  { locale: 'en', label: 'English' },
];

export default function LanguageSwitch() {
  const { locale, t } = useI18n();
  const router = useRouter();

  const choose = (next) => {
    if (next === locale) return;
    saveLocale(next);
    router.refresh();
  };

  return (
    <div role="radiogroup" aria-label={t('settings.language')} className="inline-flex self-start rounded-full border border-border p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          role="radio"
          aria-checked={locale === option.locale}
          lang={option.locale}
          onClick={() => choose(option.locale)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            locale === option.locale ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
