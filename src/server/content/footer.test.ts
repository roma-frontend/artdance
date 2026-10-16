import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: never) => fn }));

import { footerNavGroups } from '@/config/navigation';

import { buildFooterGroups, filterFooterGroups, type FooterLinkRow } from './footer';

const row = (overrides: Partial<FooterLinkRow> = {}): FooterLinkRow => ({
  id: '1',
  group: 'explore',
  labelKey: 'nav.classes',
  href: '/classes',
  order: 1,
  feature: null,
  ...overrides,
});

describe('buildFooterGroups', () => {
  it('откатывается на конфиг, когда таблица пуста', () => {
    expect(buildFooterGroups([])).toBe(footerNavGroups);
  });

  it('строит группы из строк админки: порядок и флаги сохраняются', () => {
    const groups = buildFooterGroups([
      row({ id: 'a', order: 2, feature: 'shop', labelKey: 'nav.shop', href: '/shop' }),
      row({ id: 'b', order: 1 }),
    ]);
    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group).toMatchObject({ id: 'explore', titleKey: 'footer.exploreTitle' });
    expect(group.items.map((item) => item.href)).toEqual(['/classes', '/shop']);
    expect(group.items[1]?.feature).toBe('shop');
  });

  it('восстанавливает флаг из статического конфига для старой строки без feature', () => {
    const groups = buildFooterGroups([
      row({ id: 'competition', group: 'community', labelKey: 'nav.competitions', href: '/competitions' }),
    ]);

    expect(groups[0]?.items[0]?.feature).toBe('events');
  });

  it('не отдаёт выключенную ссылку в отображаемый подвал', () => {
    const groups = filterFooterGroups(
      buildFooterGroups([
        row({ id: 'competition', group: 'community', labelKey: 'nav.competitions', href: '/competitions' }),
      ]),
      { events: false },
    );

    expect(groups).toHaveLength(0);
  });

  it('игнорирует группу вне конфигурации: заголовка для неё нет', () => {
    expect(buildFooterGroups([row({ group: 'unknown' })])).toHaveLength(0);
  });
});
