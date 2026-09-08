/**
 * КОНТЕНТ — типы того, что редактирует заказчик, а не разработчик.
 *
 * Требование, определяющее эти типы: **все фото и видео управляются из
 * админки.** Отсюда два следствия, которые важно принять до вёрстки:
 *
 * 1. **Компонент не знает имён файлов.** `<Media src="hero-dancer">` в разметке
 *    означает, что замена фото на главной — это правка кода и деплой. Поэтому
 *    ссылка на медиа приходит пропсом, а имя файла живёт в данных.
 * 2. **Альтернативный текст — это контент, а не интерфейс.** Он описывает
 *    конкретное фото, меняется вместе с ним и потому не может лежать в каталоге
 *    переводов рядом с надписями кнопок. В схеме под это есть
 *    `MediaAsset.altText` и `MediaAssetTranslation`.
 *
 * Тексты интерфейса (заголовки, подписи, CTA) остаются в i18n: они относятся к
 * продукту, а не к загруженному файлу. Управление блоками главной из админки —
 * отдельная задача (`docs/07-feature-backlog.md`, A-17), и эти типы к ней готовы.
 */

import type { Locale } from '@/i18n/config';

/** Строка на всех языках. В БД — таблица переводов, здесь — готовый результат. */
export type LocalizedText = Record<Locale, string>;

/** Ссылка на изображение. Ровно то, что вернёт запрос к `MediaAsset`. */
export interface MediaRef {
  /**
   * Ключ файла: имя сид-ассета на этапе разработки, ключ объекта в бакете
   * в production. Компонент `Media` различает их сам.
   */
  key: string;
  /** Описание изображения на трёх языках. Пустая строка = декоративное. */
  alt: LocalizedText;
  /** Точка фокуса кадра, если центр обрезает главное (`'50% 25%'`). */
  focalPoint?: string;
  /**
   * Размеры кадра и плейсхолдер — из `MediaAsset`.
   *
   * Необязательные, потому что у ключа, зашитого в код (баннер раздела), их
   * взять негде: там их находит манифест сид-ассетов. Но когда ссылка пришла из
   * базы, они обязаны доехать до компонента: без них `Media` не резервирует
   * место (сдвиг вёрстки) и показывает общий серый плейсхолдер вместо размытого
   * кадра. Именно для этого в схеме есть `width`, `height` и `blurDataUrl` —
   * чтобы разметка не зависела от файлового манифеста.
   */
  width?: number;
  height?: number;
  blurDataUrl?: string;
}

export type VideoFormat = 'av1' | 'vp9' | 'h264';

/**
 * Ссылка на видео. Источники перечислены в порядке предпочтения: по возрастанию
 * ширины кадра, внутри ширины — по приоритету формата.
 */
export interface VideoRef {
  sources: ReadonlyArray<{ format: VideoFormat; width: number; url: string }>;
  /** Постер обязателен: без него первый кадр — пустой прямоугольник. */
  poster: MediaRef;
  durationSeconds: number;
  /** Вес самого лёгкого источника, байт — для отчётов и проверки бюджета. */
  bytes: number;
}

/** Готовые для `<Media>` пропсы. Локаль применяется один раз, в одном месте. */
export function resolveMedia(
  ref: MediaRef,
  locale: Locale,
): {
  src: string;
  alt: string;
  objectPosition?: string;
  width?: number;
  height?: number;
  blurDataUrl?: string;
} {
  return {
    src: ref.key,
    alt: ref.alt[locale],
    ...(ref.focalPoint ? { objectPosition: ref.focalPoint } : {}),
    ...(ref.width !== undefined ? { width: ref.width } : {}),
    ...(ref.height !== undefined ? { height: ref.height } : {}),
    ...(ref.blurDataUrl ? { blurDataUrl: ref.blurDataUrl } : {}),
  };
}

