'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

const DISMISSED_BANNER_COOKIE = 'ARTDANCE_DISMISSED_BANNER';
const DISMISS_DAYS = 30;

interface AnnouncementBarDismissProps {
  bannerKey: string;
  children: ReactNode;
}

/**
 * Клиентская оболочка нужна только для закрытия баннера.
 *
 * Сам баннер остаётся серверным и приходит из кешируемой записи CMS. Cookie
 * содержит ключ записи, а не текст: после смены баннера в админке новый ключ
 * снова будет виден пользователю, который закрыл предыдущий.
 */
export function AnnouncementBarDismiss({ bannerKey, children }: AnnouncementBarDismissProps) {
  const t = useTranslations('common');
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const value = document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${DISMISSED_BANNER_COOKIE}=`))
      ?.slice(`${DISMISSED_BANNER_COOKIE}=`.length);

    /* Отложенное обновление не меняет первый серверный paint и не вызывает
     * синхронный cascading render внутри effect. */
    const timer = window.setTimeout(() => {
      setHydrated(true);
      if (value === encodeURIComponent(bannerKey)) setDismissed(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bannerKey]);

  if (dismissed) return null;

  return (
    <section
      data-banner-key={bannerKey}
      aria-label={t('labels.promotion')}
      className="announcement-banner relative isolate overflow-hidden border-b border-border-on-cinema bg-surface-cinema text-content-on-cinema"
    >
      {children}
      <button
        type="button"
        className="absolute right-4 top-[calc(var(--layout-nav-height)+var(--space-3))] z-20 inline-flex size-9 items-center justify-center rounded-full border border-border-on-cinema bg-surface-cinema/55 text-content-on-cinema-muted backdrop-blur-sm transition-colors duration-normal ease-brand hover:border-accent hover:text-content-on-cinema focus-visible:border-accent sm:right-6 md:right-8"
        aria-label={t('actions.close')}
        disabled={!hydrated}
        onClick={() => {
          document.cookie = `${DISMISSED_BANNER_COOKIE}=${encodeURIComponent(bannerKey)}; Max-Age=${DISMISS_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax`;
          setDismissed(true);
        }}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
