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
import { lightColors } from '@/design/tokens/semantic';
import { usePathname, useRouter } from '@/i18n/routing';
import { playTactileClick } from '@/lib/audio/tactile-click';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';

type Phase = 'idle' | 'flight' | 'hold' | 'reveal';

interface PortalState {
  phase: Phase;
  rect: DOMRect | null;
  imageSrc: string;
  href: string;
  /**
   * Копия карточки для пролёта «целиком» — с рамкой, подписями и стрелкой.
   * `null` — летит только кадр (обычный режим).
   */
  card: HTMLElement | null;
  /** Размер карточки в раскладке, до перспективы и масштабов предков. */
  cardSize: { width: number; height: number } | null;
  video: HTMLVideoElement | null;
}

interface PortalContextValue {
  /** `card` — передать, чтобы в пролёт ушла вся карточка, а не только её кадр. */
  triggerPortal: (rect: DOMRect, imageSrc: string, href: string, card?: HTMLElement) => void;
}

const IDLE: PortalState = { phase: 'idle', rect: null, imageSrc: '', href: '', card: null, cardSize: null, video: null };

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
  const reducedMotion = usePrefersStillImage();
  const [portal, setPortal] = useState<PortalState>(IDLE);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
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
      busy.current = false;
      setPortal(IDLE);
    }, motion.portal.revealMs);
  }, [later, releaseScene]);

  const triggerPortal = (rect: DOMRect, imageSrc: string, href: string, source?: HTMLElement) => {
    if (busy.current) return;

    if (reducedMotion) {
      router.push(href);
      return;
    }

    busy.current = true;
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
    const video = source?.querySelector<HTMLVideoElement>('video[data-tile-video]') ?? null;
    const scene = document.querySelector('main');
    if (scene && !video) {
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

    /*
     * Копия карточки, а не сама карточка: оригинал остаётся на месте в уплывающей
     * сцене, а копия летит поверх. Картинки в ней уже загружены — `cloneNode`
     * переиспользует кеш, второго запроса нет.
     */
    let card: HTMLElement | null = null;
    let cardSize: PortalState['cardSize'] = null;
    if (source && !video) {
      card = source.cloneNode(true) as HTMLElement;
      card.removeAttribute('id');
      card.setAttribute('tabindex', '-1');
      card.style.width = '100%';
      card.style.height = '100%';
      card.style.minHeight = '0';
      cardSize = { width: source.offsetWidth, height: source.offsetHeight };
    }

    setPortal({ phase: 'flight', rect, imageSrc, href, card, cardSize, video });
    if (video) return;
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

  const finishVideo = useCallback(() => {
    setPortal((current) => ({ ...current, phase: 'hold' }));
    router.push(portal.href);
    later(reveal, motion.portal.holdMaxMs);
  }, [later, portal.href, reveal, router]);

  const { phase, rect, imageSrc, card, cardSize, video } = portal;
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
          className="fixed inset-0 z-popover overflow-hidden"
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

          {video ? (
            <VideoFlight video={video} rect={rect} onComplete={finishVideo} />
          ) : card && cardSize ? (
            <CardFlight
              card={card}
              rect={rect}
              size={cardSize}
              dir={dir}
              flight={flight}
              arc={arc}
              sway={sway}
            />
          ) : (
          /* Окно карточки: растёт на весь экран, наклоняясь по ходу камеры с креном руки. */
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
          )}
        </animated.div>
      )}
    </PortalContext.Provider>
  );
}

interface VideoFlightProps {
  video: HTMLVideoElement;
  rect: DOMRect;
  onComplete: () => void;
}

