/**
 * PORTAL TRANSITION — проход камеры с руки: переход из карточки на её страницу.
 *
 * Камера плавно едет по вертикали к кликнутой карточке, как в руке оператора:
 * сверху вниз, если карточка ниже центра экрана, снизу вверх — если выше.
 * Планы движутся по-разному, и глаз читает это как 3D:
 *
 * - **Сцена** — сама главная (`main`) уплывает навстречу камере, наклоняется
 *   в перспективе и наезжает вокруг карточки (`transform-origin` в её центре),
 *   уходя в блюр.
 * - **Окно карточки** растёт из её координат на весь экран, по дуге
 *   наклоняясь по ходу движения с лёгким креном руки и выпрямляясь к посадке.
 * - **Кадр внутри** делает dolly-наезд и панорамирует против хода камеры
 *   со смазом на пике скорости; по нему проходит полоса света в ту же сторону.
 *
 * Дальше камера медленно доезжает (`settleMs`), пока `usePathname` не совпал с
 * целью (не дольше `holdMaxMs`), и оверлей растворяется поверх hero новой
 * страницы: там тот же кадр той же яркости, шва нет.
 *
 * Карточки подключаются через `PortalLink`. Навигация — через роутер next-intl:
 * он ставит префикс локали. При `prefers-reduced-motion` — обычный переход.
 */

'use client';

import { motion as animated } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { usePathname, useRouter } from '@/i18n/routing';
import { playTactileClick } from '@/lib/audio/tactile-click';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

type Phase = 'idle' | 'flight' | 'hold' | 'reveal';

interface PortalState {
  phase: Phase;
  rect: DOMRect | null;
  imageSrc: string;
  href: string;
}

interface PortalContextValue {
  triggerPortal: (rect: DOMRect, imageSrc: string, href: string) => void;
}

const IDLE: PortalState = { phase: 'idle', rect: null, imageSrc: '', href: '' };

const PortalContext = createContext<PortalContextValue | null>(null);

/** `null` вне провайдера — карточка тогда ведёт себя как обычная ссылка. */
export function usePortalTransition() {
  return useContext(PortalContext);
}

type Bezier = [number, number, number, number];

/** Пик пролёта — доля времени, где камера быстрее всего и окно наклонено сильнее всего. */
const PEAK = 0.5;

