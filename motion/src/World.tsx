/**
 * МИР РОЛИКА — сцена, свет, воздух.
 *
 * Это не «фон-картинка»: видео проекта работает как живая атмосфера (свет, дым,
 * движение силуэтов), сильно приглушённое вуалью. Содержание — карточки-объекты,
 * которые выходят на сцену, живут и уходят. Так ролик остаётся моушном, а не
 * слайдшоу из полноэкранных кадров.
 *
 * Все сцены ролика используют один и тот же свет и одну палитру — это и есть
 * «цельный мир» из правил скилла.
 */

import React from 'react';
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';

const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const pr = (f: number, a: number, b: number, e = Easing.out(Easing.cubic)) =>
  interpolate(f, [a, b], [0, 1], { ...cl, easing: e });

/** Плёночное зерно. Меняется каждые 2 кадра — иначе «мёртвая» картинка. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.16 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 48;
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <filter id={`gr${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#gr${seed})`} />
    </svg>
  );
};

/**
 * Пыль в луче. Свет ловит её — сцена дышит даже в статике.
 *
 * `seed` сдвигает всю раскладку частиц: три вызова с разными сидами дают три
 * разных облака. Без него пыль была бы одинаковой во всех сценах — при
 * одинаковых размерах облака это читается как копипаста кадра.
 */
export const Dust: React.FC<{ x: number; L: number; seed?: string; n?: number }> = ({ x, L, seed = 'd', n = 46 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  // Строка в число: сдвиг детерминирован, поэтому кадр воспроизводим при рендере.
  const offset = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 10_007, 7);
  if (L <= 0.02) return null;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const h = ((i + offset) * 7919) % 997 / 997;
        const y0 = h * 1500 - 300;
        const y = ((y0 + t * (12 + h * 20) + 1800) % 1600) - 380;
        const half = 60 + ((y + 600) / 1800) * 300;
        const px = x + ((((i + offset) * 104729) % 991) / 991 - 0.5) * 2 * half * 0.85 + Math.sin(t * 0.6 + i) * 16;
        const s = 1.6 + h * 3.4;
        return <div key={i} style={{ position: 'absolute', left: px, top: y, width: s, height: s, borderRadius: s, background: '#FFF3DE', opacity: L * (0.22 + 0.5 * h) }} />;
      })}
    </>
  );
};

/**
 * Прожектор: конус из-за верхнего края + пятно на полу.
 * L — яркость 0..1, обычно из `levels.json` (bass), поэтому свет дышит в такт.
 */
export const Spot: React.FC<{ x: number; L: number; groundY?: number; w?: number; color?: string }> = ({ x, L, groundY = 980, w = 420, color = '255,206,150' }) => {
  if (L <= 0.01) return null;
  const id = `sp${Math.round(x)}${Math.round(w)}`;
  return (
    <>
      <svg width={1600} height={groundY + 700} style={{ position: 'absolute', left: x - 800, top: -700, mixBlendMode: 'screen', filter: 'blur(30px)', opacity: L }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`rgba(${color},.6)`} />
            <stop offset="0.65" stopColor={`rgba(${color},.16)`} />
            <stop offset="1" stopColor={`rgba(${color},.03)`} />
          </linearGradient>
        </defs>
        <polygon points={`720,0 880,0 ${800 + w},${groundY + 700} ${800 - w},${groundY + 700}`} fill={`url(#${id})`} />
      </svg>
      <div style={{ position: 'absolute', left: x - 620, top: groundY - 80, width: 1240, height: 240, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${color},.26), rgba(${color},0))`, mixBlendMode: 'screen', opacity: L }} />
    </>
  );
};

/**
 * Задник сцены: видео проекта под вуалью.
 *
 * Видео сильно притушено и обесцвечено — оно даёт свет и движение, но не
 * претендует на роль содержания кадра. `from` — секунда, с которой играем
 * (у лупов проекта первая секунда часто «пустая»).
 */
export const Backdrop: React.FC<{ src: string; opacity?: number; blur?: number; from?: number; scale?: number }> = ({
  src, opacity = 0.5, blur = 7, from = 0, scale = 1.06,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = 1 + (f / fps) * 0.006;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity, filter: `blur(${blur}px) saturate(.7) brightness(.95)`, transform: `scale(${scale * drift})` }}>
        <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      {/* Вуаль: центр открыт, края уходят в черноту — кадр читается как сцена */}
      <AbsoluteFill style={{ background: `radial-gradient(125% 95% at 50% 44%, transparent 0%, rgba(11,10,9,.35) 62%, rgba(11,10,9,.85) 100%)` }} />
    </AbsoluteFill>
  );
};

/** Тёплая база сцены: вертикальный градиент «пол → глубина». */
export const StageFloor: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.inkDeep} 0%, ${C.ink} 58%, #191512 100%)` }} />
);

/** Тонкая золотая нить-разделитель. Протягивается слева направо. */
export const GoldRule: React.FC<{ y: number; x0?: number; x1?: number; at: number; dur?: number; color?: string; thick?: number }> = ({
  y, x0 = 120, x1 = 1800, at, dur = 22, color = C.metal, thick = 1.5,
}) => {
  const f = useCurrentFrame();
  const p = pr(f, at, at + dur, Easing.inOut(Easing.cubic));
  return (
    <div style={{ position: 'absolute', left: x0, top: y, width: (x1 - x0) * p, height: thick, background: color, opacity: 0.9 }} />
  );
};

/** Виньетка + зерно + лёгкая «ручная» тряска камеры. Класть поверх сцены. */
export const Lens: React.FC<{ shake?: number; vignette?: number }> = ({ shake = 1, vignette = 0.55 }) => {
  const f = useCurrentFrame();
  const sx = Math.sin(f / 7.3) * shake;
  const sy = Math.cos(f / 9.1) * shake * 0.7;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px,${sy}px)` }}>
        <AbsoluteFill style={{ background: `radial-gradient(105% 78% at 50% 46%, transparent 42%, rgba(0,0,0,${vignette}) 100%)` }} />
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};
