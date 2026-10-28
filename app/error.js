'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { useI18n } from '../i18n/client';
import ErrorScreen, { HomeLink } from '../components/ErrorScreen';

// Shown when a page throws (e.g. a database query failed — see
// utils/checked.js). The layout and nav stay, so the rest of the app is one
// tap away. `retry` re-renders the page; in production server errors only
// carry a `digest` that matches the server log, never the real message.
export default function ErrorPage({ error, retry }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error ? error.digest : null;

  return (
    <ErrorScreen big=":(" title={t('errors.errorTitle')} body={t('errors.errorBody')}>
      <button
        onClick={() => retry()}
        className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition hover:brightness-105"
      >
        <RotateCw size={15} /> {t('errors.retry')}
      </button>
      <HomeLink label={t('errors.home')} />
      {digest && <p className="w-full text-xs text-muted">{t('errors.code', { code: digest })}</p>}
    </ErrorScreen>
  );
}
