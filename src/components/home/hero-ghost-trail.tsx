/**
 * HERO GHOST TRAIL — шлейф отстающих копий кадра за фоновой петлёй.
 *
 * Точный перенос эффекта из прототипа (`hero-ghosts`), включая порядок фаз и все
 * тайминги. Логика цикла там такая:
 *
 *   1. обёртка видео уезжает влево за `slideMs` (14 с) на `slidePercent` своей
 *      ширины, одновременно каждые `spawnEveryMs` (0,9 с) рождается копия кадра;
 *   2. копия появляется плавно за `ghostFadeInMs`, живёт `lifetimeMs`, гаснет за
 *      `ghostFadeOutMs` и удаляется из DOM;
 *   3. через `stopSpawnAfterSlideMs` после конца сдвига копии перестают рождаться;
 *   4. спустя `pauseMs` все живые копии гаснут разом за `fadeAllOutMs`;
 *   5. через `fadeAllMs` DOM очищается и кадр возвращается за `returnMs`;
 *   6. цикл повторяется.
 *
 * **Копия — снимок кадра на `<canvas>`, а не второй `<video>`, и это главное
 * отличие от прототипа.** В макете каждая копия — настоящий видеоэлемент,
 * продолжающий играть с момента снятия. Красиво на бумаге, но означает до семи
 * параллельных декодеров одного файла (петля плюс шесть копий). Аппаратный
 * декодер обрабатывает один поток; остальные уходят на процессор, и фоновая
 * петля, которую никто не должен замечать, начинает дёргаться — вместе со всей
 * прокруткой страницы. У снимка стоимость иная: один `drawImage` раз в 0,9 с,
 * дальше композитор просто двигает и гасит готовый растр.
 *
 * Разница видна только при остановленном кадре: внутри копии нет движения. Копия
 * полупрозрачна (35%), обесцвечена и затемнена, и «шевеление» в ней не читается
 * — а вот рывки основной петли читались сразу. Фильтр при этом запекается в
 * растр при отрисовке, а не висит CSS-свойством: живой `filter` на семи слоях —
 * ещё один проход композитора на каждый кадр.
 *
 * Остальные отличия от прототипа, все — не про вид:
 *
 * • **Все таймеры убираются при размонтировании.** В прототипе страница живёт
 *   вечно и утечка невозможна; в приложении с навигацией незакрытый `setInterval`
 *   продолжает плодить узлы на странице, которой уже нет.
 * • **Шлейф живёт только вместе с петлёй.** Узкий экран, просьба убрать движение,
 *   ушедший из виду первый экран (`active`) — цикл останавливается.
 */

'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { videoProcessing } from '@/config/media-processing';
import { motion } from '@/design/motion';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

interface HeroGhostTrailProps {
  /** Обёртка основного видео: её сдвигает цикл. */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Основная петля: с неё снимается кадр для новой копии. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Петля сейчас играет и видна. Иначе цикл не нужен. */
  active: boolean;
}

