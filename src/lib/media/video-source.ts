/**
 * Выбор источника фоновой петли: сначала по ширине экрана, затем по способности
 * устройства декодировать файл аппаратно.
 *
 * **Почему ширина решается раньше формата.** У петли несколько версий кадра
 * (`videoLoopPolicy[…].renditions`), и разница между ними больше, чем между
 * кодеками. Кадр первого экрана рисуется шириной 135% от окна: на мониторе 1440
 * это 1944 пикселя, и версия в 1280 растягивалась там в полтора раза — мыло,
 * которое никаким битрейтом не лечится. На телефоне ровно наоборот: кадр
 * занимает около 560 пикселей, и версия в 1920 была бы мегабайтом, скачанным,
 * чтобы выбросить три четверти пикселей.
 *
 * **Почему формат не берётся просто первым.** Браузер выбирает первый `<source>`,
 * который «поддерживает», и поддержка здесь означает только «умею декодировать»,
 * а не «умею декодировать аппаратно». AV1 самый лёгкий по весу, но аппаратный
 * декодер AV1 есть лишь у относительно новых GPU. На остальных машинах браузер
 * честно выбирает AV1 и декодирует его на процессоре — и тогда фоновая петля,
 * которая должна быть незаметной, начинает съедать кадры и дёргаться. Экономия
 * трафика не стоит рывков на каждом просмотре.
 *
 * Поэтому формат выбирается через `navigator.mediaCapabilities`: он отвечает не
 * «поддерживается ли», а `smooth` (успеет ли в реальном времени) и
 * `powerEfficient` (аппаратный ли путь). Приоритет: аппаратный и плавный →
 * плавный → любой поддерживаемый в исходном порядке (он идёт от самого лёгкого к
 * самому совместимому, и H.264 в конце декодируется аппаратно почти везде).
 *
 * Параметры запроса берутся из политики ТОЙ ЖЕ версии кадра: спрашивать про
 * случайные числа бессмысленно, ответ зависит именно от разрешения и битрейта, с
 * которыми файл закодирован.
 */

import { videoLoopPolicy, type VideoLoopKey } from '@/config/media-processing';
import type { VideoFormat } from '@/domain/content';

/** MIME-типы источников. Единственное место, где они объявлены. */
export const videoMimeByFormat: Record<VideoFormat, string> = {
  av1: 'video/mp4; codecs=av01.0.05M.08',
  vp9: 'video/webm; codecs=vp9',
  h264: 'video/mp4; codecs=avc1.640028',
};

export interface VideoSourceChoice {
  format: VideoFormat;
  /** Ширина кадра в пикселях: по ней отбирается версия под экран. */
  width: number;
  url: string;
}

interface DecodeVerdict extends VideoSourceChoice {
  smooth: boolean;
  powerEfficient: boolean;
}

/**
 * Версия кадра для текущего окна: последняя из политики, чей порог не превышает
 * ширину окна. Порядок в политике — по возрастанию, поэтому перебор идёт с конца.
 *
 * Ширина окна, а не размер самого элемента: элемент к моменту выбора может ещё не
 * иметь итоговых размеров, а решение нужно до первого байта.
 */
function renditionWidthFor(loop: VideoLoopKey): number {
  const { renditions } = videoLoopPolicy[loop];
  const viewport = globalThis.window?.innerWidth ?? 0;

  const suitable = [...renditions]
    .sort((a, b) => a.minViewportWidth - b.minViewportWidth)
    .filter((rendition) => viewport >= rendition.minViewportWidth)
    .at(-1);

  /* Окно уже самого мелкого порога быть не может, но подстраховка дешевле сбоя. */
  return (suitable ?? renditions[0]!).width;
}

/** Битрейт, с которым закодирована версия этой ширины — для запроса к устройству. */
function bitrateFor(loop: VideoLoopKey, width: number, format: VideoFormat): number {
  const { renditions } = videoLoopPolicy[loop];
  const rendition = renditions.find((item) => item.width === width) ?? renditions.at(-1)!;
  return rendition.bitrateKbps[format];
}

/** Высота версии этой ширины. Нужна тому же запросу. */
function heightFor(loop: VideoLoopKey, width: number): number {
  const { renditions } = videoLoopPolicy[loop];
  return (renditions.find((item) => item.width === width) ?? renditions.at(-1)!).height;
}

/**
 * Лучший источник для этого устройства. `null` — ни один не поддерживается
 * (тогда на экране остаётся постер, и это рабочее состояние).
 */
export async function pickDecodableSource(
  sources: readonly VideoSourceChoice[],
  loop: VideoLoopKey,
): Promise<VideoSourceChoice | null> {
  if (sources.length === 0) return null;

  /*
   * Отбор по ширине идёт до всего остального.
   *
   * Берётся не «точно такая ширина», а самая узкая из доступных, которая не уже
   * нужной: закодированная ширина равна `min(ширина исходника, ширина версии)`, и
   * у исходника 720p широкая версия окажется файлом 1280. Если ничего подходящего
   * нет вовсе, берётся самая широкая из имеющихся — лучше показать кадр не той
   * ширины, чем не показать ничего.
   */
  const targetWidth = renditionWidthFor(loop);
  const widths = [...new Set(sources.map((source) => source.width))].sort((a, b) => a - b);
  const chosenWidth = widths.find((width) => width >= targetWidth) ?? widths.at(-1)!;
  const candidates = sources.filter((source) => source.width === chosenWidth);

  const capabilities = globalThis.navigator?.mediaCapabilities;
  /*
   * Без API выбираем последний источник, а не первый: порядок идёт от самого
   * лёгкого к самому совместимому, и «совместимый» здесь важнее — угадывать
   * наличие аппаратного AV1 вслепую хуже, чем взять H.264.
   */
  if (!capabilities?.decodingInfo) return candidates.at(-1) ?? null;

  const { targetFps } = videoLoopPolicy[loop];
  const height = heightFor(loop, chosenWidth);

  const verdicts = await Promise.all(
    candidates.map(async (source): Promise<DecodeVerdict | null> => {
      try {
        const info = await capabilities.decodingInfo({
          type: 'file',
          video: {
            contentType: videoMimeByFormat[source.format],
            width: source.width,
            height,
            bitrate: bitrateFor(loop, source.width, source.format) * 1_000,
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
  if (supported.length === 0) return candidates.at(-1) ?? null;

  return (
    supported.find((verdict) => verdict.smooth && verdict.powerEfficient) ??
    supported.find((verdict) => verdict.smooth) ??
    supported[0] ??
    null
  );
}
