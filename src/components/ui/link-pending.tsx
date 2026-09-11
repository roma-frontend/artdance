'use client';

/**
 * LINK PENDING — обратная связь на нажатую ссылку.
 *
 * Ставится ВНУТРЬ `<Link>` и показывает спиннер, пока переход не завершился:
 * `useLinkStatus` работает только у потомка ссылки — отсюда и форма компонента.
 *
 * Почему не полноэкранный оверлей и не полоса вверху страницы. Переходы в основном
 * мгновенные: маршруты префетчатся, и ответ приходит быстрее, чем человек успевает
 * заметить. Оверлей на таких переходах — вспышка на каждом щелчке, которая
 * читается как «что-то сломалось». А полоса вверху уже занята прогрессом чтения
 * (`ScrollProgress`), и вторая того же вида выглядела бы как одна неисправная.
 *
 * Задержка перед появлением — из `motion.loading.pendingDelayMs` и применяется
 * CSS-анимацией (`.pending-indicator`), а не таймером в состоянии. Таймер
 * потребовал бы сбрасывать состояние при завершении перехода, то есть вызывать
 * `setState` из эффекта — каскадный рендер, который здесь ничего не даёт.
 */

/*
 * eslint-disable-next-line no-restricted-imports --
 * Из `next/link` берётся ХУК, а не компонент `Link`: локали он не касается, а в
 * `@/i18n/routing` его нет и быть не может — это реэкспорт навигации next-intl.
 */
// eslint-disable-next-line no-restricted-imports
import { useLinkStatus } from 'next/link';
import { useTranslations } from 'next-intl';

import { Spinner } from '@/components/ui/spinner';
import { motion } from '@/design/motion';
import { cn } from '@/lib/utils';

export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  const t = useTranslations('a11y');

  if (!pending) return null;

  return (
    <Spinner
      label={t('loading')}
      className={cn('pending-indicator ml-2 align-middle', className)}
      style={{ animationDelay: `${motion.loading.pendingDelayMs}ms` }}
    />
  );
}
