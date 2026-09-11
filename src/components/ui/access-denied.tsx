/**
 * ACCESS DENIED — «не хватает прав», а не «не найдено».
 *
 * Разные тексты и разные действия: «страницы нет» отправляет в каталог, «прав не
 * хватает» отправляет к тому, кто их выдаёт. Подмена одного другим — обычная
 * практика для публичных разделов (не раскрывать существование объекта), но
 * внутри админки она вредна: сотрудник видит раздел в меню и получает «не
 * найдено», после чего идёт искать несуществующую ошибку.
 */

import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/ui/empty-state';

interface AccessDeniedProps {
  /** Что именно недоступно: подпись раздела или операции. */
  subject?: string;
}

export async function AccessDenied({ subject }: AccessDeniedProps) {
  const t = await getTranslations('errors.forbidden');
  const tAdmin = await getTranslations('admin.errors');

  return (
    <EmptyState title={t('title')} description={subject ?? tAdmin('capabilityMissing')} />
  );
}
