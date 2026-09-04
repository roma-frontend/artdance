/**
 * NAVIGATION — карта разделов сайта.
 *
 * Зачем отдельный слой, если есть `routes`: `routes` отвечает на вопрос «какой
 * URL у раздела», а этот файл — «какие разделы показываем, в каком порядке,
 * под каким ключом перевода и при каком флаге». Ни шапка, ни подвал, ни
 * мобильное меню не содержат списка ссылок: они рендерят то, что объявлено
 * здесь. Добавить раздел = одна строка в одном файле, а не правка трёх
 * компонентов, в одном из которых про него забудут.
 *
 * Текста здесь нет — только ключи перевода (`labelKey`). Тип `MessageKey`
 * делает опечатку в ключе ошибкой сборки.
 */

import type { MessageKey } from '@/i18n/types';

import { features, type FeatureKey } from './features';
import { routes } from './routes';

/**
 * Имя иконки. Сопоставление «имя → компонент» живёт в UI-слое: конфигурация
 * не должна импортировать React, иначе она перестанет быть данными.
 */
export const navIconNames = [
  'home',
  'discover',
  'classes',
  'instructors',
  'studios',
  'calendar',
  'events',
  'pricing',
  'search',
  'cart',
  'favorites',
  'account',
  'shop',
] as const;
export type NavIconName = (typeof navIconNames)[number];

export interface NavItem {
  /** Стабильный ключ для React и для аналитики. */
  id: string;
  labelKey: MessageKey;
  href: string;
  /** Раздел показывается только при включённом флаге поставки. */
  feature?: FeatureKey;
  /** Иконка для мест, где раздел показывается плиткой или вкладкой. */
  icon?: NavIconName;
}

export interface NavIconItem extends NavItem {
  icon: NavIconName;
  /**
   * Остаётся видимой на узком экране. Остальные иконки уходят в мобильное меню,
   * а не исчезают: пропавшая без альтернативы функция — это дефект, а не адаптив.
   */
  compact: boolean;
  /**
   * Иконка открывает полноэкранный поиск, а не переходит по `href`.
   *
   * `href` при этом обязателен и остаётся рабочим: без JavaScript оверлея нет, и
   * ссылка на каталог — единственный способ добраться до поиска. Обработчик
   * подавляет переход только тогда, когда оверлею есть чем его заменить.
   */
  opensSearch?: boolean;
}

/**
 * Основные разделы. Порядок из прототипа; «Cart» вынесена из строки ссылок в
 * иконку (там она и ожидается пользователем), освободившееся место занимает
 * «Studios» — аренда залов такой же самостоятельный продукт, как занятия.
 */
const primaryNav: readonly NavItem[] = [
  { id: 'home', labelKey: 'nav.home', href: routes.home(), icon: 'home' },
  { id: 'discover', labelKey: 'nav.discover', href: routes.discover(), icon: 'discover' },
  { id: 'classes', labelKey: 'nav.classes', href: routes.classes(), icon: 'classes' },
  { id: 'instructors', labelKey: 'nav.instructors', href: routes.instructors(), icon: 'instructors' },
  { id: 'studios', labelKey: 'nav.studios', href: routes.studios(), icon: 'studios' },
  { id: 'shop', labelKey: 'nav.shop', href: routes.shop(), feature: 'shop', icon: 'shop' },
  { id: 'calendar', labelKey: 'nav.calendar', href: routes.booking(), icon: 'calendar' },
];

/**
 * Иконки справа. Поиск открывает полноэкранный `SearchOverlay`, а `href` служит
 * фоллбэком без JavaScript: каталог со своими фильтрами отвечает на тот же
 * вопрос, только без подсказок на ходу.
 */
