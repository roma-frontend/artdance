/**
 * MEDIA PROCESSING — политика обработки изображений.
 *
 * Вынесено из `media.ts` отдельным модулем по одной причине: `media.ts` читает
 * `clientEnv` (базовый URL CDN), а валидация окружения происходит при импорте.
 * Конвейер и скрипты обработки должны работать **без** заполненного `.env`:
 * `npm run media:check` выполняется в CI, где переменных приложения нет и быть
 * не должно. Поэтому здесь только числа и ни одного обращения к окружению.
 *
 * Тип `ImagePresetKey` импортируется как type-only — это не создаёт runtime-связи.
 *
 * Почему обработка вообще обязательна, а не «по возможности»:
 *
 * • EXIF содержит GPS-координаты места съёмки. Фото инструктора, сделанное
 *   дома, раскрывает его адрес — это утечка, а не «лишние байты».
 * • Размер файла не ограничивает число пикселей: 20 KB PNG разворачивается в
 *   40 000 × 40 000 и выедает память процесса (декомпрессионная бомба).
 *   Поэтому лимит задаётся в пикселях, а не только в байтах.
 * • MIME от клиента — это утверждение, а не факт. Реальный формат определяется
 *   по содержимому при декодировании.
 * • Ре-энкод при загрузке (один раз) дешевле трансформации при каждом показе.
 *
 * Все значения ниже — политика, а не деталь реализации: конвейер их только
 * читает. Меняется качество или набор ширин — правка здесь и перегенерация.
 */

import type { ImagePresetKey } from './media';

export const mediaProcessing = {
  /**
   * Мастер-файл: максимальная сторона после ресайза. 2560 покрывает 2× для
   * контейнера 1280px — этого достаточно даже для Retina на десктопе.
   */
  masterMaxDimension: 2560,
  /** Ширины производных, которые генерируются при загрузке. */
  variantWidths: [420, 768, 1280, 1920] as const,
  /**
   * Порядок важен: первый формат — предпочитаемый. AVIF меньше на 20–30% при
   * равном качестве, WebP — фоллбэк для старых Safari и почтовых клиентов.
   */
  outputFormats: ['avif', 'webp'] as const,
  quality: {
    avif: 55,
    webp: 78,
    /** Только для мастера, если нужен универсально читаемый файл. */
    jpeg: 82,
  },
  /** Усилие энкодера AVIF: 4 — компромисс между временем загрузки и весом. */
  avifEffort: 4,
  /**
   * Предел числа пикселей на входе. 40 Mpx — это 8000 × 5000, больше любого
   * реального фото с телефона или камеры.
   */
  maxInputPixels: 40_000_000,
  /** Минимальный разумный размер: 1×1 «фото» — это либо ошибка, либо трекинг-пиксель. */
  minDimension: 200,
  /** Форматы, которые принимаются на вход после определения по содержимому. */
  decodableFormats: ['jpeg', 'png', 'webp', 'avif', 'heif', 'tiff'] as const,
  /**
   * Анимация отклоняется: GIF/анимированный WebP в роли фото — это видео,
   * и его место в видеоконвейере, а не в галерее товара.
   */
  allowAnimated: false,
  blur: {
    /** Ширина превью для `blurDataUrl`. Больше 16px даёт лишние байты в HTML. */
    width: 12,
    quality: 45,
    format: 'webp',
  },
  /**
   * Бюджет веса. Проверяется `npm run media:check` и перф-бюджетом: без этого
   * «оптимизированный» ассет со временем снова вырастает до мегабайта.
   */
  budgetBytes: {
    /** LCP-кадры: hero и editorial. */
    fullBleed: 320 * 1024,
    /** Карточки каталога, обложки. */
    card: 140 * 1024,
    /** Аватары и миниатюры. */
    thumbnail: 40 * 1024,
    /** Суммарный вес папки сид-медиа в репозитории. */
    seedTotal: 3 * 1024 * 1024,
  },
  /**
   * Ассеты репозитория (`public/media/seed`) — демо-контент, который заменит
   * контент заказчика. Их мастер режется агрессивнее, чем пользовательская
   * загрузка: держать в git 2560px-кадры незачем, а `next/image` всё равно
   * отдаёт браузеру производную под его экран.
   */
  seedMaxWidth: {
    fullBleed: 1920,
    card: 1024,
    thumbnail: 320,
  },
} as const;

export type MediaOutputFormat = (typeof mediaProcessing.outputFormats)[number];
/**
 * Роли бюджета изображений. Совпадают с ключами `seedMaxWidth`: и порог веса, и
 * максимальная ширина задаются для одних и тех же трёх ролей.
 */
export type MediaBudgetGroup = keyof typeof mediaProcessing.seedMaxWidth;

/** К какому бюджету относится preset. Один источник — не дублировать по месту. */
export const presetBudget: Record<ImagePresetKey, MediaBudgetGroup> = {
  heroFullBleed: 'fullBleed',
  editorialFullBleed: 'fullBleed',
  instructorHero: 'fullBleed',
  productGallery: 'fullBleed',
  categoryCard: 'card',
  classCard: 'card',
  instructorCard: 'card',
  studioCard: 'card',
  productCard: 'card',
  avatar: 'thumbnail',
  avatarLarge: 'thumbnail',
  thumbnail: 'thumbnail',
};

