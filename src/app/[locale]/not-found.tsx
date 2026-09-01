import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import { Link } from '@/i18n/routing';

export default async function NotFoundPage() {
  const t = await getTranslations('errors.notFound');

  return (
    <main className="page-container section-y flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-heading-1 mb-4">{t('title')}</h1>
      <p className="text-body mb-8 max-w-md text-content-secondary">{t('description')}</p>
      <Button asChild size="lg">
        <Link href={routes.home()}>{t('cta')}</Link>
      </Button>
    </main>
  );
}