const iconActions: readonly NavIconItem[] = [
  {
    id: 'search',
    icon: 'search',
    labelKey: 'common.actions.search',
    href: routes.discover(),
    compact: true,
    opensSearch: true,
  },
  {
    id: 'cart',
    icon: 'cart',
    labelKey: 'nav.cart',
    href: routes.cart(),
    feature: 'shop',
    compact: true,
  },
  {
    id: 'favorites',
    icon: 'favorites',
    labelKey: 'account.nav.favorites',
    href: routes.accountFavorites(),
    compact: false,
  },
  {
    id: 'account',
    icon: 'account',
    labelKey: 'nav.account',
    href: routes.account(),
    compact: false,
  },
];

/** Главное действие шапки и мобильного меню. */
export const headerCta = {
  labelKey: 'common.actions.bookNow',
  href: routes.discover(),
} as const satisfies { labelKey: MessageKey; href: string };

/** Скрывает разделы выключенных модулей: навигация не ведёт в никуда. */
function enabled<T extends NavItem>(items: readonly T[]): readonly T[] {
  return items.filter((item) => item.feature === undefined || features[item.feature]);
}

export const primaryNavItems = enabled(primaryNav);
export const headerIconItems = enabled(iconActions);

/**
 * Мобильная навигация: нижний док и сетка разделов.
 *
 * Список ссылок в выезжающей панели заменён на то, что ожидается от приложения:
 * четыре постоянных назначения в доке у большого пальца и центральная кнопка,
 * открывающая сетку остальных разделов. Причина не в моде: панель со списком
 * из девяти строк требует прицельного попадания в текст у верхнего края
 * экрана, а до верхнего края телефона в 6,7 дюйма одной рукой не достать.
 *
 * Слоты 0 и 1 — слева от центральной кнопки, 3 и 4 — справа; слот 2 занимает
 * сама кнопка. Номер слота объявлен здесь, а не выводится из порядка: он
 * определяет положение подчёркивания активной вкладки, и «сдвинуть Discover
 * правее» должно быть правкой одной цифры.
 */
export const mobileDockSlots = [0, 1, 3, 4] as const;
export type MobileDockSlot = (typeof mobileDockSlots)[number];

export interface MobileDockItem extends NavItem {
  icon: NavIconName;
  slot: MobileDockSlot;
}

/**
 * В доке только разделы БЕЗ флага поставки.
 *
 * Выключенный модуль убрал бы вкладку, и остальные разъехались бы по сетке из
 * пяти колонок — центральная кнопка перестала бы быть центральной. Всё, что
 * зависит от флагов, живёт в сетке разделов, где число плиток произвольно.
 * Инвариант закреплён `navigation.test.ts`.
 */
const mobileDock: readonly MobileDockItem[] = [
  { id: 'home', labelKey: 'nav.home', href: routes.home(), icon: 'home', slot: 0 },
  { id: 'discover', labelKey: 'nav.discover', href: routes.discover(), icon: 'discover', slot: 1 },
  { id: 'classes', labelKey: 'nav.classes', href: routes.classes(), icon: 'classes', slot: 3 },
  { id: 'account', labelKey: 'nav.account', href: routes.account(), icon: 'account', slot: 4 },
];

export const mobileDockItems: readonly MobileDockItem[] = enabled(mobileDock);

/** Идентификаторы, которые уже видны в доке: в сетке они не повторяются. */
const dockIds: ReadonlySet<string> = new Set(mobileDockItems.map((item) => item.id));

/**
 * Сетка разделов в шторке: всё, чего нет в доке.
 *
 * Собирается из тех же данных, что шапка и подвал, поэтому списки не могут
 * разойтись, а раздел выключенного модуля не попадёт ни в один из них.
 */
export const mobileMenuItems: readonly NavItem[] = [...primaryNavItems, ...headerIconItems].filter(
  (item) => !dockIds.has(item.id),
);

/**
 * Страницы, первый экран которых — кинематографичная тёмная плоскость
 * (`surface-cinema`). На них шапка стартует прозрачной и светлой, а фон
 * получает только после прокрутки. Список объявлен здесь, чтобы компонент
 * шапки не знал, «что нарисовано на главной».
 */
