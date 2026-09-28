'use client';

/**
 * COMMAND PALETTE — палитра команд по Cmd/Ctrl+K.
 *
 * Открывается везде (кроме полей ввода), навигация — клавиатура + click.
 * Список строится из routes и danceStyles, а не из DOM навигации.
 */

import { useRouter } from '@/i18n/routing';
import { useEffect, useState } from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { routes } from '@/config/routes';
import { danceStyles } from '@/domain/enums';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Палитра команд"
      description="Быстрый переход по разделам"
      closeLabel="Закрыть"
    >
      <CommandInput placeholder="Поиск раздела…" />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>
        <CommandGroup heading="Навигация">
          <CommandItem onSelect={() => go(routes.discover())}>Каталог · Discover</CommandItem>
          <CommandItem onSelect={() => go(routes.classes())}>Занятия</CommandItem>
          <CommandItem onSelect={() => go(routes.instructors())}>Инструкторы</CommandItem>
          <CommandItem onSelect={() => go(routes.studios())}>Студии</CommandItem>
          <CommandItem onSelect={() => go(routes.events())}>События</CommandItem>
          <CommandItem onSelect={() => go(routes.shop())}>Магазин</CommandItem>
          <CommandItem onSelect={() => go(routes.pricing())}>Тарифы</CommandItem>
          <CommandItem onSelect={() => go(routes.contact())}>Контакты</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Кабинет">
          <CommandItem onSelect={() => go(routes.account())}>Мой кабинет</CommandItem>
          <CommandItem onSelect={() => go(routes.accountBookings())}>Мои брони</CommandItem>
          <CommandItem onSelect={() => go(routes.accountOrders())}>Заказы</CommandItem>
          <CommandItem onSelect={() => go(routes.cart())}>Корзина</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Стили">
          {danceStyles.slice(0, 8).map((slug) => (
            <CommandItem key={slug} onSelect={() => go(routes.style(slug))}>
              {slug}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