export function HeroGhostTrail({ wrapRef, videoRef, active }: HeroGhostTrailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const wideEnough = useMediaQuery(
    `(min-width: ${videoProcessing.heroLoop.ghostTrailMinViewportWidth}px)`,
  );

  const enabled = wideEnough && !reducedMotion && videoProcessing.heroLoop.ghostTrailMax > 0;

  useEffect(() => {
    const container = containerRef.current;
    const wrap = wrapRef.current;
    const mainVideo = videoRef.current;
    if (!container || !wrap || !mainVideo || !enabled || !active) return;

    const trail = motion.heroGhostTrail;
    const { ghostTrailMax, ghostFrameWidth, maxWidth, maxHeight } = videoProcessing.heroLoop;

    /** Снимок делается в пропорциях исходной петли, а не элемента на экране. */
    const frameWidth = ghostFrameWidth;
    const frameHeight = Math.round((ghostFrameWidth * maxHeight) / maxWidth);

    let ghosts: HTMLElement[] = [];
    let spawning = false;
    let disposed = false;

    /*
     * Все отложенные вызовы регистрируются, чтобы уборка гарантированно их
     * отменила. Забытый таймер здесь означает узел, добавленный в DOM страницы,
     * которую пользователь уже покинул.
     */
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let spawnTimer: ReturnType<typeof setInterval> | null = null;

    const later = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, delay);
      timers.add(id);
      return id;
    };

    const clearGhosts = () => {
      for (const ghost of ghosts) ghost.remove();
      ghosts = [];
    };

    const spawn = () => {
      if (!spawning || ghosts.length >= ghostTrailMax) return;
      /* Кадра ещё нет — рисовать нечего, и пустой прямоугольник хуже пропуска. */
      if (mainVideo.readyState < mainVideo.HAVE_CURRENT_DATA) return;

      const element = document.createElement('div');
      element.className = 'hero-ghost';

      const canvas = document.createElement('canvas');
      canvas.width = frameWidth;
      canvas.height = frameHeight;

      const context = canvas.getContext('2d');
      if (!context) return;

      /*
       * Обесцвечивание и затемнение запекаются в растр здесь, один раз. Те же
       * значения, что у копий в макете (`motion.heroGhostTrail.filter`), только
       * платим за них не каждый кадр композитора, а один `drawImage`.
       */
      context.filter = trail.filter;
      context.drawImage(mainVideo, 0, 0, frameWidth, frameHeight);

      element.append(canvas);
      container.append(element);
      ghosts.push(element);

      /*
       * Два кадра ожидания перед сменой прозрачности: браузер должен успеть
       * применить начальное состояние, иначе перехода не будет вовсе.
       */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (disposed) return;
          element.style.transition = `opacity ${trail.ghostFadeInMs}ms ease-in-out`;
          element.style.opacity = '1';
        });
      });

      later(() => {
        element.style.transition = `opacity ${trail.ghostFadeOutMs}ms ease-in-out`;
        element.style.opacity = '0';
        later(() => {
          ghosts = ghosts.filter((item) => item !== element);
          element.remove();
        }, trail.ghostRemoveAfterMs);
      }, trail.lifetimeMs);
    };

    const slideLeft = () => {
      wrap.style.transition = `transform ${trail.slideMs}ms ${trail.slideEasing}`;
      wrap.style.transform = `translateX(-${trail.slidePercent}%)`;
    };

    const slideBack = () => {
      wrap.style.transition = `transform ${trail.returnMs}ms var(--ease-brand)`;
      wrap.style.transform = 'translateX(0)';
    };

    const runCycle = () => {
      spawning = true;
      clearGhosts();
      spawn();
      spawnTimer = setInterval(spawn, trail.spawnEveryMs);
      slideLeft();

      later(() => {
        spawning = false;
        if (spawnTimer) clearInterval(spawnTimer);
      }, trail.slideMs + trail.stopSpawnAfterSlideMs);

      later(() => {
        for (const ghost of ghosts) {
          ghost.style.transition = `opacity ${trail.fadeAllOutMs}ms ease-in-out`;
          ghost.style.opacity = '0';
        }
        later(() => {
          clearGhosts();
          slideBack();
        }, trail.fadeAllMs);
      }, trail.slideMs + trail.pauseMs);

      later(
        runCycle,
        trail.slideMs + trail.pauseMs + trail.fadeAllMs + trail.returnMs + trail.cycleTailMs,
      );
    };

    /** Цикл стартует, когда петля отдала первый кадр: иначе копии будут пустыми. */
    const start = () => later(runCycle, trail.startDelayMs);

    if (mainVideo.readyState >= mainVideo.HAVE_CURRENT_DATA) start();
    else mainVideo.addEventListener('loadeddata', start, { once: true });

    return () => {
      disposed = true;
      mainVideo.removeEventListener('loadeddata', start);
      if (spawnTimer) clearInterval(spawnTimer);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      clearGhosts();
      /* Кадр возвращается на место: следующий монтаж начнёт цикл с нуля. */
      wrap.style.transition = '';
      wrap.style.transform = '';
    };
  }, [active, enabled, videoRef, wrapRef]);

  if (!enabled) return null;

  return <div ref={containerRef} aria-hidden data-slot="hero-ghost-trail" className="hero-ghosts" />;
}