/** Есть ли у видео хоть один источник. Пока петля не закодирована — нет. */
export function hasPlayableVideo(video: VideoRef | null): video is VideoRef {
  return video !== null && video.sources.length > 0;
}

/* ───────────────────────────── Главная страница ───────────────────────────── */

export interface HomeHeroContent {
  /** Фоновое видео. `null` до кодирования петли — тогда показывается постер. */
  video: VideoRef | null;
  /**
   * Тот же клип, закодированный от конца к началу.
   *
   * Нужен для обратного прохода раскрытия. Отрицательной скорости у видео не
   * бывает, а перемотка назад идёт неровно: при ключевом кадре каждые восемь кадров
   * задержка перемотки колеблется с тем же периодом, и движение «местами
   * ускоряется». Перевёрнутый клип назад ИГРАЕТ — то есть плавен по той же причине,
   * по которой плавен прямой проход.
   *
   * Скачивается лениво, только когда посетитель начал раскрытие: тот, кто до
   * первого экрана не дотронулся, за этот файл не платит.
   */
  reverseVideo: VideoRef | null;
  /** Постер и он же фоллбэк. Отдельно от видео: используется всегда. */
  image: MediaRef;
  /**
   * Показатели первого экрана. Значения придут из аналитики, но набор и порядок
   * — контент: заказчик решает, чем хвалиться.
   */
  stats: ReadonlyArray<{ id: string; value: number; suffix: string; decimals: number }>;
}

export interface StyleTileItem {
  /** Значение `DanceStyle`. Название берётся из i18n по этому ключу. */
  style: string;
  /**
   * Слаг для адреса хаба. Приходит из данных, а не считается в компоненте:
   * составлять URL из значения enum — задача слоя контента, а не разметки.
   */
  slug: string;
  image: MediaRef;
  classCount: number;
}

/**
 * Заявление бренда («EVERY BODY HAS A RHYTHM. FIND YOURS.»).
 *
 * Видео здесь, а не в hero-типе, потому что фоновых петель на главной две, и они
 * независимы: у editorial своя политика кодирования, свой бюджет и своя
 * упреждающая загрузка. Общего типа с `HomeHeroContent` намеренно нет — у hero
 * есть показатели, у editorial их нет, и объединение дало бы обоим по половине
 * лишних полей.
 */
export interface HomeEditorialContent {
  /** Фоновая петля. `null` до кодирования — тогда остаётся постер. */
  video: VideoRef | null;
  /**
   * Постер и он же фоллбэк: показывается до старта воспроизведения, при
   * `prefers-reduced-motion` и при экономии данных.
   */
  image: MediaRef;
}

/* ────────────────────────────── Карточки каталога ──────────────────────────────
 *
 * Карточки названы по сущности, а не по экрану. Одна и та же карточка занятия
 * стоит на главной, в `/discover`, в `/classes`, в профиле инструктора и в блоке
 * «похожие»: префикс `Home*` был бы неверен уже на втором экране, а второй тип с
 * теми же полями означал бы два места, где карточка расходится с данными.
 */

/**
 * Занятие в подборке или листинге.
 *
 * Здесь нет `scheduleLabel: 'Saturday, 18:00'`, хотя в прототипе подпись именно
 * такая: название дня недели зависит от локали, и строка из данных означала бы
 * английский день на армянской странице. Поэтому расписание приходит числами, а
 * читаемый вид собирает компонент через форматтер локали.
 */
export interface ClassCardItem {
  slug: string;
  /** Название занятия — контент, в production с переводами из БД. */
  title: string;
  /** Значение `DanceStyle`: подпись берётся из i18n. */
  style: string;
  /** Значение `SkillLevel`: подпись берётся из i18n. */
  level: string;
  instructorName: string;
  /** День недели: 0 — воскресенье, как в `Date.getDay()`. */
  weekday: number;
  /** Время начала в формате `HH:mm` — 24 часа, без локали. */
  startTime: string;
  durationMinutes: number;
  price: number;
  spotsLeft: number;
  /** Открыт ли лист ожидания при заполненной группе. */
  waitlistOpen: boolean;
  /** Бейдж «в тренде». Взаимоисключающий с «мест нет». */
  isTrending: boolean;
  image: MediaRef;
}

