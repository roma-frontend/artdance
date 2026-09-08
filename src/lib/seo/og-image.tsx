/**
 * КАРТОЧКА ССЫЛКИ ДЛЯ СОЦСЕТЕЙ — один рендерер на все `opengraph-image`.
 *
 * Зачем вообще (A-23 в бэклоге): ссылками делятся в WhatsApp и Telegram, и
 * превью решает, откроют её или пролистают. До этой задачи `og:image` на КАЖДОЙ
 * странице сайта указывал на `/media/og/default.jpg`, которого в `public` нет,
 * то есть превью не было вовсе — мессенджер показывал ссылку строкой.
 *
 * Три решения, каждое из которых стоило проверки на живом рендере.
 *
 * **1. Фотография попадает на карточку через `sharp`, а не напрямую.** Движок
 * отрисовки (satori внутри `next/og`) понимает только PNG, APNG, JPEG, GIF и
 * SVG — список зашит в него константой. Весь наш сид и всё, что загружают
 * пользователи, — WebP и AVIF: конвейер `lib/media/ingest.ts` специально их и
 * делает. Поэтому кадр читается с диска (или из бакета), пережимается в JPEG и
 * передаётся движку буфером. Держать вторую, «социальную» копию каждой
 * фотографии в JPEG было бы дешевле по процессору, но это второй набор файлов в
 * деплое и второй конвейер, который однажды разойдётся с первым.
 *
 * **2. Отсутствие или сбой кадра не ломает ни сборку, ни превью.** Картинки
 * прерисовываются на сборке для всех известных адресов; исключение внутри
 * означало бы упавший `next build` из-за одного битого файла. Поэтому неудача
 * логируется предупреждением, а карточка собирается типографской: тёмная
 * плоскость, диагональная вуаль с акцентом, тот же текст. Это не заглушка, а
 * полноценный второй вариант — у правовых документов и справки фотографии нет и
 * не будет.
 *
 * **3. Цвета и раскладка приходят из токенов и конфигурации.** Литералов здесь
 * нет: цвета — семантические роли (`darkColors`), вуали — `raw.scrim`, кегли и
 * отступы — `seo.openGraph.card`. Карточка обязана выглядеть как сайт, а не
 * «примерно так же».
 *
 * Про шрифты и про то, почему их копия лежит в репозитории, — README рядом с
 * файлами: `src/design/og-fonts/README.md`.
 */

import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { mediaUrl, seo, site } from '@/config';
import { mediaProcessing } from '@/config/media-processing';
import { seedMediaPath } from '@/design/seed-media';
import { darkColors, raw } from '@/design/tokens';

const card = seo.openGraph.card;

/** Размер и тип отдаются маршрутами как есть: Next ждёт именно эти экспорты. */
export const ogImageSize = {
  width: seo.openGraph.imageWidth,
  height: seo.openGraph.imageHeight,
} as const;

export const ogImageContentType = 'image/png';

/**
 * Текстовая альтернатива картинки (`og:image:alt`).
 *
 * Название бренда, а не описание сюжета, и это осознанно: заголовок и описание
 * страницы уже уехали в `og:title` и `og:description`, а сама карточка содержит
 * тот же текст набором. Дублировать его третий раз — шум; сообщить, что это
 * карточка ArtDance, полезно. Значение не переводится, потому что имя бренда
 * одинаково во всех локалях.
 */
export const ogImageAlt = site.name;

/* ─────────────────────────────── Шрифты ─────────────────────────────── */

const FONT_DIR = join(process.cwd(), 'src', 'design', 'og-fonts');

/**
 * Латиница и кириллица объявлены разными семействами при одной гарнитуре.
 *
 * Не стилистическое решение, а обход поведения движка: два файла под одним
 * именем и с одинаковым начертанием не складываются в общий набор глифов —
 * побеждает первый, и русский заголовок молча уезжает в системный шрифт. Разные
 * имена в цепочке `fontFamily` дают подбор по глифам, что и нужно.
 */
const fontSources = [
  { file: 'playfair-display-latin-400-normal.woff', name: 'Display', weight: 400 },
  { file: 'playfair-display-latin-700-normal.woff', name: 'Display', weight: 700 },
  { file: 'playfair-display-cyrillic-400-normal.woff', name: 'DisplayCyrillic', weight: 400 },
  { file: 'playfair-display-cyrillic-700-normal.woff', name: 'DisplayCyrillic', weight: 700 },
  { file: 'noto-sans-armenian-armenian-400-normal.woff', name: 'Armenian', weight: 400 },
  { file: 'noto-sans-armenian-armenian-700-normal.woff', name: 'Armenian', weight: 700 },
] as const;

