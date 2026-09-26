'use client';

import { useEffect, useRef } from 'react';

import { useCursorFollow } from '@/hooks/use-cursor-follow';

export function Magnetic() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    ref.current = document.body;
    return () => { ref.current = null; };
  }, []);
  useCursorFollow(
    ref,
    '[data-magnetic], button, .hero-content a, .cinema-surface a.rounded-full, .magnetic-button',
  );
  return null;
}
