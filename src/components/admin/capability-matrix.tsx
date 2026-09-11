'use client';

/**
 * CAPABILITY MATRIX — что позволено роли.
 *
 * Переключатель на каждое право, и это осознанно дороже, чем «сохранить всё
 * формой»: изменение прав — точечная операция, её делают по одному пункту и
 * объясняют в журнале. Массовое сохранение матрицы означало бы одну запись аудита
 * на тридцать изменений и невозможность понять, какое из них сломало доступ.
 *
 * Права вне базового набора роли показаны выключенными: их нельзя «разрешить»
 * матрицей, потому что матрица только запрещает. Разрешение сверх базового набора
 * — это временный грант или смена роли, и интерфейс не должен намекать иначе.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import { ActionError } from '@/components/admin/status-actions';
import { Badge } from '@/components/ui/badge';
import { userRoleLabelKey, type UserRole } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { setRoleCapability } from '@/server/actions/admin/people';

export interface MatrixCell {
  capability: string;
  inBaseSet: boolean;
  denied: boolean;
  granted: boolean;
}

interface CapabilityMatrixProps {
  role: UserRole;
  cells: readonly MatrixCell[];
  editable: boolean;
}

export function CapabilityMatrix({ role, cells, editable }: CapabilityMatrixProps) {
  const t = useTranslations('admin.roles');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(setRoleCapability, {
    onSuccess: () => router.refresh(),
  });

  const busy = status === 'executing';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-card-title text-content-primary">{tRoot(userRoleLabelKey(role))}</h3>
        <Badge variant="metal">{t('capabilityColumn')}</Badge>
      </div>

      <p className="text-body-sm text-content-secondary">{t('matrixHint')}</p>

      <ul className="grid gap-2 md:grid-cols-2">
        {cells.map((cell) => (
          <li
            key={cell.capability}
            className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2"
          >
            <span className="text-body-sm font-mono text-content-secondary">{cell.capability}</span>

            <label className="flex items-center gap-2">
              <span className="sr-only">{cell.capability}</span>
              <input
                type="checkbox"
                /* Отмечено = разрешено. Запрет в матрице — снятая галочка. */
                checked={cell.inBaseSet && !cell.denied}
                disabled={!editable || !cell.inBaseSet || busy}
                onChange={(event) =>
                  execute({ role, capability: cell.capability, enabled: event.target.checked })
                }
                className="size-4 rounded-sm border-border-strong accent-accent"
              />
              {cell.granted ? <Badge variant="warning">{t('grantsTitle')}</Badge> : null}
            </label>
          </li>
        ))}
      </ul>

      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}
