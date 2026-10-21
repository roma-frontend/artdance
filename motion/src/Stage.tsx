/**
 * СЦЕНА ЭТАПА — общая для всех шести: подпись, карточки данных, свет.
 *
 * Один каркас, но раскладка у каждого этапа своя (`layout`), а заголовок
 * масштабируется под язык (`TITLE_SCALE`): армянский и английский шире
 * русского, и без масштаба заголовок уходит за кадр.
 *
 * Все элементы держатся внутри `SAFE` — отступ 120 px от краёв. Раньше
 * колонка карточек в раскладке `right` начиналась с 1290 px при ширине 660,
 * то есть заканчивалась на 1950 при кадре 1920: значения обрезались.
 */

import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, Loop, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './brand';
import { COL_W, SAFE, type StageTiming } from './stages';
import type { Locale, StageCopy } from './locales';
import { FONTS, TITLE_SCALE } from './locales';
import { Lens, Spot } from './World';

const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pr = (f: number, a: number, b: number, e = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...cl, easing: e });

const hexA = (hex: string, a: number) => {
  const v = hex.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`;
};

/**
 * Колонка карточек в раскладках right / left.
 *
 * `right` — подпись слева, карточки у правого края; `left` — зеркально.
 * Раньше обе раскладки ставили карточки на `SAFE.x`, то есть в `left` они
 * ложились ровно под подпись и сцена читалась как одна колонка.
 */
const colLeft = (layout: 'right' | 'left') => (layout === 'right' ? SAFE.right - COL_W : SAFE.x);

/** Подпись в `left` уходит к правому краю и выравнивается по правому краю. */
const capSide = (layout: 'right' | 'left') =>
  layout === 'right' ? { x: SAFE.x, align: 'left' as const } : { x: SAFE.x + (SAFE.right - SAFE.x) - COL_W, align: 'left' as const };

/**
 * Плашка этапа: номер, заголовок, подзаголовок.
 * Выезжает слева с пружиной; золотая нить протягивается под номером.
 */
export const StageCaption: React.FC<{ stage: StageTiming; copy: StageCopy; locale: Locale; x?: number; y?: number; align?: 'left' | 'center' }> = ({ stage, copy, locale, x = SAFE.x, y = SAFE.top, align = 'left' }) => {
  const { fps } = useVideoConfig();
  // Сцена живёт внутри <Sequence from={stage.start}>, где кадр локальный.
  // Тайминги здесь абсолютные — переводим, иначе все подписи, кроме первой,
  // анимируются «до нуля» и не появляются.
  const f = useCurrentFrame() + stage.start;
  const s = stage.start;
  const num = spring({ frame: f - s, fps, config: { damping: 16, mass: 0.9, stiffness: 90 } });
  const ttl = spring({ frame: f - s - 4, fps, config: { damping: 17, mass: 1, stiffness: 100 } });
  const sub = pr(f, s + 12, s + 30);
  const out = pr(f, s + (stage.end - stage.start) - 12, s + (stage.end - stage.start) - 2, Easing.in(Easing.cubic));

  const isCenter = align === 'center';
  const fonts = FONTS[locale];
  const titleSize = 78 * TITLE_SCALE[locale];

  return (
    <div style={{ position: 'absolute', left: isCenter ? 0 : x, right: isCenter ? 0 : undefined, top: y, opacity: 1 - out, transform: `translateX(${(1 - num) * -70}px)`, textAlign: isCenter ? 'center' : 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, justifyContent: isCenter ? 'center' : 'flex-start' }}>
        <div style={{ fontFamily: fonts.sans, fontWeight: 800, fontSize: 62, lineHeight: 1, color: C.metal, letterSpacing: '-0.02em', opacity: num }}>{stage.n}</div>
        <div style={{ width: 74, height: 2, background: C.metal, transformOrigin: 'left', transform: `scaleX(${pr(f, s + 6, s + 26)})`, opacity: 0.85 }} />
      </div>
      <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: titleSize, lineHeight: 1.04, color: C.ivory, letterSpacing: '-0.015em', marginTop: 12, opacity: ttl, transform: `translateY(${(1 - ttl) * 26}px)`, textShadow: '0 18px 44px rgba(0,0,0,.85)' }}>
        {copy.title}
      </div>
      <div style={{ fontFamily: fonts.sans, fontWeight: 500, fontSize: 26, lineHeight: 1.4, color: C.ivoryMuted, marginTop: 14, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`, maxWidth: 820, marginLeft: isCenter ? 'auto' : 0, marginRight: isCenter ? 'auto' : 0, textShadow: '0 8px 22px rgba(0,0,0,.9)' }}>
        {copy.sub}
      </div>
    </div>
  );
};

