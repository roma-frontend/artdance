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
 * Копии — настоящие `<video>`, как в макете, а не кадры на канве: только так
 * шлейф остаётся живым (каждая копия продолжает играть с того момента, когда
 * была снята), и именно это делает эффект узнаваемым. Стоимость приемлема,
 * потому что наша петля — 1280px и 591 KB против 1920px и 20,6 МБ в прототипе:
 * шесть копий здесь дешевле, чем шесть там.
 *
 * Три отличия от прототипа, все — не про вид:
 *
 * • **Все таймеры убираются при размонтировании.** В прототипе страница живёт
 *   вечно и утечка невозможна; в приложении с навигацией незакрытый `setInterval`
 *   продолжает рождать `<video>` на странице, которой уже нет.
 * • **Копии не появляются, если экран узкий или пользователь просил убрать
 *   движение.** Шлейф без движения — грязь на экране.
 * • **Источники те же, что у основной петли**, а не путь строкой: браузер берёт
 *   их из кеша, второй загрузки не происходит.
 */

'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { videoProcessing } from '@/config/media-processing';
import { motion } from '@/design/motion';
import type { VideoRef } from '@/domain/content';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

/** MIME-типы источников. Дублируют список в `HeroVideo` по одной причине: */
const mimeByFormat = {
  av1: 'video/mp4; codecs=av01.0.05M.08',
  vp9: 'video/webm; codecs=vp9',
  h264: 'video/mp4; codecs=avc1.640028',
} as const;

interface HeroGhostTrailProps {
  /** Обёртка основного видео: её сдвигает цикл. */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Основная петля: у неё берётся `currentTime` для новой копии. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Источники петли — те же файлы, что уже в кеше браузера. */
  video: VideoRef;
}

interface Ghost {
  element: HTMLDivElement;
  video: HTMLVideoElement;
}

export function HeroGhostTrail({ wrapRef, videoRef, video }: HeroGhostTrailProps) {
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
    if (!container || !wrap || !mainVideo || !enabled) return;

    const trail = motion.heroGhostTrail;
    const maxGhosts = videoProcessing.heroLoop.ghostTrailMax;

    let ghosts: Ghost[] = [];
    let spawning = false;
    let disposed = false;

    /*
     * Все отложенные вызовы регистрируются, чтобы уборка гарантированно их
     * отменила. Забытый таймер здесь означает `<video>`, добавленный в DOM
     * страницы, которую пользователь уже покинул.
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

    /** Освобождение копии: остановить воспроизведение и убрать из DOM. */
    const dispose = (ghost: Ghost) => {
      ghost.video.pause();
      /* Пустой src и load() освобождают декодер, иначе он живёт до сборки мусора. */
      ghost.video.removeAttribute('src');
      ghost.video.load();
      ghost.element.remove();
    };

    const clearGhosts = () => {
      for (const ghost of ghosts) dispose(ghost);
      ghosts = [];
    };

    const spawn = () => {
      if (!spawning || ghosts.length >= maxGhosts) return;

      const element = document.createElement('div');
      element.className = 'hero-ghost';

      const copy = document.createElement('video');
      copy.muted = true;
      copy.playsInline = true;
      copy.loop = true;
      /** Копия догоняет основную петлю: шлейф отстаёт по кадру, а не по сюжету. */
      for (const source of video.sources) {
        const sourceElement = document.createElement('source');
        sourceElement.src = source.url;
        sourceElement.type = mimeByFormat[source.format];
        copy.append(sourceElement);
      }
      copy.currentTime = mainVideo.currentTime;
      void copy.play().catch(() => {
        /* Автозапуск копии может быть отклонён — тогда она просто останется кадром. */
      });

      element.append(copy);
      container.append(element);

      const ghost: Ghost = { element, video: copy };
      ghosts.push(ghost);

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
          ghosts = ghosts.filter((item) => item !== ghost);
          dispose(ghost);
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
          ghost.element.style.transition = `opacity ${trail.fadeAllOutMs}ms ease-in-out`;
          ghost.element.style.opacity = '0';
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
  }, [enabled, video, videoRef, wrapRef]);

  if (!enabled) return null;

  return <div ref={containerRef} aria-hidden data-slot="hero-ghost-trail" className="hero-ghosts" />;
}
