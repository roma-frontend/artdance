'use client';

/**
 * COMMAND PALETTE — палитра команд.
 *
 * Две задачи: публичная навигация (всегда) и админ-режим (внутри /admin).
 * Горячая клавиша — `>` (без модификатора), а не `Cmd+K`: `Cmd+K` уже занят
 * `SearchOverlay` (тот же макет attendu, Firefox Ctrl+K → адресная строка),
 * и два слушателя на одном сочетании боролись бы за preventDefault.
 * `>` — конвенция палитр админок (Linear, Raycast), не конфликтует с вводом:
 * в поле ввода слушатель не срабатывает.
 */

import { usePathname, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { isAdminPath, routes } from '@/config/routes';
import { adminNavigation } from '@/config/admin';
import { danceStyles } from '@/domain/enums';

interface AdminCommandsProps {
  go: (href: string) => void;
}

function AdminCommands({ go }: AdminCommandsProps) {
  const t = useTranslations();
  return (
    <>
      {adminNavigation.map((group) => (
        <CommandGroup key={group.id} heading={String(t(group.labelKey))}>
          {group.items.map((item) => (
            <CommandItem key={item.href} value={`${String(t(item.labelKey))} ${item.href}`} onSelect={() => go(item.href)}>
              {String(t(item.labelKey))}
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
      <CommandSeparator />
      <CommandGroup heading={String(t('commandPalette.groups.quickActions'))}>
        <CommandItem value="admin orders bookings" onSelect={() => go(routes.adminBookings())}>
          {String(t('commandPalette.groups.quickActions'))} — {String(t('admin.nav.bookings'))}
        </CommandItem>
        <CommandItem value="admin reports" onSelect={() => go(routes.adminReports())}>
          {String(t('admin.nav.reports'))}
        </CommandItem>
        <CommandItem value="admin trash" onSelect={() => go(routes.adminTrash())}>
          {String(t('admin.nav.trash'))}
        </CommandItem>
      </CommandGroup>
    </>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();

  const isAdmin = isAdminPath(pathname);

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      // В поле ввода палитра не открывается — это поле поиска/формы.
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      // `>` без модификаторов; Shift+`.` на EN-раскладке.
      if (event.key === '>' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      // `?` — подсказка палитры для админки (открывает её же).
      if (event.key === '?' && isAdmin && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    },
    [isAdmin],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const title = useMemo(() => String(t('commandPalette.title')), [t]);
  const description = useMemo(() => String(t('commandPalette.description')), [t]);
  const placeholder = useMemo(() => String(t('commandPalette.searchPlaceholder')), [t]);
  const closeLabel = useMemo(() => String(t('a11y.closeDialog')), [t]);
  const empty = useMemo(() => String(t('commandPalette.empty')), [t]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={title} description={description} closeLabel={closeLabel}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>{empty}</CommandEmpty>

        {/* Публичная навигация — всегда */}
        <CommandGroup heading={String(t('commandPalette.groups.navigation'))}>
          <CommandItem value="discover catalog" onSelect={() => go(routes.discover())}>
            Discover · {String(t('commandPalette.groups.navigation'))}
          </CommandItem>
          <CommandItem value="classes" onSelect={() => go(routes.classes())}>
            {String(t('admin.nav.classes'))}
          </CommandItem>
          <CommandItem value="instructors" onSelect={() => go(routes.instructors())}>
            {String(t('admin.nav.instructors'))}
          </CommandItem>
          <CommandItem value="studios venues" onSelect={() => go(routes.studios())}>
            {String(t('admin.nav.venues'))}
          </CommandItem>
          <CommandItem value="events" onSelect={() => go(routes.events())}>
            {String(t('admin.nav.events'))}
          </CommandItem>
          <CommandItem value="shop products" onSelect={() => go(routes.shop())}>
            {String(t('admin.nav.products'))}
          </CommandItem>
          <CommandItem value="pricing plans" onSelect={() => go(routes.pricing())}>
            Pricing
          </CommandItem>
          <CommandItem value="contact" onSelect={() => go(routes.contact())}>
            Contact
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={String(t('commandPalette.groups.account'))}>
          <CommandItem value="account dashboard" onSelect={() => go(routes.account())}>
            {String(t('commandPalette.groups.account'))}
          </CommandItem>
          <CommandItem value="bookings" onSelect={() => go(routes.accountBookings())}>
            {String(t('admin.nav.bookings'))}
          </CommandItem>
          <CommandItem value="orders" onSelect={() => go(routes.accountOrders())}>
            {String(t('admin.nav.orders'))}
          </CommandItem>
          <CommandItem value="cart" onSelect={() => go(routes.cart())}>
            Cart
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading={String(t('commandPalette.groups.styles'))}>
          {danceStyles.slice(0, 8).map((slug) => (
            <CommandItem key={slug} value={slug} onSelect={() => go(routes.style(slug))}>
              {slug}
            </CommandItem>
          ))}
        </CommandGroup>

        {isAdmin && <AdminCommands go={go} />}
      </CommandList>
    </CommandDialog>
  );
}
