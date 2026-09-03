/**
 * MOBILE MENU SHEET — сетка разделов, выезжающая снизу.
 *
 * Заменила список ссылок в панели справа. Причина не косметическая: в панели
 * девять строк текста начинались у верхнего края экрана, а до верха телефона в
 * 6,7 дюйма одной рукой не дотянуться — приходилось перехватывать устройство.
 * Плитки в три колонки собирают те же разделы в зону, где палец уже находится,
 * и дают цель размером с плитку вместо строки текста.
 *
 * Построена на `Drawer` (vaul), а не на `Sheet` (Radix Dialog), и это ответ на
 * замечание «открывается и закрывается очень резко». Дело было не только в
 * отсутствующих утилитах анимации: даже с ними CSS-выезд по нашей брендовой
 * кривой `cubic-bezier(.16, 1, .3, 1)` проходит 96% пути за первые 230ms из 500
 * и последние четыре пиксела ползёт — движение читается как щелчок с
 * послесвечением. Кривая хороша для короткого сдвига на несколько пикселей, а
 * не для панели во весь экран.
 *
 * vaul для этого и написан: у него своя кривая для панелей, а главное —
 * ЗАКРЫТИЕ ПЕРЕТАСКИВАНИЕМ. Именно оно отличает шторку приложения от
 * веб-модалки: скорость пальца переходит в скорость панели, и жест можно
 * отменить на полпути. Библиотека уже была в зависимостях проекта, а обёртка
 * `ui/drawer.tsx` лежала неиспользованной.
 *
 * Здесь только СОДЕРЖИМОЕ шторки: сам `Drawer` и кнопка-триггер живут в доке.
 * Так сделано ради возврата фокуса — vaul, как и Radix, возвращает фокус на
 * элемент-триггер. Пока шторка управлялась своим `useState`, а кнопка была
 * обычной, возвращать было некуда: на телефоне касание кнопку не фокусирует, и
 * после `Esc` фокус оставался на `body`.
 *
 * Полоска-«ручка» сверху — кнопка с доступным именем, а не декорация: жест
 * перетаскивания мышью и клавиатурой недоступен, и закрытие обязано иметь
 * обычную цель. Декоративный дубль от вендорной обёртки скрыт (`globals.css`).
 */

'use client';

import { useTranslations } from 'next-intl';

import { navIcons } from '@/components/layout/nav-icons';
import { Button } from '@/components/ui/button';
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { headerCta, isActiveNavPath, mobileMenuItems } from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function MobileMenuSheetContent() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <DrawerContent className="mobile-menu-sheet overscroll-contain">
      {/*
        Заголовок и описание обязательны для `aria-labelledby` и
        `aria-describedby` диалога, но визуально шторка в них не нуждается:
        сетка разделов говорит сама за себя.
      */}
      <DrawerHeader className="sr-only">
        <DrawerTitle>{t('nav.menuTitle')}</DrawerTitle>
        <DrawerDescription>{t('nav.menuDescription')}</DrawerDescription>
      </DrawerHeader>

      <DrawerClose
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
                <DrawerClose asChild>
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
                </DrawerClose>
              </li>
            );
          })}
        </ul>
      </nav>

      <DrawerClose asChild>
        <Button asChild block size="lg" variant="accent" className="mt-4 shrink-0">
          <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
        </Button>
      </DrawerClose>
    </DrawerContent>
  );
}
