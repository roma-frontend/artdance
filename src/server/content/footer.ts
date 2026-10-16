import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import { features, type FeatureKey } from '@/config/features';
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

/** Оставляет только ссылки, доступные в текущем entitlement-снимке. */
export function filterFooterGroups(
  groups: readonly NavGroup[],
  enabled: Partial<Record<FeatureKey, boolean>> = features,
): readonly NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const feature = item.feature;
        return feature === undefined || (feature in enabled && enabled[feature] !== false);
      }),
    }))
    .filter((group) => group.items.length > 0);
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
    const configuredItem = footerNavGroups
      .find((candidate) => candidate.id === row.group)
      ?.items.find((item) => item.href === row.href);
    const feature = row.feature ?? configuredItem?.feature ?? null;

    group.items.push({
      id: row.id,
      labelKey: row.labelKey as NavItem['labelKey'],
      href: row.href,
      ...(feature ? { feature: feature as NavItem['feature'] } : {}),
    });
    groups.set(row.group, group);
  }
  return [...groups.values()];
}

async function loadFooterGroups(): Promise<readonly NavGroup[]> {
  try {
    const rows = await db.footerLink.findMany({
      where: { isActive: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
      select: { id: true, group: true, labelKey: true, href: true, order: true, feature: true },
    });
    return buildFooterGroups(rows);
  } catch {
    // Первый деплой и локальная разработка могут идти без таблицы контента.
    return footerNavGroups;
  }
}

export const getFooterNavGroups = defineQuery({
  name: 'footerNavGroups',
  tags: () => [cacheTags.content('footer')],
  revalidate: dataRevalidate.content,
  handler: loadFooterGroups,
});
