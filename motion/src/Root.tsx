/**
 * ТРИ КОМПОЗИЦИИ — по одной на локаль.
 *
 * Отдельные композиции, а не пропс на рендере: так в Studio видно все три
 * версии рядом, и `--props` не нужен. Имя = язык: `ArtDance-ru`, `ArtDance-en`,
 * `ArtDance-hy`.
 */

import React from 'react';
import { Composition } from 'remotion';
import { ArtDance } from './ArtDance';
import { LOCALES } from './locales';
import { DURATION } from './stages';

export const RemotionRoot: React.FC = () => (
  <>
    {LOCALES.map((locale) => (
      <Composition
        key={locale}
        id={`ArtDance-${locale}`}
        component={ArtDance}
        durationInFrames={DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ locale }}
      />
    ))}
  </>
);