export interface InstructorCardItem {
  slug: string;
  name: string;
  /** Направления одной строкой: `Salsa · Latin · Bachata`. */
  headline: string;
  /** Значения `DanceStyle` — для ссылок и подписей. */
  styles: readonly string[];
  yearsExperience: number;
  hourlyRateFrom: number;
  ratingAverage: number;
  ratingCount: number;
  isVerified: boolean;
  image: MediaRef;
}

export interface VenueCardItem {
  slug: string;
  name: string;
  description: string;
  /** Район города. В production — из адреса площадки. */
  district: string;
  /** Значения `VenueAmenity`: подписи берутся из i18n. */
  amenities: readonly string[];
  pricePerHour: number;
  ratingAverage: number;
  ratingCount: number;
  image: MediaRef;
}

/**
 * Отзыв в подборке. Текст — контент: в production приходит из `Review` с
 * модерацией, а не из фикстуры.
 */
export interface TestimonialItem {
  id: string;
  authorName: string;
  /** «Salsa · 6 месяцев на ArtDance» — роль, а не должность. */
  authorRole: string;
  rating: number;
  body: string;
  image: MediaRef;
}

/**
 * Товар в подборке или листинге.
 *
 * `priceFrom` вместо `price` у подарочной карты: она продаётся от суммы, и
 * «5 000 ֏» без «от» было бы неверным обещанием.
 */
export interface ProductCardItem {
  slug: string;
  title: string;
  /** Бренд над названием. В макете у всех ARTDANCE, в БД — своё поле. */
  brand: string;
  price: number;
  /** Цена — минимальная из вариантов, а не фиксированная. */
  priceFrom: boolean;
  /** Минимальный остаток по вариантам: определяет метку «осталось мало». */
  stock: number;
  image: MediaRef;
}

/**
 * Событие: воркшоп, батл, мастер-класс.
 *
 * Дата приходит числом и месяцем, а не готовой строкой «15 SEP»: месяц зависит
 * от локали, и подпись собирает форматтер.
 */
export interface EventCardItem {
  slug: string;
  title: string;
  /** Значение `EventType`: подпись берётся из i18n. */
  type: string;
  /**
   * Начало события — ISO-строка, а не `Date`.
   *
   * Так выглядит значение после кеша: слой запросов кладёт результат в кеш
   * данных, а тот сериализует, и `Date` возвращается строкой. Тип, обещающий
   * `Date`, означал бы `item.startsAt.toISOString is not a function` на первой
   * же собранной странице — так и случилось при переносе на базу.
   *
   * Разбор — в компоненте, одной строкой: `new Date(item.startsAt)`.
   */
  startsAt: string;
  /** `HH:mm`—`HH:mm` как в макете: событие идёт часы, а не минуты. */
  startTime: string;
  endTime: string;
  /** Название площадки или места. Площадка может быть внешней. */
  locationName: string;
  /** Ноль означает бесплатный вход и выводится словом, а не нулём. */
  price: number;
  spotsLeft: number;
  image: MediaRef;
}

export interface HomeContent {
  hero: HomeHeroContent;
  styleTiles: readonly StyleTileItem[];
  editorial: HomeEditorialContent;
  popularClasses: readonly ClassCardItem[];
  instructors: readonly InstructorCardItem[];
  venues: readonly VenueCardItem[];
  testimonials: readonly TestimonialItem[];
  products: readonly ProductCardItem[];
  events: readonly EventCardItem[];
}


