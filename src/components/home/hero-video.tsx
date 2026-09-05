/**
 * HeroVideo — кадр первого экрана: занавес, раскрываемый прокруткой.
 *
 * Первый жест прокрутки запускает раскрытие, и оно ИДЁТ ДО КОНЦА само: клип
 * проигрывается целиком, страница доезжает до второй секции. Жест назад так же
 * доигрывает до закрытого занавеса. Промежуточных положений не существует.
 *
 * **Почему раскрытие делает прокрутка, а не видео.** Приём заказчика — «занавес
 * открывается». Получить раскрытие от генератора видео не удалось, и причина не в
 * формулировке промпта: на вход модель получала кадр с закрытым занавесом, и убрать
 * его из пикселей она не может — только отъехать от него камерой. На 10 и на 15
 * секундах результат был один и тот же, занавес открывался частично.
 *
 * **Почему не зум в щель.** Щель занимает 13% ширины кадра (замерено по столбцам
 * яркости). Чтобы она заполнила окно, нужно семикратное увеличение: полоса в 270
 * пикселей растянулась бы на всю ширину. Единственное увеличение здесь —
 * хвостовое, до `heroParallax.tailZoom`, и оно подобрано так, чтобы исходных
 * пикселей всё ещё было больше экранных.
 *
 * **Почему клип ПРОИГРЫВАЕТСЯ, а прокрутка следует за ним, а не наоборот.** Это
 * главное решение компонента, и оно принято после того, как обратный порядок был
 * сделан и отвергнут. Прокрутка, ведущая клип, означает перемотку: каждое положение
 * страницы — запрос `currentTime`, то есть сборка кадра по требованию. Таких
 * запросов при прокрутке десятки в секунду, выполняются они неравномерно, и
 * движение читается как перелистывание — «видео, которое не видео». Плавно видео
 * умеет только одно: играть. Поэтому доигрывание запускает воспроизведение, а
 * положение страницы каждый кадр вычисляется из фактического `currentTime`.
 *
 * Побочная выгода этого порядка важнее исходной задачи: синхронность держится сама.
 * Если браузер срежет скорость воспроизведения (Safari ограничивает высокие) или
 * клип встанет на буферизации, прокрутка встанет вместе с ним — она следует за
 * фактом, а не за расчётом.
 *
 * Перемотка остаётся ровно для одного случая — обратного прохода: отрицательной
 * скорости у видео не бывает, а перевёрнутая копия клипа удвоила бы вес первого
 * экрана. Назад раскрытие менее плавное, и это принятая асимметрия.
 *
 * Три решения, каждое против конкретного дефекта:
 *
 * 1. **Время клипа отображается на ВЕСЬ путь прохода**, а не на приколотую часть.
 *    Отдельной фазы «доехать до второй секции» нет: с ней получалось два движения
 *    подряд — видео кончилось, потом страница поехала. Теперь последний кадр и приход
 *    второй секции — один момент.
 * 2. **Обратный проход ведётся по готовности декодера**, а не по часам. По часам он
 *    «местами ускорялся»: перемотка занимает неизвестное время, и там, где декодер
 *    успевал, кадры шли пачками.
 * 3. **Прогрев декодера** беззвучным `play()` с немедленной паузой. Safari на iOS
 *    не отдаёт кадры по `currentTime`, пока воспроизведение ни разу не начиналось.
 *
 * Прокрутка на время доигрывания удерживается, с предохранителем по времени: иначе
 * посетитель останавливает раскрытие на середине, а если клип встал на буферизации —
 * страница осталась бы заблокированной.
 *
 * Постер — первый кадр клипа, то есть закрытый занавес, и он же единственное
 * содержимое экрана при `prefers-reduced-motion` и экономии данных. Кнопки
 * управления движением нет и не требуется: движения без действия пользователя не
 * происходит вовсе, а WCAG 2.2.2 говорит об анимации, которая запускается сама.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Media } from '@/components/ui/media';
import { videoProcessing } from '@/config/media-processing';
import { motion } from '@/design/motion';
import { hasPlayableVideo, resolveMedia, type VideoRef } from '@/domain/content';
import {
  heroRevealProgress,
  heroStageGeometry,
  heroStageOf,
  useHeroRevealProgress,
  type HeroGestureDirection,
} from '@/lib/hooks/use-hero-reveal';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/config';

export interface HeroVideoProps {
  video: VideoRef | null;
  /**
   * Тот же клип от конца к началу — для обратного прохода.
   *
   * Отдельный файл, а не перемотка: назад видео воспроизвести нельзя, а перемотка
   * идёт неровно. Скачивается лениво, когда посетитель начал раскрытие.
   */
  reverseVideo: VideoRef | null;
  /** Постер. Отдельным пропсом: показывается и без видео. */
  poster: Parameters<typeof resolveMedia>[0];
  locale: Locale;
}

