'use client';

import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Easing } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { AdminSidebar, type SidebarGroup } from '@/components/admin/admin-sidebar';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import { motion as designMotion } from '@/design/motion';
import { Link, usePathname } from '@/i18n/routing';

interface Props {
  groups: readonly SidebarGroup[];
  userName: string;
  roleLabel: string;
  title: string;
  subtitle: string;
  backToSiteLabel: string;
  children: React.ReactNode;
}

const admin = designMotion.admin;
const adminEase = admin.ease as unknown as Easing;

export function AdminShellLayout({ groups, userName, roleLabel, title, subtitle, backToSiteLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс drawer при смене адреса
    setOpen(false);
  }, [pathname]);

  // при переходе по сайдбару — плавно скроллим страницу к началу контента (под шапку)
  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    if (reduce) return;
    const id = requestAnimationFrame(() => {
      const el = mainRef.current;
      if (!el) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // scroll-padding-top уже = var(--layout-nav-height), но делаем 12px воздуха от хедера
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, reduce]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-surface-canvas">
      {/* Header — лёгкий entrance сверху, танцевальная плавность */}
      <motion.header
        initial={reduce ? false : { y: admin.header.yPx, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: admin.durationMs.normal / 1000, ease: adminEase }}
        className="sticky top-0 z-header border-b border-border-default bg-surface-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-surface-card/80"
        style={{ willChange: reduce ? undefined : 'transform, opacity' }}
      >
        <div className="page-container flex items-center gap-3 py-3 sm:py-4">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="admin-drawer"
            onClick={() => setOpen(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-card text-content-primary shadow-sm transition-colors hover:bg-surface-sunken hover:border-border-strong active:scale-95 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href={routes.admin()} className="shrink-0 text-heading-4 leading-none tracking-tight text-content-primary">
              {title}
            </Link>
            <span className="hidden text-caption leading-none text-content-tertiary sm:inline-flex sm:items-center sm:pt-1">
              {subtitle}
            </span>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="max-w-[14ch] truncate text-body-sm text-content-secondary xl:max-w-none">{userName}</span>
            <Badge variant="metal" size="md" className="shrink-0">{roleLabel}</Badge>
            <Button asChild variant="ghost" size="sm"><Link href={routes.home()}>{backToSiteLabel}</Link></Button>
            <SignOutButton />
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Badge variant="metal" size="sm" className="shrink-0 max-w-[10ch] truncate">{roleLabel}</Badge>
            <Link href={routes.home()} className="inline-flex size-9 items-center justify-center rounded-full border border-border-default bg-surface-card text-content-secondary">
              <span className="sr-only">{backToSiteLabel}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
          </div>
        </div>

        <div className="page-container flex items-center justify-between gap-3 border-t border-border-subtle bg-surface-sunken/60 py-2.5 text-body-sm lg:hidden">
          <span className="min-w-0 truncate text-content-secondary">{userName} <span className="text-content-tertiary">· {roleLabel}</span></span>
          <div className="shrink-0 [&_button]:h-8 [&_button]:px-3 [&_button]:text-xs">
            <SignOutButton />
          </div>
        </div>
      </motion.header>

      {/* Drawer overlay — fade */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="admin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: adminEase }}
            className="fixed inset-0 z-drawer bg-surface-overlay/60 backdrop-blur-sm lg:hidden"
            aria-hidden={!open}
            onClick={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* Drawer panel — spring slide */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="admin-drawer"
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            initial={reduce ? { x: 0, opacity: 0 } : { x: '-100%' }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: '-100%' }}
            transition={reduce ? { duration: 0.15 } : (admin.spring as unknown as Record<string, unknown>)}
            className="fixed inset-y-0 left-0 z-drawer flex w-[86vw] max-w-sm flex-col bg-surface-card shadow-xl lg:hidden"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', willChange: 'transform' }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-4">
              <div>
                <p className="text-sm font-bold tracking-tight text-content-primary">{title}</p>
                <p className="text-xs text-content-tertiary">{subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex size-9 items-center justify-center rounded-full border border-border-default bg-surface-card text-content-secondary hover:bg-surface-sunken">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-compact">
              <AdminSidebar groups={groups} onNavigate={() => setOpen(false)} variant="drawer" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Main layout — левая навигация липкая, правая часть обычный поток без внутреннего скролла */}
      <div className="page-container grid grid-cols-1 gap-6 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[var(--layout-admin-sidebar-width)_1fr] xl:grid-cols-[var(--layout-admin-sidebar-width-wide)_1fr]">
        <motion.aside
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduce ? { duration: 0 } : { duration: admin.durationMs.normal / 1000, ease: adminEase, delay: 0.06 }}
          className="hidden lg:block"
        >
          <div
            data-admin-sidebar-scroll
            className="sticky top-[calc(var(--layout-nav-height)+1.25rem)] overflow-y-auto overscroll-contain pr-2 scroll-smooth scrollbar-none"
            style={
              {
                maxHeight: 'calc(100dvh - var(--layout-nav-height) - 1.5rem)',
                height: 'calc(100dvh - var(--layout-nav-height) - 1.5rem)',
                scrollbarGutter: 'stable',
              } as React.CSSProperties
            }
          >
            <AdminSidebar groups={groups} variant="desktop" />
          </div>
        </motion.aside>

        <main ref={mainRef} id={site.mainContentId} className="min-w-0">
          <div className="pb-2">{children}</div>
        </main>
      </div>
    </div>
  );
}
