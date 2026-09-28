'use client';

import { useTranslations } from 'next-intl';

import { navIcons } from '@/components/layout/nav-icons';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';
import { DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { headerCta, headerMegaGroups, isActiveNavPath } from '@/config/navigation';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function MobileMenuSheetContent() {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <DrawerContent className="mobile-menu-sheet overscroll-contain max-h-[86vh]">
      <DrawerHeader className="sr-only">
        <DrawerTitle>{t('nav.menuTitle')}</DrawerTitle>
        <DrawerDescription>{t('nav.menuDescription')}</DrawerDescription>
      </DrawerHeader>

      <DrawerClose
        aria-label={t('nav.closeMenu')}
        className={cn('mx-auto mt-1 mb-3 block h-1.5 w-10 shrink-0 rounded-full bg-border-strong transition-colors hover:bg-content-tertiary')}
      />

      <nav aria-label={t('a11y.mainNav')} className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <div className="space-y-5">
          {headerMegaGroups.map((group) => (
            <section key={group.id}>
              <h3 className="px-2 text-eyebrow text-content-tertiary">{t(group.labelKey)}</h3>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {group.children.map((item) => {
                  const active = isActiveNavPath(pathname, item.href);
                  const Icon = item.icon ? (navIcons as Record<string, React.ComponentType<{ className?: string }>>)[item.icon] : null;
                  return (
                    <li key={item.id}>
                      <DrawerClose asChild>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex h-full flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors active:scale-98',
                            active ? 'border-accent bg-accent-soft text-content-accent' : 'border-border-default bg-surface-raised text-content-primary',
                          )}
                        >
                          {Icon && (
                            <span className="grid size-9 place-items-center rounded-lg bg-surface-card">
                              <Icon aria-hidden className="size-4" />
                            </span>
                          )}
                          <span className="text-caption leading-tight">{t(item.labelKey)}</span>
                        </Link>
                      </DrawerClose>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <div className="mt-3 shrink-0">
        <LocaleSwitcher variant="sheet" />
      </div>

      <DrawerClose asChild>
        <Button asChild block size="lg" variant="accent" className="mt-3 shrink-0">
          <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
        </Button>
      </DrawerClose>
    </DrawerContent>
  );
}
