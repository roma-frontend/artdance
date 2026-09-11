import 'server-only';

/**
 * Разбор параметров списка админки.
 *
 * Один разбор на все экраны: иначе `?page=abc` в одном списке даёт первую
 * страницу, в другом — пустую выдачу, а в третьем ошибку. Неизвестный и битый
 * параметр отбрасывается: ссылку из письма могли обрезать, и половина фильтра —
 * не повод показать ошибку вместо данных.
 */

import type { AdminListParams } from '@/config/routes';

export function parseAdminQuery(raw: Record<string, string | string[] | undefined>): AdminListParams {
  const single = (key: string): string | undefined => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const trimmed = first?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  };

  const page = Number.parseInt(single('page') ?? '', 10);

  return {
    ...(single('q') ? { q: single('q') } : {}),
    ...(single('status') ? { status: single('status') } : {}),
    ...(single('sort') ? { sort: single('sort') } : {}),
    ...(single('parent') ? { parent: single('parent') } : {}),
    ...(single('tab') ? { tab: single('tab') } : {}),
    ...(single('range') ? { range: single('range') } : {}),
    ...(Number.isFinite(page) && page > 1 ? { page } : {}),
  };
}