/** `usePathname` не видит query и hash: `/instructors/x?date=…` — это `/instructors/x`. */
const pathOf = (href: string) => href.split(/[?#]/)[0];

/** Ход камеры: `1` — сверху вниз (карточка ниже центра экрана), `-1` — снизу вверх. */
const directionOf = (rect: DOMRect) => (rect.top + rect.height / 2 >= window.innerHeight / 2 ? 1 : -1);

export function PortalTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const [portal, setPortal] = useState<PortalState>(IDLE);
  const timers = useRef<number[]>([]);
  const sceneAnimation = useRef<Animation | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const releaseScene = useCallback(() => {
    const animation = sceneAnimation.current;
    if (!animation) return;
    animation.cancel();
    const scene = (animation.effect as KeyframeEffect | null)?.target;
    if (scene instanceof HTMLElement) scene.style.transformOrigin = '';
    sceneAnimation.current = null;
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      releaseScene();
    },
    [releaseScene],
  );

  const reveal = useCallback(() => {
    // Растворение запускается один раз: страховочный таймер удержания больше не нужен.
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setPortal((current) => (current.phase === 'idle' ? current : { ...current, phase: 'reveal' }));
    later(() => {
      // Если навигация сорвалась, главная возвращается в покой под уже прозрачным оверлеем.
      releaseScene();
      setPortal(IDLE);
    }, motion.portal.revealMs);
  }, [later, releaseScene]);

  const triggerPortal = (rect: DOMRect, imageSrc: string, href: string) => {
    if (portal.phase !== 'idle') return;

    if (reducedMotion) {
      router.push(href);
      return;
    }

    try {
      playTactileClick();
      navigator.vibrate?.(18);
    } catch {
      // Браузер может запретить вибрацию без жеста — не важно.
    }

    // Грузим маршрут параллельно пролёту, а не после него.
    router.prefetch(href);

    const config = motion.portal;
    const dir = directionOf(rect);

    // Сцена: главная уплывает навстречу камере, наклоняется и наезжает. Web Animations — без рендеров React.
    const scene = document.querySelector('main');
    if (scene) {
      const box = scene.getBoundingClientRect();
      const [x1, y1, x2, y2] = config.ease;
      const lift = -dir * config.scene.lift * window.innerHeight;
      const frame = (progress: number) =>
        `perspective(${config.perspective}px) translateY(${lift * progress}px) ` +
        `rotateX(${dir * config.scene.tilt * progress}deg) scale(${1 + (config.scene.zoom - 1) * progress})`;
      scene.style.transformOrigin = `${rect.left + rect.width / 2 - box.left}px ${rect.top + rect.height / 2 - box.top}px`;
      sceneAnimation.current = scene.animate([{ transform: frame(0) }, { transform: frame(1) }], {
        duration: config.flightMs,
        easing: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
        fill: 'forwards',
      });
    }

    setPortal({ phase: 'flight', rect, imageSrc, href });
    later(() => {
      setPortal((current) => (current.phase === 'flight' ? { ...current, phase: 'hold' } : current));
      router.push(href);
      later(reveal, config.holdMaxMs);
    }, config.flightMs);
  };

  /* Новый маршрут отрисован — даём браузеру кадр на покраску и растворяемся. */
  useEffect(() => {
    if (portal.phase !== 'hold' || pathname !== pathOf(portal.href)) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(reveal);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, portal.phase, portal.href, reveal]);

  const { phase, rect, imageSrc } = portal;
  const config = motion.portal;
  const seconds = config.flightMs / 1000;
  const ease = [...config.ease] as Bezier;

  /** Весь пролёт одной кривой: разгон руки → мягкая остановка. */
  const flight = { duration: seconds, ease };
  /** Дуга: наклон и смаз нарастают к пику скорости и отпускают к посадке. */
  const arc = { duration: seconds, times: [0, PEAK, 1], ease: ['easeIn' as const, 'easeOut' as const] };
  /** Крен руки: качнуло по ходу, чуть отыграло назад, успокоилось. */
  const sway = { duration: seconds, times: [0, 0.35, 0.7, 1], ease: 'easeInOut' as const };

  const dir = rect ? directionOf(rect) : 1;
  const pan = config.imagePan * 100;
  const { tilt, roll } = config.window;

  return (
    <PortalContext.Provider value={{ triggerPortal }}>
      {children}

      {phase !== 'idle' && rect && (
        <animated.div
          aria-hidden="true"
          data-slot="portal-transition"
          data-phase={phase}
          className="pointer-events-none fixed inset-0 z-popover overflow-hidden"
          style={{ perspective: `${config.perspective}px` }}
          initial={{ opacity: 1 }}
          animate={{ opacity: phase === 'reveal' ? 0 : 1 }}
          transition={{ duration: config.revealMs / 1000, ease: 'easeOut' }}
        >
          {/* Затемнение и блюр уплывающей сцены. */}
          <animated.div
            className="absolute inset-0 bg-surface-cinema/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={flight}
          />

          {/* Окно карточки: растёт на весь экран, наклоняясь по ходу камеры с креном руки. */}
          <animated.div
            className="absolute overflow-hidden bg-surface-cinema shadow-xl"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: 16,
              rotateX: 0,
              rotateZ: 0,
            }}
            animate={{
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: window.innerHeight,
              borderRadius: 0,
              rotateX: [0, dir * tilt, 0],
              rotateZ: [0, -dir * roll, dir * roll * 0.4, 0],
            }}
            transition={{ ...flight, rotateX: arc, rotateZ: sway }}
          >
            {imageSrc && (
              // Уже загруженный кадр карточки (`currentSrc`): next/image здесь дал бы второй запрос.
              <animated.img
                src={imageSrc}
                alt=""
                className="size-full object-cover"
                initial={{ scale: config.imageZoom.from, y: '0%', filter: 'blur(0px) brightness(1)' }}
                animate={
                  phase === 'flight'
                    ? {
                        scale: [config.imageZoom.from, config.imageZoom.peak, config.imageZoom.landed],
                        y: ['0%', `${-dir * pan}%`, '0%'],
                        filter: [
                          'blur(0px) brightness(1)',
                          `blur(${config.motionBlur}px) brightness(0.75)`,
                          `blur(0px) brightness(${config.landingBrightness})`,
                        ],
                      }
                    : {
                        scale: config.imageZoom.settled,
                        y: '0%',
                        filter: `blur(0px) brightness(${config.landingBrightness})`,
                      }
                }
                transition={phase === 'flight' ? arc : { duration: config.settleMs / 1000, ease: [0.2, 0, 0.2, 1] }}
              />
            )}

            {/* Полоса света проходит по кадру в ту же сторону, куда едет камера. */}
            <animated.span
              className="portal-sweep absolute inset-0"
              initial={{ y: `${-dir * 120}%`, opacity: 0 }}
              animate={{ y: `${dir * 120}%`, opacity: [0, 0.9, 0] }}
              transition={flight}
            />

            {/* Виньетка: края темнеют на пике скорости и отпускают к посадке. */}
            <animated.span
              className="portal-vignette absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35] }}
              transition={arc}
            />
          </animated.div>
        </animated.div>
      )}
    </PortalContext.Provider>
  );
}
