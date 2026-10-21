/**
 * ХУК — первые 4 секунды.
 *
 * Задача хука: зал должен понять, о чём ролик, до того как пойдут этапы.
 * Поэтому здесь одна фраза и один образ — занавес расходится, луч выхватывает
 * сцену. Слова появляются по одному, а не строкой целиком: строка, выехавшая
 * разом, читается как титр, а не как речь.
 *
 * Фраза приходит из `locales.ts` и переставляется под язык: у английского
 * хук длиннее, у армянского шире по глифам, поэтому размер подбирается по
 * длине строки, а не задан числом.
 */

import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';
import type { Copy, Locale } from './locales';
import { FONTS } from './locales';
import { Dust, Lens, Spot } from './World';

const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pr = (f: number, a: number, b: number, e = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...cl, easing: e });

/** Половина занавеса. Бархат брендового бургунди, уходит в черноту у края. */
const Curtain: React.FC<{ side: 'l' | 'r'; p: number }> = ({ side, p }) => {
  const dir = side === 'l' ? -1 : 1;
  return (
    <div
      style={{
        position: 'absolute', top: 0, bottom: 0, [side === 'l' ? 'left' : 'right']: 0, width: '54%',
        transform: `translateX(${dir * p * 62}%)`,
        background: `linear-gradient(${side === 'l' ? '90deg' : '270deg'}, ${C.inkDeep} 0%, #2A0D14 34%, ${C.accent} 72%, #4A1119 100%)`,
        boxShadow: '0 0 140px rgba(0,0,0,.9)',
      }}
    >
      {/* Складки бархата: вертикальные полосы разной плотности */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,.42) 0px, rgba(0,0,0,0) 16px, rgba(0,0,0,.28) 34px, rgba(0,0,0,0) 58px)', opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.7) 100%)' }} />
    </div>
  );
};

/**
 * Размер строки хука под длину текста.
 *
 * Числом задавать нельзя: русское «Танцы Армении» — 13 знаков, английское
 * "Armenia's dance scene" — 21, армянское «Հայաստանի պարը» — 14. Но длина
 * в знаках ещё не ширина: армянские глифы заметно шире латинских, поэтому
 * для hy нужен отдельный коэффициент, иначе строка выходит за кадр.
 *
 * Ширина кадра 1920, безопасное поле 120 с каждой стороны — 1680 px.
 * Замер по факту: при 122 px строка hy занимает ~1830 px, отсюда 0.82.
 */
const WIDTH_FACTOR: Record<Locale, number> = { ru: 1, en: 1, hy: 0.82 };

const fitSize = (text: string, locale: Locale, base = 132, maxChars = 13) =>
  Math.min(base, (base * maxChars) / Math.max(text.length, 1)) * WIDTH_FACTOR[locale];

export const Intro: React.FC<{ copy: Copy; locale: Locale }> = ({ copy, locale }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fonts = FONTS[locale];

  // Занавес: медленно, с торможением — это зал, а не слайд
  const open = pr(f, 6, 62, Easing.inOut(Easing.cubic));
  // Свет вспыхивает после того, как створки разошлись
  const light = pr(f, 26, 60);
  const L = light * (0.72 + Math.sin(f / 9) * 0.06);

  const w1 = copy.hookLine1.split(' ');
  const w2 = copy.hookLine2.split(' ');
  // Английский длиннее, армянский шире по глифам — кегль считается под каждый язык
  const size1 = fitSize(copy.hookLine1, locale);
  const size2 = fitSize(copy.hookLine2, locale);

  const out = pr(f, 108, 120, Easing.in(Easing.cubic));

  return (
    <AbsoluteFill style={{ background: C.inkDeep }}>
      <Spot x={960} L={L} groundY={1040} w={470} />
      <Spot x={960} L={L * 0.5} groundY={1050} w={780} color="255,236,205" />
      <Dust x={960} L={L} seed="intro" n={60} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 620, textAlign: 'center', opacity: 1 - out }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 400, fontSize: 40, letterSpacing: '0.42em', color: C.metal, textTransform: 'uppercase', opacity: pr(f, 34, 56), marginBottom: 26 }}>
          ArtDance
        </div>
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: size1, lineHeight: 1.05, color: C.ivory, letterSpacing: '-0.02em', textShadow: '0 24px 60px rgba(0,0,0,.85)' }}>
          {w1.map((w, i) => {
            const s = spring({ frame: f - 40 - i * 6, fps, config: { damping: 18, mass: 1, stiffness: 95 } });
            const o = pr(f, 40 + i * 6, 58 + i * 6);
            return (
              <span key={i} style={{ display: 'inline-block', opacity: o, filter: `blur(${(1 - o) * 12}px)`, transform: `translateY(${(1 - s) * 34}px)`, marginRight: '0.24em' }}>
                {w}
              </span>
            );
          })}
          <br />
          <em style={{ fontStyle: 'italic', color: C.metal, fontSize: size2 }}>
            {w2.map((w, i) => {
              const d = 60 + i * 8;
              const s = spring({ frame: f - d, fps, config: { damping: 18, mass: 1, stiffness: 95 } });
              const o = pr(f, d, d + 18);
              return (
                <span key={i} style={{ display: 'inline-block', opacity: o, filter: `blur(${(1 - o) * 12}px)`, transform: `translateY(${(1 - s) * 34}px)`, marginRight: '0.24em' }}>
                  {w}
                </span>
              );
            })}
          </em>
        </div>
        <div style={{ fontFamily: fonts.sans, fontWeight: 500, fontSize: 28, color: C.ivoryMuted, marginTop: 34, opacity: pr(f, 78, 100) }}>
          {copy.hookList}
        </div>
      </div>

      <Curtain side="l" p={open} />
      <Curtain side="r" p={open} />
      <Lens shake={1.1} vignette={0.62} />
    </AbsoluteFill>
  );
};
