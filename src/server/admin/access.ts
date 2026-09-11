import 'server-only';

/**
 * ДОСТУП К АДМИНСКИМ ЭКРАНАМ.
 *
 * Layout уже отсеял гостей и не-персонал, но страница обязана проверять своё
 * право сама: `/admin/payouts` открывается прямой ссылкой, а не только из меню, и
 * «пункт не показан» не является защитой. Один вызов на экран — один запрос за
 * матрицей прав, а не по запросу на каждую проверку.
 *
 * Экран, в отличие от server action, отвечает не исключением, а экраном: человеку
 * нужно объяснение и путь дальше, а не 403 в консоли. Поэтому здесь возвращается
 * набор прав, а решение «показать отказ» принимает страница.
 */

import type { Capability } from '@/config/capabilities';
import { resolveCapabilities } from '@/lib/auth/capabilities';
import { requireRole, type Caller } from '@/lib/auth/guards';

export interface AdminAccess {
  caller: Caller;
  capabilities: Set<Capability>;
  can: (capability: Capability) => boolean;
}

export async function adminAccess(): Promise<AdminAccess> {
  /*
   * Порог роли, а не только capability: у клиента набор прав пуст, и без порога
   * страница отличала бы «нет права» от «не сотрудник» только текстом ошибки.
   */
  const caller = await requireRole('SUPPORT');
  const capabilities = await resolveCapabilities(caller.role);

  return {
    caller,
    capabilities,
    can: (capability) => capabilities.has(capability),
  };
}
