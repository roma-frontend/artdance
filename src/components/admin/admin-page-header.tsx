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
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {parent ? (
          <Link
            href={parent.href}
            className="text-eyebrow uppercase text-content-tertiary underline-offset-4 hover:text-content-accent hover:underline"
          >
            {t(parent.labelKey)}
          </Link>
        ) : null}

        <h1 className="text-heading-2 mt-1 text-content-primary">{title ?? (titleKey ? t(titleKey) : '')}</h1>

        {subtitle ?? subtitleKey ? (
          <p className="text-body-sm mt-2 max-w-(--layout-prose-max-width) text-content-secondary">
            {subtitle ?? (subtitleKey ? t(subtitleKey) : '')}
          </p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