/** Превью строки: видео-луп направления или фото. Живёт всё время показа. */
const RowThumb: React.FC<{ src: string; accent?: boolean; seed: number }> = ({ src, accent, seed }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isVideo = src.endsWith('.mp4');
  const zoom = 1.06 + Math.sin((f / fps) * 0.8 + seed) * 0.02;
  const media = isVideo ? (
    // Лупы направлений — 3.5 с, а сцена идёт 8 с: зацикливаем явно.
    // `loop` у OffthreadVideo требует конечной длительности, поэтому <Loop>.
    <Loop durationInFrames={Math.round(3.5 * fps)} layout="none">
      <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </Loop>
  ) : (
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  );
  return (
    <div style={{ position: 'relative', width: 92, height: 92, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${accent ? hexA(C.metal, 0.7) : 'rgba(247,244,239,.18)'}`, transform: `scale(${zoom})` }}>
      {media}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(11,10,9,.5))' }} />
    </div>
  );
};

/**
 * Строка данных: превью, подпись, значение.
 *
 * Подпись может сжиматься, значение — нет (`flexShrink: 0`): «20 000 ֏/час»
 * должно читаться целиком, а длинное имя площадки лучше усечь многоточием.
 */
const Row: React.FC<{ label: string; value: string; accent?: boolean; img?: string; at: number; offset: number; i: number; locale: Locale }> = ({ label, value, accent, img, at, offset, i, locale }) => {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame() + offset; // см. StageCaption: тайминги абсолютные
  const s = spring({ frame: f - at, fps, config: { damping: 15, mass: 0.85, stiffness: 110 } });
  const o = pr(f, at, at + 14);
  const col = accent ? C.metal : C.ivory;
  const fonts = FONTS[locale];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: img ? '12px 22px 12px 12px' : '20px 28px', marginBottom: 14,
        background: accent ? hexA(C.accent, 0.34) : 'rgba(20,18,16,.52)',
        border: `1.5px solid ${accent ? hexA(C.metal, 0.55) : 'rgba(247,244,239,.14)'}`,
        borderRadius: 14, backdropFilter: 'blur(6px)',
        opacity: o, transform: `translateX(${(1 - s) * 46}px)`,
        boxShadow: '0 20px 44px rgba(0,0,0,.45)',
      }}
    >
      {img && <RowThumb src={img} accent={accent} seed={i} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        {accent && !img && <div style={{ width: 9, height: 9, borderRadius: 9, background: C.metal, boxShadow: `0 0 16px ${C.metal}`, flexShrink: 0 }} />}
        <span style={{ fontFamily: fonts.sans, fontWeight: 500, fontSize: 27, color: accent ? C.ivory : C.ivoryMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <span style={{ fontFamily: fonts.sans, fontWeight: 700, fontSize: 27, color: col, whiteSpace: 'nowrap', flexShrink: 0 }}>{value}</span>
    </div>
  );
};

export type Layout = 'right' | 'left' | 'split' | 'grid';

/**
 * Сцена этапа целиком: свет, подпись, карточки данных, линза.
 *
 * `layout` меняет место подписи и карточек, чтобы шесть этапов не были копией:
 * right — подпись слева, карточки справа; left — зеркально;
 * split — подпись по центру сверху, карточки одной колонкой по центру;
 * grid — подпись по центру сверху, карточки сеткой 2×2.
 *
 * Всё держится внутри `SAFE` (отступ 120 px от краёв) и в колонке `COL_W`.
 * Двухколоночные раскладки занимают всю безопасную ширину: 1680 = 820 + 40 + 820.
 */
export const StageScene: React.FC<{ stage: StageTiming; copy: StageCopy; locale: Locale; bass: number }> = ({ stage, copy, locale, bass }) => {
  const f = useCurrentFrame() + stage.start;
  const layout = stage.layout;
  const L = 0.55 + bass * 0.75;
  const lightIn = pr(f, stage.start - 10, stage.start + 12);
  const cap = layout === 'split' || layout === 'grid' ? { x: 0, y: SAFE.top, align: 'center' as const } : { ...capSide(layout), y: SAFE.top };

  const rows = copy.rows.map((r, i) => (
    <Row key={r.label} label={r.label} value={r.value} accent={r.accent} img={r.img} at={stage.start + 14 + i * 5} offset={stage.start} i={i} locale={locale} />
  ));

  // Раскладки разведены по-настоящему: у каждой своя геометрия, иначе четыре
  // этапа подряд выглядят одним слайдом.
  //   right / left — подпись сбоку, карточки одной колонкой у противоположного края;
  //   split        — подпись по центру, карточки одной широкой колонкой по центру;
  //   grid         — подпись по центру, карточки сеткой 2×2.
  const centered = layout === 'split' || layout === 'grid';
  const cardsTop = layout === 'grid' ? 430 : layout === 'split' ? 500 : 560;

  return (
    <AbsoluteFill>
      <Spot x={layout === 'left' ? 1520 : 400} L={L * lightIn} groundY={1000} w={430} />
      <Spot x={layout === 'left' ? 380 : 1560} L={L * lightIn * 0.45} groundY={1010} w={300} color="180,200,255" />
      {!centered && (
        // Нить идёт под подписью: в `left` подпись справа, поэтому и нить справа.
        <div style={{ position: 'absolute', left: cap.x, top: 330, width: 700, height: 2, background: C.metal, opacity: 0.85, transformOrigin: 'left', transform: `scaleX(${pr(f, stage.start + 6, stage.start + 28)})` }} />
      )}

      <StageCaption stage={stage} copy={copy} locale={locale} {...cap} />

      {layout === 'grid' ? (
        <div style={{ position: 'absolute', left: SAFE.x, top: cardsTop, width: SAFE.right - SAFE.x, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40 }}>{rows}</div>
      ) : layout === 'split' ? (
        // Одна колонка по центру: ширина как у боковой, иначе «подпись —
        // значение» разъезжаются по краям и строка перестаёт читаться парой.
        <div style={{ position: 'absolute', left: (SAFE.x + SAFE.right) / 2 - COL_W / 2, top: cardsTop, width: COL_W }}>{rows}</div>
      ) : (
        <div style={{ position: 'absolute', left: colLeft(layout), top: cardsTop, width: COL_W }}>{rows}</div>
      )}

      <Lens shake={0.9} vignette={0.5} />
    </AbsoluteFill>
  );
};