/**
 * Что происходит с раскрытием прямо сейчас.
 *
 * `idle` — раскрытие стоит, положение задаёт прокрутка (перезагрузка, якорь,
 * перетаскивание полосы). Остальные три — доигрывание, и во время них прокрутка
 * ведётся кодом, а жесты не принимаются.
 */
type RevealPhase = 'idle' | 'playing' | 'rewinding';

/**
 * Доля раскрытия, меньше которой постер и текущий кадр клипа неразличимы.
 *
 * Выведена из политики, а не выбрана: половина кадра клипа, отнесённая к его полной
 * длительности.
 */
const frameTolerance =
  motion.heroParallax.seekThresholdFrames /
  (videoProcessing.heroLoop.targetFps * videoProcessing.heroLoop.maxDurationSeconds);

export function HeroVideo({ video, reverseVideo, poster, locale }: HeroVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();

  /**
   * До гидратации `stillImage` равен `true`, поэтому сервер и клиент отдают
   * одинаковую разметку с одним постером, а клип появляется после того, как стали
   * известны предпочтения.
   */
  const playable = hasPlayableVideo(video) && !stillImage;

  /**
   * Выбранный источник. Пока он не определён, `<video>` без `src` и не грузит
   * ничего: решение принимается по ответу `mediaCapabilities`, а не по порядку
   * `<source>` в разметке.
   */
  const [source, setSource] = useState<string | null>(null);

  /**
   * Источник перевёрнутого клипа. `null`, пока он не нужен.
   *
   * Выбирается не при загрузке страницы, а когда посетитель начал раскрытие: тот,
   * кто до первого экрана не дотронулся, за второй файл не платит. К моменту
   * окончания прямого прохода — а он идёт около четырёх секунд — файл обычно уже
   * скачан, и обратный проход идёт плавно с первого же жеста.
   */
  const [reverseSource, setReverseSource] = useState<string | null>(null);
  const reverseArmedRef = useRef(false);

  /** Кадр показан — до этого его подменяет постер. */
  const [showing, setShowing] = useState(false);
  const shownRef = useRef(false);
  /** Декодер прогрет: до этого Safari на iOS не отдаёт кадры по `currentTime`. */
  const primedRef = useRef(false);

  /**
   * Совпадает ли постер с тем кадром, который должен быть на экране.
   *
   * Постер — ПЕРВЫЙ кадр клипа, то есть закрытый занавес. Если страницу
   * перезагрузили посреди раскрытия, браузер восстановит прокрутку, и постер
   * покажет кадр, которого в этом месте быть не должно: закрытый занавес там, где
   * сцена уже открыта. Тогда постер убирается, и до появления клипа остаётся
   * кинематографичная плоскость — «ещё не загрузилось» читается лучше, чем чужой
   * кадр, который потом прыгнет.
   */
  const [posterMatchesFrame, setPosterMatchesFrame] = useState(true);

  const phaseRef = useRef<RevealPhase>('idle');
  const frameRef = useRef(0);

  useEffect(() => {
    if (!playable || !hasPlayableVideo(video)) return;

    let cancelled = false;
    void pickDecodableSource(video.sources, 'hero').then((chosen) => {
      if (!cancelled && chosen) setSource(chosen.url);
    });

    return () => {
      cancelled = true;
    };
  }, [playable, video]);

  const armReverse = useCallback(() => {
    if (reverseArmedRef.current || !hasPlayableVideo(reverseVideo)) return;
    reverseArmedRef.current = true;

    void pickDecodableSource(reverseVideo.sources, 'heroReverse').then((chosen) => {
      if (chosen) setReverseSource(chosen.url);
    });
  }, [reverseVideo]);

  /** Длительность клипа. До готовности метаданных — заявленная политикой. */
  const durationOf = useCallback((element: HTMLVideoElement) => {
    return Number.isFinite(element.duration) && element.duration > 0
      ? element.duration
      : videoProcessing.heroLoop.maxDurationSeconds;
  }, []);

  /**
   * Хвостовое укрупнение кадра.
   *
   * Подводит камеру ближе в последней трети раскрытия. Начинается не с нуля — иначе
   * шло бы одновременно с раскрытием и читалось бы как дрейф кадра, а не как
   * приближение к сцене.
   */
  const applyZoom = useCallback((reveal: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const { tailZoom, tailZoomFromProgress, tailZoomFullAtProgress } = motion.heroParallax;
    const span = Math.max(tailZoomFullAtProgress - tailZoomFromProgress, 0.001);
    const tail = Math.min(Math.max((reveal - tailZoomFromProgress) / span, 0), 1);
    wrap.style.transform = `scale(${(1 + (tailZoom - 1) * tail).toFixed(4)})`;
  }, []);

  /** Показать кадр, когда на нём действительно нужный момент клипа. */
  const revealFrameIfReady = useCallback((element: HTMLVideoElement) => {
    if (shownRef.current || !primedRef.current) return;
    if (element.seeking || element.readyState < element.HAVE_CURRENT_DATA) return;
    shownRef.current = true;
    setShowing(true);
  }, []);

  /**
   * Положение клипа по положению страницы. Только для состояния `idle`:
   * перезагрузка, переход по якорю, перетаскивание полосы прокрутки.
   */
  const syncFromScroll = useCallback(
    (reveal: number) => {
      applyZoom(reveal);

      const element = videoRef.current;
      if (!element) return;

      const target = reveal * durationOf(element);
      const threshold =
        motion.heroParallax.seekThresholdFrames / videoProcessing.heroLoop.targetFps;

      if (Math.abs(target - element.currentTime) >= threshold && !element.seeking) {
        element.currentTime = target;
      }

      revealFrameIfReady(element);
    },
    [applyZoom, durationOf, revealFrameIfReady],
  );

  const onProgress = useCallback(
    (progress: number) => {
      /* Во время доигрывания положение задаёт клип, а не прокрутка. */
      if (phaseRef.current !== 'idle') return;

      if (progress > frameTolerance) setPosterMatchesFrame(false);
      syncFromScroll(progress);
    },
    [syncFromScroll],
  );

  useHeroRevealProgress(containerRef, onProgress, playable && source !== null);

  /*
   * Прогрев декодера.
   *
   * Safari на iOS не отдаёт кадры по `currentTime`, пока воспроизведение ни разу не
   * начиналось: элемент остаётся пустым, и на месте кадра виден постер. Беззвучное
   * воспроизведение разрешено политикой автозапуска, поэтому `play()` с немедленной
   * паузой законен и незаметен.
   *
   * Отказ `play()` не ошибка: на экране остаётся постер, и это рабочее состояние.
   */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || source === null) return;

    let cancelled = false;

    const prime = () => {
      void element
        .play()
        .then(() => {
          element.pause();
          if (cancelled) return;
          primedRef.current = true;
          const stage = heroStageOf(containerRef.current);
          syncFromScroll(stage ? heroRevealProgress(stage) : 0);
        })
        .catch(() => {});
    };

    if (element.readyState >= element.HAVE_CURRENT_DATA) {
      prime();
    } else {
      element.addEventListener('loadeddata', prime, { once: true });
    }

    return () => {
      cancelled = true;
      element.removeEventListener('loadeddata', prime);
    };
  }, [source, syncFromScroll]);

  /* Кадр может стать готовым к показу и без прокрутки — по приходу данных. */
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const check = () => revealFrameIfReady(element);
    element.addEventListener('seeked', check);
    element.addEventListener('canplay', check);

    return () => {
      element.removeEventListener('seeked', check);
      element.removeEventListener('canplay', check);
    };
  }, [revealFrameIfReady, source]);

  /**
   * Доигрывание.
   *
   * Держится в одном эффекте, потому что все три его фазы — воспроизведение,
   * передача экрана и обратный проход — делят одно и то же: цикл кадров анимации,
   * удержание прокрутки и предохранитель по времени. Разнести их значило бы
   * заводить три копии этой обвязки.
   */
  /**
   * Доигрывание и перехват жеста.
   *
   * Держится в одном эффекте, потому что всё это делит одно состояние: фазу прохода,
   * замер геометрии и цикл кадров. Разнести значило бы передавать фазу между
   * эффектами и заводить три копии обвязки.
   */
  useEffect(() => {
    if (!playable || source === null) return;

    const stage = heroStageOf(containerRef.current);
    if (!stage) return;

    const { revealPlaybackRate, revealLockTimeoutMs, revealRewindStepFrames } =
      motion.heroParallax;

    let lockTimer = 0;
    let detachRewind: (() => void) | null = null;

    const cancelFrame = () => {
      if (frameRef.current !== 0) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };

    /**
     * Геометрия прохода. Замеряется на монтировании и при изменении размеров окна —
     * НЕ в цикле кадров.
     *
     * Здесь была ошибка, которую видно только глазами: геометрия мерилась каждый
     * кадр — и в том же кадре цикл двигал прокрутку. Получалась обратная связь
     * «замерил → сдвинул → замерил уже другое»: положение обёртки относительно окна
     * зависит от прокрутки, браузер округляет её до целых пикселей, и цель на
     * следующем кадре смещалась на доли пикселя туда-обратно. На шве между первым
     * экраном и второй секцией это читалось как дрожание кромок.
     *
     * Второе, не менее важное: замер вынесен из обработчика жеста. Обработчик
     * неактивный (`passive: false`), то есть браузер ждёт его перед прокруткой, и
     * чтение геометрии там означало бы принудительный пересчёт вёрстки на каждое
     * событие колеса. Доля прохода считается арифметикой из `scrollY`.
     */
    const geometry = { top: 0, travel: 1 };

    const measure = () => {
      const { top, travel } = heroStageGeometry(stage);
      geometry.top = top;
      geometry.travel = travel;
    };

    measure();

    /** Доля прохода без обращения к вёрстке. Может выйти за [0,1] — это важно ниже. */
    const rawProgress = () => (window.scrollY - geometry.top) / geometry.travel;

    /** Доля прохода, обрезанная краями: она задаёт положение в клипе. */
    const progressNow = () => Math.min(Math.max(rawProgress(), 0), 1);

    /**
     * Может ли жест в эту сторону относиться к первому экрану.
     *
     * Решение принимается по НЕОБРЕЗАННОЙ доле, и это не придирка. Обрезанная доля
     * ниже прохода всегда равна единице, поэтому по ней невозможно отличить «страница
     * ровно на конце раскрытия» от «страница в подвале». В первом случае жест вверх
     * обязан начать обратный проход, во втором — не должен трогать страницу вовсе,
     * иначе посетителя телепортирует из подвала к занавесу.
     *
     * Допуск в один пиксель: конец прохода — округлённое значение, и точное равенство
     * единице не выполняется никогда.
     */
    const canAct = (direction: HeroGestureDirection) => {
      const raw = rawProgress();
      const tolerance = 1 / geometry.travel;

      return direction === 'forward'
        ? raw < 1 - tolerance
        : raw > tolerance && raw <= 1 + tolerance;
    };

    let lockTimerArmed = false;

    const armLockTimer = () => {
      lockTimerArmed = true;
      lockTimer = window.setTimeout(() => finish(), revealLockTimeoutMs);
    };

    const clearLockTimer = () => {
      if (!lockTimerArmed) return;
      lockTimerArmed = false;
      if (lockTimer !== 0) {
        window.clearTimeout(lockTimer);
        lockTimer = 0;
      }
    };

    function finish() {
      cancelFrame();
      clearLockTimer();
      detachRewind?.();
      detachRewind = null;
      const element = videoRef.current;
      if (element) element.pause();
      const reverse = reverseRef.current;
      if (reverse) reverse.pause();
      pass = null;
      document.documentElement.style.overflowAnchor = '';
      phaseRef.current = 'idle';
      /* Размеры могли поменяться, пока шёл проход. */
      measure();
    }

    /** Замер, действующий на весь проход: за проход вёрстка не перестраивается. */
    let pass: { top: number; travel: number } | null = null;

    const beginPass = () => {
      pass = { top: geometry.top, travel: geometry.travel };
      armLockTimer();

      /*
       * Инерция браузера гасится в самом начале.
       *
       * Даже с перехватом события в очереди может лежать уже начатая браузером
       * плавная прокрутка — например, посетитель дошёл до первого экрана по инерции
       * с предыдущего жеста. Присвоение текущего положения останавливает её: иначе
       * это вторая сила, тянущая страницу, пока проход ведёт её сам.
       */
      window.scrollTo({ top: window.scrollY, behavior: 'instant' });

      /*
       * Привязка прокрутки к содержимому выключается на время прохода.
       *
       * Браузер умеет сам подправлять положение прокрутки, когда что-то выше неё
       * меняет размер (scroll anchoring). Пока прокрутку ведёт код, такая помощь —
       * снова вторая сила и снова дрожание на шве.
       */
      document.documentElement.style.overflowAnchor = 'none';
    };

    /** Прокрутка встаёт туда, где ей велит доля прохода. */
    const scrollToReveal = (reveal: number) => {
      if (!pass) return;
      /*
       * Целые пиксели. Дробное значение браузер округляет сам, но по-разному для
       * приколотого слоя и для потока под ним — и кромки расходятся на пиксель.
       */
      window.scrollTo({ top: Math.round(pass.top + pass.travel * reveal), behavior: 'instant' });
    };

    /**
     * Прямой проход: клип играет, прокрутка следует за его временем.
     *
     * Именно в этом порядке, а не наоборот — см. шапку компонента. Положение
     * страницы каждый кадр берётся из фактического `currentTime`, поэтому срезанная
     * браузером скорость или буферизация не расходят кадр с прокруткой.
     *
     * Отдельной фазы «доехать до второй секции» здесь НЕТ, и это исправление по
     * замечанию заказчика: сначала было так, и получалось два движения подряд —
     * видео кончилось, потом страница поехала. Теперь время клипа отображается на
     * ВЕСЬ путь прохода, поэтому последний кадр и приход второй секции — один и тот
     * же момент.
     */
    const play = (element: HTMLVideoElement) => {
      phaseRef.current = 'playing';
      beginPass();
      /* Перевёрнутый клип понадобится на обратном жесте — качаем его уже сейчас. */
      armReverse();
      element.playbackRate = revealPlaybackRate;

      void element.play().catch(() => {
        /* Автозапуск отклонён — доигрывать нечем, остаётся положение прокрутки. */
        finish();
      });

      const duration = durationOf(element);

      const step = () => {
        frameRef.current = 0;
        const reveal = Math.min(element.currentTime / duration, 1);
        applyZoom(reveal);
        scrollToReveal(reveal);

        if (reveal < 1 && !element.ended) {
          frameRef.current = window.requestAnimationFrame(step);
          return;
        }

        finish();
      };

      frameRef.current = window.requestAnimationFrame(step);
    };

    /**
     * Обратный проход перевёрнутым клипом: он тоже ИГРАЕТ.
     *
     * Ровно та же механика, что у прямого прохода, и плавность у неё та же по той
     * же причине. Кадры на стыке совпадают — последний кадр прямого клипа и первый
     * кадр перевёрнутого это один и тот же момент съёмки, — поэтому подмена
     * элемента незаметна и переход не нужен.
     */
    const playReverse = (element: HTMLVideoElement, from: number) => {
      phaseRef.current = 'rewinding';
      beginPass();

      const clip = durationOf(element);
      element.currentTime = (1 - from) * clip;
      element.playbackRate = revealPlaybackRate;
      element.style.opacity = '1';

      void element.play().catch(() => {
        element.style.opacity = '0';
        finish();
      });

      const step = () => {
        frameRef.current = 0;
        const reveal = Math.max(1 - element.currentTime / clip, 0);
        applyZoom(reveal);
        scrollToReveal(reveal);

        if (reveal > 0 && !element.ended) {
          frameRef.current = window.requestAnimationFrame(step);
          return;
        }

        /* Прямой клип возвращается на первый кадр ДО подмены — иначе виден скачок. */
        const forward = videoRef.current;
        if (forward) forward.currentTime = 0;
        element.style.opacity = '0';
        finish();
      };

      frameRef.current = window.requestAnimationFrame(step);
    };

    /**
     * Запасной обратный проход перемоткой — если перевёрнутый клип ещё не скачан.
     *
     * Ведётся по готовности декодера, а не по часам: следующий кадр запрашивается
     * после того, как доехал предыдущий. Ровным этот путь всё равно не будет —
     * задержка перемотки колеблется с периодом ключевых кадров, — поэтому он и
     * запасной. Обычно до него не доходит: файл качается с началом прямого прохода.
     */
    const rewind = (element: HTMLVideoElement, from: number) => {
      phaseRef.current = 'rewinding';
      beginPass();
      element.pause();

      const clip = durationOf(element);
      const step = revealRewindStepFrames / videoProcessing.heroLoop.targetFps / clip;
      let reveal = from;

      const advance = () => {
        reveal = Math.max(reveal - step, 0);
        applyZoom(reveal);
        scrollToReveal(reveal);

        if (reveal <= 0) {
          finish();
          return;
        }

        element.currentTime = reveal * clip;
      };

      const onSeeked = () => {
        if (phaseRef.current === 'rewinding') advance();
      };

      element.addEventListener('seeked', onSeeked);
      detachRewind = () => element.removeEventListener('seeked', onSeeked);

      advance();
    };

    /** Запустить проход в заданную сторону. Вызывается только из перехватчика жеста. */
    const start = (direction: HeroGestureDirection) => {
      const element = videoRef.current;
      if (!element) return;

      /*
       * Доля берётся ЗДЕСЬ, из фактического положения страницы.
       *
       * Прежде она измерялась до того, как жест был отменён, и при резком движении
       * браузер успевал прокрутить страницу первым: проход начинался с прежней доли и
       * первым же кадром возвращал страницу назад — рывок, который видно только на
       * резком жесте и только назад, потому что вперёд обе силы тянут в одну сторону.
       */
      const progress = progressNow();

      if (direction === 'forward') {
        play(element);
        return;
      }

      /*
       * Перевёрнутый клип, если он готов, — иначе перемотка. Условие именно на
       * готовность данных, а не на наличие источника: элемент с назначенным `src`,
       * но без первого кадра, дал бы чёрную вспышку в момент подмены.
       */
      const reverse = reverseRef.current;
      if (reverse && reverse.readyState >= reverse.HAVE_CURRENT_DATA) {
        playReverse(reverse, progress);
        return;
      }

      armReverse();
      rewind(element, progress);
    };

    /**
     * Перехват жеста — ДО того, как браузер его применит.
     *
     * Это ключевое отличие от прежней версии, и оно решает дефект «при резком скролле
     * дёргается». Прежде слушатель был пассивным: браузер применял прокрутку, а код
     * узнавал о жесте потом и возвращал страницу к началу прохода. Чем резче жест, тем
     * больше был откат.
     *
     * Теперь событие отменяется, и прокрутка от него не происходит вовсе — страница
     * движется только так, как её ведёт проход. Тем же перехватом закрывается
     * требование «остановить на середине нельзя»: пока проход идёт, события гасятся.
     *
     * Слушатель неактивный (`passive: false`), то есть браузер ждёт его перед
     * прокруткой. Поэтому внутри нет ни одного обращения к вёрстке: доля прохода
     * считается арифметикой из `scrollY`, а геометрия обновляется по `resize`.
     */
    const onWheel = (event: WheelEvent) => {
      if (phaseRef.current !== 'idle') {
        event.preventDefault();
        return;
      }
      if (event.deltaY === 0) return;

      const direction: HeroGestureDirection = event.deltaY > 0 ? 'forward' : 'backward';
      if (!canAct(direction)) return;

      event.preventDefault();
      start(direction);
    };

    let touchY = 0;

    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (phaseRef.current !== 'idle') {
        event.preventDefault();
        return;
      }

      const y = event.touches[0]?.clientY ?? 0;
      const travelled = touchY - y;
      if (Math.abs(travelled) < 1) return;
      touchY = y;

      /* Палец вверх — страница вниз. */
      const direction: HeroGestureDirection = travelled > 0 ? 'forward' : 'backward';
      if (!canAct(direction)) return;

      event.preventDefault();
      start(direction);
    };

    /** Клавиши прокрутки и направление, которое они задают. */
    const gestureKeys: Record<string, HeroGestureDirection> = {
      ArrowDown: 'forward',
      PageDown: 'forward',
      End: 'forward',
      ' ': 'forward',
      ArrowUp: 'backward',
      PageUp: 'backward',
      Home: 'backward',
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = gestureKeys[event.key];
      if (!direction) return;

      if (phaseRef.current !== 'idle') {
        event.preventDefault();
        return;
      }
      if (!canAct(direction)) return;

      event.preventDefault();
      start(direction);
    };

    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
      cancelFrame();
      clearLockTimer();
      document.documentElement.style.overflowAnchor = '';
      phaseRef.current = 'idle';
    };
  }, [applyZoom, armReverse, durationOf, playable, source]);

  const posterProps = resolveMedia(poster, locale);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden">
      {/*
        Постер лежит под кадром и остаётся видимым, пока браузер не отдал кадр
        клипа. Это же изображение — единственное содержимое экрана при экономии
        данных и при просьбе убрать движение.
      */}
      <Media
        {...posterProps}
        preset="heroFullBleed"
        priority
        fill
        className="absolute inset-0 size-full"
        imageClassName={cn(
          'transition-opacity duration-slow ease-brand',
          posterMatchesFrame ? undefined : 'opacity-0',
        )}
      />

      {playable && hasPlayableVideo(video) && (
        <div ref={wrapRef} className="hero-video-wrap">
          <video
            ref={videoRef}
            data-slot="hero-clip"
            className={cn(
              'transition-opacity duration-slow ease-brand',
              showing ? 'opacity-100' : 'opacity-0',
            )}
            /*
             * `autoPlay` и `loop` отсутствуют намеренно: клип запускается жестом и
             * останавливается на последнем кадре. `preload="auto"` обязателен —
             * воспроизведение на четырёхкратной скорости съедает буфер вчетверо
             * быстрее, и метаданных для этого недостаточно.
             */
            muted
            playsInline
            src={source ?? undefined}
            preload={source === null ? 'none' : 'auto'}
            /** Без описания и без управления фокусом: это фон, а не контент. */
            aria-hidden
            tabIndex={-1}
          />

          {/*
            Перевёрнутый клип для обратного прохода. Лежит ПОВЕРХ прямого и обычно
            прозрачен: на обратном жесте он становится видимым и играет вперёд.
            Переход не нужен и вреден — кадры на стыке совпадают, а полусекундное
            растворение между двумя одинаковыми кадрами читалось бы как мигание.

            Источник появляется только с началом раскрытия, поэтому у тех, кто до
            первого экрана не дотронулся, этот элемент не тянет ни байта.
          */}
          {reverseSource !== null && (
            <video
              ref={reverseRef}
              data-slot="hero-clip-reverse"
              className="absolute inset-0 size-full opacity-0"
              muted
              playsInline
              src={reverseSource}
              preload="auto"
              aria-hidden
              tabIndex={-1}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Уложился ли клип в бюджет. Используется в отчётах и в админке. */
export function videoWithinBudget(video: VideoRef): boolean {
  return video.bytes <= videoProcessing.heroLoop.maxBytes;
}
