'use client';

import { useEffect, useRef, useState } from 'react';

import { hasPlayableVideo, type VideoRef } from '@/domain/content';
import { useBackgroundVideo } from '@/lib/hooks/use-background-video';
import { usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { pickDecodableSource } from '@/lib/media/video-source';
import { cn } from '@/lib/utils';

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
  const playable = hasPlayableVideo(video) && !stillImage;
  const [source, setSource] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    // Не грузим видео, пока браузер не в idle / пользователь не взаимодействует.
    let cleanupIdle = onIdle(() => setIdle(true));
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
