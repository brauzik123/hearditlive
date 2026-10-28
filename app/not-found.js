import { getI18n } from '../i18n/server';
import ErrorScreen, { HomeLink } from '../components/ErrorScreen';

// Shown when a page calls notFound() (a deleted show, a private profile,
// an unknown festival) and for URLs that match no page at all.
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <ErrorScreen big="404" title={t('errors.notFoundTitle')} body={t('errors.notFoundBody')}>
      <HomeLink label={t('errors.home')} />
    </ErrorScreen>
  );
}
