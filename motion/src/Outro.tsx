/**
 * ФИНАЛ — лого собирается в луче, дальше три факта.
 *
 * Знак собирается из трёх частей по очереди (голова, фигура, руки), затем
 * проявляется словесная марка. Так лого читается как событие, а не как титр
 * «в конце всегda пишут лого». Дальше — три факта о проекте, по одному.
 *
 * Знак бургунди на почти чёрном даёт 2.15:1 — принятое в проекте отклонение
 * (см. `src/design/tokens/contrast.ts`). В зале этого мало, поэтому под знаком
 * лежит световой ореол: тот же приём «луч на сцене», а не смена брендового цвета.
 */

import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';
import type { Copy, Locale } from './locales';
import { FONTS } from './locales';
import { Dust, Lens, Spot } from './World';
import { FINALE } from './stages';

const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pr = (f: number, a: number, b: number, e = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...cl, easing: e });

/** Факт финала: значение и подпись, появляются по одному. */
const Fact: React.FC<{ label: string; value: string; at: number; accent?: boolean; locale: Locale }> = ({ label, value, at, accent, locale }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame() + FINALE.start; // тайминги абсолютные
  const s = spring({ frame: f - at, fps, config: { damping: 16, mass: 0.9, stiffness: 100 } });
  const o = pr(f, at, at + 16);
  const fonts = FONTS[locale];
  return (
    <div style={{ opacity: o, transform: `translateY(${(1 - s) * 30}px)`, textAlign: 'center', minWidth: 340 }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 54, color: accent ? C.metal : C.ivory, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: fonts.sans, fontWeight: 500, fontSize: 20, color: C.ivoryMuted, marginTop: 12, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
};

export const Outro: React.FC<{ copy: Copy; locale: Locale }> = ({ copy, locale }) => {
  const { fps } = useVideoConfig();
  const s = FINALE.start;
  // Внутри <Sequence from={FINALE.start}> кадр локальный, тайминги — абсолютные.
  const f = useCurrentFrame() + s;
  const fonts = FONTS[locale];

  // Луч финала: сходится в одну точку и держится
  const converge = pr(f, s - 8, s + 26);
  const L = 0.5 + converge * 0.6 + Math.sin(f / 10) * 0.05;

  // Знак: три части по очереди, с пружиной
  const part1 = spring({ frame: f - (s + 8), fps, config: { damping: 14, mass: 0.8, stiffness: 120 } });
  const part2 = spring({ frame: f - (s + 14), fps, config: { damping: 14, mass: 0.8, stiffness: 120 } });
  const part3 = spring({ frame: f - (s + 20), fps, config: { damping: 14, mass: 0.8, stiffness: 120 } });
  const markScale = 1.6 - 0.6 * part3;

  const word = spring({ frame: f - (s + 32), fps, config: { damping: 18, mass: 1, stiffness: 90 } });
  const wordO = pr(f, s + 32, s + 54);
  const tagline = pr(f, s + 52, s + 74);

  // Пыль вспыхивает в момент сборки знака
  const burst = pr(f, s + 20, s + 34) * (1 - pr(f, s + 46, s + 60));

  return (
    <AbsoluteFill style={{ background: C.inkDeep }}>
      <Spot x={960} L={L} groundY={1080} w={520} />
      <Dust x={960} L={L * 0.9} seed="outro" n={70} />
      <Dust x={960} L={burst * 1.6} seed="burst" n={40} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {/* Знак: части собираются по очереди, знак «садится» на место */}
        <div style={{ transform: `scale(${markScale})`, marginBottom: 4, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 420, height: 420, marginLeft: -210, marginTop: -210, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(255,226,180,${0.22 * part3}), rgba(255,226,180,0))`, pointerEvents: 'none' }} />
          <svg viewBox="0 0 32 32" width={150} height={150} fill="none" style={{ display: 'block', overflow: 'visible', position: 'relative' }}>
            <g style={{ transform: `translate(0, ${(1 - part1) * -70}px)`, opacity: part1 }}>
              <circle cx="16" cy="6" r="3.2" fill={C.accent} />
            </g>
            <g style={{ transform: `translate(0, ${(1 - part2) * 70}px) scale(${0.6 + 0.4 * part2})`, transformOrigin: '16px 21px', opacity: part2 }}>
              <path d="M16 10.5C16 10.5 9 13.8 7.5 21C6 28 11.5 29.5 14.5 28C17.5 26.5 16 22.5 16 22.5C16 22.5 14.5 26.5 17.5 28C20.5 29.5 26 28 24.5 21C23 13.8 16 10.5 16 10.5Z" fill={C.accent} />
            </g>
            <g style={{ opacity: part3 }}>
              <path d="M11 15.5C11 15.5 8 12.5 5 14" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M21 15.5C21 15.5 24 12.5 27 14" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* Словесная марка: латиница, поэтому Playfair в любой локали */}
        <div style={{ fontFamily: 'Playfair Display', fontWeight: 900, fontSize: 118, color: C.ivory, letterSpacing: '-0.01em', opacity: wordO, transform: `translateY(${(1 - word) * 24}px)`, textShadow: '0 20px 50px rgba(0,0,0,.8)', lineHeight: 1 }}>
          {'ArtDance'.split('').map((ch, i) => {
            const d = s + 32 + i * 2;
            const os = pr(f, d, d + 14);
            return (
              <span key={i} style={{ display: 'inline-block', opacity: os, filter: `blur(${(1 - os) * 14}px)`, transform: `translateY(${(1 - os) * 30}px)` }}>
                {ch}
              </span>
            );
          })}
        </div>

        <div style={{ fontFamily: fonts.display, fontSize: 32, color: C.metal, opacity: tagline, marginTop: 20, letterSpacing: '0.06em' }}>
          {copy.tagline}
        </div>

        {/* Нить отделяет теглайн от фактов. Отступы с обеих сторон, иначе линия
            прилипает к тексту и читается как зачёркивание. */}
        <div style={{ width: 640 * pr(f, s + 74, s + 96, Easing.inOut(Easing.cubic)), height: 1.5, background: C.metal, opacity: 0.8, marginTop: 40, marginBottom: 48 }} />

        <div style={{ display: 'flex', gap: 84, alignItems: 'flex-start' }}>
          {copy.facts.map((fact, i) => (
            <Fact key={fact.label} label={fact.label} value={fact.value} accent={fact.accent} at={s + 88 + i * 8} locale={locale} />
          ))}
        </div>

        <div style={{ fontFamily: fonts.sans, fontWeight: 500, fontSize: 24, color: C.ivoryFaint, marginTop: 52, opacity: pr(f, s + 128, s + 150), letterSpacing: '0.08em' }}>
          {copy.footer}
        </div>
      </AbsoluteFill>

      <Lens shake={0.7} vignette={0.55} />
    </AbsoluteFill>
  );
};
