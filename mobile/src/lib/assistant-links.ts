import type { Href } from 'expo-router';

import type { Locale } from '@/lib/i18n';

/**
 * Ссылки в ответе ассистента. Веб-адрес (`http://localhost:3000/ru/classes/slug`
 * или `https://artdance.am/...`) не открывается: путь сопоставляется с экраном
 * приложения, и нажатие ведёт внутри неё. Адреса, которых в приложении нет,
 * показываются обычным текстом, без перехода.
 */

export type AssistantSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; label: string; href: Href | null };

type Kind = 'class' | 'instructor' | 'studio' | 'event' | 'product' | 'style' | 'page';

/** Подпись для голого адреса без текста в квадратных скобках. */
const KIND_LABELS: Record<Locale, Record<Kind, string>> = {
  ru: { class: 'Занятие', instructor: 'Инструктор', studio: 'Зал', event: 'Мероприятие', product: 'Товар', style: 'Направление', page: 'Страница' },
  en: { class: 'Class', instructor: 'Instructor', studio: 'Studio', event: 'Event', product: 'Product', style: 'Dance style', page: 'Page' },
  hy: { class: 'Դաս', instructor: 'Մանկավարժ', studio: 'Դահլիճ', event: 'Միջոցառում', product: 'Ապրանք', style: 'Պարի ուղղություն', page: 'Էջ' },
};

/** Префикс локали, который веб добавляет к путям: `/ru/classes`. */
const LOCALE_PREFIX = /^\/(hy|ru|en)(?=\/|$)/;

const STATIC_ROUTES: Record<string, { href: Href; kind: Kind }> = {
  '/classes': { href: '/classes', kind: 'page' },
  '/shop': { href: '/shop', kind: 'page' },
  '/styles': { href: '/styles', kind: 'page' },
  '/schedule': { href: '/schedule', kind: 'page' },
  '/pricing': { href: '/pricing', kind: 'page' },
  '/help': { href: '/help', kind: 'page' },
  '/faq': { href: '/faq', kind: 'page' },
  '/contact': { href: '/contact', kind: 'page' },
  '/blog': { href: '/blog', kind: 'page' },
  '/about': { href: '/about', kind: 'page' },
  '/cart': { href: '/cart', kind: 'page' },
  '/gift-cards': { href: '/gift-cards', kind: 'page' },
  '/become-instructor': { href: '/become-instructor', kind: 'page' },
  '/list-your-studio': { href: '/list-your-studio', kind: 'page' },
  '/account/bookings': { href: '/account/bookings', kind: 'page' },
  '/account/orders': { href: '/account/orders', kind: 'page' },
  '/account/subscription': { href: '/account/subscription', kind: 'page' },
  '/instructors': { href: { pathname: '/catalog/[section]', params: { section: 'instructors' } }, kind: 'page' },
  '/studios': { href: { pathname: '/catalog/[section]', params: { section: 'studios' } }, kind: 'page' },
  '/events': { href: { pathname: '/catalog/[section]', params: { section: 'events' } }, kind: 'page' },
  '/competitions': { href: { pathname: '/catalog/[section]', params: { section: 'events' } }, kind: 'page' },
  '/social-events': { href: { pathname: '/catalog/[section]', params: { section: 'events' } }, kind: 'page' },
};

function catalogHref(section: 'classes' | 'instructors' | 'studios' | 'events' | 'shop', slug: string): Href {
  return { pathname: '/catalog/[section]/[slug]', params: { section, slug } };
}

const DETAIL_ROUTES: { pattern: RegExp; kind: Kind; href: (slug: string) => Href }[] = [
  { pattern: /^\/classes\/([^/]+)$/, kind: 'class', href: (slug) => catalogHref('classes', slug) },
  { pattern: /^\/instructors\/([^/]+)$/, kind: 'instructor', href: (slug) => catalogHref('instructors', slug) },
  { pattern: /^\/studios\/([^/]+)(?:\/book)?$/, kind: 'studio', href: (slug) => catalogHref('studios', slug) },
  { pattern: /^\/events\/([^/]+)$/, kind: 'event', href: (slug) => catalogHref('events', slug) },
  { pattern: /^\/shop\/([^/]+)$/, kind: 'product', href: (slug) => catalogHref('shop', slug) },
  { pattern: /^\/styles\/([^/]+)$/, kind: 'style', href: (slug) => ({ pathname: '/styles/[slug]', params: { slug } }) },
];

/** Переводит адрес из ответа в маршрут приложения. `null` — такого экрана нет. */
export function resolveAssistantLink(rawUrl: string): { href: Href; kind: Kind } | null {
  let path: string;
  try {
    path = new URL(rawUrl).pathname;
  } catch {
    return null;
  }
  path = path.replace(LOCALE_PREFIX, '').replace(/\/+$/, '') || '/';

  const fixed = STATIC_ROUTES[path];
  if (fixed) return fixed;

  for (const route of DETAIL_ROUTES) {
    const match = route.pattern.exec(path);
    if (match) return { href: route.href(decodeURIComponent(match[1])), kind: route.kind };
  }
  return null;
}

/**
 * Разбирает текст ответа на обычный текст и ссылки. Поддерживаются `[Название](адрес)`
 * и голый адрес; хвостовая пунктуация после голого адреса остаётся текстом.
 */
const LINK_TOKEN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]*[^\s.,;:!?)])/g;

export function splitAssistantText(text: string, locale: Locale): AssistantSegment[] {
  const segments: AssistantSegment[] = [];
  let last = 0;

  for (const match of text.matchAll(LINK_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: 'text', value: text.slice(last, index) });

    const [whole, markdownLabel, markdownUrl, bareUrl] = match;
    const resolved = resolveAssistantLink(markdownUrl ?? bareUrl);
    const label = markdownLabel?.trim() || (resolved ? KIND_LABELS[locale][resolved.kind] : '');
    if (label) segments.push({ type: 'link', label, href: resolved?.href ?? null });

    last = index + whole.length;
  }

  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}