/** A viewport-sized camera film behind an opening mask, as in motion.html. */
function VideoFlight({ video, rect, onComplete }: VideoFlightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { completeRef.current(); return; }
    let width = window.innerWidth;
    let height = window.innerHeight;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const optics = motion.portal.optics;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Capture the decoded frame; cloneNode does not preserve video playback state.
    const snapshot = document.createElement('canvas');
    snapshot.width = Math.max(1, Math.round(rect.width * 2));
    snapshot.height = Math.max(1, Math.round(rect.height * 2));
    const snapshotContext = snapshot.getContext('2d');
    const hasSnapshot = video.readyState >= 2 && video.videoWidth > 0 && Boolean(snapshotContext);
    if (hasSnapshot && snapshotContext) {
      const transform = getComputedStyle(video).transform;
      const zoom = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
      const scale = Math.max(snapshot.width / video.videoWidth, snapshot.height / video.videoHeight) * zoom;
      snapshotContext.drawImage(video, (snapshot.width - video.videoWidth * scale) / 2, (snapshot.height - video.videoHeight * scale) / 2, video.videoWidth * scale, video.videoHeight * scale);
    }
    const poster = new Image();
    poster.src = video.poster;
    const radius = parseFloat(getComputedStyle(video.closest('[data-portal-card]') ?? video).borderTopLeftRadius) || 16;
    const clip = document.createElement('video');
    clip.muted = true;
    clip.playsInline = true;
    clip.preload = 'auto';
    const cameraSrc = video.dataset.portalVideoSrc;
    clip.src = cameraSrc || video.currentSrc || video.src;
    canvas.dataset.videoSrc = clip.src;
    clip.playbackRate = cameraSrc ? 1.3 : 1;
    const continueFrame = () => {
      if (!cameraSrc && Number.isFinite(clip.duration)) {
        // Continue from the clicked frame rather than restarting the style loop.
        clip.currentTime = Math.min(video.currentTime, Math.max(0, clip.duration - 1.2));
      }
    };
    clip.addEventListener('loadedmetadata', continueFrame);
    const started = performance.now();
    let clipStart = 0;
    let failed = false;
    let playing = false;
    let frame = 0;
    let finished = false;
    let finalFrame: HTMLCanvasElement | null = null;
    const startClip = () => {
      if (playing || failed || finished) return;
      playing = true;
      clip.play().then(() => { clipStart = performance.now(); }).catch(() => { failed = true; });
    };
    const fail = () => { failed = true; };
    clip.addEventListener('canplay', startClip);
    clip.addEventListener('error', fail);
    clip.load();
    const cover = (media: CanvasImageSource, mw: number, mh: number, x: number, y: number, w: number, h: number) => {
      const scale = Math.max(w / mw, h / mh);
      ctx.drawImage(media, x + (w - mw * scale) / 2, y + (h - mh * scale) / 2, mw * scale, mh * scale);
    };
    const draw = (now: number) => {
      if (finished && finalFrame) {
        ctx.drawImage(finalFrame, 0, 0, width, height);
        return;
      }
      const elapsed = now - started;
      const p = Math.min(1, elapsed / 1100);
      const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      const x = rect.left * (1 - e);
      const y = rect.top * (1 - e);
      const w = rect.width + (width - rect.width) * e;
      const h = rect.height + (height - rect.height) * e;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius * (1 - e));
      ctx.clip();
      ctx.fillStyle = lightColors['surface-cinema'];
      ctx.fillRect(x, y, w, h);
      // Destroy detail before fullscreen: footage supplies motion and colour, not pixels.
      const mediaWidth = clip.videoWidth || video.videoWidth || snapshot.width;
      const mediaHeight = clip.videoHeight || video.videoHeight || snapshot.height;
      const upsample = Math.max((cameraSrc ? width : w) / mediaWidth, (cameraSrc ? height : h) / mediaHeight);
      const detailFade = Math.min(1, Math.max(0, (e - 0.05) / (optics.detailFadeEnd - 0.05)));
      const effectProgress = detailFade * detailFade * (3 - 2 * detailFade);
      const softness = effectProgress * Math.min(optics.diffusionMaxPx, optics.diffusionFloorPx + Math.max(0, upsample - 1) * 4);
      // Apply to the composited output, not just one drawImage pass. This also
      // stays on the moving video and retained landing frame throughout reveal.
      canvas.style.filter = `blur(${softness.toFixed(2)}px)`;
      if (hasSnapshot) cover(snapshot, snapshot.width, snapshot.height, x, y, w, h);
      else if (poster.complete && poster.naturalWidth) cover(poster, poster.naturalWidth, poster.naturalHeight, x, y, w, h);
      if (clipStart && clip.readyState >= 2) {
        ctx.globalAlpha = Math.min(1, (now - clipStart) / 360);
        if (cameraSrc) cover(clip, clip.videoWidth, clip.videoHeight, 0, 0, width, height);
        else cover(clip, clip.videoWidth, clip.videoHeight, x, y, w, h);
        ctx.globalAlpha = 1;
      }
      // Keep the moving background subordinate to the passage through dark glass.
      const veil = optics.veilOpacity * effectProgress;
      ctx.globalAlpha = veil;
      ctx.fillStyle = lightColors['surface-cinema'];
      ctx.fillRect(x, y, w, h);
      // A broad, quiet lens reflection — no flashing, glitching or RGB separation.
      const lightX = width * (0.2 + 0.5 * p);
      const glow = ctx.createRadialGradient(lightX, height * 0.25, 0, lightX, height * 0.25, width * 0.7);
      glow.addColorStop(0, lightColors['content-on-cinema']);
      glow.addColorStop(1, 'transparent');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = optics.lightOpacity * e;
      ctx.fillStyle = glow;
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.hypot(width, height) / 2);
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, lightColors['surface-cinema']);
      ctx.globalAlpha = optics.vignetteOpacity * e;
      ctx.fillStyle = vignette;
      ctx.fillRect(x, y, w, h);
      const shade = ctx.createLinearGradient(0, height * 0.52, 0, height);
      shade.addColorStop(0, 'transparent');
      shade.addColorStop(1, lightColors['surface-sunken']);
      ctx.globalAlpha = 0.55 * e;
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      canvas.dataset.expansion = e.toFixed(3);
      canvas.dataset.optics = 'dark-glass';
      canvas.dataset.diffusion = softness.toFixed(2);
      canvas.dataset.veil = veil.toFixed(2);
      if (p === 1 && (clip.ended || failed || (!clipStart && elapsed > 2500) || elapsed > 8000)) {
        finished = true;
        finalFrame = document.createElement('canvas');
        finalFrame.width = canvas.width;
        finalFrame.height = canvas.height;
        finalFrame.getContext('2d')?.drawImage(canvas, 0, 0);
        canvas.dataset.result = clip.ended ? 'ended' : 'fallback';
        completeRef.current();
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    const onResize = () => { if (finished) draw(performance.now()); };
    window.addEventListener('resize', onResize);
    frame = requestAnimationFrame(draw);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onResize);
      clip.removeEventListener('loadedmetadata', continueFrame);
      clip.removeEventListener('canplay', startClip);
      clip.removeEventListener('error', fail);
      clip.pause();
      clip.removeAttribute('src');
      clip.load();
    };
  }, [video, rect]);

  return <canvas ref={canvasRef} data-slot="portal-video-aperture" className="absolute inset-0 size-full" />;
}

