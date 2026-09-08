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
export const buildWaves = [
  'foundation',
  'catalog',
  /**
   * Контентные и правовые страницы. Отдельная волна, а не часть каталога: в
   * прототипе этих экранов нет вовсе, а ссылки на них есть в подвале — то есть
   * пока волна не закрыта, каждая страница сайта ведёт в 404.
   */
  'content',
  'booking',
  'commerce',
  'account',
  'admin',
] as const;
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
      'С 05.09.2026 состояние следует не порогу в 60px, а замеру: сплошной шапка становится, ' +
      'когда обёртка кинематографичного первого экрана перестаёт достигать её кромки ' +
      '(use-cinema-hero-behind.ts). Порог был верен, пока первый экран уезжал сразу; с ' +
      'приколотым экраном он красил шапку в цвет канвы поверх тёмного театра. ' +
      'Логотип — inline SVG, не изображение ' +
      '(BrandMark). Версия 02.09.2026: добавлены CTA «Book Now» (.nav-book) и бургер ' +
      '(.nav-hamburger). ОТЛИЧИЯ ОТ МАКЕТА, сделанные осознанно: (1) ссылки и CTA скрываются ' +
      'на 1024px, а не на 768px — семь разделов, четыре иконки и кнопка в строку между этими ' +
      'ширинами не помещаются, в прототипе они наезжают друг на друга; (2) «Cart» вынесена из ' +
      'строки ссылок в иконку, освободившееся место занял раздел «Studios»; (3) активный ' +
      'раздел помечается aria-current="page", а не служебным классом .active; (4) состояние ' +
      'шапки зависит не только от скролла: на страницах без кинематографичного первого экрана ' +
      'она сплошная сразу (config/navigation.ts: hasCinemaHero) — иначе тёмный текст лёг бы ' +
      'на светлый фон. Состояние authenticated придёт с волной auth отдельным клиентским ' +
      'островком: чтение сессии в шапке отключило бы SSG у всех страниц сайта.',
  },
  {
    name: 'BrandMark',
    path: 'components/brand/brand-mark.tsx',
    role: 'Знак бренда — фигура танцовщицы, inline SVG',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    notes:
      'currentColor вместо зашитого цвета: один компонент работает и на светлой шапке, и над ' +
      'тёмным hero. aria-hidden — рядом всегда стоит словесная марка, иначе скринридер ' +
      'прочитает бренд дважды.',
  },
  {
    name: 'SkipToContent',
    path: 'components/layout/skip-to-content.tsx',
    role: 'Ссылка «к содержимому» для клавиатуры и скринридеров',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['all'],
    i18n: ['nav'],
    states: ['hidden', 'focused'],
    notes:
      'В прототипе отсутствует — типичный пробел макета, который находит первый же аудит ' +
      'доступности (WCAG 2.4.1). Цель — site.mainContentId, тот же id на <main> каждого ' +
      'шаблона.',
  },
  {
    name: 'SiteFooter',
    path: 'components/layout/site-footer.tsx',
    role: 'Подвал с пятью колонками ссылок и соцсетями',
    wave: 'foundation',
    prototypeClasses: ['footer', 'footer-g', 'footer-desc', 'footer-social', 'footer-h', 'footer-l', 'footer-bt'],
    screens: ['all'],
    i18n: ['footer', 'brand'],
    notes:
      'Сетка 2fr 1fr 1fr 1fr 1fr → 2 колонки на планшете → 1 на телефоне. Состав колонок — ' +
      'данные (footerNavGroups в config/navigation.ts), а не разметка: раздел выключенного ' +
      'модуля не попадает в подвал так же, как не попадает в шапку, а пустая колонка не ' +
      'рендерится вовсе. Год в копирайте — из системного времени, а не литерал: подвал не ' +
      'должен устаревать первого января. Соцсети подписаны названием платформы, а не значком: ' +
      'брендовых иконок в lucide нет, а нарисованный по памяти чужой логотип — юридический ' +
      'риск и заметная небрежность.',
  },
  {
    name: 'PageHero',
    path: 'components/layout/page-hero.tsx',
    role: 'Баннер внутренней страницы: кадр, затемнение, заголовок',
    wave: 'catalog',
    prototypeClasses: ['hero-spacer', 'hero-banner', 'hero-banner-img', 'hero-banner-ov', 'hero-banner-content'],
    screens: ['discover', 'instructors', 'studios', 'shop', 'events'],
    i18n: ['nav'],
    image: 'heroFullBleed',
    states: ['with-image', 'without-image', 'with-breadcrumbs'],
    notes:
      'Отдельный компонент, а не копия hero главной: у баннера внутренней страницы нет ни ' +
      'видео, ни показателей, ни параллакса — только кадр и заголовок первого уровня. ' +
      '.hero-spacer из макета в продукте не нужен: высота шапки объявлена токеном ' +
      '(layout.navHeight / --layout-nav-height), а распорка пустым div — обходной путь, ' +
      'который молча ломается при смене высоты шапки.',
  },
  {
    name: 'MobileDock',
    path: 'components/layout/mobile-dock.tsx',
    role: 'Нижняя панель навигации: четыре вкладки и центральная кнопка',
    wave: 'foundation',
    prototypeClasses: ['nav-hamburger'],
    screens: ['all'],
    i18n: ['nav', 'a11y'],
    states: ['at-section', 'no-active-section', 'menu-open', 'menu-closed'],
    notes:
      'В прототипе мобильная навигация — бургер и выезжающий справа список из девяти строк. ' +
      'Заменено по существу: список начинался у ВЕРХНЕГО края экрана, а до верха телефона в ' +
      '6,7 дюйма одной рукой не дотянуться. Док стоит там, где палец уже есть. Образец — ' +
      'мобильная навигация в проектах заказчика (office, online-shop). ' +
      'Состав вкладок — mobileDockItems в config/navigation.ts, и в доке разрешены только ' +
      'разделы БЕЗ флага поставки: выключенный модуль убрал бы вкладку, остальные разъехались ' +
      'бы по сетке из пяти колонок и центральная кнопка перестала бы быть центральной ' +
      '(инвариант в navigation.test.ts). ' +
      'Геометрия задана жёстко: блок иконки и блок подписи фиксированной высоты у каждой ' +
      'вкладки. Длинная армянская подпись обрезается внутри своего блока и не может сдвинуть ' +
      'иконку соседней вкладки; активная выделяется цветом и толщиной штриха, а не масштабом — ' +
      'увеличенная иконка поднимает верхнюю кромку и получается «почти выровнено». ' +
      'Кнопка — настоящий SheetTrigger, а не своё состояние: Radix определяет по нему, куда ' +
      'вернуть фокус после закрытия. Со своим useState фокус уходил на body, потому что ' +
      'касание на телефоне кнопку не фокусирует. ' +
      'Док фиксирован, поэтому body получает нижний отступ (.has-mobile-dock) — иначе подвал ' +
      'уезжает под панель и последние ссылки сайта недостижимы. Плавающая кнопка темы ' +
      'поднимается над доком (.above-mobile-dock).',
  },
  {
    name: 'MobileMenuSheet',
    path: 'components/layout/mobile-menu-sheet.tsx',
    role: 'Шторка снизу с сеткой разделов',
    wave: 'foundation',
    prototypeClasses: ['mobile-menu', 'mobile-overlay', 'mobile-close'],
    screens: ['all'],
    i18n: ['nav', 'common.actions', 'a11y'],
    states: ['closed', 'open', 'dragging', 'closing'],
    notes:
      'Три колонки плиток вместо списка ссылок: цель размером с плитку вместо строки текста. ' +
      'Состав — mobileMenuItems: всё, чего нет в доке, из тех же данных, что шапка и подвал. ' +
      'Построена на Drawer (vaul), а НЕ на Sheet (Radix Dialog), и это результат двух ' +
      'замечаний заказчика об одном симптоме — «открывается и закрывается очень резко». ' +
      'Причина первая: вендорный Sheet рассчитывает на утилиты animate-in и ' +
      'slide-in-from-bottom из пакета tw-animate-css, которого в проекте нет — классы в ' +
      'разметке были, CSS они не генерировали, Tailwind на несуществующую утилиту не жалуется. ' +
      'Причина вторая: даже с анимацией наша брендовая кривая cubic-bezier(.16,1,.3,1) ' +
      'проходит 96% пути за первые 230ms из 500 и последние четыре пиксела ползёт — она ' +
      'рассчитана на сдвиг в несколько пикселей, а не на панель во весь экран. ' +
      'vaul для этого и написан: своя кривая для панелей (0.32, 0.72, 0, 1) и, главное, ' +
      'ЗАКРЫТИЕ ПЕРЕТАСКИВАНИЕМ — скорость пальца переходит в скорость панели, жест можно ' +
      'отменить на полпути. Именно оно отличает шторку приложения от веб-модалки. Библиотека ' +
      'уже была в зависимостях, обёртка ui/drawer.tsx лежала неиспользованной. ' +
      'autoFocus включён явно: у vaul он выключен по умолчанию (на телефоне автофокус в поле ' +
      'поднимает клавиатуру), но полей здесь нет, а модальный диалог обязан забирать фокус — ' +
      'иначе ловушке фокуса нечего держать и Tab уводит на страницу под затемнением. ' +
      'Высота по содержимому до 85dvh, а не во весь экран: шторку, занявшую экран целиком, ' +
      'нельзя ни потянуть вниз, ни увидеть, что под ней. ' +
      'Полоска-«ручка» — кнопка с доступным именем: перетаскивание недоступно с клавиатуры. ' +
      'Проверяется ФАКТ движения (несколько разных положений за первые кадры), а не класс.',
  },
  {
    name: 'SearchOverlay',
    path: 'components/search/search-overlay.tsx',
    role: 'Полноэкранный поиск с фильтрами по типу сущности',
    wave: 'catalog',
    prototypeClasses: ['searchOverlay'],
    screens: ['all'],
    i18n: ['search'],
    states: ['closed', 'open-empty', 'typing', 'loading', 'results', 'no-results', 'failed'],
    notes:
      'В прототипе — inline-стили и без логики. Открытие по клику на иконку и по Cmd/Ctrl+K. ' +
      'Debounce из limits.search.debounceMs, запрос в /api/search с отменой через AbortController: ' +
      'без отмены ответ на «сал» приходит после ответа на «сальса» и перезаписывает выдачу. ' +
      'Чипы разделов — переключатели области (aria-pressed), а не ссылки: в макете это <span> ' +
      'с cursor: pointer, то есть фильтр, у которого не было реализации. Совпадение подсвечивается ' +
      'весом и яркостью, а не цветом — акцент бренда на тёмном фоне не проходит контраст как текст. ' +
      'Миниатюр у строк нет намеренно: изображения показывает страница результатов.',
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
      'Три состояния по кругу, а не два: без «системной» пользователь, один раз нажавший ' +
      'кнопку, навсегда отвязан от системной настройки и вернуться не может — в прототипе ' +
      'именно так. Значение пишется в data-theme на <html> блокирующим скриптом next-themes ' +
      'ДО первой отрисовки: в прототипе localStorage читается в конце страницы, и пользователь ' +
      'с тёмной темой видит вспышку светлого экрана на каждой загрузке. Cookie не используем — ' +
      'чтение cookie в layout сделало бы каждую страницу динамической и лишило каталог отдачи ' +
      'с CDN. До первого выбора тему определяет @media (prefers-color-scheme) в tokens.css, ' +
      'поэтому она работает и без JavaScript. Подпись называет следующее действие и задана ' +
      'отдельным ключом на каждый вариант: собирать «Переключить на {тема}» из частей — ' +
      'верный способ получить неверный падеж в одном из трёх языков. Hero и editorial ' +
      'остаются тёмными в обеих темах — это surface-cinema, роль, а не тема.',
  },

  /* ───────────────────────── Главная ───────────────────────── */
  {
    name: 'HeroSection',
    path: 'components/home/hero-section.tsx',
    role: 'Первый экран: занавес, раскрываемый прокруткой, заголовок, две CTA, четыре показателя',
    wave: 'foundation',
    prototypeClasses: ['hero', 'hero-bg', 'hero-ov', 'hero-c', 'hero-badge', 'hero-title', 'hero-sub', 'hero-btns', 'hero-stats', 'hero-sv', 'hero-sl', 'hero-scroll'],
    screens: ['home'],
    i18n: ['home.hero'],
    image: 'heroFullBleed',
    states: ['default', 'reduced-motion', 'video-unavailable'],
    notes:
      'Версия 05.09.2026: первый экран — раскрытие занавеса прокруткой (см. HeroVideo). ' +
      'Экран приколот к верху окна, а обёртка выше окна на motion.heroParallax.' +
      'revealRunwayViewports: без этой полосы разгона занавес открывался бы уже за кромкой. ' +
      'Слои идут по доле раскрытия, а не по пикселям прокрутки (HeroParallax): затемнение ' +
      'уходит на 0.22, текст на 0.26, кадр укрупняется с 0.55 — текст обязан исчезнуть ДО ' +
      'того, как за ним окажется светлая сцена. Ушедший текст помечается inert: секция ' +
      'приколота, и невидимые кнопки иначе остаются достижимыми по Tab. ' +
      'Показатели набегают от нуля при появлении в viewport (Counter, motion.counter). ' +
      'Заголовок содержит <em> с акцентным курсивом — в i18n это отдельный ключ, а не HTML ' +
      'в строке. Показатели размечены как <dl>: «12K+» без подписи не значит ничего, и пару ' +
      '«число — подпись» скринридер должен читать парой. ДЕФЕКТ макета: min-height 100vh → ' +
      'используем 100dvh, иначе приколотый экран дёргается при появлении адресной строки на ' +
      'iOS. У секции НЕТ утилиты relative: она перебивает position: sticky из слоя ' +
      'компонентов, и экран перестаёт прикалываться.',
  },
  {
    name: 'HeroVideo',
    path: 'components/home/hero-video.tsx',
    role: 'Кадр первого экрана: занавес, раскрываемый прокруткой, и постер',
    wave: 'foundation',
    prototypeClasses: ['hero-video-wrap', 'hero-video-main', 'hero-ghosts', 'hero-ghost'],
    screens: ['home'],
    i18n: ['a11y'],
    image: 'heroFullBleed',
    states: ['poster-only', 'loading', 'revealing', 'reduced-motion', 'save-data', 'error'],
    notes:
      'Самый рискованный компонент макета. Версия 05.09.2026: петля заменена клипом, который ' +
      'ОТМАТЫВАЕТСЯ прокруткой — позиция во времени равна доле пройденной полосы разгона. ' +
      'Причина: раскрытие занавеса невозможно получить от генератора видео (модель держит ' +
      'исходную композицию и открывает занавес частично на любой длительности), а зумом в ' +
      'щель — тем более: щель занимает 13% ширины кадра, ей нужно семикратное увеличение. ' +
      'Три решения против дефектов отматывания: (1) плотные ключевые кадры в файле ' +
      '(videoLoopPolicy.hero.scrub, каждые 8 кадров) — иначе браузер отдаёт ближайший ' +
      'предыдущий ключевой и раскрытие идёт ступенями; (2) одна перемотка за раз, запросы ' +
      'складываются в одно последнее значение — иначе быстрая прокрутка ставит в очередь ' +
      'сотни перемоток; (3) прогрев декодера беззвучным play() с немедленной паузой — Safari ' +
      'на iOS не отдаёт кадры по currentTime, пока воспроизведение ни разу не начиналось. ' +
      'Постер обязателен (videoProcessing.posterRequired) и остаётся единственным содержимым ' +
      'при prefers-reduced-motion и Save-Data. Источник выбирается через navigator.' +
      'mediaCapabilities по признакам smooth и powerEfficient, а не по порядку <source>. ' +
      'ТРЕЙЛА КОПИЙ (hero-ghosts) БОЛЬШЕ НЕТ: он множил снимки ИГРАЮЩЕГО кадра, а при ' +
      'отматывании кадр стоит — шесть копий одного кадра читаются как дефект отрисовки. ' +
      'Классы прототипа оставлены за этим компонентом намеренно: они закрывают приём макета, ' +
      'решение по которому принято, а не потеряно. ' +
      'КНОПКИ ПАУЗЫ НЕТ и не требуется: движения без действия пользователя не происходит ' +
      'вовсе, а WCAG 2.2.2 говорит об анимации, которая запускается сама. ' +
      'ОСТАЛОСЬ: клип отдаётся из public/ — с появлением бакета R2 путь /media/video/… ' +
      'станет ключом объекта, меняется только videoLoop() в server/content/home.ts.',
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
    screens: ['home', 'styles'],
    i18n: ['danceStyles', 'common.counts'],
    image: 'categoryCard',
    states: ['default', 'hover', 'loading'],
    notes:
      'aspect-ratio 3/4, при 480px → 1/1. На hover: приближение и затемнение фото ' +
      '(scale 1.08, brightness .65, saturate 1.2), подъём названия на 4px, появление ' +
      'счётчика и стрелки. ОТЛИЧИЯ ОТ МАКЕТА: (1) плитка — ссылка на хаб направления ' +
      '(routes.style(slug)), а не div с onclick: подборка направления обязана быть ' +
      'шарящейся и индексируемой, а плитка — достижимой с клавиатуры. Адрес ведёт на хаб, а ' +
      'не на /discover?style=: плитка спрашивает «что такое сальса», и ровно на это хаб и ' +
      'отвечает (A-01); побочно ушёл второй адрес одного фильтра — чипы дают ?style=salsa, ' +
      'а плитка давала ?style=SALSA; (2) счётчик занятий и ' +
      'стрелка скрыты ТОЛЬКО внутри @media (hover: hover) — в прототипе они появляются на ' +
      'hover, то есть на телефоне число занятий недостижимо; (3) плитка НЕ поднимается при ' +
      'наведении, и это соответствие макету, которое легко нарушить «для единообразия с ' +
      'карточками»: у .cat нет translateY, и сетка из десяти плиток, дрожащих под курсором, ' +
      'выглядит сломанной. Класс card-surface на ней нужен только ради плавной границы. ' +
      'Счётчик на главной — число из макета (demoStyleTiles), на /styles — посчитанное по ' +
      'данным: хаб показывает занятия рядом со счётчиком, и «48» над одной карточкой было бы ' +
      'ошибкой. В production оба считаются из базы и сходятся.',
  },
  {
    name: 'StyleLinkList',
    path: 'components/catalog/style-link-list.tsx',
    role: 'Перечень направлений ссылками, без фотографий',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['styles', 'style'],
    i18n: ['danceStyles', 'common.counts', 'styleHub'],
    states: ['with-classes', 'instructors-only', 'no-supply', 'hover'],
    notes:
      'В макете этого блока нет, и он нужен именно из-за макета: плитка (.cat) держится на ' +
      'фотографии, а фотография есть у пяти направлений из восемнадцати. Кадр другого танца ' +
      'вместо отсутствующего утверждает неправду, поэтому там, где перечислены ВСЕ ' +
      'направления, работает текст. Подпись под названием — данные, а не обещание: занятия, ' +
      'если они есть; преподаватели, если занятий нет; «ищем преподавателей», если нет ' +
      'ничего. «0 занятий» сообщает то же самое, но читается как поломка.',
  },
  {
    name: 'StyleIndexScreen',
    path: 'app/[locale]/styles/page.tsx',
    role: 'Перечень всех направлений: плитки с занятиями и полный список',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['styles'],
    i18n: ['styleHub.index', 'seo.styles'],
    image: 'heroFullBleed',
    states: ['default', 'no-featured'],
    notes:
      'Страницы нет ни в макете, ни в бэклоге (A-01 просит только /styles/[style]): без неё ' +
      'тринадцать хабов из восемнадцати не имеют ни одной внутренней ссылки и живут только ' +
      'в карте сайта. Два блока с разным смыслом, а не один список дважды: «идут сейчас» — ' +
      'плитки направлений, на которые можно записаться; «все направления» — полный перечень ' +
      'текстом, включая те, для которых преподавателя пока нет.',
  },
  {
    name: 'StyleHubScreen',
    path: 'app/[locale]/styles/[style]/page.tsx',
    role: 'SEO-хаб направления: описание, занятия, преподаватели, залы, соседние направления',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['style'],
    i18n: ['styleHub', 'danceStyles', 'levels', 'common.counts'],
    image: 'heroFullBleed',
    states: ['full', 'instructors-only', 'no-supply', 'no-photo'],
    notes:
      'A-01 в бэклоге: 18 направлений × 3 локали = 54 документа под запросы вида «уроки ' +
      'бачаты в Ереване». Отличие от /classes?style=: каталог отвечает тому, кто уже выбрал, ' +
      'хаб — тому, кто выбирает, поэтому первым идёт собственный текст о направлении ' +
      '(styleHub.styles.*), и только затем предложение и ссылка в каталог с фильтром. ' +
      'Страница есть у всех восемнадцати, в индекс попадают только те, у которых есть ' +
      'занятия или преподаватели (getStyleHubSlugs → noIndex), и это следует из данных: ' +
      'появился преподаватель — страница вошла в индекс сама. Пустое состояние здесь не ' +
      'заглушка, а содержание: оно ведёт к соседним направлениям и к приглашению ' +
      'преподавать. Кадр может отсутствовать — PageHero это умеет.',
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
      'Бейдж TRENDING и FULL — взаимоисключающие, приоритет у FULL: то, что нельзя купить, ' +
      'не рекламируют. Счётчик мест — SpotsLeft с порогом commerce.lowStockThreshold. ' +
      'Кликается вся карточка, но доступное имя ссылки — только название занятия ' +
      '(растянутый ::after у якоря): в прототипе кликается div через onclick, такая карточка ' +
      'недоступна с клавиатуры и не открывается в новой вкладке. Расписание собирается из ' +
      'номера дня и времени через форматтер локали — строка «Saturday, 18:00» из данных ' +
      'означала бы английский день недели на армянской странице. Сердечко (FavoriteButton) ' +
      'видно всегда, а не только на hover: в макете оно появляется по наведению и на телефоне ' +
      'недостижимо. Оно лежит поверх растянутого якоря и работает до входа.',
  },
  {
    name: 'ClassCarousel',
    path: 'components/catalog/class-carousel.tsx',
    role: 'Горизонтальная прокрутка карточек со snap и кнопками',
    wave: 'catalog',
    prototypeClasses: ['classes', 'classes-wrap', 'scroll-arrows', 'scroll-arrow'],
    screens: ['home'],
    i18n: ['home.popular', 'a11y'],
    states: ['default', 'empty', 'loading', 'at-start', 'at-end', 'not-scrollable'],
    notes:
      'Нативный scroll-snap, без библиотеки: у браузера уже есть инерция, тачпад, ' +
      'клавиатура и поддержка prefers-reduced-motion (пакет embla был добавлен и удалён ' +
      'именно поэтому). Лента фокусируема, поэтому прокручивается стрелками клавиатуры ' +
      '(WCAG 2.1.1); кнопкам заданы aria-label и aria-controls — в макете это безымянные ' +
      'круги с символом. Шаг равен ширине карточки, а не константе. ' +
      'ОТЛИЧИЯ ОТ МАКЕТА: (1) кнопки появляются только если скрыто больше половины ' +
      'карточки — в прототипе четыре карточки на широком экране прокручиваются на 36px, и ' +
      'кнопки при этом есть; (2) карточки эластичны (min 260 / max 300px, как в CSS макета), ' +
      'поэтому на широком экране строка заполняется без обрезанного края; (3) перетаскивание ' +
      'мышью не переносится: чтобы отличить перетаскивание от клика, нужно подавлять переход ' +
      'по ссылке, и цена ошибки — карточка, которая иногда не открывается.',
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
    notes:
      'Рейтинг рисует RatingStars и сам решает, показывать ли среднюю оценку. Бейдж ' +
      'верификации в прототипе — зелёный круг с галочкой без подписи: для скринридера это ' +
      'ничего не значащая картинка. Здесь у него есть текстовая альтернатива ' +
      '(instructor.verifiedBadge), а значок aria-hidden. Цена — «от»: ставка зависит от ' +
      'длительности и места занятия. Сетка 4→2→1.',
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
      'scrim.editorialRadial. Не зависит от темы. ' +
      'ОТЛИЧИЕ ОТ МАКЕТА: фон — фоновая петля (EditorialVideo), а не статичный кадр. ' +
      'Клип прислан заказчиком 04.09.2026, отклонение согласовано (docs/00-decision-record.md ' +
      '§8); при reduced-motion и Save-Data остаётся постер, то есть ровно макет. Добавлен ' +
      'второй scrim под текстом (scrim.editorialCopy): яркость движущегося кадра за ' +
      'заголовком меняется на каждом кадре, и без вуали ivory-текст терял контраст.',
  },
  {
    name: 'EditorialVideo',
    path: 'components/home/editorial-video.tsx',
    role: 'Фоновая петля заявления бренда с постером и упреждающей загрузкой',
    wave: 'foundation',
    prototypeClasses: ['editorial-bg'],
    screens: ['home'],
    i18n: [],
    image: 'editorialFullBleed',
    states: ['poster', 'loading', 'playing', 'reduced-motion', 'save-data'],
    notes:
      'В прототипе фон секции — <img>. Петля добавлена по просьбе заказчика; политика ' +
      'кодирования — videoProcessing.editorialLoop, файлы собраны npm run video:encode -- ' +
      '--loop editorial. Отличия от петли первого экрана: (1) файл не качается, пока секция ' +
      'далеко — источник выбирается за preloadAheadViewportFactor экранов до появления, ' +
      'иначе петля тратилась бы на секцию, до которой могут не долистать; (2) шлейфа копий ' +
      'нет — он был бы вторым набором декодов ради эффекта, который в этой секции не читается; ' +
      '(3) кадр растворён к краям маской mask.cinemaEdges, иначе видео читается как ' +
      'вставленное окно в чёрной секции; (4) blur() на видео нет — у постера он скрывает ' +
      'артефакты одного кадра, у петли это фильтр на каждый кадр во весь экран. ' +
      'Постер — ПЕРВЫЙ кадр самой петли (editorial-loop-poster), поэтому подмена не читается ' +
      'как смена картинки. Кнопки паузы нет по тому же решению, что у hero.',
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
    notes:
      'Оснащение — до трёх меток, остальное «+N»: полный список из восьми пунктов ' +
      'превращает карточку в таблицу и мешает сравнивать площадки, для чего сетка и ' +
      'существует. Иконка района — lucide, а не эмодзи 📍: эмодзи рендерится по-разному в ' +
      'системах, а скринридер читает его как «булавка».',
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
    notes:
      'Защищается Turnstile и rateLimits.contactForm. Требует явного согласия на обработку: ' +
      'подписка без отмеченной галочки — нарушение ЗРА «О защите персональных данных», и ' +
      'действие возвращает ошибку валидации. Адрес подтверждается письмом (double opt-in), ' +
      'иначе любой может подписать чужую почту и рассылка собирает жалобы на спам. Успех ' +
      'ЗАМЕНЯЕТ форму: оставленное поле приглашает подписаться второй раз, а вторая подписка ' +
      'ничего не делает. Состояние «уже подписаны» отдельное — обещание «проверьте почту» в ' +
      'этом случае было бы ложью, письма не будет.',
  },
  {
    name: 'SectionHeading',
    path: 'components/ui/section-heading.tsx',
    role: 'Надзаголовок + заголовок + подзаголовок секции',
    wave: 'foundation',
    prototypeClasses: ['sec-h', 'label', 'c', 'sec-title', 'sec-subtitle', 'detail-h'],
    screens: ['all'],
    variants: ['left', 'center'],
    states: ['with-subtitle', 'without-subtitle', 'on-cinema'],
    notes:
      'Надзаголовок имеет декоративную золотую черту через ::before (.eyebrow-rule в ' +
      'globals.css). Уровень заголовка задаётся пропом level: на главной секции идут ' +
      'вторым уровнем, внутри страницы — третьим, и скачок h2 → h4 здесь невозможен. ' +
      'Подзаголовок необязателен и не создаёт пустой <p>.',
  },

  /* ───────────────────────── Каталог и детали ───────────────────────── */
  {
    name: 'DiscoverFilters',
    path: 'components/catalog/discover-filters.tsx',
    role: 'Фильтры каталога: направление, уровень, цена, дата, город',
    wave: 'catalog',
    prototypeClasses: ['tags', 'tag'],
    screens: ['discover'],
    i18n: ['catalog.filters', 'catalog.sort'],
    states: ['collapsed', 'expanded', 'applied', 'empty-result'],
    notes:
      'В прототипе только чипы направлений. Состояние фильтров живёт в URL (routes.discover), ' +
      'а не в React-состоянии: ссылка должна быть шарящейся и индексируемой. Каждый чип — ' +
      'ссылка, а не кнопка с обработчиком: открывается в новой вкладке и работает без JS. ' +
      'На 1024px и ниже фильтры уходят в Sheet, а НЕ исчезают, как в макете ' +
      '(display: none !important на 360px): каталог без фильтров на телефоне бесполезен. ' +
      'Активный чип помечается aria-current="page" — цвет как единственный признак выбора ' +
      'не годится. Группы обёрнуты в fieldset/legend, иначе скринридер читает список ссылок ' +
      'без назначения.',
  },
  {
    name: 'CatalogShell',
    path: 'components/catalog/catalog-shell.tsx',
    role: 'Общая обвязка листинга: счётчик, фильтры, пустое состояние, пагинация',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['discover', 'classes', 'instructors', 'studios', 'events', 'shop'],
    i18n: ['catalog', 'common.states'],
    states: ['results', 'empty-filtered', 'empty-unfiltered', 'single-page', 'paginated'],
    notes:
      'Шесть разделов каталога отличаются только карточкой и сеткой. Всё остальное — общее, ' +
      'и держится здесь, иначе пустое состояние поправят в одном разделе из шести. Сетка ' +
      'карточек остаётся у страницы: у товаров четыре колонки, у площадок три, у занятий ' +
      'эластичная лента, и пропс columns={{sm:2,lg:4}} был бы переписыванием Tailwind. ' +
      'Пустое состояние ЗАМЕНЯЕТ содержимое, а не дописывается под ним: список из нуля ' +
      'карточек с текстом под ним читается как «загружается».',
  },
  {
    name: 'CatalogPagination',
    path: 'components/catalog/catalog-pagination.tsx',
    role: 'Страницы листинга ссылками с сохранением фильтров',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['discover', 'classes', 'instructors', 'studios', 'events', 'shop'],
    i18n: ['catalog.pagination', 'a11y'],
    states: ['single-page', 'first-page', 'middle-page', 'last-page', 'with-gaps'],
    notes:
      'Ссылки, а не кнопки: ?page=3 обязан открываться по прямому адресу и попадать в ' +
      'индекс. Первая страница пишется БЕЗ параметра — один канонический адрес. rel=prev/next ' +
      'сообщают поисковику, что это одна серия, а не десять похожих документов. Пропуск в одну ' +
      'страницу показывается номером, а не многоточием (paginationWindow).',
  },
  {
    name: 'FavoriteButton',
    path: 'components/ui/favorite-button.tsx',
    role: 'Сохранить занятие, инструктора или площадку',
    wave: 'catalog',
    prototypeClasses: ['cc-fav'],
    screens: ['home', 'discover', 'class', 'instructor', 'studios', 'shop'],
    i18n: ['favorites', 'a11y'],
    states: ['inactive', 'active', 'on-media', 'guest', 'authenticated'],
    notes:
      'В макете ♡ появляется только на hover — на телефоне такая кнопка недостижима. Здесь ' +
      'видна всегда, наведение меняет только заметность. Работает ДО входа: набор гостя живёт ' +
      'в localStorage (lib/client/favorites.ts) и переносится в Favorite при входе, как ' +
      'корзина гостя. Состояние передаётся aria-pressed и заливкой, а не только цветом. ' +
      'Доступное имя включает название сущности: на странице десяток одинаковых кнопок.',
  },
  {
    name: 'ClassDetailScreen',
    path: 'app/[locale]/classes/[slug]/page.tsx',
    role: 'Страница занятия: обложка, описание, чему научитесь, инструктор, панель брони',
    wave: 'booking',
    prototypeClasses: ['tag', 'tags', 'class-grid', 'detail-grid', 'detail-body', 'detail-mb', 'instructor-row', 'sticky-sidebar', 'sidebar-card'],
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
  {
    name: 'StudioDetailScreen',
    path: 'app/[locale]/studios/[slug]/page.tsx',
    role: 'Страница зала: описание, оснащение, занятия и афиша, как добраться',
    wave: 'catalog',
    prototypeClasses: ['detail-grid', 'sidebar-card', 'tag'],
    screens: ['studio'],
    i18n: ['studio', 'reviews'],
    image: 'studioCard',
    states: ['available', 'no-classes', 'rent-unavailable'],
    notes:
      'Главное действие — «занятия здесь», а не аренда: аренда зала приходит с движком ' +
      'доступности (фаза 3), и ссылка на несуществующий маршрут была бы 404 в каталоге. ' +
      'Кнопка аренды выключена и объяснена рядом (common.states.comingSoon) — тем же ' +
      'приёмом, что недоступный способ оплаты. Залов внутри площадки нет: в данных одна ' +
      'площадь и одна вместимость, поле придёт с VenueRoom. Карта — ссылка по координатам ' +
      '(site.maps), встроенная карта требует ключа и стоит отдельной задачей.',
  },
  {
    name: 'EventDetailScreen',
    path: 'app/[locale]/events/[slug]/page.tsx',
    role: 'Страница события: когда, где, места, регистрация',
    wave: 'catalog',
    prototypeClasses: ['detail-grid', 'sidebar-card', 'event-type'],
    screens: ['event'],
    i18n: ['events'],
    image: 'studioCard',
    states: ['upcoming', 'free-entry', 'open-entry', 'few-spots', 'registration-unavailable'],
    notes:
      'Ноль в цене — «вход свободный» словом, а не «0 ֏». У события с открытым входом ' +
      'счётчик мест не показывается: «осталось 200 из 200» на площади не информация. ' +
      'Регистрация выключена до появления движка брони, кнопка объяснена рядом. Место — ' +
      'ссылка, если это площадка каталога, и текст, если внешняя площадь.',
  },

  /* ───────────────────────── Бронирование ───────────────────────── */
  {
    name: 'BookingScreen',
    path: 'app/[locale]/instructors/[slug]/book/page.tsx',
    role: 'Экран бронирования: календарь, слоты, место, сводка',
    wave: 'booking',
    prototypeClasses: ['booking-grid', 'booking-detail-grid'],
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
    prototypeClasses: ['cal-week', 'cal-3col', 'cal-3col-gap'],
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
    prototypeClasses: ['info-row', 'info-row-success'],
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
    name: 'CartLineItem',
    path: 'components/cart/cart-line-item.tsx',
    role: 'Позиция корзины: миниатюра, вариант, цена, количество, удаление',
    wave: 'commerce',
    prototypeClasses: ['img-product'],
    screens: ['cart'],
    i18n: ['cart', 'shop', 'common.actions', 'common.labels', 'a11y'],
    image: 'thumbnail',
    states: ['default', 'pending', 'low-stock', 'out-of-stock', 'price-changed'],
    notes:
      'Перенесён из CartScreen отдельным компонентом: строка товара с количеством и удалением ' +
      'используется и в корзине, и в подтверждении заказа, и в кабинете. Количество не хранится ' +
      'внутри — истина о корзине на сервере (после validateCart цена и остаток могут ' +
      'измениться), компонент сообщает о желании изменить его и рисует ответ. Порог «осталось ' +
      'мало» — commerce.lowStockThreshold. Миниатюра 100 → 76 → 60px, как в макете, но ' +
      'пропорция задаётся preset thumbnail, а не классом. Удаление — текстовая кнопка, как в ' +
      'прототипе: крестик в углу строки нажимается случайно. Доступное имя кнопки включает ' +
      'название товара — пять кнопок «Удалить» подряд для скринридера неразличимы.',
  },
  {
    name: 'PromoCodeForm',
    path: 'components/cart/promo-code-form.tsx',
    role: 'Ввод промокода и снятие применённого',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['cart', 'checkout'],
    i18n: ['cart', 'validation'],
    states: ['empty', 'too-short', 'pending', 'applied', 'invalid'],
    notes:
      'В ПРОТОТИПЕ ЭТОГО БЛОКА НЕТ: скидка показана уже применённой строкой «Discount ' +
      '(WELCOME10)», то есть код взялся из ниоткуда. Ключи в каталоге переводов при этом есть, ' +
      'а состояния promo-applied / promo-invalid перечислены у CartScreen — поле ожидается ' +
      'продуктом. Валидность кода проверяет server action, компонент — только длину ' +
      '(promotions.codeMinLength) и регистр. В заказе один код ' +
      '(promotions.maxCodesPerOrder), поэтому заменить его можно только сняв прежний.',
  },
  {
    name: 'CheckoutScreen',
    path: 'app/[locale]/checkout/[step]/page.tsx',
    role: 'Оформление заказа: шаги, формы, сводка справа',
    wave: 'commerce',
    prototypeClasses: ['checkout-grid'],
    screens: ['checkout'],
    i18n: ['checkout', 'validation'],
    states: ['contact', 'delivery', 'payment', 'confirm', 'cart-changed', 'payment-failed'],
    notes:
      'Каждый шаг — свой URL (checkoutSteps в routes.ts), поэтому «назад» браузера работает ' +
      'как ожидается, а брошенное оформление можно возобновить ссылкой. Сетка .checkout-grid ' +
      'схлопывается в колонку на 768px, сводка уезжает под формы, но итог и CTA обязаны ' +
      'остаться доступны — StickyActionBar.',
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
    prototypeClasses: ['tag', 'cc-badge', 'event-type', 'inst-v', 'badge-accent'],
    screens: ['all'],
    variants: ['neutral', 'accent', 'signal', 'metal', 'success', 'warning', 'onMedia'],
    notes:
      'В прототипе это четыре класса с почти одинаковыми стилями. Варианты названы по ' +
      'смысловой роли, а не по виду. Осознанно НЕ shadcn/ui badge: его модель ' +
      '(default|secondary|destructive|outline) описывает вид, и в ней негде выразить ' +
      '«осталось мало мест» (signal) и «проверенный инструктор» (metal); поведения у метки ' +
      'нет, поэтому чужая разметка дала бы только второй источник правды о цветах. ' +
      'Вариант onMedia — плотная плашка поверх фотографии (.cc-badge): полупрозрачный фон ' +
      'на снимке не читается.',
  },
  {
    name: 'Price',
    path: 'components/ui/price.tsx',
    role: 'Цена с единицей: за занятие, за час, за месяц, «от»',
    wave: 'foundation',
    prototypeClasses: ['cc-price', 'card-price', 'inst-price', 'price-heading', 'price-sub'],
    screens: ['all'],
    i18n: ['common.labels'],
    variants: ['perClass', 'perHour', 'perMonth', 'perYear', 'perSession', 'from', 'total'],
    notes:
      'Форматирование — только через useFormatter().number(value, "price"). Символ ֏, ' +
      'разрядность и позиция знака заданы форматом локали: «5,000 ֏» вместо «5 000 ֏» — ' +
      'признак непереведённого сайта. Единица — отдельный элемент, а не часть строки ' +
      'перевода с подставленной суммой: иначе цену нельзя выделить визуально и нельзя ' +
      'прочитать голосом отдельно от единицы.',
  },
  {
    name: 'RatingStars',
    path: 'components/ui/rating-stars.tsx',
    role: 'Рейтинг звёздами с числом отзывов',
    wave: 'foundation',
    prototypeClasses: ['test-stars', 'inst-rating', 'card-rating'],
    screens: ['all'],
    i18n: ['a11y', 'common.counts'],
    states: ['rated', 'not-enough-reviews'],
    notes:
      'Ниже reviews.minCountToDisplayAverage средний рейтинг не показывается — два отзыва ' +
      'не дают «4.9», это ложное впечатление проверенности; выводится только число отзывов. ' +
      'Звёзды aria-hidden, скринридер получает строку a11y.ratingStars: пять символов ★ в ' +
      'дереве доступности читаются как «звезда звезда звезда». Дробная часть — заливка по ' +
      'ширине, а не округление: 4.6 это не пять звёзд и не четыре.',
  },
  {
    name: 'SpotsLeft',
    path: 'components/ui/spots-left.tsx',
    role: 'Индикатор свободных мест с цветовой градацией',
    wave: 'foundation',
    prototypeClasses: ['cc-spots', 'spots', 'ok', 'low'],
    screens: ['home', 'discover', 'class', 'events'],
    i18n: ['common.counts', 'common.actions'],
    states: ['plenty', 'few', 'sold-out', 'waitlist'],
    notes:
      'Порог «мало» — commerce.lowStockThreshold: это коммерческий рычаг, им управляет ' +
      'владелец продукта в одном месте. Цвет не единственный носитель смысла — текст всегда ' +
      'называет количество словами (WCAG 1.4.1). «Мест нет» и «есть лист ожидания» — разные ' +
      'состояния: во втором действие ещё возможно, и подпись это сообщает.',
  },
  {
    name: 'QuantityStepper',
    path: 'components/ui/quantity-stepper.tsx',
    role: 'Счётчик количества: «−», число, «+»',
    wave: 'commerce',
    prototypeClasses: [],
    screens: ['cart', 'shop'],
    i18n: ['a11y', 'common.labels'],
    states: ['default', 'at-min', 'at-max', 'disabled'],
    notes:
      'В макете это три div с символами и без обработчиков. Здесь две кнопки с доступными ' +
      'именами (a11y.quantityIncrease / quantityDecrease) и иконками lucide: «−» из шрифта ' +
      'скринридер читает как «минус», иконка помечена aria-hidden. Границы — из домена ' +
      '(clampQuantity → commerce.maxQuantityPerItem), то же правило действует на сервере. ' +
      'Кнопка на границе отключается, а не молча ничего не делает.',
  },
  {
    name: 'CountdownTimer',
    path: 'components/ui/countdown-timer.tsx',
    role: 'Обратный отсчёт до истечения срока',
    wave: 'booking',
    prototypeClasses: [],
    screens: ['booking', 'checkout'],
    i18n: ['booking'],
    states: ['running', 'warning', 'expired', 'before-hydration'],
    notes:
      'Считает сервер, отображает клиент: приходит момент (expiresAt), а не «осталось 15 ' +
      'минут» — длительность, посчитанная на сервере и отрисованная через две секунды, уже ' +
      'врёт. До гидратации выводится прочерк: разница часов сервера и клиента дала бы разный ' +
      'текст в одном узле, то есть ошибку гидратации. Часы клиента могут быть неверны, поэтому ' +
      'onExpire не отменяет бронь, а просит экран перечитать состояние. По истечении таймер ' +
      'останавливается. aria-live намеренно нет: секунды вслух перекрывают всё остальное.',
  },
  {
    name: 'Media',
    path: 'components/ui/media.tsx',
    role: 'Обёртка next/image с presets и fallback',
    wave: 'foundation',
    prototypeClasses: ['avatar', 'avatar-md', 'img-landscape', 'img-product'],
    screens: ['all'],
    i18n: ['a11y'],
    states: ['loading', 'loaded', 'error-fallback'],
    notes:
      'Единственный компонент, которому разрешено вызывать next/image. Принимает ' +
      'ImagePresetKey, а не sizes/quality: рассинхрон sizes и сетки — главная причина плохого LCP. ' +
      'Классы прототипа img-landscape, img-product, avatar, avatar-md — это фиксированные ' +
      'пропорции кадра; в продукте им соответствуют presets, поэтому пропорция задаётся ' +
      'выбором preset, а не классом в разметке.',
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
  {
    name: 'AuthShell',
    path: 'components/auth/auth-shell.tsx',
    role: 'Рамка экранов входа, регистрации и сброса пароля',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['sign-in', 'sign-up', 'forgot-password', 'reset-password'],
    i18n: ['auth'],
    notes:
      'В прототипе этих экранов нет: в нём нет входа. Рамка выведена из его же правил — узкая ' +
      'карточка, заголовок font-display, поля во всю ширину, те же токены, что у карточек ' +
      'каталога. Ни шапки, ни подвала: единственная задача экрана — впустить человека, а ' +
      'навигация по каталогу уводит от неё. Высота 100dvh, а не 100vh: на iOS адресная строка ' +
      'иначе прячет кнопку отправки.',
  },
  {
    name: 'SignInScreen',
    path: 'components/auth/sign-in-form.tsx',
    role: 'Вход по адресу и паролю',
    wave: 'foundation',
    prototypeClasses: ['form-input'],
    screens: ['sign-in'],
    i18n: ['auth.signIn', 'validation'],
    states: ['idle', 'submitting', 'invalid-credentials', 'locked-out', 'captcha-required'],
    notes:
      'Ошибка входа — одна на форму, а не на поле: «неверный адрес или пароль» относится к паре, ' +
      'и подсветить одно поле значило бы сказать, какое именно неверно. Это то же перечисление ' +
      'адресов, которое закрывает сервер. Блокировка после серии неудач приходит отдельным ' +
      'сообщением с числом минут: разница между «неверные данные» и «подождите 15 минут» ' +
      'определяет, что человек сделает дальше. Переход после входа считает сервер и проверяет ' +
      'путь на относительность — иначе ?redirectTo=https://зло.example превращает страницу ' +
      'входа в фишинговый редирект.',
  },
  {
    name: 'AccountOverviewScreen',
    path: 'app/[locale]/account/page.tsx',
    role: 'Кабинет клиента: обзор',
    wave: 'account',
    prototypeClasses: [],
    screens: ['account'],
    i18n: ['account', 'nav'],
    states: ['authenticated', 'no-bookings', 'no-orders'],
    notes:
      'Первый экран кабинета и одновременно то, чего не хватало входу: без него успешный вход ' +
      'приводил на несуществующий адрес, а иконка «Account» в шапке вела в 404. Гвард здесь, а ' +
      'не только в proxy.ts: прокси перенаправляет по НАЛИЧИЮ cookie, а подпись и isActive ' +
      'проверяет getCaller. Страница перенаправляет, а не бросает: requireCaller уместен в ' +
      'server action, на странице он даёт экран ошибки вместо формы входа. Броней и заказов нет ' +
      'и взять их неоткуда — Booking создаёт продукт, а не сид, поэтому пустые состояния с ' +
      'дорогой в каталог и есть содержимое экрана на сегодня.',
  },
  {
    name: 'StatusBadge',    path: 'components/data/status-badge.tsx',
    role: 'Статус сущности: единственное место, где он превращается в цвет и текст',
    wave: 'admin',
    prototypeClasses: [],
    screens: ['account', 'admin', 'checkout'],
    i18n: ['status'],
    variants: ['booking', 'payment', 'order', 'payout', 'moderation'],
    notes:
      'В прототипе статусов нет: в нём нет ни кабинета, ни админки. Компонент заведён до них ' +
      'намеренно — как только статус красится по месту, в проекте появляется пять разных ' +
      'наборов цветов для одного CANCELLED, и «почему у меня зелёная отмена, а у клиента ' +
      'красная» становится вопросом на приёмке. Карты статус → тон полные по построению ' +
      '(satisfies Record), поэтому новый статус в схеме нельзя забыть покрасить. Тон выбран по ' +
      'смыслу состояния: success — дошло до конца, accent — идёт по плану, warning — ждёт ' +
      'кого-то, signal — сорвалось, neutral — закрыто без последствий. Цвет не единственный ' +
      'носитель смысла: подпись есть всегда, поэтому WCAG 1.4.1 выполнен без иконок.',
  },
  {
    name: 'FormField',
    path: 'components/ui/form-field.tsx',
    role: 'Поле формы: подпись, ввод, подсказка, ошибка',
    wave: 'catalog',
    prototypeClasses: ['form-label', 'form-input', 'form-2col'],
    screens: ['booking', 'checkout', 'auth', 'account'],
    i18n: ['validation', 'common.labels'],
    states: ['idle', 'focused', 'filled', 'invalid', 'disabled', 'readonly'],
    notes:
      'В прототипе поля — просто <input class="form-input"> без подписей: в четырёх формах ' +
      'из пяти подпись заменена placeholder, что исчезает при вводе и не читается ' +
      'скринридером (WCAG 3.3.2). Здесь подпись обязательна и связана с полем через id, ' +
      'сообщение об ошибке — через aria-describedby, а сам факт ошибки — aria-invalid. ' +
      'Текст ошибки берётся из namespace validation, а не пишется у места вызова: одна и та ' +
      'же ошибка обязана звучать одинаково во всех формах.',
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
      'motion.reveal и motion.stagger, они же попадают в CSS-переменные генератором ' +
      'токенов: смещение «60px» знают и CSS (переход), и JS (порог наблюдателя). ' +
      'КРИТИЧНО и исправлено против макета: скрытое состояние объявлено только внутри ' +
      '@media (scripting: enabled) and (prefers-reduced-motion: no-preference). В прототипе ' +
      '`.reveal { opacity: 0 }` задано статически — без JavaScript страница остаётся пустой, ' +
      'это потеря контента, а не потеря анимации. Наблюдатель один на страницу, а не по ' +
      'одному на секцию; готовность помечается атрибутом data-revealed прямо на узле, без ' +
      'состояния React — за появлением не следует никакой логики, и рендер секции ради ' +
      'атрибута не нужен.',
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
      'В макете — элемент, создаваемый скриптом с инлайновыми стилями, ширина ' +
      'пересчитывается на каждое событие скролла. В продукте: высота, слой и порог из ' +
      'motion.scrollProgress, обновление через requestAnimationFrame, transform: scaleX ' +
      'вместо width (width анимируется через layout, transform — через композитор), ' +
      'aria-hidden (это декорация, а не индикатор выполнения задачи). Начальное состояние ' +
      'задаётся тем же свойством transform, что и обновление из скрипта: утилита scale-x-0 ' +
      'в Tailwind v4 пишет в отдельное свойство scale, из-за чего полоса на каждой загрузке ' +
      'мигала на всю ширину. На короткой странице скрыта.',
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
      'стоит кадров. При prefers-reduced-motion не существует в DOM вообще, а не скрыт ' +
      'стилями. Цвет — accent-soft, тот же акцент под 8%, что и в макете. Позиция ' +
      'обновляется мимо состояния React: движение мыши даёт десятки событий в секунду. ' +
      'Слой — z-sticky: над контентом, но под шапкой, иначе пятно размывало бы навигацию.',
  },
  {
    name: 'CardTilt',
    path: 'components/fx/card-tilt.tsx',
    role: '3D-наклон карточки под курсором',
    wave: 'catalog',
    prototypeClasses: [],
    screens: ['home', 'discover', 'instructors', 'studios', 'shop'],
    states: ['idle', 'tilting', 'disabled'],
    notes:
      'Эффект есть в прототипе (.cat, .inst, .card), но его не было в этой карте: он живёт ' +
      'в inline-JS и применяется к трём классам сразу. Параметры — motion.cardTilt. ' +
      'Реализован обёрткой, а не стилем карточки: у карточки свой hover-подъём тоже через ' +
      'transform, и два источника одного свойства означают, что одно состояние затирает ' +
      'другое. Обёртка отвечает за поворот, карточка — за подъём, они складываются. ' +
      'Отключён на touch и при prefers-reduced-motion.',
  },
  {
    name: 'Counter',
    path: 'components/fx/counter.tsx',
    role: 'Число, набегающее от нуля при появлении в области просмотра',
    wave: 'foundation',
    prototypeClasses: ['hero-sv', 'hero-sl', 'hero-stats'],
    screens: ['home'],
    states: ['before-start', 'counting', 'done', 'reduced-motion', 'no-script'],
    notes:
      'Параметры — motion.counter: 2200ms и ease-out четвёртой степени, как в прототипе. ' +
      'ГЛАВНОЕ ОТЛИЧИЕ: в разметку попадает итоговое число, а не нуль. В макете в HTML стоит ' +
      '0, а значение живёт в атрибуте data-count — для пользователя без JavaScript и для ' +
      'поискового робота на первом экране написано «0+ активных танцоров», то есть теряется ' +
      'не анимация, а факт. Чтобы при этом не показать «число → нуль → число» в момент ' +
      'гидратации, стартовое состояние скрыто в CSS теми же условиями, что появление секций ' +
      '(scripting: enabled + prefers-reduced-motion: no-preference), причём через visibility: ' +
      'элемент продолжает занимать место, и раскладка hero не дёргается. Знак «+» входит в ' +
      'тот же элемент: иначе на время гидратации на экране остаётся одинокий плюс. ' +
      'Форматирование через локаль, а не toLocaleString() без аргументов, как в макете.',
  },
  {
    name: 'HeroParallax',
    path: 'components/fx/hero-parallax.tsx',
    role: 'Расслоение первого экрана при уходе вверх',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['home'],
    states: ['at-top', 'scrolling', 'past', 'disabled'],
    notes:
      'В прототипе — inline-обработчик scroll, который на каждое событие пишет три ' +
      'transform подряд. Здесь роли назначаются атрибутом data-parallax (background, ' +
      'content, overlay), а сдвиги считаются в одном requestAnimationFrame: фон уезжает ' +
      'медленнее экрана, контент быстрее и гаснет, затемнение растворяется. Коэффициенты — ' +
      'motion.heroParallax. Считается только пока первый экран пересекает viewport: ' +
      'обработчик, работающий на всей длине страницы, тратит кадры на невидимое. ' +
      'При prefers-reduced-motion эффекта нет вовсе, слушатель не подписывается.',
  },
  {
    name: 'SectionParallax',
    path: 'components/fx/section-parallax.tsx',
    role: 'Медленный проезд фона секции относительно её содержимого',
    wave: 'foundation',
    prototypeClasses: [],
    screens: ['home'],
    states: ['before', 'in-view', 'after', 'disabled'],
    notes:
      'Тот же приём, что в hero, но привязка иная: ход считается от положения самой ' +
      'секции в окне, а не от прокрутки страницы, поэтому эффект не зависит от того, ' +
      'сколько секций стоит выше, и вставка блока выше по странице его не сдвигает. ' +
      'Используется в editorial («EVERY BODY HAS A RHYTHM»). Слоёв ТРИ, и это суть эффекта: ' +
      'кадр проходит 200px, блок содержимого 60px, заголовок 40px и попутно меняет масштаб ' +
      'на 0.08 — числа из макета как есть (motion.sectionParallax). Глубину создаёт разница ' +
      'скоростей: «параллакс», в котором двигается только фон, читается как съехавшая ' +
      'картинка. Кадр увеличен на 20% — без запаса ход открывает полосу у кромки. ' +
      'Отключён до 768px и при prefers-reduced-motion.',
  },

  /* ───────────────────── Контентные и правовые страницы ─────────────────────
   *
   * Ни одного из этих блоков в прототипе нет: макет заканчивается каталогом и
   * оформлением заказа. Классы прототипа у них пустые, и это правда, а не
   * недоработка — `design:status` учитывает их в плане волны, но не ждёт от них
   * покрытия классов макета.
   */
  {
    name: 'ContentSection',
    path: 'components/content/content-section.tsx',
    role: 'Полоса контентной страницы: фон, контейнер, заголовок, содержимое',
    wave: 'content',
    prototypeClasses: [],
    screens: ['about', 'help', 'faq', 'pricing', 'gift-cards', 'become-instructor', 'list-your-studio'],
    i18n: [],
    states: ['canvas', 'raised', 'cinema', 'tight', 'prose', 'anchored'],
    notes:
      'Восемь страниц собраны из одного каркаса, иначе ритм секций расходится между ними ' +
      'на одну ступень отступа — и это видно только когда страницы стоят рядом на приёмке. ' +
      'Якорь (id) получает scroll-margin в высоту шапки: без этого переход из оглавления ' +
      'ставит заголовок под прилипшую шапку.',
  },
  {
    name: 'ValueGrid',
    path: 'components/content/value-grid.tsx',
    role: 'Сетка карточек «заголовок + абзац», опционально ссылкой',
    wave: 'content',
    prototypeClasses: [],
    screens: ['about', 'help', 'become-instructor', 'list-your-studio'],
    states: ['static', 'link', 'on-cinema', '2-col', '3-col', '4-col'],
    notes:
      'Иконки из lucide-react и всегда декоративные: эмодзи из прототипа скринридер читает ' +
      'вслух посреди делового текста. Карточка-ссылка кликается целиком, а не подписью.',
  },
  {
    name: 'StepList',
    path: 'components/content/step-list.tsx',
    role: 'Нумерованные шаги «как это работает»',
    wave: 'content',
    prototypeClasses: [],
    screens: ['become-instructor', 'list-your-studio', 'gift-cards'],
    states: ['row', 'column', 'on-cinema'],
    notes:
      'Разметка <ol>: порядок здесь смысловой, и скринридер объявляет номер сам — ' +
      'нарисованная цифра остаётся декоративной (aria-hidden).',
  },
  {
    name: 'FactList',
    path: 'components/content/fact-list.tsx',
    role: 'Список утверждений с отметкой: условия, требования, правила',
    wave: 'content',
    prototypeClasses: [],
    screens: ['become-instructor', 'list-your-studio', 'gift-cards'],
    states: ['check', 'info', 'neutral', '2-col'],
  },
  {
    name: 'FaqAccordion',
    path: 'components/content/faq-accordion.tsx',
    role: 'Вопросы и ответы группами + разметка FAQPage',
    wave: 'content',
    prototypeClasses: [],
    screens: ['faq'],
    i18n: ['faq'],
    states: ['collapsed', 'expanded', 'no-javascript'],
    notes:
      'На <details>, а не на вендорном Accordion: Radix размонтирует закрытое содержимое, ' +
      'и в HTML страницы остаются вопросы без ответов — для страницы, которая живёт с ' +
      'выдачи, это исключает главное. Схема FAQPage собирается из того же массива, что и ' +
      'список: расхождение Google трактует как обман и снимает сниппет целиком.',
  },
  {
    name: 'PlanComparisonTable',
    path: 'components/content/plan-comparison-table.tsx',
    role: 'Сравнение тарифов по квотам',
    wave: 'content',
    prototypeClasses: [],
    screens: ['pricing'],
    i18n: ['pricing'],
    states: ['default', 'highlighted-plan', 'boolean-cell', 'unlimited-cell'],
    notes:
      'Настоящая <table> с <th scope>: сетка из div читается скринридером как поток ' +
      'значений без связи со строкой и колонкой. Значения — из PlanQuota, а не текстом: ' +
      'иначе «2 занятия» в карточке разойдётся с «2» в таблице на первой правке квоты.',
  },
  {
    name: 'LegalDocument',
    path: 'components/content/legal-document.tsx',
    role: 'Правовой документ: оглавление, разделы, версия, статус черновика',
    wave: 'content',
    prototypeClasses: [],
    screens: ['legal'],
    i18n: ['legal'],
    states: ['draft', 'active', 'with-toc'],
    notes:
      'Числа документа (окно отмены, ставка удержания, комиссия, НДС, сроки хранения) ' +
      'подставляются из бизнес-правил: иначе правка окна отмены оставляет в политике ' +
      'возврата старую цифру, по которой клиент прав в споре. Статус draft виден на ' +
      'странице до проверки юристом (задача 8.2 плана).',
  },
  {
    name: 'ContactForm',
    path: 'components/content/contact-form.tsx',
    role: 'Обращение в поддержку с капчей и честным результатом отправки',
    wave: 'content',
    prototypeClasses: [],
    screens: ['contact'],
    i18n: ['contact'],
    states: ['idle', 'submitting', 'delivered', 'not-delivered', 'invalid-field', 'failed'],
    notes:
      'Недоставленное письмо не выдаётся за успех: действие возвращает delivered, и при ' +
      'отказе провайдера человек видит прямой адрес поддержки. Ошибка адресуется полю, ' +
      'которое назвал сервер, а не общим сообщением над формой.',
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
