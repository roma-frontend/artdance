/**
 * РОЛИК ЦЕЛИКОМ: хук → шесть этапов → финал.
 *
 * Свет и звук идут от одного источника — `levels.json` (покадровые bass/mid/high
 * трека) и `beats.json` (доли). Поэтому смены попадают в музыку, а не в
 * равные интервалы, а прожектор дышит в такт.
 *
 * Склейки между этапами — не fade: свет на сцене гаснет на сильной доле,
 * подпись уходит расфокусом, следующая сцена входит с новой раскладкой.
 *
 * Локаль приходит пропсом и одна на весь ролик: смешивать языки в одном
 * ролике нельзя, а три версии — три отдельные композиции (см. `Root.tsx`).
 */

import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import levels from './levels.json';
import beats from './beats.json';
import { C } from './brand';
import { fontFaces } from './fonts';
import type { Locale } from './locales';
import { COPY } from './locales';
import { Intro } from './Intro';
import { Outro } from './Outro';
import { StageScene } from './Stage';
import { Backdrop, StageFloor } from './World';
import { FINALE, INTRO_END, STAGES } from './stages';

/** Покадровый bass из `levels.json`, сглаженный. Свет не должен дёргаться. */
const bass = (f: number) => {
  const i = Math.max(0, Math.min(levels.bass.length - 1, Math.round(f)));
  const a = levels.bass[i] ?? 0;
  const b = levels.bass[Math.min(levels.bass.length - 1, i + 1)] ?? a;
  return (a + b) / 2;
};

/**
 * Ближайшая доля после кадра `f` — по ней ставим события (удар света, звук).
 * Если брать просто `f`, событие промахивается мимо музыки на 1–3 кадра,
 * и это слышно.
 */
const nextBeat = (f: number) => {
  const sec = f / 30;
  const b = beats.beats.find((x) => x > sec) ?? sec;
  return Math.round(b * 30);
};

export const ArtDance: React.FC<{ locale: Locale }> = ({ locale }) => {
  const f = useCurrentFrame();
  const copy = COPY[locale];

  // Глобальный «вдох» света по музыке
  const b = bass(f);

  return (
    <AbsoluteFill style={{ background: C.inkDeep }}>
      <style>{fontFaces}</style>

      {/* Пол сцены — самый нижний слой: задники кладутся поверх него */}
      <Sequence from={0} durationInFrames={FINALE.start + 20} name="floor">
        <StageFloor />
      </Sequence>

      {/* Задник: меняется вместе с этапом, на склейке уходит в черноту */}
      {STAGES.map((st) => (
        <Sequence key={st.n} from={st.start} durationInFrames={st.end - st.start + 14} name={`bg-${st.n}`}>
          <Backdrop src={st.backdrop} from={st.from} opacity={0.72} blur={7} />
        </Sequence>
      ))}

      {/* Затемнение на склейках: гаснет на доле, входит в следующую сцену */}
      {STAGES.slice(1).map((st) => {
        const at = st.start;
        const dark = interpolate(f, [at - 16, at - 2, at + 10, at + 26], [0, 0.92, 0.92, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return <AbsoluteFill key={`dark-${st.n}`} style={{ background: C.inkDeep, opacity: dark, pointerEvents: 'none' }} />;
      })}

      <Sequence from={0} durationInFrames={INTRO_END} name="intro">
        <Intro copy={copy} locale={locale} />
      </Sequence>

      {STAGES.map((st, i) => (
        <Sequence key={st.n} from={st.start} durationInFrames={st.end - st.start} name={st.n}>
          <StageScene stage={st} copy={copy.stages[i]!} locale={locale} bass={b} />
        </Sequence>
      ))}

      <Sequence from={FINALE.start} durationInFrames={FINALE.end - FINALE.start} name="finale">
        <Outro copy={copy} locale={locale} />
      </Sequence>

      {/* Музыка: окно трека, обрезанное под длину ролика */}
      <Audio src={staticFile('track.mp3')} volume={0.62} />

      {/* Звук на событиях: тише трека на ~20 dB, только на смысловых точках */}
      <Audio src={staticFile('sfx/whoosh.wav')} volume={0.13} />
      {STAGES.map((st, i) => (
        <Sequence key={`sfx-${st.n}`} from={nextBeat(st.start)} durationInFrames={20} name={`sfx-${st.n}`}>
          <Audio src={staticFile(i === 0 ? 'sfx/riser.wav' : 'sfx/impact.wav')} volume={i === 0 ? 0.1 : 0.16} />
        </Sequence>
      ))}
      {STAGES.map((st) => (
        <Sequence key={`tick-${st.n}`} from={st.start + 14} durationInFrames={30} name={`tick-${st.n}`}>
          <Audio src={staticFile('sfx/tick.wav')} volume={0.09} />
        </Sequence>
      ))}
      <Sequence from={FINALE.start + 20} durationInFrames={40} name="sfx-finale">
        <Audio src={staticFile('sfx/impact.wav')} volume={0.17} />
      </Sequence>
    </AbsoluteFill>
  );
};