type Transition = Record<string, unknown>;

interface CardFlightProps {
  card: HTMLElement;
  rect: DOMRect;
  size: { width: number; height: number };
  dir: number;
  flight: Transition;
  arc: Transition;
  sway: Transition;
}

/**
 * Пролёт карточки ЦЕЛИКОМ: копия карточки — с рамкой, подписью, счётчиком и
 * стрелкой — едет к центру экрана и наезжает, пока не закроет его собой.
 *
 * Масштаб, а не рост ширины и высоты, как у окна-кадра: при росте размеров
 * текст внутри переносился бы заново и прыгал, а при масштабе карточка
 * приближается как один предмет — ровно то, что видит камера. Конечный масштаб
 * «cover»: кадр карточки закрывает окно, и растворение ложится на hero новой
 * страницы, где стоит тот же кадр.
 */
function CardFlight({ card, rect, size, dir, flight, arc, sway }: CardFlightProps) {
  const { tilt, roll } = motion.portal.window;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  /* Карточка на экране может быть меньше своей раскладки (перспектива барабана). */
  const from = rect.width / size.width;
  const cover = Math.max(viewportWidth / size.width, viewportHeight / size.height) * 1.08;

  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && node.firstChild !== card) node.replaceChildren(card);
    },
    [card],
  );

  return (
    <animated.div
      className="absolute overflow-hidden rounded-lg shadow-xl"
      style={{
        top: centerY - size.height / 2,
        left: centerX - size.width / 2,
        width: size.width,
        height: size.height,
        transformStyle: 'preserve-3d',
      }}
      initial={{ x: 0, y: 0, scale: from, rotateX: 0, rotateZ: 0, filter: 'blur(0px) brightness(1)' }}
      animate={{
        x: viewportWidth / 2 - centerX,
        y: viewportHeight / 2 - centerY,
        scale: cover,
        rotateX: [0, dir * tilt, 0],
        rotateZ: [0, -dir * roll, dir * roll * 0.4, 0],
        filter: [
          'blur(0px) brightness(1)',
          `blur(${motion.portal.motionBlur * 0.35}px) brightness(0.9)`,
          `blur(0px) brightness(${motion.portal.landingBrightness})`,
        ],
      }}
      transition={{ ...flight, rotateX: arc, rotateZ: sway, filter: arc }}
    >
      <div ref={mount} className="size-full" />

      {/* Та же полоса света, что у пролёта кадра: единый язык перехода. */}
      <animated.span
        className="portal-sweep absolute inset-0"
        initial={{ y: `${-dir * 120}%`, opacity: 0 }}
        animate={{ y: `${dir * 120}%`, opacity: [0, 0.9, 0] }}
        transition={flight}
      />
    </animated.div>
  );
}