/**
 * Порядок цепочки — порядок подбора глифов.
 *
 * Армянский идёт последним, но участвует во всех локалях: знак драма (֏) есть
 * только в нём, а цена стоит на карточке и в русской, и в английской версии.
 */
const FONT_STACK = 'Display, DisplayCyrillic, Armenian';

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

/**
 * Файлы читаются один раз на процесс.
 *
 * На сборке рендерится несколько десятков карточек; без кеша это несколько сотен
 * чтений одних и тех же ста килобайт.
 */
let fontsPromise: Promise<LoadedFont[]> | undefined;

function ogFonts(): Promise<LoadedFont[]> {
  fontsPromise ??= Promise.all(
    fontSources.map(async (source) => ({
      name: source.name,
      data: toArrayBuffer(await readFile(join(FONT_DIR, source.file))),
      weight: source.weight,
      style: 'normal' as const,
    })),
  );

  return fontsPromise;
}

/**
 * `Buffer` → `ArrayBuffer`.
 *
 * Движок читает и картинку, и шрифт через `DataView`, а тот отказывается
 * работать с `Buffer`: «First argument to DataView constructor must be an
 * ArrayBuffer». Срез по границам нужен потому, что `Buffer` — это окно в общий
 * пул памяти, и `buffer` без смещения вернёт чужие байты вместе со своими.
 *
 * Копия делается через `Uint8Array`, а не срезом `buffer.buffer`: тип поля —
 * `ArrayBuffer | SharedArrayBuffer`, и разделяемая память здесь недопустима.
 */
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

/* ─────────────────────────────── Фотография ─────────────────────────────── */

/**
 * Байты исходного кадра по ссылке на медиа.
 *
 * Два источника, как и у компонента `Media`: сид-ассет лежит в `public` (на
 * сборке его читают с диска — HTTP-запроса к самому себе тогда просто некуда
 * сделать), остальное приходит из бакета по абсолютному адресу.
 */
async function sourceBytes(key: string): Promise<Buffer | null> {
  const seed = seedMediaPath(key);
  if (seed) return readFile(join(process.cwd(), 'public', seed));

  const url = mediaUrl(key);
  if (url.startsWith('/')) return readFile(join(process.cwd(), 'public', url));

  if (url.startsWith('http')) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  return null;
}

/**
 * Кадр, пережатый под карточку, или `null`.
 *
 * `null` вместо исключения: карточка без фотографии — законный вариант, а
 * упавшая сборка из-за одного файла — нет. Причина сбоя уходит в предупреждение,
 * которое переживает продакшен-сборку (`removeConsole` оставляет `warn`).
 */
async function cardPhoto(key: string | null | undefined): Promise<ArrayBuffer | null> {
  if (!key) return null;

  try {
    const source = await sourceBytes(key);
    if (!source) return null;

    const jpeg = await sharp(source)
      .resize(ogImageSize.width, ogImageSize.height, { fit: 'cover' })
      /*
       * Кадр гасится здесь, а не вуалью поверх: фильтра `brightness` у движка
       * отрисовки нет, а вуаль, достаточная для светлого снимка, съела бы
       * фотографию на тёмном. Причина и значение — `card.photoBrightness`.
       */
      .modulate({ brightness: card.photoBrightness })
      .jpeg({ quality: mediaProcessing.quality.jpeg })
      .toBuffer();

    return toArrayBuffer(jpeg);
  } catch (error) {
    console.warn(`[og] кадр «${key}» не удалось подготовить: ${String(error)}`);
    return null;
  }
}

/* ─────────────────────────────── Карточка ─────────────────────────────── */

export interface OgCardInput {
  /**
   * Надзаголовок: направление занятия, тип события, район площадки. Отвечает на
   * вопрос «что это», пока заголовок отвечает «что именно».
   */
  eyebrow?: string;
  title: string;
  /**
   * Детали одной строкой: инструктор, зал, дата, цена. Пустые значения
   * отбрасываются — «· ·» в превью читается как поломка.
   */
  meta?: ReadonlyArray<string | null | undefined>;
  /** Метка вида сущности: «Занятие», «Преподаватель», «Событие». */
  kind?: string;
  /** Ключ сид-ассета или объекта в бакете. Отсутствие — типографская карточка. */
  imageKey?: string | null;
}

