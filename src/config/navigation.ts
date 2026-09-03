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
export const navIconNames = ['search', 'cart', 'favorites', 'account'] as const;
export type NavIconName = (typeof navIconNames)[number];

export interface NavItem {
  /** Стабильный ключ для React и для аналитики. */
  id: string;
  labelKey: MessageKey;
  href: string;
  /** Раздел показывается только при включённом флаге поставки. */
  feature?: FeatureKey;
}

export interface NavIconItem extends NavItem {
  icon: NavIconName;
  /**
   * Остаётся видимой на узком экране. Остальные иконки уходят в мобильное меню,
   * а не исчезают: пропавшая без альтернативы функция — это дефект, а не адаптив.
   */
  compact: boolean;
}

/**
 * Основные разделы. Порядок из прототипа; «Cart» вынесена из строки ссылок в
 * иконку (там она и ожидается пользователем), освободившееся место занимает
 * «Studios» — аренда залов такой же самостоятельный продукт, как занятия.
 */
const primaryNav: readonly NavItem[] = [
  { id: 'home', labelKey: 'nav.home', href: routes.home() },
  { id: 'discover', labelKey: 'nav.discover', href: routes.discover() },
  { id: 'classes', labelKey: 'nav.classes', href: routes.classes() },
  { id: 'instructors', labelKey: 'nav.instructors', href: routes.instructors() },
  { id: 'studios', labelKey: 'nav.studios', href: routes.studios() },
  { id: 'shop', labelKey: 'nav.shop', href: routes.shop(), feature: 'shop' },
  { id: 'calendar', labelKey: 'nav.calendar', href: routes.booking() },
];

/**
 * Иконки справа. Поиск ведёт в каталог с его фильтрами: полноэкранный
 * `SearchOverlay` приходит в волне `catalog`, и до тех пор кнопка обязана
 * куда-то приводить — неработающая иконка хуже отсутствующей.
 */
const iconActions: readonly NavIconItem[] = [
  {
    id: 'search',
    icon: 'search',
    labelKey: 'common.actions.search',
    href: routes.discover(),
    compact: true,
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
 * Мобильное меню: основные разделы плюс то, что не поместилось в иконки.
 * Собирается из тех же данных — списки не могут разойтись.
 */
export const mobileNavItems: readonly NavItem[] = [
  ...primaryNavItems,
  ...headerIconItems.filter((item) => !item.compact),
];

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
