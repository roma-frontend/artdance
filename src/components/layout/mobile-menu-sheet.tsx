/**
 * MOBILE MENU SHEET — сетка разделов, выезжающая снизу.
 *
 * Заменила список ссылок в панели справа. Причина не косметическая: в панели
 * девять строк текста начинались у верхнего края экрана, а до верха телефона в
 * 6,7 дюйма одной рукой не дотянуться — приходилось перехватывать устройство.
 * Плитки в три колонки собирают те же разделы в зону, где палец уже находится,
 * и дают цель размером с плитку вместо строки текста.
 *
 * Здесь только СОДЕРЖИМОЕ шторки: сам `Sheet` и кнопка-триггер живут в доке.
 * Так сделано ради возврата фокуса. `Sheet` возвращает фокус на элемент,
 * который его открыл, и определяет этот элемент по `SheetTrigger`. Пока шторка
 * управлялась своим `useState`, а кнопка была обычной, Radix не знал, куда
 * возвращать фокус: на телефоне касание кнопку не фокусирует, и после `Esc`
 * фокус оставался на `body` — клавиатурная навигация начиналась заново с начала
 * страницы. Проверяется `e2e/site-header.spec.ts`.
 *
 * Что осталось от `Sheet` (Radix Dialog) и почему он: ловушка фокуса, закрытие
 * по `Esc` и по клику на затемнение, блокировка прокрутки страницы, `aria-modal`
 * и скрытие остального содержимого от скринридера. Всё это при ручной
 * реализации забывают — и потом находит аудит.
 *
 * Полоска-«ручка» сверху — не украшение, а основная цель для закрытия: жест
 * «смахнуть вниз» Radix не поддерживает, а тянуться к крестику в углу на
 * широком телефоне так же неудобно, как к списку у верхнего края.
 */

'use client';

import { useTranslations } from 'next-intl';

import { navIcons } from '@/components/layout/nav-icons';
import { Button } from '@/components/ui/button';
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { headerCta, isActiveNavPath, mobileMenuItems } from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function MobileMenuSheetContent() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <SheetContent
      side="bottom"
      /*
       * `data-side` для CSS: проп `side` вендорного компонента в разметку не
       * попадает, а анимации выезда объявлены в `globals.css` по этому атрибуту
       * (вендорные файлы не патчим — их перезаписывает shadcn).
       */
      data-side="bottom"
      showCloseButton={false}
      className="mobile-menu-sheet overscroll-contain gap-0"
    >
      {/*
        Заголовок и описание обязательны для `aria-labelledby` и
        `aria-describedby` диалога, но визуально шторка в них не нуждается:
        сетка разделов говорит сама за себя.
      */}
      <SheetHeader className="sr-only">
        <SheetTitle>{t('nav.menuTitle')}</SheetTitle>
        <SheetDescription>{t('nav.menuDescription')}</SheetDescription>
      </SheetHeader>

      <SheetClose
        aria-label={t('nav.closeMenu')}
        className={cn(
          'mx-auto mt-1 mb-4 block h-1.5 w-10 shrink-0 rounded-full',
          'bg-border-strong transition-colors duration-normal ease-brand',
          'hover:bg-content-tertiary',
        )}
      />

      <nav aria-label={t('a11y.mainNav')} className="min-h-0 flex-1 overflow-y-auto">
        <ul className="grid grid-cols-3 gap-3">
          {mobileMenuItems.map((item) => {
            const active = isActiveNavPath(pathname, item.href);
            const Icon = item.icon ? navIcons[item.icon] : null;

            return (
              <li key={item.id}>
                {/* `asChild` закрывает шторку тем же нажатием, которым уходит переход. */}
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-full flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center',
                      'transition-colors duration-normal ease-brand active:scale-98',
                      active
                        ? 'border-accent bg-accent-soft text-content-accent'
                        : 'border-border-default bg-surface-raised text-content-primary',
                    )}
                  >
                    {Icon && (
                      <span className="grid size-11 place-items-center rounded-md bg-surface-card">
                        <Icon className="size-5" aria-hidden />
                      </span>
                    )}
                    <span className="text-caption leading-tight">{t(item.labelKey)}</span>
                  </Link>
                </SheetClose>
              </li>
            );
          })}
        </ul>
      </nav>

      <SheetClose asChild>
        <Button asChild block size="lg" variant="accent" className="mt-4 shrink-0">
          <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
        </Button>
      </SheetClose>
    </SheetContent>
  );
}