export async function renderOgCard(input: OgCardInput): Promise<ImageResponse> {
  const [fonts, photo] = await Promise.all([ogFonts(), cardPhoto(input.imageKey)]);

  const title = truncate(input.title, seo.limits.ogTitleMax);
  const eyebrow =
    input.eyebrow === undefined ? '' : truncate(input.eyebrow, card.eyebrowMax);
  const meta = truncate(
    (input.meta ?? [])
      .filter((part): part is string => Boolean(part && part.length > 0))
      .join(' · '),
    card.metaMax,
  );

  const titleSize =
    title.length > card.titleLongThreshold ? card.titleSizeLong : card.titleSize;

  return new ImageResponse(
    (
      <div
        style={{
          width: `${ogImageSize.width}px`,
          height: `${ogImageSize.height}px`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          padding: `${card.padding}px`,
          backgroundColor: darkColors['surface-cinema'],
          color: darkColors['content-on-cinema'],
          fontFamily: FONT_STACK,
        }}
      >
        {photo === null ? (
          /*
           * Без фотографии — та же диагональная вуаль, что держит первый экран
           * главной: тёмный левый верх, акцент в правом нижнем углу. Плоский
           * прямоугольник читался бы как отсутствие картинки, а не как плакат.
           */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              backgroundImage: raw.scrim.heroDiagonal,
            }}
          />
        ) : (
          <>
            {/*
              `<img>`, а не `Media`: это не разметка страницы, а описание
              картинки для движка отрисовки — ни `next/image`, ни оптимизатор
              здесь не участвуют. `alt` пустой, потому что альтернативу несёт вся
              карточка целиком (`ogImageAlt` → `og:image:alt`).
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              /*
               * Буфер, а не адрес: на сборке HTTP-запроса к самому себе сделать
               * некуда, а движок принимает `ArrayBuffer` наравне с URL. Типы
               * `next/og` этого не описывают, отсюда приведение.
               */
              src={photo as unknown as string}
              alt=""
              width={ogImageSize.width}
              height={ogImageSize.height}
              style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
            />
            {/* Вуаль под текстом — та же, что под подписями плиток направлений. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                backgroundImage: raw.scrim.bottomStrong,
              }}
            />
          </>
        )}

        {/* ── Верхняя строка: логотип и вид сущности ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: `${card.gap}px` }}>
            <div
              style={{
                width: `${card.brandRuleWidth}px`,
                height: '2px',
                backgroundColor: darkColors.metal,
              }}
            />
            <div
              style={{
                fontSize: `${card.brandSize}px`,
                letterSpacing: `${card.brandTracking}px`,
                textTransform: 'uppercase',
              }}
            >
              {site.name}
            </div>
          </div>

          {input.kind !== undefined && (
            <div
              style={{
                display: 'flex',
                backgroundColor: darkColors.accent,
                color: darkColors['content-on-accent'],
                borderRadius: '999px',
                padding: `${card.kindTracking * 3}px ${card.padding / 2}px`,
                fontSize: `${card.kindSize}px`,
                letterSpacing: `${card.kindTracking}px`,
                textTransform: 'uppercase',
              }}
            >
              {input.kind}
            </div>
          )}
        </div>

        {/* ── Нижний блок: надзаголовок, заголовок, детали ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: `${card.gap}px`,
          }}
        >
          {eyebrow.length > 0 && (
            <div
              style={{
                fontSize: `${card.eyebrowSize}px`,
                letterSpacing: `${card.eyebrowTracking}px`,
                textTransform: 'uppercase',
                color: darkColors.metal,
              }}
            >
              {eyebrow}
            </div>
          )}

          <div style={{ fontSize: `${titleSize}px`, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>

          {meta.length > 0 && (
            <div
              style={{
                fontSize: `${card.metaSize}px`,
                color: darkColors['content-on-cinema-muted'],
              }}
            >
              {meta}
            </div>
          )}
        </div>
      </div>
    ),
    { ...ogImageSize, fonts },
  );
}

/**
 * Обрезка заголовка по длине, а не по числу строк.
 *
 * `line-clamp` движок понимает, но результат зависит от того, где именно
 * закончится строка при данной гарнитуре, — то есть от того, что нельзя
 * проверить тестом. Предел в символах (`seo.limits.ogTitleMax`) даёт
 * предсказуемую карточку и тот же порог, по которому админка проверяет длину
 * заголовка. Обрезка идёт по границе слова: половина слова с многоточием
 * выглядит как сбой кодировки.
 */
function truncate(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
