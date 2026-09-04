/**
 * CHECKOUT STEPPER — четыре шага оформления.
 *
 * Шаги берутся из `checkoutSteps` (`config/routes.ts`), и у каждого свой URL.
 * Поэтому «назад» браузера работает как ожидается, а брошенное оформление можно
 * возобновить ссылкой — это и причина, по которой шаги не живут в состоянии
 * компонента.
 *
 * **Пройденный шаг — ссылка, будущий — нет.** В прототипе пройденные и будущие
 * шаги выглядят одинаково (различается только активный), то есть по индикатору
 * нельзя вернуться и исправить телефон. Отличие от макета сделано осознанно и
 * минимально: пройденные шаги получают цвет основного контента и становятся
 * ссылками, будущие остаются приглушённым текстом. Ни галочек, ни номеров — их в
 * дизайне нет, и добавлять их значило бы менять вид, а не поведение.
 *
 * **`<ol>` и `aria-current="step"`.** Индикатор — это нумерованный список
 * состояний процесса; скринридер должен сообщать, на каком шаге человек
 * находится, а не читать четыре ссылки подряд.
 *
 * На 480px подписи в макете сжимаются до 0.6rem — здесь этого не нужно: четыре
 * слова умещаются, потому что каждый шаг — гибкая колонка, а не элемент
 * фиксированной ширины.
 */

import { useTranslations } from 'next-intl';

import { checkoutSteps, routes, type CheckoutStep } from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface CheckoutStepperProps {
  current: CheckoutStep;
  /**
   * Шаги, которые можно открыть повторно. По умолчанию — все, что идут раньше
   * текущего: вернуться и поправить данные разрешено, перескочить вперёд нет.
   */
  completed?: readonly CheckoutStep[];
  className?: string;
}

export function CheckoutStepper({ current, completed, className }: CheckoutStepperProps) {
  const t = useTranslations('checkout.steps');

  const currentIndex = checkoutSteps.indexOf(current);
  const isCompleted = (step: CheckoutStep, index: number) =>
    completed ? completed.includes(step) : index < currentIndex;

  return (
    <ol
      className={cn('flex border-b border-border-default', className)}
      /* Список шагов — навигация по процессу, а не по сайту: роль не меняем. */
    >
      {checkoutSteps.map((step, index) => {
        const active = step === current;
        const done = !active && isCompleted(step, index);

        const label = (
          <span
            className={cn(
              'text-label block px-2 py-4 text-center uppercase',
              'border-b-2 transition-colors duration-normal ease-brand',
              active
                ? 'border-accent text-content-accent'
                : done
                  ? 'border-transparent text-content-primary'
                  : 'border-transparent text-content-tertiary',
            )}
          >
            {t(step)}
          </span>
        );

        return (
          <li key={step} className="flex-1" aria-current={active ? 'step' : undefined}>
            {done ? (
              <Link href={routes.checkoutStep(step)} className="block hover:opacity-80">
                {label}
              </Link>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ol>
  );
}
