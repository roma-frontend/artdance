import type { Transition } from 'framer-motion';

import { animationConfig } from './parallax';

export function revealTransition(index = 0): Transition {
  return {
    duration: animationConfig.duration.slow,
    ease: [...animationConfig.easing.smooth],
    delay: Math.min(7, Math.max(0, index)) * 0.055,
  };
}

export function splitWords(text: string): string[] {
  return text.split(/(\s+)/u).filter(Boolean);
}
