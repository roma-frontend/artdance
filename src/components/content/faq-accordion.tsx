/**
 * FAQ ACCORDION — вопросы, ответы и разметка `FAQPage` одним блоком.
 *
 * **Почему `<details>`, а не вендорный `Accordion` из `components/ui`.** Radix
 * размонтирует закрытое содержимое: в HTML страницы остаются только вопросы, а
 * ответов там нет вовсе. Для страницы, смысл которой — попасть в выдачу с
 * готовым ответом, это исключает главное. `<details>` держит текст в разметке
 * всегда, работает без JavaScript, отвечает на клавиатуру и объявляется
 * скринридером как раскрывающийся блок — то есть даёт всё, за чем сюда пришли бы
 * с библиотекой, и ничего не стоит в бандле.
 *
 * Цена решения: высоту нельзя анимировать нативно. Стрелка при этом поворачивается
 * (`group-open:`), а раскрытие происходит мгновенно — на текстовой странице это
 * читается как отзывчивость, а не как сбой.
 *
 * **Разметка `FAQPage` живёт здесь же.** Google сверяет схему с видимым текстом и
 * снимает расширенный сниппет целиком при расхождении. Поэтому схема собирается
 * из того же массива, что и список: забыть её или разойтись с ней нельзя.
 */

import { PlusIcon } from 'lucide-react';

import { JsonLdScript } from '@/components/seo/json-ld';
import { faqSchema, type FaqEntry } from '@/lib/seo/jsonld';
import { cn } from '@/lib/utils';

export interface FaqGroup {
  id: string;
  title: string;
  items: readonly FaqEntry[];
}

interface FaqAccordionProps {
  groups: readonly FaqGroup[];
  /**
   * Выводить разметку `FAQPage`. По умолчанию да; отключается там, где список
   * вопросов не главный на странице (например, короткий блок на лендинге) —
   * `FAQPage` на нескольких страницах одного сайта Google трактует как спам.
   */
  structuredData?: boolean;
  className?: string;
}

export function FaqAccordion({ groups, structuredData = true, className }: FaqAccordionProps) {
  const schema = faqSchema(groups.flatMap((group) => [...group.items]));

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      {structuredData && schema !== null && <JsonLdScript schema={schema} />}

      {groups.map((group) => (
        <section key={group.id} id={group.id} className="scroll-mt-(--layout-nav-height)">
          <h3 className="text-heading-3 mb-4">{group.title}</h3>

          <div className="border-t border-border-default">
            {group.items.map((item) => (
              <details
                key={item.question}
                className="group border-b border-border-default"
                /*
                 * Открытых по умолчанию вопросов нет: список из десяти
                 * раскрытых ответов — это не FAQ, а статья, по которой нельзя
                 * пробежаться глазами.
                 */
              >
                <summary
                  className={cn(
                    'flex cursor-pointer list-none items-start justify-between gap-4 py-4',
                    'text-body font-semibold transition-colors duration-normal ease-brand',
                    'hover:text-content-accent',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
                    /* Служебный маркер `▶` в WebKit убирается только так. */
                    '[&::-webkit-details-marker]:hidden',
                  )}
                >
                  {item.question}
                  <PlusIcon
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-content-tertiary transition-transform duration-normal ease-brand group-open:rotate-45"
                  />
                </summary>

                <p className="text-body-sm max-w-(--layout-prose-max-width) pb-5 text-content-secondary">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