/* ───────────────────────── Листинги каталога ─────────────────────────
 *
 * Один тип страницы результатов на все листинги. Причина не в экономии, а в
 * поведении: у каждого листинга обязаны совпадать номер страницы, общее число
 * найденного и признак «есть ещё» — иначе пагинация на одном экране считает
 * страницы от нуля, а на другом от единицы, и это выясняется на приёмке.
 *
 * Пагинация страничная, а не курсорная, и это осознанно: `/discover?page=3`
 * обязан открываться по прямой ссылке и попадать в индекс. Курсор нужен для
 * бесконечной прокрутки внутри одного сеанса (`limits.pagination.infiniteScrollBatch`)
 * и появится там, где она есть.
 */

export interface CatalogPage<T> {
  items: readonly T[];
  /** Сколько найдено всего — для подписи «12 занятий» и для расчёта страниц. */
  total: number;
  /** Текущая страница, от единицы: так же, как в URL. */
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Пустая страница результатов. Отдельная функция, чтобы поля не разъезжались. */
export function emptyCatalogPage<T>(page: number, pageSize: number): CatalogPage<T> {
  return { items: [], total: 0, page, pageSize, pageCount: 0 };
}

/**
 * Значение фасета фильтра со счётчиком.
 *
 * Счётчик обязателен: фильтр, который ведёт в пустой результат, — худший вид
 * фильтра, потому что о своей бесполезности он сообщает только после клика.
 */
export interface FacetOption {
  /** Значение для URL (`hip-hop`), не enum и не подпись. */
  value: string;
  /** Ключ i18n для подписи. Готовой строки здесь быть не может: три языка. */
  labelKey: string;
  count: number;
}

/* ───────────────────────── Детальные страницы ───────────────────────── */

/**
 * Отзыв на детальной странице.
 *
 * Отличается от `TestimonialItem` признаком подтверждённой брони: подборка на
 * главной — витрина, а список на странице занятия — реальные отзывы, у которых
 * важно видеть, был ли автор на занятии.
 *
 * Даты здесь нет намеренно: в прототипе её нет ни у одного отзыва, а показывать
 * «2 дня назад» рядом с отзывом, у которого дата взята из даты импорта, —
 * обещание точности, которой в данных не было.
 */
export interface ReviewItem {
  id: string;
  authorName: string;
  authorRole: string;
  rating: number;
  body: string;
  /**
   * Отзыв оставлен после подтверждённой брони. При
   * `reviews.requireVerifiedPurchase` иных отзывов на платформе не бывает, но
   * флаг остаётся в типе: правило — настройка, а бейдж «подтверждённая бронь»
   * должен исчезать вместе с ней, а не оставаться неверным украшением.
   */
  isVerifiedPurchase: boolean;
  image: MediaRef;
}

/**
 * Агрегат рейтинга.
 *
 * Среднее скрывается, пока отзывов меньше `reviews.minCountToDisplayAverage`:
 * «5,0 по одному отзыву» — не оценка, а случайность, и показывать её рядом с
 * «4,8 по 128 отзывам» нечестно по отношению к обоим.
 */
export interface RatingSummary {
  average: number;
  count: number;
}

/** Занятие в расписании: одна дата проведения, а не правило повторения. */
export interface ScheduleEntry {
  /** День недели: 0 — воскресенье, как в `Date.getDay()`. */
  weekday: number;
  startTime: string;
  endTime: string;
  spotsLeft: number;
}

export interface ClassDetail extends ClassCardItem {
  description: string;
  /** «Чему научитесь» — список из макета. Контент, в production из БД. */
  learningPoints: readonly string[];
  capacity: number;
  instructorSlug: string;
  instructorHeadline: string;
  instructorImage: MediaRef;
  instructorRating: number;
  instructorRatingCount: number;
  instructorVerified: boolean;
  venueSlug: string;
  venueName: string;
  venueDistrict: string;
  schedule: readonly ScheduleEntry[];
  rating: RatingSummary;
  reviews: readonly ReviewItem[];
  /** Похожие занятия: то же направление, другой слаг. */
  similar: readonly ClassCardItem[];
}

export interface InstructorExperienceEntry {
  title: string;
  organization?: string;
  location?: string;
  startYear: number;
  /** Отсутствие года окончания означает «по настоящее время». */
  endYear?: number;
}

/**
 * Площадка как ссылка: слаг обязателен.
 *
 * Раньше здесь был `venueNames: string[]`. Список залов без слагов —
 * тупик: человек читает «преподаёт в Pulse Dance Studio» и не может туда
 * перейти, хотя страница зала существует.
 */
export interface VenueLinkItem {
  slug: string;
  name: string;
}

export interface InstructorDetail extends InstructorCardItem {
  bio: string;
  /** Узкие специализации: «Salsa On1», «Bachata Sensual». Контент. */
  specializations: readonly string[];
  studentCount: number;
  /** Выезжает ли к клиенту: определяет доступность опции места. */
  acceptsTravel: boolean;
  experience: readonly InstructorExperienceEntry[];
  classes: readonly ClassCardItem[];
  venues: readonly VenueLinkItem[];
  rating: RatingSummary;
  reviews: readonly ReviewItem[];
}

export interface VenueDetail extends VenueCardItem {
  areaSqm: number;
  capacity: number;
  /** Координаты для карты. */
  latitude: number;
  longitude: number;
  /** Занятия, которые проходят на площадке. */
  classes: readonly ClassCardItem[];
  /** События на площадке: у зала своя афиша, и она продаёт аренду лучше описания. */
  events: readonly EventCardItem[];
  rating: RatingSummary;
  reviews: readonly ReviewItem[];
}

export interface EventDetail extends EventCardItem {
  description: string;
  capacity: number;
  /** Слаг площадки, если событие проходит на площадке каталога. */
  venueSlug?: string;
  venueDistrict?: string;
  latitude?: number;
  longitude?: number;
}

export interface ProductVariantItem {
  sku: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
}

export interface ProductDetail extends ProductCardItem {
  description: string;
  categorySlug: string;
  variants: readonly ProductVariantItem[];
  /** Галерея. Первый кадр совпадает с `image` карточки. */
  gallery: readonly MediaRef[];
  /** Подарочная карта: цена выбирается покупателем, а не берётся из варианта. */
  isGiftCard: boolean;
  related: readonly ProductCardItem[];
}


/* ────────────────────────────── Хаб направления ──────────────────────────────
 *
 * `/styles/[style]` — не листинг с предвыбранным фильтром, а страница о самом
 * танце: что это, кто ведёт, где учат, сколько стоит и что взять с собой. Отсюда
 * и тип: не `CatalogPage`, а сводка по направлению.
 */

/** Направление в перечне на `/styles`. */
export interface StyleSummary {
  /** Значение `DanceStyle`. Название и описание берутся из i18n по этому ключу. */
  style: string;
  slug: string;
  /**
   * Кадр направления. `null` — легальное состояние: фотография есть у пяти
   * направлений из макета, у остальных она появится вместе с контентом
   * заказчика, и заглушка вместо неё была бы обманом.
   */
  image: MediaRef | null;
  classCount: number;
  instructorCount: number;
}

export interface StyleHubDetail extends StyleSummary {
  /** Занятия по направлению — уже отображённые карточки. */
  classes: readonly ClassCardItem[];
  instructors: readonly InstructorCardItem[];
  /** Залы, где этому учат. У зала своего направления нет — связь через занятия. */
  venues: readonly VenueCardItem[];
  /** Минимальная цена занятия. `null`, когда занятий нет. */
  priceFrom: number | null;
  /** Уровни, представленные в занятиях. Порядок — как в `skillLevels`. */
  levels: readonly string[];
  /** Районы, где проходят занятия. */
  districts: readonly string[];
  /** Соседние направления — `DanceStyle`, из `relatedDanceStyles`. */
  related: readonly StyleSummary[];
}
