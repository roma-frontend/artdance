/**
 * Выбор источника фоновой петли по способности устройства его декодировать.
 *
 * **Зачем это нужно.** Браузер берёт первый `<source>`, который «поддерживает», и
 * поддержка здесь означает только «умею декодировать», а не «умею декодировать
 * аппаратно». AV1 у нас самый лёгкий по весу (605 KB против 1,1 МБ у H.264), но
 * аппаратный декодер AV1 есть лишь у относительно новых GPU. На остальных
 * машинах браузер честно выбирает AV1 и декодирует его на процессоре — и тогда
 * фоновая петля, которая должна быть незаметной, начинает съедать кадры и
 * дёргаться. Экономия 500 KB трафика не стоит рывков на каждом просмотре.
 *
 * Поэтому источник выбирается через `navigator.mediaCapabilities`: он отвечает
 * не «поддерживается ли», а `smooth` (успеет ли в реальном времени) и
 * `powerEfficient` (аппаратный ли путь). Приоритет: аппаратный и плавный →
 * плавный → любой поддерживаемый в исходном порядке (он идёт от самого лёгкого к
 * самому совместимому, и H.264 в конце декодируется аппаратно почти везде).
 *
 * Параметры запроса — из `videoProcessing.heroLoop`: те же ширина, высота, fps и
 * битрейт, с которыми файл закодирован. Спрашивать про случайные числа
 * бессмысленно: ответ зависит именно от них.
 */

import { videoProcessing } from '@/config/media-processing';
import type { VideoFormat } from '@/domain/content';

/** MIME-типы источников. Единственное место, где они объявлены. */
export const videoMimeByFormat: Record<VideoFormat, string> = {
  av1: 'video/mp4; codecs=av01.0.05M.08',
  vp9: 'video/webm; codecs=vp9',
  h264: 'video/mp4; codecs=avc1.640028',
};

export interface VideoSourceChoice {
  format: VideoFormat;
  url: string;
}

interface DecodeVerdict extends VideoSourceChoice {
  smooth: boolean;
  powerEfficient: boolean;
}

/**
 * Лучший источник для этого устройства. `null` — ни один не поддерживается
 * (тогда на экране остаётся постер, и это рабочее состояние).
 */
export async function pickDecodableSource(
  sources: readonly VideoSourceChoice[],
): Promise<VideoSourceChoice | null> {
  if (sources.length === 0) return null;

  const capabilities = globalThis.navigator?.mediaCapabilities;
  /*
   * Без API выбираем последний источник, а не первый: порядок идёт от самого
   * лёгкого к самому совместимому, и «совместимый» здесь важнее — угадывать
   * наличие аппаратного AV1 вслепую хуже, чем взять H.264.
   */
  if (!capabilities?.decodingInfo) return sources.at(-1) ?? null;

  const { maxWidth, maxHeight, targetFps, bitrateKbps } = videoProcessing.heroLoop;

  const verdicts = await Promise.all(
    sources.map(async (source): Promise<DecodeVerdict | null> => {
      try {
        const info = await capabilities.decodingInfo({
          type: 'file',
          video: {
            contentType: videoMimeByFormat[source.format],
            width: maxWidth,
            height: maxHeight,
            bitrate: bitrateKbps[source.format] * 1_000,
            framerate: targetFps,
          },
        });
        if (!info.supported) return null;
        return { ...source, smooth: info.smooth, powerEfficient: info.powerEfficient };
      } catch {
        /* Некоторые браузеры бросают на незнакомой конфигурации — считаем «не знаем». */
        return null;
      }
    }),
  );

  const supported = verdicts.filter((verdict): verdict is DecodeVerdict => verdict !== null);
  if (supported.length === 0) return sources.at(-1) ?? null;

  return (
    supported.find((verdict) => verdict.smooth && verdict.powerEfficient) ??
    supported.find((verdict) => verdict.smooth) ??
    supported[0] ??
    null
  );
}
