/**
 * КАРТА КОМПОНЕНТОВ: прототип → продукт.
 *
 * Контракт между утверждённым дизайном и кодом. Для каждого блока прототипа
 * зафиксировано: какой компонент его заменяет, где он лежит, какие варианты и
 * состояния обязателен поддерживать, какой namespace i18n и какой image preset
 * использует.
 *
 * Зачем это файл, а не документ:
 *   • `npm run design:status` печатает, что уже реализовано и что осталось —
 *     план не расходится с реальностью;
 *   • CSS-классы прототипа перечислены явно, поэтому при вёрстке видно, какие
 *     именно стили нужно перенести, и ничего не теряется;
 *   • состояния (`states`) — это чек-лист приёмки компонента. «Забыли состояние
 *     пустого списка» перестаёт быть открытием на демо.
 *
 * Источник: `design/reference/artdance-final.html`.
 *
 * Здесь только блоки, которые есть в прототипе. Компоненты, которых в макете нет
 * (формы, таблицы, диалоги, тосты, состояния загрузки и ошибок) — в
 * `docs/08-component-catalog.md`. При старте волны такой компонент переносится
 * сюда со своим `wave`, иначе `design:status` не увидит его в плане.
 */

import type { ImagePresetKey } from '@/config/media';

/** Очередь реализации. Совпадает с фазами в `docs/06-implementation-plan.md`. */
export const buildWaves = ['foundation', 'catalog', 'booking', 'commerce', 'account', 'admin'] as const;
export type BuildWave = (typeof buildWaves)[number];

export interface ComponentSpec {
  /** Имя компонента. Файл выводится из `path`. */
  name: string;
  /** Путь относительно `src/`. */
  path: string;
  /** Что это за блок в макете. */
  role: string;
  wave: BuildWave;
  /** Классы прототипа, стили которых переносятся в этот компонент. */
  prototypeClasses: readonly string[];
  /** Экраны прототипа, где блок встречается. */
  screens: readonly string[];
  /** Namespace i18n, откуда компонент берёт текст. */
  i18n?: readonly string[];
  /** Preset изображения, если компонент рендерит медиа. */
  image?: ImagePresetKey;
  /** Обязательные состояния — чек-лист приёмки. */
  states?: readonly string[];
  /** Варианты, которые нужно поддержать. */
  variants?: readonly string[];
  /** Заметки о неочевидном поведении в макете. */
  notes?: string;
}

