'use client';

import dynamic from 'next/dynamic';

const HeroParallaxFX = dynamic(() => import('@/components/home/hero-parallax-fx').then((m) => m.HeroParallaxFX), { ssr: false });
const HeroMythicDust = dynamic(() => import('@/components/fx/hero-mythic-dust').then((m) => m.HeroMythicDust), { ssr: false });

export function HeroClientFX() {
  return (
    <>
      <HeroParallaxFX />
      <HeroMythicDust />
    </>
  );
}
