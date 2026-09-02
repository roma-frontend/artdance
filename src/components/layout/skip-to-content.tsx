/**
 * SKIP TO CONTENT — первая ссылка в DOM.
 *
 * Пользователь клавиатуры и скринридера иначе обязан пройти всю навигацию на
 * каждой странице, прежде чем добраться до текста. Ссылка невидима, пока не
 * получит фокус (WCAG 2.4.1, обход блоков).
 *
 * Это внутристраничный якорь, поэтому здесь обычный `<a href="#…">`, а не
 * локале-зависимый `Link`: перехода между маршрутами не происходит, а `Link`
 * добавил бы к нему префикс локали.
 */

import { getTranslations } from 'next-intl/server';

import { site } from '@/config';
import { cn } from '@/lib/utils';

export async function SkipToContent() {
  const t = await getTranslations('nav');

  return (
    <a
      href={`#${site.mainContentId}`}
      className={cn(
        'sr-only',
        'focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4',
        'focus-visible:z-modal focus-visible:rounded-full',
        'focus-visible:bg-accent focus-visible:px-6 focus-visible:py-3',
        'focus-visible:text-label focus-visible:text-content-on-accent',
      )}
    >
      {t('skipToContent')}
    </a>
  );
}
