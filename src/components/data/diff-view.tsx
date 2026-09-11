/**
 * DIFF VIEW — изменение записи в читаемом виде.
 *
 * `AuditLog.diff` хранит только изменённые поля: `{ price: { before: 8000,
 * after: 9000 } }`. Показать это как JSON — значит переложить разбор на человека,
 * который пришёл разобраться в споре, а не читать структуры данных.
 *
 * Компонент ничего не решает о смысле полей: он не знает, что `price` — деньги.
 * Значение печатается как есть, потому что в момент чтения журнала важна не
 * красота, а точность: «было 8000, стало 9000». Форматирование денег здесь
 * добавило бы риск показать в журнале не то число, которое записано.
 */

import { getTranslations } from 'next-intl/server';

/** Один изменённый ключ. Значения — уже обезличенные `recordAudit`. */
export interface DiffEntry {
  field: string;
  before: string | null;
  after: string | null;
}

interface DiffViewProps {
  entries: readonly DiffEntry[];
}

export async function DiffView({ entries }: DiffViewProps) {
  const t = await getTranslations('admin.audit');

  if (entries.length === 0) {
    return <p className="text-body-sm text-content-tertiary">{t('diffEmpty')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      <table className="w-full text-left">
        <caption className="sr-only">{t('diffTitle')}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            <th scope="col" className="text-label px-4 py-2 text-content-secondary">
              {t('diffTitle')}
            </th>
            <th scope="col" className="text-label px-4 py-2 text-content-secondary">
              {t('diffBefore')}
            </th>
            <th scope="col" className="text-label px-4 py-2 text-content-secondary">
              {t('diffAfter')}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.field} className="border-t border-border-subtle align-top">
              <th scope="row" className="text-body-sm px-4 py-2 font-semibold text-content-primary">
                {entry.field}
              </th>
              <td className="text-body-sm px-4 py-2 text-content-secondary line-through decoration-content-tertiary">
                {entry.before ?? '—'}
              </td>
              <td className="text-body-sm px-4 py-2 font-semibold text-content-primary">
                {entry.after ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
