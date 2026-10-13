'use client';

import { AnimatePresence, motion as animated, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { usePathname } from '@/i18n/routing';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

const DISMISSED_BANNER_COOKIE = 'ARTDANCE_DISMISSED_BANNER';
const DISMISS_DAYS = 30;

/** Селектор первого экрана — тот же, что у шапки (`use-cinema-hero-behind`). */
const HERO_SELECTOR = '.hero-viewport';

/** Контурное слово ARTDANCE в подвале (`site-footer.tsx`). */
const FOOTER_WORD_SELECTOR = '[data-footer-word]';

interface AnnouncementBarDismissProps {
  bannerKey: string;
  children: ReactNode;
}

/**
 * Клиентская оболочка баннера: показ после первого экрана, закрытие и 3D-вход.
 *
 * **Почему полоса ждёт первого экрана.** Hero занимает всю высоту окна и держит
 * видео; полоса поверх него «отрезала» бы кадр. Мы не измеряем прокрутку числом,
 * а наблюдаем сам hero: `IntersectionObserver` даёт знать, когда его нижняя кромка
 * ушла выше окна. До этого баннера в разметке нет — ни в потоке, ни поверх. На
 * страницах без hero ждать нечего, полоса показывается сразу.
 *
 * **Почему 3D на пружине.** Панель входит снизу как крышка на петле: наклон
 * вокруг оси X (`transformPerspective`) уходит от `rotateX(16°)`/смещения вниз к
 * ровному положению, а `AnimatePresence` симметрично складывает её вниз при
 * закрытии и при возврате к первому экрану. Пружина — из `design/motion`, та же,
 * что у остальных появлений проекта. Наклон по прокрутке даёт лёгкая надстройка
 * (`ScrollTilt`): `±2.5°` по направлению движения. Оба слоя выключены при
 * `prefers-reduced-motion` — остаётся короткое растворение без движения.
 *
 * **Почему панель уступает подвалу.** Контурное ARTDANCE стоит в самом низу
 * страницы, и плавающая панель в конце прокрутки легла бы на него. Мы наблюдаем
 * это слово отдельным `IntersectionObserver` и провожаем панель «нырком»: лёгкий
 * откат назад, затем ускорение вниз — будто панель уходит под воду. Уехало слово
 * из кадра — панель поднимается обратно обычной петелью.
 *
 * Cookie содержит ключ записи, а не текст: после смены баннера в админке новый
 * ключ снова будет виден тому, кто закрыл предыдущий.
 */
export function AnnouncementBarDismiss({ bannerKey, children }: AnnouncementBarDismissProps) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [stowed, setStowed] = useState(false);

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

  useEffect(() => {
    if (dismissed) return;

    const hero = document.querySelector<HTMLElement>(HERO_SELECTOR);
    if (!hero) {
      /*
       * Ждать нечего — на странице без первого экрана промо уместно сразу.
       * Обновление в следующем кадре, а не синхронно в теле эффекта: синхронный
       * `setState` здесь дал бы каскадный рендер.
       */
      const frame = window.requestAnimationFrame(() => setRevealed(true));
      return () => window.cancelAnimationFrame(frame);
    }

    /*
     * Считаем первым экраном только тот, что ушёл ВВЕРХ за кромку окна:
     * `isIntersecting` один не отличает «прокрутили дальше» от «hero ещё ниже».
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setRevealed(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
      },
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [dismissed, pathname]);

  /*
   * Слово ARTDANCE в кадре — панель складывается вниз, чтобы не лежать на нём.
   * Селектор по атрибуту, а не по тексту: надпись переводится (`brand.name`),
   * а маркер не зависит от языка.
   */
  useEffect(() => {
    if (dismissed) return;

    const word = document.querySelector<HTMLElement>(FOOTER_WORD_SELECTOR);
    if (!word) {
      const frame = window.requestAnimationFrame(() => setStowed(false));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setStowed(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(word);
    return () => observer.disconnect();
  }, [dismissed, pathname]);

  const shown = revealed && hydrated && !dismissed && !stowed;

  return (
    <AnimatePresence>
      {shown ? (
        <animated.section
          key="announcement"
          data-banner-key={bannerKey}
          aria-label={t('labels.promotion')}
          className="announcement-banner above-mobile-dock pointer-events-none fixed inset-x-0 z-sticky px-4 sm:px-6"
          style={{ transformPerspective: motion.banner.perspectivePx, transformOrigin: 'bottom center' }}
          initial={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, y: motion.banner.offsetFromPx, rotateX: motion.banner.rotateFromDeg }
          }
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotateX: 0 }}
          /*
           * Два разных ухода: уступка футеру — «нырок» вниз с откатом и
           * ускорением; закрытие крестиком — спокойная складка на петле.
           */
          exit={
            stowed
              ? reduced
                ? { opacity: 0 }
                : {
                    opacity: [1, 1, 0],
                    y: [0, 36, motion.banner.dive.yPx],
                    rotateX: [0, motion.banner.dive.retreatDeg, motion.banner.dive.plungeDeg],
                    scale: motion.banner.dive.scale,
                  }
              : reduced
                ? { opacity: 0 }
                : { opacity: 0, y: motion.banner.offsetExitPx, rotateX: motion.banner.rotateExitDeg }
          }
          transition={
            reduced
              ? { duration: motion.banner.reducedFadeMs / 1000 }
              : stowed
                ? {
                    duration: motion.banner.dive.durationMs / 1000,
                    times: [0, 0.55, 1],
                    ease: motion.banner.dive.ease,
                  }
                : motion.banner.spring
          }
        >
          <ScrollTilt reduced={reduced}>
            <div className="pointer-events-auto mx-auto flex w-full max-w-(--layout-content-max-width) items-center gap-3 rounded-lg border border-border-on-cinema bg-surface-cinema/95 px-4 py-3 text-content-on-cinema shadow-lg backdrop-blur-md">
              {children}
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-content-on-cinema-muted transition-colors duration-normal ease-brand hover:bg-content-on-cinema/10 hover:text-content-on-cinema focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                aria-label={t('actions.close')}
                onClick={() => {
                  document.cookie = `${DISMISSED_BANNER_COOKIE}=${encodeURIComponent(bannerKey)}; Max-Age=${DISMISS_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax`;
                  setDismissed(true);
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </ScrollTilt>
        </animated.section>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Лёгкий наклон панели по направлению прокрутки.
 *
 * Скорость сглаживается пружиной, поэтому панель не дёргается на каждом колесе,
 * а плавно «отзывается» на движение. Наклон малый (`motion.banner.scrollTiltDeg`):
 * это украшение, а не аттракцион, и текст остаётся читаемым. При
 * `prefers-reduced-motion` слой не рендерится вовсе.
 */
function ScrollTilt({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { stiffness: 120, damping: 30, mass: 0.6 });
  const range = motion.banner.scrollVelocityRange;
  const rotateX = useTransform(
    velocity,
    [-range, range],
    [motion.banner.scrollTiltDeg, -motion.banner.scrollTiltDeg],
    { clamp: true },
  );

  if (reduced) return <>{children}</>;

  return <animated.div style={{ rotateX }}>{children}</animated.div>;
}
