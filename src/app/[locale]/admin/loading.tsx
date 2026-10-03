/**
 * Загрузочное состояние админки — составной скелетон без CLS.
 *
 * Форма повторяет боевую страницу пиксель-в-пиксель: шапка
 * (AdminPageHeader), панель фильтров (TableFilters) и таблица
 * (DataTable). Поэтому подмена skeleton → контент не сдвигает
 * верстку ни на пиксель. Шимер + pulse в Skeleton, гаснет при
 * prefers-reduced-motion. Подходит для 80% экранов админки —
 * списков; для сводок (overview/dashboard) лёгкое расхождение
 * дешевле, чем вспышка или пустой экран.
 */

import { AdminListPageSkeleton } from '@/components/admin/admin-skeletons';

export default function AdminLoading() {
  return <AdminListPageSkeleton rows={6} columns={5} />;
}
