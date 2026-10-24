/**
 * LEGAL DOCUMENT — оферта, политики и правила одним шаблоном.
 *
 * Шесть документов различаются только текстом, поэтому вёрстка у них общая, а
 * состав разделов приходит из `config/legal.ts`. Три вещи здесь не косметические.
 *
 * **Числа в документах — из бизнес-правил, а не из текста.** Окно бесплатной
 * отмены, ставка удержания, комиссия, НДС, сроки хранения данных подставляются
 * плейсхолдерами. Иначе «поменяйте окно отмены с 24 на 12 часов» превращается в
 * правку шести переводов на трёх языках — и однажды в политике возврата останется
 * старая цифра, по которой клиент будет прав в споре.
 *
 * **Все значения передаются каждому разделу.** ICU игнорирует лишние аргументы,
 * поэтому один объект на документ надёжнее, чем попытка угадать, какому разделу
 * какие числа нужны: добавленный в перевод плейсхолдер иначе падает в рантайме на
 * `MISSING_VALUE` — и именно в правовом документе, где ошибку никто не ждёт.
 *
 * **Статус черновика виден.** Пока текст не проверен юристом (задача 8.2 плана),
 * страница говорит об этом прямо. Документ, который выглядит действующим, но не
 * проверен, хуже отсутствующего: на него начинают ссылаться.
 */

import { Reveal } from '@/components/fx/reveal';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { LegalDocumentContent } from '@/server/content/legal';

interface LegalDocumentProps {
  content: LegalDocumentContent;
}

/**
 * Вёрстка документа. Тексты и подстановки собирает `buildLegalDocumentContent` на
 * сервере, поэтому компонент только рисует готовое и не читает переводы сам.
 */
export function LegalDocument({ content }: LegalDocumentProps) {
  return (
    <div className="page-container section-y grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <article className="max-w-(--layout-prose-max-width)">
        {content.draftNotice && (
          /*
           * `role="note"` вместо `alert`: предупреждение не требует немедленной
           * реакции, а `alert` перебивает чтение страницы скринридером.
           */
          <p
            role="note"
            className="text-body-sm mb-8 rounded-md border border-border-strong bg-surface-sunken p-4 text-content-secondary"
          >
            {content.draftNotice}
          </p>
        )}

        <p className="text-body-lg text-content-secondary">{content.intro}</p>

        <div className="mt-12 flex flex-col gap-10">
          {content.sections.map((section) => (
            <Reveal key={section.id} as="section" id={section.id} className="scroll-mt-(--layout-nav-height)">
              <h2 className="text-heading-3">{section.title}</h2>
              <p className="text-body mt-3 text-content-secondary">{section.body}</p>
            </Reveal>
          ))}
        </div>

        <p className="text-body-sm mt-12 border-t border-border-default pt-6 text-content-tertiary">
          {content.contactNote}
        </p>
      </article>

      {/*
        Оглавление и список документов — рядом с текстом на широком экране и над
        ним на узком. Документы длинные, и без оглавления «где тут про возврат»
        решается прокруткой.

        Два `<nav>`, а не один: «в этом документе» и «все документы» — разные
        навигационные блоки, и у каждого должно быть своё доступное имя. В одном
        общем `<nav>` скринридер объявляет одиннадцать ссылок под заголовком
        «Содержание», из которых половина ведёт на другие страницы.
      */}
      <div className="lg:sticky lg:top-(--layout-nav-height) flex flex-col gap-8 lg:order-last">
        <nav aria-label={content.tocTitle}>
          <h2 className="text-eyebrow mb-3 text-content-tertiary">{content.tocTitle}</h2>
          <ul className="flex flex-col gap-2 border-s border-border-default ps-4">
            {content.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-body-sm text-content-secondary transition-colors duration-normal ease-brand hover:text-content-accent"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={content.documentsTitle}>
          <h2 className="text-eyebrow mb-3 text-content-tertiary">{content.documentsTitle}</h2>
          <ul className="flex flex-col gap-2">
            {content.others.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.path}
                  className={cn(
                    'text-body-sm text-content-secondary',
                    'transition-colors duration-normal ease-brand hover:text-content-accent',
                  )}
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-caption text-content-tertiary">{content.versionNote}</p>
      </div>
    </div>
  );
}

