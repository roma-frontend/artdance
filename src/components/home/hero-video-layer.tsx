'use client';

import { useEffect, useRef, useState } from 'react';

import { hasPlayableVideo, type VideoRef } from '@/domain/content';
import { useBackgroundVideo } from '@/lib/hooks/use-background-video';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import { cn } from '@/lib/utils';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

interface TileVideoProps {
  video: VideoRef;
  posterAlt: string;
  isActive: boolean;
  className?: string;
}

/** Style-tile variant of the background layer, with the same motion/data safeguards. */
export function TileVideo({ video, isActive, className }: TileVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();
  const lite = useIsLiteMode();
  const enabled = isActive && !stillImage && !lite;
  const [source, setSource] = useState<string | null>(null);
  const { near } = useBackgroundVideo({
    videoRef,
    containerRef,
    enabled,
    ready: source !== null,
    preloadAheadViewports: 0,
  });
  useEffect(() => {
    if (!near) return;
    const element = videoRef.current;
    if (!element) return;
    // Vertical clips: choose resolution from the actual rendered height, not viewport width.
    const required = element.getBoundingClientRect().height * 9 / 16 * Math.min(window.devicePixelRatio || 1, 2);
    const width = required > 720 ? 1080 : 720;
    const candidates = video.sources.filter((item) => item.width === width);
    const types = { h264: 'video/mp4', vp9: 'video/webm; codecs="vp9"', av1: 'video/webm; codecs="av01.0.05M.08"' };
    // Prefer the broadly hardware-decoded H.264 path for three simultaneous tile loops.
    const chosen = (['h264', 'vp9', 'av1'] as const).map((format) => candidates.find((item) => item.format === format && element.canPlayType(types[format]))).find(Boolean);
    setSource(chosen?.url ?? null);
  }, [near, video]);
  // transitionSources holds "другое видео из серии стиля": для hip-hop это warp (1920), для остальных — alt-лупа (1080)
  const portalSrc =
    video.transitionSources?.find((item) => item.format === 'h264' && item.width === 1080)?.url ??
    video.transitionSources?.find((item) => item.format === 'h264' && item.width === 1920)?.url ??
    video.transitionSources?.find((item) => item.format === 'h264')?.url;
  return (
    <div ref={containerRef} aria-hidden className="absolute inset-0">
      <video
        ref={videoRef}
        data-tile-video=""
        data-portal-video-src={portalSrc}
        muted
        loop
        playsInline
        poster={video.poster.key}
        src={enabled ? source ?? undefined : undefined}
        preload={source && enabled ? 'auto' : 'none'}
        tabIndex={-1}
        className={cn('absolute inset-0 size-full object-cover', className)}
      />
    </div>
  );
}

function onIdle(cb: () => void): () => void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id: number = w.requestIdleCallback(cb, { timeout: 3500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 1200);
  return () => window.clearTimeout(id);
}

export function HeroVideoLayer({ video }: { video: VideoRef | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillImage = usePrefersStillImage();
  const lite = useIsLiteMode();
  const playable = hasPlayableVideo(video) && !stillImage && !lite;
  const [source, setSource] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    // Не грузим видео, пока браузер не в idle / пользователь не взаимодействует.
    const cleanupIdle = onIdle(() => setIdle(true));
    const onInteract = () => setIdle(true);
    window.addEventListener('pointerdown', onInteract, { once: true, passive: true });
    window.addEventListener('touchstart', onInteract, { once: true, passive: true });
    window.addEventListener('scroll', onInteract, { once: true, passive: true });
    return () => {
      cleanupIdle();
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('touchstart', onInteract);
      window.removeEventListener('scroll', onInteract);
    };
  }, []);

  const shouldLoad = playable && idle;

  const { near, active } = useBackgroundVideo({
    videoRef,
    containerRef,
    enabled: shouldLoad,
    ready: source !== null,
    preloadAheadViewports: 0,
  });

  useEffect(() => {
    if (!near || !hasPlayableVideo(video) || !shouldLoad) return;
    let cancelled = false;
    void pickDecodableSource(video.sources, 'hero').then((chosen) => {
      if (!cancelled && chosen) setSource(chosen.url);
    });
    return () => {
      cancelled = true;
    };
  }, [near, video, shouldLoad]);

  const playing = active && source !== null;

  if (!shouldLoad || !hasPlayableVideo(video)) {
    // Резервируем контейнер для IntersectionObserver, но без видео-DOM.
    return <div ref={containerRef} aria-hidden className="absolute inset-0" />;
  }

  return (
    <div
      ref={containerRef}
      data-slot="hero-video-wrap"
      className={cn(
        'hero-video-wrap absolute inset-0 transition-opacity duration-slow ease-brand',
        playing ? 'opacity-100' : 'opacity-0',
      )}
    >
      <video
        ref={videoRef}
        data-slot="hero-clip"
        className="hero-video-main absolute inset-0 size-full object-cover"
        muted
        loop
        playsInline
        src={source ?? undefined}
        preload={source === null ? 'none' : 'auto'}
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