export const componentManifest: readonly ComponentSpec[] = [
  /* ───────────────────────── Оболочка ───────────────────────── */
  {
    name: 'SiteHeader',
    path: 'components/layout/site-header.tsx',
    role: 'Фиксированная навигация, меняющая фон при скролле',
    wave: 'foundation',
    prototypeClasses: ['nav', 'nav-in', 'nav-logo', 'nav-links', 'nav-right', 'nav-icon', 'nav-book', 'nav-hamburger'],
    screens: ['all'],
    i18n: ['nav', 'common.actions'],
    states: ['top', 'scrolled', 'mobile-menu-open', 'authenticated', 'anonymous'],
    notes:
      'В макете при скролле добавляется класс .scrolled: фон, blur и уменьшение высоты. ' +
      'Порог — 40px. Логотип — inline SVG, не изображение. Версия 02.09.2026: добавлены ' +
      'CTA «Book Now» (.nav-book) и бургер (.nav-hamburger); оба скрываются/показываются ' +
      'на 768px. Бургер — это <button> с тремя span, превращающимися в крестик.',
  },
  {
    name: 'MobileNavDrawer',
    path: 'components/layout/mobile-nav-drawer.tsx',
    role: 'Выезжающее справа мобильное меню с затемнением',
    wave: 'foundation',
    prototypeClasses: ['mobile-menu', 'mobile-overlay', 'mobile-close'],
    screens: ['all'],
    i18n: ['nav', 'common.actions', 'a11y'],
    states: ['closed', 'open', 'closing'],
    notes:
      'Появился в версии 02.09.2026. Ширина 280px, выезд справа 400ms, затемнение с ' +
      'backdrop-filter. В макете это toggle класса .open через inline-onclick — в продукте ' +
      'нужны ловушка фокуса, закрытие по Esc и по клику на оверлей, возврат фокуса на ' +
      'бургер и блокировка скролла body. z-index — из zIndex.drawer, а не 9999.',
  },
  {
    name: 'SiteFooter',
    path: 'components/layout/site-footer.tsx',
    role: 'Подвал с пятью колонками ссылок и соцсетями',
    wave: 'foundation',
    prototypeClasses: ['footer', 'footer-g', 'footer-desc', 'footer-social', 'footer-h', 'footer-l', 'footer-bt'],
    screens: ['all'],
    i18n: ['footer', 'brand'],
    notes: 'Сетка 2fr 1fr 1fr 1fr 1fr → 2 колонки на планшете → 1 на телефоне.',
  },
  {
    name: 'SearchOverlay',
    path: 'components/search/search-overlay.tsx',
    role: 'Полноэкранный поиск с фильтрами по типу сущности',
    wave: 'catalog',
    prototypeClasses: ['searchOverlay'],
    screens: ['all'],
    i18n: ['search'],
    states: ['closed', 'open-empty', 'typing', 'results', 'no-results'],
    notes:
      'В прототипе — inline-стили и без логики. Открытие по клику на иконку и по Cmd/Ctrl+K. ' +
      'Debounce из limits.search.debounceMs.',
  },
  {
    name: 'ThemeToggle',
      path: 'components/layout/theme-toggle.tsx',
    role: 'Плавающая кнопка переключения светлой и тёмной темы',
    wave: 'foundation',
    prototypeClasses: ['theme-btn'],
    screens: ['all'],
    i18n: ['common.theme'],
    states: ['light', 'dark', 'system'],
    notes:
      'Значение пишется в data-theme на <html> и в cookie. Hero и editorial остаются ' +
      'тёмными в обеих темах — это surface-cinema, а не тема.',
  },

  /* ───────────────────────── Главная ───────────────────────── */
  {
    name: 'HeroSection',
    path: 'components/home/hero-section.tsx',
    role: 'Первый экран: фоновое видео, заголовок, две CTA, четыре показателя',
    wave: 'foundation',
    prototypeClasses: ['hero', 'hero-bg', 'hero-ov', 'hero-c', 'hero-badge', 'hero-title', 'hero-sub', 'hero-btns', 'hero-stats', 'hero-sv', 'hero-sl', 'hero-scroll'],
    screens: ['home'],
    i18n: ['home.hero'],
    image: 'heroFullBleed',
    states: ['default', 'reduced-motion', 'video-unavailable'],
    notes:
      'Версия 02.09.2026: статичное фото заменено видео (см. HeroVideo). Показатели ' +
      'анимируются счётчиком от нуля при появлении в viewport — параметры в ' +
      'motion.counter. При уходе вверх работает параллакс: фон уезжает медленнее, ' +
      'контент быстрее и гаснет (motion.heroParallax). Заголовок содержит <em> с ' +
      'акцентным курсивом — в i18n это отдельный ключ, а не HTML в строке. ' +
      'ДЕФЕКТ макета: min-height 100vh → использовать 100dvh, иначе первый экран ' +
      'дёргается при появлении адресной строки на iOS.',
  },
  {
    name: 'HeroVideo',
    path: 'components/home/hero-video.tsx',
    role: 'Фоновая петля первого экрана с постером и трейлом копий',
    wave: 'foundation',
    prototypeClasses: ['hero-video-wrap', 'hero-video-main', 'hero-ghosts', 'hero-ghost'],
    screens: ['home'],
    i18n: ['a11y'],
    image: 'heroFullBleed',
    states: ['poster-only', 'loading', 'playing', 'paused-by-user', 'reduced-motion', 'save-data', 'error'],
    notes:
      'Самый рискованный компонент макета. Исходник петли — 21,6 МБ, автозапуск без ' +
      'poster и без preload, а трейл создаёт до шести копий <video> (до семи потоков ' +
      '1080p одновременно). Требования: постер обязателен (videoProcessing.posterRequired), ' +
      'петля ≤ 1,2 МБ и ≤ 8 с, источники av1/vp9/h264, автозапуск подавляется при ' +
      'prefers-reduced-motion, Save-Data и медленном соединении, трейл ограничен ' +
      'ghostTrailMax и включается от 1024px. Петля отдаётся с CDN, а не из репозитория. ' +
      'Кнопка паузы обязательна: автовоспроизводимое движение дольше 5 секунд требует ' +
      'управления (WCAG 2.2.2).',
  },
  {
    name: 'HeroSearchBar',
    path: 'components/home/hero-search-bar.tsx',
    role: 'Поисковая строка, наезжающая на hero снизу',
    wave: 'catalog',
    prototypeClasses: ['heroSearch', 'search-pill', 'search-pill-filters'],
    screens: ['home'],
    i18n: ['search'],
    states: ['idle', 'focused', 'with-filters', 'compact'],
    notes:
      'Отрицательный margin-top −2.5rem поверх hero. Три чипа: город, дата, направление. ' +
      'Версия 02.09.2026: чипы вынесены в .search-pill-filters и сворачиваются по ширине — ' +
      'на 768px остаётся первый, на 360px строка становится вертикальной. ДЕФЕКТ: на 360px ' +
      'фильтры скрыты через display:none !important без альтернативы — в продукте они ' +
      'должны уходить в Sheet, а не исчезать.',
  },
  {
    name: 'StyleMarquee',
    path: 'components/home/style-marquee.tsx',
    role: 'Бегущая строка направлений на акцентном фоне',
    wave: 'foundation',
    prototypeClasses: ['marquee', 'marquee-t'],
    screens: ['home'],
    i18n: ['danceStyles'],
    notes:
      'Список дублируется для бесшовной прокрутки (animation 40s linear infinite). ' +
      'aria-hidden: содержимое декоративное и дублирует навигацию.',
  },
  {
    name: 'StyleTileGrid',
    path: 'components/catalog/style-tile-grid.tsx',
    role: 'Сетка направлений 5×1 с фото и счётчиком занятий',
    wave: 'catalog',
    prototypeClasses: ['cats', 'cat', 'cat-ov', 'cat-n', 'cat-c', 'cat-a'],
    screens: ['home'],
    i18n: ['danceStyles', 'common.counts'],
    image: 'categoryCard',
    states: ['default', 'hover', 'loading'],
    notes:
      'aspect-ratio 3/4, при 480px → 1/1. На hover: зум фото, подъём названия, ' +
      'появление счётчика и стрелки.',
  },
  {
    name: 'ClassCard',
    path: 'components/catalog/class-card.tsx',
    role: 'Карточка занятия в горизонтальной прокрутке',
    wave: 'catalog',
    prototypeClasses: ['cc', 'cc-img', 'cc-badge', 'cc-fav', 'cc-body', 'cc-meta', 'cc-title', 'cc-inst', 'cc-foot', 'cc-price', 'cc-spots'],
    screens: ['home', 'discover'],
    i18n: ['classDetail', 'common.counts', 'levels', 'danceStyles'],
    image: 'classCard',
    variants: ['default', 'trending', 'full'],
    states: ['default', 'hover', 'favorited', 'sold-out', 'waitlist'],
    notes:
      'Бейдж TRENDING и FULL — взаимоисключающие. Счётчик мест окрашивается: ok → success, ' +
      'мало → warning, нет мест → signal. Порог «мало» — commerce.lowStockThreshold.',
  },
  {
    name: 'ClassCarousel',
    path: 'components/catalog/class-carousel.tsx',
    role: 'Горизонтальная прокрутка карточек со snap и кнопками',
    wave: 'catalog',
    prototypeClasses: ['classes', 'classes-wrap', 'scroll-arrows', 'scroll-arrow'],
    screens: ['home'],
    i18n: ['home.popular', 'a11y'],
    states: ['default', 'empty', 'loading', 'at-start', 'at-end'],
    notes:
      'scroll-snap-type: x mandatory, скроллбар скрыт. Версия 02.09.2026: появились ' +
      'кнопки-стрелки (.scroll-arrow), они гасятся на краях списка — шаг и допуск в ' +
      'motion.carousel. Кнопкам нужны aria-label и aria-controls: в макете это ' +
      'безымянные круги с символом.',
  },
  {
    name: 'InstructorCard',
    path: 'components/catalog/instructor-card.tsx',
    role: 'Карточка инструктора с бейджем верификации',
    wave: 'catalog',
    prototypeClasses: ['insts', 'inst', 'inst-img', 'inst-v', 'inst-info', 'inst-name', 'inst-style', 'inst-meta', 'inst-rating', 'inst-price'],
    screens: ['home', 'instructors'],
    i18n: ['instructor', 'common.counts', 'danceStyles'],
    image: 'instructorCard',
    states: ['default', 'hover', 'verified', 'unverified'],
    notes: 'Рейтинг и направления окрашены metal и accent соответственно. Сетка 4→2→1.',
  },
  {
    name: 'EditorialStatement',
    path: 'components/home/editorial-statement.tsx',
    role: 'Полноэкранное заявление бренда на тёмном фоне',
    wave: 'foundation',
    prototypeClasses: ['editorial', 'editorial-bg', 'editorial-ov', 'editorial-c', 'accent'],
    screens: ['home'],
    i18n: ['home.editorial'],
    image: 'editorialFullBleed',
    notes:
      'Типографика display-editorial до 8rem. Фон с opacity .3 и blur(1px), поверх — ' +
      'scrim.editorialRadial. Не зависит от темы.',
  },
  {
    name: 'VenueCard',
    path: 'components/catalog/venue-card.tsx',
    role: 'Карточка площадки с районом, оснащением и ценой за час',
    wave: 'catalog',
    prototypeClasses: ['card', 'card-img', 'card-body', 'card-foot', 'card-price', 'card-rating', 'loc', 'tags', 'tag'],
    screens: ['home', 'studios'],
    i18n: ['studio', 'studio.amenities'],
    image: 'studioCard',
    states: ['default', 'hover', 'unavailable'],
    notes: 'Оснащение — до трёх тегов, остальное «+N». Иконка района — не эмодзи, а lucide.',
  },
  {
    name: 'ProductCard',
    path: 'components/shop/product-card.tsx',
    role: 'Карточка товара с быстрым добавлением в корзину',
    wave: 'commerce',
    prototypeClasses: ['card', 'card-img', 'prod-quick', 'prod-brand', 'card-body', 'card-price'],
    screens: ['home', 'shop'],
    i18n: ['shop', 'common.actions'],
    image: 'productCard',
    states: ['default', 'hover', 'adding', 'added', 'low-stock', 'out-of-stock'],
    notes:
      'Кнопка Quick Add появляется на hover из градиента снизу; на touch-устройствах ' +
      'должна быть видна всегда. Подарочная карта показывает «From {price}».',
  },
  {
    name: 'EventCard',
    path: 'components/catalog/event-card.tsx',
    role: 'Карточка события с бейджем даты',
    wave: 'catalog',
    prototypeClasses: ['card', 'date-badge', 'event-type', 'spots'],
    screens: ['home', 'events'],
    i18n: ['events', 'common.counts'],
    image: 'studioCard',
    states: ['default', 'free-entry', 'sold-out', 'past'],
    notes: 'Бейдж даты — accent, число в display-гарнитуре. Бесплатный вход выводится словом, не нулём.',
  },
  {
    name: 'TestimonialCard',
    path: 'components/home/testimonial-card.tsx',
    role: 'Отзыв с крупной кавычкой-водяным знаком',
    wave: 'catalog',
    prototypeClasses: ['test', 'test-stars', 'test-quote', 'test-author', 'test-avatar', 'test-name', 'test-role'],
    screens: ['home'],
    i18n: ['reviews', 'a11y'],
    image: 'avatar',
    notes:
      'Кавычка — псевдоэлемент ::before, 8rem, opacity .06. Звёзды обязаны иметь ' +
      'текстовую альтернативу (a11y.ratingStars).',
  },
  {
    name: 'NewsletterSection',
    path: 'components/home/newsletter-section.tsx',
    role: 'Подписка на рассылку',
    wave: 'catalog',
    prototypeClasses: ['newsletter', 'nl-form'],
    screens: ['home'],
    i18n: ['home.newsletter', 'validation'],
    states: ['idle', 'submitting', 'success', 'error', 'already-subscribed'],
    notes: 'Защищается Turnstile и rateLimits.contactForm. Требует явного согласия на обработку.',
  },
  {
    name: 'SectionHeading',
    path: 'components/ui/section-heading.tsx',
    role: 'Надзаголовок + заголовок + подзаголовок секции',
    wave: 'foundation',
    prototypeClasses: ['sec-h', 'label', 'c'],
    screens: ['all'],
    variants: ['left', 'center'],
    notes: 'Надзаголовок (label) имеет декоративную золотую черту через ::before.',
  },

  /* ───────────────────────── Каталог и детали ───────────────────────── */
  {
    name: 'DiscoverFilters',
    path: 'components/catalog/discover-filters.tsx',
    role: 'Фильтры каталога: направление, уровень, цена, дата, город',
    wave: 'catalog',
    prototypeClasses: ['tags', 'tag'],
    screens: ['discover'],
    i18n: ['discover.filters', 'discover.sort'],
    states: ['collapsed', 'expanded', 'applied', 'empty-result'],
    notes:
      'В прототипе только чипы направлений. Состояние фильтров живёт в URL (routes.discover), ' +
      'а не в React-состоянии: ссылка должна быть шарящейся и индексируемой.',
  },
  {
    name: 'ClassDetailScreen',
    path: 'app/[locale]/classes/[slug]/page.tsx',
    role: 'Страница занятия: обложка, описание, чему научитесь, инструктор, панель брони',
    wave: 'booking',
    prototypeClasses: ['tag', 'tags', 'class-grid'],
    screens: ['class'],
    i18n: ['classDetail', 'booking', 'reviews'],
    image: 'editorialFullBleed',
    states: ['available', 'few-spots', 'full-waitlist', 'cancelled'],
    notes:
      'Панель брони — sticky на десктопе, фиксированная снизу на мобильном. ' +
      'Условия отмены берутся из booking.freeCancellationHours, не из текста. ' +
      'Версия 02.09.2026: двухколоночная сетка получила класс .class-grid и на 768px ' +
      'схлопывается в колонку. В макете это сделано через display:flex !important ' +
      'поверх inline-стилей — в продукте таких перебиваний быть не должно.',
  },
  {
    name: 'InstructorProfileScreen',
    path: 'app/[locale]/instructors/[slug]/page.tsx',
    role: 'Профиль инструктора: обложка, аватар с обводкой, специализации, панель брони',
    wave: 'booking',
    prototypeClasses: ['inst-v', 'tag'],
    screens: ['instructor'],
    i18n: ['instructor', 'reviews', 'booking'],
    image: 'instructorHero',
    states: ['verified', 'unverified', 'no-availability', 'fully-booked'],
    notes: 'Аватар 90px с обводкой 3px цветом surface-card, наезжает на обложку.',
  },

  /* ───────────────────────── Бронирование ───────────────────────── */
  {
    name: 'BookingScreen',
    path: 'app/[locale]/instructors/[slug]/book/page.tsx',
    role: 'Экран бронирования: календарь, слоты, место, сводка',
    wave: 'booking',
    prototypeClasses: ['booking-grid'],
    screens: ['booking'],
    i18n: ['booking'],
    states: ['loading', 'ready', 'no-availability', 'hold-active', 'hold-expired'],
    notes:
      'Версия 02.09.2026: сетка «календарь + сводка» получила класс .booking-grid и на ' +
      '768px становится колонкой, сводка уезжает под календарь. На мобильном сводка с ' +
      'итогом и CTA должна оставаться доступной — StickyActionBar, а не длинная прокрутка.',
  },
  {
    name: 'BookingCalendar',
    path: 'components/booking/booking-calendar.tsx',
    role: 'Месячный календарь выбора даты',
    wave: 'booking',
    prototypeClasses: [],
    screens: ['booking'],
    i18n: ['booking', 'a11y'],
    states: ['loading', 'available', 'no-availability', 'past-date', 'selected', 'beyond-horizon'],
    notes:
      'Неделя начинается с понедельника (localeMeta.firstDayOfWeek). Горизонт — ' +
      'booking.maxAdvanceDays. Полная навигация с клавиатуры обязательна.',
  },
  {
    name: 'TimeSlotPicker',
    path: 'components/booking/time-slot-picker.tsx',
    role: 'Сетка доступных слотов на выбранную дату',
    wave: 'booking',
    prototypeClasses: [],
    screens: ['booking'],
    i18n: ['booking'],
    states: ['loading', 'slots', 'empty', 'selected', 'just-taken'],
    notes:
      'Слот кратен booking.slotGranularityMinutes. Доступность НЕ кешируется ' +
      '(dataRevalidate.availability = 0): устаревший ответ означает двойную бронь.',
  },
  {
    name: 'LocationOptionPicker',
    path: 'components/booking/location-option-picker.tsx',
    role: 'Выбор места: студия, у клиента (+плата за выезд), онлайн',
    wave: 'booking',
    prototypeClasses: [],
    screens: ['booking'],
    i18n: ['booking'],
    states: ['studio', 'customer-location', 'online', 'travel-unavailable'],
    notes:
      'Плата за выезд — booking.travelFee, радиус — booking.travelRadiusKm. ' +
      'Опция скрывается, если инструктор не выезжает (acceptsTravel).',
  },
  {
    name: 'BookingSummary',
    path: 'components/booking/booking-summary.tsx',
    role: 'Сводка брони с итогом и таймером удержания слота',
    wave: 'booking',
    prototypeClasses: [],
    screens: ['booking'],
    i18n: ['booking'],
    states: ['incomplete', 'ready', 'hold-active', 'hold-expiring', 'hold-expired'],
    notes:
      'Таймер удержания — booking.holdTtlMinutes. По истечении слот освобождается, ' +
      'и пользователь возвращается к выбору времени с понятным сообщением.',
  },

  /* ───────────────────────── Магазин ───────────────────────── */
  {
    name: 'CartScreen',
    path: 'app/[locale]/cart/page.tsx',
    role: 'Корзина: позиции с количеством, сводка, промокод, трест-бейджи',
    wave: 'commerce',
    prototypeClasses: ['cart-grid'],
    screens: ['cart'],
    i18n: ['cart', 'common.counts', 'a11y'],
    image: 'thumbnail',
    states: ['empty', 'items', 'promo-applied', 'promo-invalid', 'item-unavailable', 'price-changed'],
    notes:
      'Контрольный расчёт из макета зафиксирован в prisma/fixtures/demo.ts (demoCartTotals) ' +
      'и покрыт тестом. Перед оформлением корзина перепроверяется на сервере с diff-ответом. ' +
      'Версия 02.09.2026: .cart-grid схлопывается в колонку на 768px, миниатюры товаров ' +
      'уменьшаются на 480px.',
  },
  {
    name: 'CheckoutStepper',
    path: 'components/checkout/checkout-stepper.tsx',
    role: 'Индикатор четырёх шагов оформления',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['checkout'],
    i18n: ['checkout.steps'],
    states: ['contact', 'delivery', 'payment', 'confirm'],
    notes: 'Шаги — checkoutSteps из routes.ts, каждый шаг имеет свой URL.',
  },
  {
    name: 'PaymentMethodPicker',
    path: 'components/checkout/payment-method-picker.tsx',
    role: 'Выбор способа оплаты: ARCA, Idram, Telcell, карта',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['checkout'],
    i18n: ['checkout.payment'],
    states: ['idle', 'selected', 'redirecting', 'failed', 'method-unavailable'],
    notes:
      'Доступные способы приходят из availablePaymentMethods() — они зависят от ' +
      'настроенного провайдера, а не хардкодятся. Форма карты рендерится только для ' +
      'провайдеров с inline-вводом; для redirect-схемы её быть не должно.',
  },
  {
    name: 'OrderSummary',
    path: 'components/checkout/order-summary.tsx',
    role: 'Сводка заказа: позиции, скидка, доставка, итог',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['cart', 'checkout'],
    i18n: ['cart', 'checkout', 'common.labels'],
    states: ['default', 'recalculating', 'changed'],
  },
  {
    name: 'TrustBadges',
    path: 'components/checkout/trust-badges.tsx',
    role: 'Бейджи безопасности и возврата',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['cart', 'checkout'],
    i18n: ['cart', 'checkout.trust'],
    notes:
      'Срок возврата — commerce.returnWindowDays. Список способов оплаты должен ' +
      'совпадать с реально подключёнными: несуществующий логотип банка подрывает доверие.',
  },

  /* ───────────────────────── Базовые примитивы ───────────────────────── */
  {
    name: 'Button',
    path: 'components/ui/button.tsx',
    role: 'Кнопка: пять вариантов, три размера',
    wave: 'foundation',
    prototypeClasses: ['btn', 'btn-lg', 'btn-md', 'btn-sm', 'btn-accent', 'btn-outline', 'btn-white', 'btn-ghost', 'btn-full', 'btn-arrow'],
    screens: ['all'],
    variants: ['accent', 'outline', 'ghost', 'contrast', 'onCinema'],
    states: ['default', 'hover', 'active', 'disabled', 'loading', 'focus-visible'],
  },
  {
    name: 'Badge',
    path: 'components/ui/badge.tsx',
    role: 'Метка: направление, уровень, статус, тренд',
    wave: 'foundation',
    prototypeClasses: ['tag', 'cc-badge', 'event-type', 'inst-v'],
    screens: ['all'],
    variants: ['neutral', 'accent', 'signal', 'metal', 'success', 'warning'],
  },
  {
    name: 'Price',
    path: 'components/ui/price.tsx',
    role: 'Цена с единицей: за занятие, за час, за месяц, «от»',
    wave: 'foundation',
    prototypeClasses: ['cc-price', 'card-price', 'inst-price'],
    screens: ['all'],
    i18n: ['common.labels'],
    variants: ['perClass', 'perHour', 'perMonth', 'from', 'total'],
    notes:
      'Форматирование — только через useFormatter().number(value, "price"). ' +
      'Символ ֏ и разрядность задаются форматом локали, не строкой.',
  },
  {
    name: 'RatingStars',
    path: 'components/ui/rating-stars.tsx',
    role: 'Рейтинг звёздами с числом отзывов',
    wave: 'foundation',
    prototypeClasses: ['test-stars', 'inst-rating', 'card-rating'],
    screens: ['all'],
    i18n: ['a11y', 'reviews'],
    states: ['rated', 'not-enough-reviews'],
    notes:
      'Ниже reviews.minCountToDisplayAverage средний рейтинг не показывается — ' +
      'два отзыва не дают «4.9».',
  },
  {
    name: 'SpotsLeft',
    path: 'components/ui/spots-left.tsx',
    role: 'Индикатор свободных мест с цветовой градацией',
    wave: 'catalog',
    prototypeClasses: ['cc-spots', 'spots', 'ok', 'low'],
    screens: ['home', 'discover', 'class', 'events'],
    i18n: ['common.counts'],
    states: ['plenty', 'few', 'sold-out', 'waitlist'],
  },
  {
    name: 'FavoriteButton',
    path: 'components/ui/favorite-button.tsx',
    role: 'Кнопка добавления в избранное',
    wave: 'catalog',
    prototypeClasses: ['cc-fav'],
    screens: ['home', 'discover', 'class', 'shop'],
    i18n: ['common.actions', 'a11y'],
    states: ['inactive', 'active', 'pending', 'requires-auth'],
    notes: 'Анонимному пользователю показывается приглашение войти, а не молчаливый отказ.',
  },
  {
    name: 'Media',
    path: 'components/ui/media.tsx',
    role: 'Обёртка next/image с presets и fallback',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    i18n: ['a11y'],
    states: ['loading', 'loaded', 'error-fallback'],
    notes:
      'Единственный компонент, которому разрешено вызывать next/image. Принимает ' +
      'ImagePresetKey, а не sizes/quality: рассинхрон sizes и сетки — главная причина плохого LCP.',
  },
  {
    name: 'EmptyState',
    path: 'components/ui/empty-state.tsx',
    role: 'Пустое состояние списка с призывом к действию',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    i18n: ['common.states'],
    notes:
      'В прототипе пустых состояний нет вообще — это самый частый пробел при переносе ' +
      'макета в продукт. Компонент обязателен для каждого списка.',
  },

  /* ───────────────────── Эффекты (версия 02.09.2026) ───────────────────── */
  {
    name: 'Reveal',
    path: 'components/fx/reveal.tsx',
    role: 'Появление блока при попадании в viewport',
    wave: 'foundation',
    prototypeClasses: ['reveal', 'reveal-left', 'reveal-right', 'reveal-scale', 'stagger'],
    screens: ['all'],
    variants: ['up', 'left', 'right', 'scale', 'stagger'],
    states: ['hidden', 'visible', 'reduced-motion'],
    notes:
      'Появился в версии 02.09.2026 и применён почти ко всем секциям. Параметры — ' +
      'motion.reveal и motion.stagger. Критично: при prefers-reduced-motion блок должен ' +
      'сразу получать конечное состояние, а не оставаться прозрачным — иначе контент ' +
      'просто не виден. То же при отключённом JS: начальная непрозрачность задаётся ' +
      'только после подписки observer.',
  },
  {
    name: 'ScrollProgress',
    path: 'components/fx/scroll-progress.tsx',
    role: 'Полоса прогресса чтения страницы',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    states: ['hidden', 'visible'],
    notes:
      'В макете — элемент с inline-стилями, ширина пересчитывается на каждый скролл. ' +
      'В продукте: высота и порог из motion.scrollProgress, обновление через ' +
      'requestAnimationFrame, aria-hidden (это декорация, а не индикатор прогресса задачи).',
  },
  {
    name: 'PointerGlow',
    path: 'components/fx/pointer-glow.tsx',
    role: 'Мягкое акцентное свечение под курсором',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    states: ['idle', 'active', 'disabled'],
    notes:
      'Только при (hover: hover) and (pointer: fine) — на touch эффект бессмысленен и ' +
      'стоит кадров. Отключается при prefers-reduced-motion. Параметры — motion.pointerGlow.',
  },
];

/** Компонентов на волну — для планирования. */
export function countByWave(): Record<BuildWave, number> {
  const counts = Object.fromEntries(buildWaves.map((wave) => [wave, 0])) as Record<BuildWave, number>;
  for (const spec of componentManifest) counts[spec.wave] += 1;
  return counts;
}

/** Все CSS-классы прототипа, покрытые манифестом: контроль, что ничего не потеряно. */
export function coveredPrototypeClasses(): Set<string> {
  const covered = new Set<string>();
  for (const spec of componentManifest) {
    for (const className of spec.prototypeClasses) covered.add(className);
  }
  return covered;
}