const cinemaHeroPaths: readonly string[] = [routes.home()];

/**
 * Подвал: пять колонок ссылок.
 *
 * Тот же принцип, что у шапки — состав объявлен данными, а не разметкой.
 * Правовые ссылки выделены в отдельную группу: их набор диктуется офертой и
 * законом, а не продуктовыми решениями, и меняется по другому поводу.
 */
export interface NavGroup {
  id: string;
  titleKey: MessageKey;
  items: readonly NavItem[];
}

const footerGroups: readonly NavGroup[] = [
  {
    id: 'explore',
    titleKey: 'footer.exploreTitle',
    items: [
      { id: 'discover', labelKey: 'nav.discover', href: routes.discover() },
      { id: 'classes', labelKey: 'nav.classes', href: routes.classes() },
      { id: 'instructors', labelKey: 'nav.instructors', href: routes.instructors() },
      { id: 'studios', labelKey: 'nav.studios', href: routes.studios() },
      { id: 'events', labelKey: 'nav.events', href: routes.events(), feature: 'events' },
      { id: 'shop', labelKey: 'nav.shop', href: routes.shop(), feature: 'shop' },
    ],
  },
  {
    id: 'company',
    titleKey: 'footer.companyTitle',
    items: [
      { id: 'about', labelKey: 'footer.about', href: routes.about() },
      { id: 'blog', labelKey: 'footer.blog', href: routes.blog() },
      { id: 'contact', labelKey: 'footer.contact', href: routes.contact() },
    ],
  },
  {
    id: 'support',
    titleKey: 'footer.supportTitle',
    items: [
      { id: 'help', labelKey: 'footer.help', href: routes.help() },
      { id: 'faq', labelKey: 'footer.faq', href: routes.faq() },
      {
        id: 'giftCards',
        labelKey: 'footer.giftCards',
        href: routes.giftCards(),
        feature: 'shop',
      },
    ],
  },
  {
    id: 'business',
    titleKey: 'footer.businessTitle',
    items: [
      { id: 'becomeInstructor', labelKey: 'footer.becomeInstructor', href: routes.becomeInstructor() },
      { id: 'listStudio', labelKey: 'footer.listStudio', href: routes.listYourStudio() },
      { id: 'pricing', labelKey: 'nav.pricing', href: routes.pricing(), feature: 'subscriptions' },
    ],
  },
  {
    id: 'legal',
    titleKey: 'footer.legalTitle',
    items: [
      { id: 'terms', labelKey: 'footer.terms', href: routes.terms() },
      { id: 'privacy', labelKey: 'footer.privacy', href: routes.privacy() },
      { id: 'cookies', labelKey: 'footer.cookies', href: routes.cookiePolicy() },
      { id: 'refund', labelKey: 'footer.refundPolicy', href: routes.refundPolicy() },
      { id: 'cancellation', labelKey: 'footer.cancellationPolicy', href: routes.cancellationPolicy() },
      { id: 'community', labelKey: 'footer.communityGuidelines', href: routes.communityGuidelines() },
    ],
  },
];

/** Колонки подвала без выключенных разделов. Пустая колонка не рендерится. */
export const footerNavGroups: readonly NavGroup[] = footerGroups
  .map((group) => ({ ...group, items: enabled(group.items) }))
  .filter((group) => group.items.length > 0);

export function hasCinemaHero(pathname: string): boolean {
  return cinemaHeroPaths.includes(pathname);
}

/**
 * Активен ли раздел для текущего пути. Учитывает вложенность
 * (`/classes/hip-hop-basics` подсвечивает «Classes») и игнорирует query.
 */
export function isActiveNavPath(pathname: string, href: string): boolean {
  const path = href.split('?')[0] ?? href;
  if (path === routes.home()) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}
