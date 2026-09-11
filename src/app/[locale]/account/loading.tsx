/**
 * Загрузочное состояние кабинета.
 *
 * Кабинет и все его подразделы динамические: они читают сессию, и статически
 * пререндеренного маршрута под этим сегментом нет — условие из
 * `docs/03-conventions.md` §2e выполнено.
 *
 * Отступ сверху тот же `.inner-page`, что у страниц кабинета: без него скелет
 * уезжает под фиксированную шапку, а содержимое потом появляется ниже — то есть
 * подмена сдвигает экран, ровно то, чего скелет должен избегать.
 */

import { SkeletonList } from '@/components/ui/skeleton-card';
import { getRootTranslate } from '@/i18n/translate';

export default async function AccountLoading() {
  const t = await getRootTranslate();

  return (
    <main className="page-container inner-page">
      <SkeletonList label={t('a11y.loading')} />
    </main>
  );
}
