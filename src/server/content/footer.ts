import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import { footerNavGroups, type NavGroup, type NavItem } from '@/config/navigation';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

/** Строка из таблицы `FooterLink` в публичном виде группы. */
export interface FooterLinkRow {
  id: string;
  group: string;
  labelKey: string;
  href: string;
  order: number;
  feature: string | null;
}

const groupTitles = new Map(footerNavGroups.map((group) => [group.id, group.titleKey]));

/**
 * Ссылки подвала из админки, сгруппированные как статический конфиг.
 *
 * Пустая таблица — «оператор ещё ничего не настроил» — откатывается на
 * `footerNavGroups` из `navigation.ts`, чтобы первый деплой не остался без
 * подвала. Группа вне конфигурации игнорируется: у неё нет `titleKey`, и
 * выдумывать заголовок — это писать строку в коде, откуда она ушла.
 */
export function buildFooterGroups(rows: readonly FooterLinkRow[]): readonly NavGroup[] {
  if (rows.length === 0) return footerNavGroups;

  // Билдер не полагается на порядок строк из БД: сортирует сам, иначе одна
  // опечатка в orderBy ломает порядок ссылок на всех страницах.
  rows = rows.slice().sort((left, right) => left.group.localeCompare(right.group) || left.order - right.order);

  const groups = new Map<string, { id: string; titleKey: NavGroup['titleKey']; items: NavItem[] }>();
  for (const row of rows) {
    const titleKey = groupTitles.get(row.group);
    if (!titleKey) continue;
    const group = groups.get(row.group) ?? { id: row.group, titleKey, items: [] };
    group.items.push({
      id: row.id,
      labelKey: row.labelKey as NavItem['labelKey'],
      href: row.href,
      ...(row.feature ? { feature: row.feature as NavItem['feature'] } : {}),
    });
    groups.set(row.group, group);
  }
  return [...groups.values()];
}

async function loadFooterGroups(): Promise<readonly NavGroup[]> {
  const rows = await db.footerLink.findMany({
    where: { isActive: true },
    orderBy: [{ group: 'asc' }, { order: 'asc' }],
    select: { id: true, group: true, labelKey: true, href: true, order: true, feature: true },
  });
  return buildFooterGroups(rows);
}

export const getFooterNavGroups = defineQuery({
  name: 'footerNavGroups',
  tags: () => [cacheTags.content('footer')],
  revalidate: dataRevalidate.content,
  handler: loadFooterGroups,
});
