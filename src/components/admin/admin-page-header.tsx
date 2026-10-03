/**
 * ADMIN PAGE HEADER — шапка экрана админки.
 *
 * Заголовок, пояснение, путь наверх и место под действия. Существует, чтобы у
 * двадцати разделов была одна вертикальная ритмика: без общей шапки каждый экран
 * получает свои отступы, и админка выглядит собранной из разных проектов.
 *
 * Текст приходит ключами: заголовок раздела объявлен в `adminResourceSpecs`, а не
 * написан на странице.
 */

import type { ReactNode } from 'react';

import { AdminReveal } from '@/components/admin/admin-motion';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';

interface AdminPageHeaderProps {
  titleKey?: MessageKey;
  /** Готовый заголовок, когда он приходит из данных (номер заказа, имя клиента). */
  title?: string;
  subtitleKey?: MessageKey;
  subtitle?: string;
  /** Ссылка «наверх»: раздел, к которому относится экран. */
  parent?: { href: string; labelKey: MessageKey };
  actions?: ReactNode;
}

export async function AdminPageHeader({
  titleKey,
  title,
  subtitleKey,
  subtitle,
  parent,
  actions,
}: AdminPageHeaderProps) {
  const t = await getRootTranslate();

  return (
    <AdminReveal>
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {parent ? (
            <Link
              href={parent.href}
              className="inline-flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-content-tertiary underline-offset-4 hover:text-content-accent hover:underline"
            >
              <span aria-hidden>←</span> {t(parent.labelKey)}
            </Link>
          ) : null}

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-content-primary sm:mt-1 sm:text-3xl lg:text-2xl leading-none">{title ?? (titleKey ? t(titleKey) : '')}</h1>

          {subtitle ?? subtitleKey ? (
            <p className="text-body-sm mt-2 max-w-(--layout-prose-max-width) leading-relaxed text-content-secondary">
              {subtitle ?? (subtitleKey ? t(subtitleKey) : '')}
            </p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0 [&_a]:shrink-0 [&_button]:shrink-0">{actions}</div> : null}
      </header>
    </AdminReveal>
  );
}