/** Ключ производной в бакете: `<base>/<width>.<format>`. Хеш содержимого — в базовом ключе. */
export function variantKey(baseKey: string, width: number, format: MediaOutputFormat): string {
  return `${baseKey}/${width}.${format}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   ВИДЕО
   ────────────────────────────────────────────────────────────────────────────
   С версии прототипа от 02.09.2026 первый экран — фоновая петля видео. Исходник
   из макета весит 21,6 МБ, и в таком виде он неприемлем:

   • это первый экран, то есть трафик тратится до того, как пользователь увидел
     хоть одно слово. На мобильном тарифе в Армении это ощутимые деньги;
   • `autoplay` без `poster` даёт пустой кадр до первого байта;
   • трейл из копий (`hero-ghosts`) декодирует до семи потоков 1080p
     одновременно — на среднем Android это просадка кадров и нагрев.

   Поэтому политика: короткая петля, жёсткий бюджет, обязательный постер и отказ
   от автозапуска там, где пользователь об этом просил (reduced-motion, Save-Data).
   ──────────────────────────────────────────────────────────────────────────── */

export const videoProcessing = {
  /**
   * Фоновая петля первого экрана. Бюджет выведен из цели «первый экран целиком
   * до 1,5 МБ»: постер ~60 KB + петля ~1,2 МБ + шрифты и JS.
   */
  heroLoop: {
    maxBytes: 1_200 * 1024,
    /** Дольше 8 секунд петля не читается как петля, а вес растёт линейно. */
    maxDurationSeconds: 8,
    /** 1280 достаточно: кадр перекрыт затемняющим слоем и размыт по краям. */
    maxWidth: 1280,
    targetFps: 25,
    /** kbit/s. AV1 даёт тот же результат вдвое дешевле, но кодируется долго. */
    bitrateKbps: { av1: 500, vp9: 700, h264: 1_100 },
    /** Порядок = приоритет источников в `<video>`. */
    formats: ['av1', 'vp9', 'h264'] as const,
    /** Дорожка звука удаляется: петля всегда без звука, а трек — это лишние байты. */
    stripAudio: true,
    /** Число копий в трейле (`hero-ghosts`). 0 = трейл выключен. */
    ghostTrailMax: 3,
    /** Трейл включается только на широких экранах: на мобильном он не виден и вреден. */
    ghostTrailMinViewportWidth: 1024,
  },
  /**
   * Условия, при которых видео **не** проигрывается и остаётся постер.
   * Это не деградация, а уважение к настройке пользователя.
   */
  autoplaySuppressedWhen: [
    'prefers-reduced-motion: reduce',
    'prefers-reduced-data: reduce',
    'Save-Data: on',
    'connection.effectiveType is 2g or slow-2g',
    'connection.saveData is true',
  ] as const,
  /** Постер обязателен всегда: без него первый кадр — белый прямоугольник. */
  posterRequired: true,
  /** Хранилище: петля отдаётся с CDN, а не из репозитория. */
  storage: 'bucket',
} as const;

/**
 * Команды кодирования. Держатся в конфиге, а не в README, потому что параметры
 * должны меняться вместе с бюджетом выше, а не отдельно от него.
 *
 * Требуется `ffmpeg` (в системе разработчика его может не быть — тогда шаг
 * выполняется на машине с ним или в CI).
 */
export const videoEncodeCommands = {
  h264: (input: string, output: string) =>
    `ffmpeg -i "${input}" -t ${videoProcessing.heroLoop.maxDurationSeconds} -vf "scale=${videoProcessing.heroLoop.maxWidth}:-2,fps=${videoProcessing.heroLoop.targetFps}" -an -c:v libx264 -b:v ${videoProcessing.heroLoop.bitrateKbps.h264}k -preset slow -profile:v high -movflags +faststart "${output}.mp4"`,
  vp9: (input: string, output: string) =>
    `ffmpeg -i "${input}" -t ${videoProcessing.heroLoop.maxDurationSeconds} -vf "scale=${videoProcessing.heroLoop.maxWidth}:-2,fps=${videoProcessing.heroLoop.targetFps}" -an -c:v libvpx-vp9 -b:v ${videoProcessing.heroLoop.bitrateKbps.vp9}k -row-mt 1 "${output}.webm"`,
  av1: (input: string, output: string) =>
    `ffmpeg -i "${input}" -t ${videoProcessing.heroLoop.maxDurationSeconds} -vf "scale=${videoProcessing.heroLoop.maxWidth}:-2,fps=${videoProcessing.heroLoop.targetFps}" -an -c:v libsvtav1 -b:v ${videoProcessing.heroLoop.bitrateKbps.av1}k -preset 6 "${output}.av1.mp4"`,
  /** Постер берётся из кадра петли, а не из отдельного фото: иначе виден стык. */
  poster: (input: string, output: string) =>
    `ffmpeg -i "${input}" -ss 0.5 -frames:v 1 "${output}.png"`,
} as const;
