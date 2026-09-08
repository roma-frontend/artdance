/**
 * AUTH SHELL — общая рамка экранов входа, регистрации и сброса пароля.
 *
 * В прототипе этих экранов нет вообще, поэтому рамка выведена из его же правил:
 * узкая карточка на `surface-canvas`, заголовок `font-display`, поля во всю
 * ширину. Ничего нового не изобретается — те же токены, что у карточек каталога.
 *
 * **Экран занимает высоту первого экрана и центрирует карточку.** Форма входа,
 * прижатая к верху пустой страницы, читается как ошибка загрузки.
 *
 * **Ни шапки, ни подвала.** Единственная задача этих страниц — впустить человека;
 * навигация по каталогу здесь уводит от неё. Обратная дорога есть: логотип ведёт
 * на главную, и это единственная ссылка вне формы.
 *
 * **`100dvh`, а не `100vh`.** На iOS адресная строка съедает часть `100vh`, и
 * кнопка отправки оказывается под сгибом — ровно на форме входа это заметнее
 * всего.
 */

import type { ReactNode } from 'react';

import { BrandMark } from '@/components/brand/brand-mark';
import { routes, site } from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  /** Ссылка внизу карточки: «нет аккаунта?» / «вернуться ко входу». */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AuthShell({ title, subtitle, footer, children, className }: AuthShellProps) {
  return (
    <main
      id={site.mainContentId}
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface-canvas px-4 py-12"
    >
      <Link href={routes.home()} aria-label={site.name} className="text-content-primary">
        <BrandMark />
      </Link>

      <div
        className={cn(
          'w-full max-w-md rounded-xl border border-border-default bg-surface-card p-6 shadow-md md:p-8',
          className,
        )}
      >
        <h1 className="text-heading-3">{title}</h1>
        {subtitle && <p className="text-body-sm mt-2 text-content-secondary">{subtitle}</p>}

        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="text-body-sm text-content-secondary">{footer}</div>}
    </main>
  );
}
