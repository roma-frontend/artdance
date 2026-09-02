/**
 * MOBILE NAV DRAWER — выезжающее справа меню для узких экранов.
 *
 * Построен на `Sheet` (Radix Dialog), а не на своём состоянии с классом `.open`,
 * как в прототипе. Причина не в экономии строк: у диалога Radix из коробки есть
 * то, что при ручной реализации забывают и что потом находит аудит доступности —
 * ловушка фокуса, закрытие по `Esc`, закрытие по клику на затемнение, возврат
 * фокуса на бургер, блокировка прокрутки `body`, `aria-modal` и скрытие
 * остальной страницы от скринридера. Наше здесь — только вид и содержимое.
 *
 * Ширина 280px и слой из карты `zIndex.drawer` (не `9999`, как в макете) —
 * см. `--layout-drawer-width` и правило для `[data-slot='sheet-content']`
 * в `globals.css`.
 *
 * Бургер не превращается в крестик, хотя в прототипе превращается: при открытом
 * меню он оказывается под затемнением и недоступен, так что анимация была бы не
 * видна никому. Закрытие — круглой кнопкой внутри панели, она в макете есть
 * (`.mobile-close`).
 */

'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { headerCta, isActiveNavPath, mobileNavItems } from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface MobileNavDrawerProps {
  /** Шапка получила фон: бургер становится тёмным, как и остальной её текст. */
  solid: boolean;
  className?: string;
}

export function MobileNavDrawer({ solid, className }: MobileNavDrawerProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        aria-label={t('nav.openMenu')}
        className={cn(
          'inline-flex size-9 flex-col items-center justify-center gap-1.5 rounded-full',
          'transition-colors duration-normal ease-brand',
          solid ? 'text-content-primary' : 'text-content-on-cinema',
          className,
        )}
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-(--layout-drawer-width) gap-0 px-8 pt-20 pb-8 sm:max-w-none"
      >
        {/*
          Заголовок и описание обязательны для `aria-labelledby`/`aria-describedby`
          диалога, но визуально панель в них не нуждается — крестик и список
          говорят сами за себя. Поэтому они есть в разметке и скрыты визуально.
        */}
        <SheetHeader className="sr-only">
          <SheetTitle>{t('nav.menuTitle')}</SheetTitle>
          <SheetDescription>{t('nav.menuDescription')}</SheetDescription>
        </SheetHeader>

        <SheetClose
          aria-label={t('nav.closeMenu')}
          className={cn(
            'absolute top-5 right-5 grid size-10 place-items-center rounded-full',
            'bg-surface-sunken text-content-primary',
            'transition-colors duration-normal ease-brand hover:bg-accent hover:text-content-on-accent',
          )}
        >
          <XIcon className="size-5" aria-hidden />
        </SheetClose>

        <nav aria-label={t('a11y.mainNav')} className="flex flex-col">
          {mobileNavItems.map((item) => {
            const active = isActiveNavPath(pathname, item.href);
            return (
              /* `asChild` закрывает панель тем же кликом, которым уходит переход. */
              <SheetClose key={item.id} asChild>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'border-b border-border-default py-3.5 text-heading-4',
                    'transition-colors duration-normal ease-brand hover:text-accent',
                    active ? 'text-accent' : 'text-content-primary',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              </SheetClose>
            );
          })}
        </nav>

        <SheetClose asChild>
          <Button asChild block size="lg" className="mt-8">
            <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
