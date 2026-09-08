/**
 * SEARCH OVERLAY — полноэкранный поиск.
 *
 * В прототипе это блок с инлайновыми стилями и без всякой логики: поле, крестик,
 * шесть чипов. Ни обработчика ввода, ни результатов, ни Esc, ни ловушки фокуса.
 * Здесь достроено всё, без чего поиск не поиск.
 *
 * **Результаты настоящие.** Запрос уходит в `/api/search` (задача 2.8 плана) с
 * задержкой `limits.search.debounceMs` и отменяется через `AbortController`:
 * при быстром вводе ответ на «сал» приходит после ответа на «сальса», и без
 * отмены в списке оказалась бы выдача по неполному слову. Именно поэтому это
 * route handler, а не server action — действие отменить нельзя.
 *
 * **Чипы разделов — фильтр, а не навигация.** В макете это `<span>` с
 * `cursor: pointer` без активного состояния: замысел ясен, реализации не было.
 * Здесь они переключают область поиска (`aria-pressed`) и попадают в адрес
 * страницы результатов, поэтому «залы по слову pulse» можно переслать ссылкой.
 *
 * **Три алфавита.** «Բաչատա», «bachata», «бачата» и даже «бочата» находят одно и
 * то же: сравнение идёт по ключу поиска (`lib/search/normalize.ts`), а не по
 * строке. Совпадение подсвечивается в исходном написании — подсветка считается по
 * той же карте, по которой найдено.
 *
 * **Направления остаются подсказкой.** Они ведут в подборку
 * (`/discover?style=…`), то есть отвечают на «покажи всё по сальсе», а не «вот
 * одно занятие». Список берётся из словаря домена без запроса к серверу, поэтому
 * пустой экран открывается мгновенно.
 *
 * **Чего здесь осознанно нет.** Миниатюр у результатов: восемь изображений на
 * каждый устоявшийся запрос — это трафик ради украшения списка, по которому
 * скользят глазами. Фотографии показывает страница результатов, где список и
 * рассматривают. Истории запросов (`search.recent`) — тоже: она требует хранения
 * на устройстве и своего экрана управления в настройках приватности, это отдельная
 * работа (C-05 в бэклоге), а не побочный эффект поля ввода.
 */

'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRoutes, limits, routes } from '@/config';
import {
  danceStyleLabelKey,
  danceStyleSlug,
  danceStyles,
  danceStylesMatchingTerm,
  type DanceStyle,
} from '@/domain/enums';
import {
  enabledSearchScopes,
  searchScopeLabelKey,
  type SearchHit,
  type SearchResponse,
  type SearchScope,
} from '@/domain/search';
import { Link, useRouter } from '@/i18n/routing';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { highlightMatches } from '@/lib/search/normalize';
import { cn } from '@/lib/utils';

/* ───────────────────────── Управление оверлеем ───────────────────────── */

interface SearchOverlayApi {
  open: boolean;
  openSearch(): void;
  closeSearch(): void;
}

const SearchOverlayContext = createContext<SearchOverlayApi | null>(null);

/**
 * Доступ к оверлею из шапки и мобильного меню.
 *
 * Контекст, а не глобальный стор: состояние живёт ровно столько, сколько
 * страница, и подписчиков у него два. Стор ради этого — лишний слой, который
 * потом начнут использовать для того, что должно быть в URL.
 */
export function useSearchOverlay(): SearchOverlayApi {
  const api = useContext(SearchOverlayContext);
  if (!api) {
    throw new Error('useSearchOverlay вызван вне <SearchOverlayProvider>.');
  }
  return api;
}

export function SearchOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  /**
   * Элемент, которому возвращается фокус после закрытия.
   *
   * Возврат сделан вручную, и это не дублирование чужой работы. Radix в
   * модальном диалоге возвращает фокус на СВОЙ `DialogTrigger`; здесь триггера
   * Radix нет — поиск открывают иконка в шапке и сочетание Cmd/Ctrl+K из любого
   * места страницы. `triggerRef` у Radix остаётся пустым, его обработчик
   * закрытия ничего не фокусирует, и человек с клавиатуры после Esc оказывался
   * на `<body>`: обход страницы приходилось начинать заново (WCAG 2.4.3).
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const rememberFocus = useCallback(() => {
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement ? active : null;
  }, []);

  const restoreFocus = useCallback(() => {
    const node = returnFocusRef.current;
    /* Узел мог исчезнуть вместе со своей частью страницы — тогда возвращать некуда. */
    if (node?.isConnected) node.focus();
  }, []);

  /*
   * Cmd/Ctrl+K — ожидаемое сочетание для поиска в продуктах последних лет.
   * `preventDefault` обязателен: в Firefox Ctrl+K фокусирует адресную строку.
   * Слушатель один на приложение и не зависит от того, открыт ли оверлей.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();

      if (open) {
        setOpen(false);
        return;
      }
      /* Запоминаем ДО открытия: после него фокус уже в поле ввода. */
      rememberFocus();
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, rememberFocus]);

  const api = useMemo<SearchOverlayApi>(
    () => ({
      open,
      openSearch: () => {
        rememberFocus();
        setOpen(true);
      },
      closeSearch: () => setOpen(false),
    }),
    [open, rememberFocus],
  );

  return (
    <SearchOverlayContext.Provider value={api}>
      {children}
      <SearchOverlay open={open} onOpenChange={setOpen} onRestoreFocus={restoreFocus} />
    </SearchOverlayContext.Provider>
  );
}

/* ───────────────────────── Результат запроса ───────────────────────── */

/**
 * Ответ на конкретный запрос — вместе с тем, на что он отвечает.
 *
 * Запрос и раздел хранятся рядом с находками, потому что состояние «идёт
 * загрузка» из них выводится, а не держится отдельным флагом: пока сохранённый
 * ответ отвечает не на то, что сейчас в поле, показывается загрузка. Отдельный
 * флаг пришлось бы ставить синхронно в эффекте — лишний рендер и нарушение
 * правила `react-hooks/set-state-in-effect`.
 */
interface Outcome {
  term: string;
  scope: SearchScope;
  /**
   * Номер попытки. Нужен кнопке «повторить»: без него повторный запрос на тот же
   * термин не отличался бы от уже полученного ответа, и нажатие ничего бы не
   * делало.
   */
  attempt: number;
  hits: readonly SearchHit[];
  failed: boolean;
}

/* ───────────────────────────── Оверлей ───────────────────────────── */

interface SearchOverlayProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Возврат фокуса на то, откуда поиск открыли. См. `SearchOverlayProvider`. */
  onRestoreFocus(): void;
}

export function SearchOverlay({ open, onOpenChange, onRestoreFocus }: SearchOverlayProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** Счётчик попыток: меняется при «повторить» и заново запускает запрос. */
  const [attempt, setAttempt] = useState(0);

  const debouncedQuery = useDebouncedValue(query, limits.search.debounceMs);
  /** Обрезка на клиенте, чтобы отправленный запрос совпадал с возвращённым. */
  const term = debouncedQuery.trim().slice(0, limits.search.maxQueryLength);
  const longEnough = term.length >= limits.search.minQueryLength;

  const answered =
    outcome !== null &&
    outcome.term === term &&
    outcome.scope === scope &&
    outcome.attempt === attempt;
  const loading = longEnough && !answered;
  const failed = answered && outcome.failed;
  const hits = answered && !outcome.failed ? outcome.hits : [];

  /*
   * Запрос к API. Отменяется при следующем нажатии клавиши, смене раздела и
   * закрытии оверлея: незавершённый запрос, ответ которого уже никому не нужен,
   * успел бы перезаписать актуальную выдачу.
   */
  useEffect(() => {
    if (!open || !longEnough) return;

    const controller = new AbortController();
    const url = `${apiRoutes.search()}?${new URLSearchParams({
      q: term,
      scope,
      locale,
      limit: String(limits.search.maxSuggestions),
    }).toString()}`;

    fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`search failed: ${response.status}`);
        return (await response.json()) as SearchResponse;
      })
      .then((payload) => {
        setOutcome({ term, scope, attempt, hits: payload.hits, failed: false });
      })
      .catch(() => {
        /* Отмена — это не сбой поиска, а наш собственный следующий запрос. */
        if (controller.signal.aborted) return;
        setOutcome({ term, scope, attempt, hits: [], failed: true });
      });

    return () => controller.abort();
  }, [open, longEnough, term, scope, locale, attempt]);

  /** Подписи направлений на языке страницы: по ним показывается «популярное». */
  const styleOptions = useMemo(
    () =>
      danceStyles.map((style: DanceStyle) => ({
        style,
        label: t(danceStyleLabelKey(style)),
      })),
    [t],
  );

  /**
   * Направления, подходящие запросу.
   *
   * Сопоставление идёт по словарю написаний домена (три алфавита и разговорные
   * формы) и дополняется подписью на языке страницы: перевод названия — это тоже
   * написание, по которому человек ищет.
   *
   * При выбранном разделе подсказок нет: направление — это подборка из всего
   * каталога, и предлагать её рядом с отфильтрованной выдачей «только
   * инструкторы» значит показывать то, что чипом только что отключили.
   */
  const styleMatches = useMemo(() => {
    if (!longEnough) return styleOptions.slice(0, limits.search.popularCount);
    if (scope !== 'all') return [];

    const byDictionary = new Set(danceStylesMatchingTerm(term));
    const needle = term.toLocaleLowerCase();

    return styleOptions
      .filter(
        (option) =>
          byDictionary.has(option.style) || option.label.toLocaleLowerCase().includes(needle),
      )
      .slice(0, limits.search.maxStyleSuggestions);
  }, [longEnough, scope, styleOptions, term]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const resultsHref = routes.discover({
    q: term,
    ...(scope === 'all' ? {} : { scope }),
  });

  /*
   * Оверлей закрывается по переходу, а не сам собой: разметка страницы под ним
   * остаётся смонтированной, и без явного закрытия человек попадает на новую
   * страницу, продолжая смотреть в затемнённое поле поиска.
   */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(longEnough ? resultsHref : routes.discover());
    close();
  };

  /** Список для перевода фокуса стрелками — см. `onListKeyDown`. */
  const listRef = useRef<HTMLDivElement>(null);
  /** Поле ввода: фокус при открытии ставится вручную — см. `onOpenAutoFocus`. */
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Стрелки переводят фокус между строками выдачи.
   *
   * Это дополнение к обычной табуляции, а не замена: строки остаются ссылками, а
   * список — списком, поэтому здесь не появляется ни `role="combobox"`, ни
   * `aria-activedescendant`. Полноценный combobox потребовал бы забрать у ссылок
   * их роль, а вместе с ней — открытие в новой вкладке и предпросмотр адреса.
   */
  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const links = Array.from(listRef.current?.querySelectorAll('a[href]') ?? []);
    if (links.length === 0) return;

    event.preventDefault();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === 'ArrowDown'
        ? Math.min(current + 1, links.length - 1)
        : Math.max(current - 1, 0);

    (links[current === -1 && event.key === 'ArrowUp' ? links.length - 1 : next] as HTMLElement).focus();
  };

  const statusText = failed
    ? t('search.failed')
    : loading
      ? t('common.states.loading')
      : longEnough
        ? hits.length + styleMatches.length > 0
          ? t('search.resultsTitle')
          : t('search.noResults', { query: term })
        : query.trim().length > 0
          ? t('search.minLength', { min: limits.search.minQueryLength })
          : t('search.popular');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        /* Закрытый поиск не помнит прошлый запрос: следующее открытие — новый. */
        if (!next) {
          setQuery('');
          setScope('all');
          setOutcome(null);
        }
      }}
    >
      <DialogContent
        /*
         * Фокус ставится вручную, а не атрибутом `autoFocus` на поле, и это
         * исправление конкретного дефекта. React выполняет `autoFocus` в фазе
         * коммита — РАНЬШЕ, чем Radix успевает запомнить, что было в фокусе до
         * открытия. Радиксу оставалось нечего возвращать, и после Esc фокус
         * уходил на `<body>`: человек с клавиатуры терял место на странице и
         * начинал обход сайта заново. Теперь `onOpenAutoFocus` отменяет
         * стандартное поведение (иначе фокус достался бы кнопке закрытия — она
         * первая в разметке) и переводит фокус в поле сам, уже после того, как
         * прежний элемент записан.
         */
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        /*
         * Возврат фокуса тоже наш: обработчик Radix ведёт фокус на его
         * `DialogTrigger`, которого здесь нет, и потому не делает ничего.
         * `preventDefault` отменяет и его, и стандартный возврат `FocusScope` —
         * дальше решает только `onRestoreFocus`.
         */
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
        className={cn(
          /*
           * Вендорный `DialogContent` — карточка по центру экрана. Здесь нужен
           * весь экран, поэтому его геометрия перекрывается целиком. Значения
           * центрирования (`top-[50%]`, `translate`) снимаются явно: без этого
           * `inset-0` борется с ними, а не заменяет их.
           */
          'inset-0 top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 sm:max-w-none',
          'flex flex-col items-center gap-0 overflow-hidden rounded-none border-0 p-0',
          'bg-surface-cinema/95 backdrop-blur-2xl',
          'text-content-on-cinema',
        )}
      >
        <DialogTitle className="sr-only">{t('common.actions.search')}</DialogTitle>

        <button
          type="button"
          onClick={close}
          aria-label={t('a11y.closeDialog')}
          className={cn(
            'absolute end-6 top-6 flex size-11 items-center justify-center rounded-full',
            'bg-content-on-cinema/10 text-content-on-cinema',
            'transition-colors duration-normal ease-brand hover:bg-content-on-cinema/20',
          )}
        >
          <XIcon className="size-5" aria-hidden />
        </button>

        {/*
          Прокрутка и ограничение ширины — РАЗНЫЕ элементы, и это главное здесь.
          Пока `overflow-y-auto` стоял на `.page-container` (ширина 1320px,
          центрирование), полоса прокрутки рисовалась по правому краю САМОГО
          КОНТЕЙНЕРА, то есть повисала в воздухе посреди тёмного экрана. Теперь
          прокручивается слой во всю ширину, а `.page-container` внутри отвечает
          только за ширину контента и боковые отступы.

          `scrollbar-none`: прокрутка остаётся полностью рабочей (колесо, палец,
          табуляция по ссылкам), но системной полосы не видно — на полноэкранном
          тёмном фоне она читается как светлый шов.

          Отступ сверху — токен `layout.overlayTopOffset`, как в макете: поле
          ввода попадает в естественную зону взгляда, а не в центр экрана.
        */}
        <div className="scrollbar-none w-full flex-1 overflow-y-auto">
          <div className="page-container flex flex-col items-center pt-(--layout-overlay-top-offset) pb-10">
            <form
              onSubmit={submit}
              role="search"
              className="w-full max-w-(--layout-content-max-width)"
            >
              <label className="flex items-center gap-3 border-b-2 border-border-on-cinema pb-4">
                <SearchIcon className="size-6 shrink-0 text-content-on-cinema-muted" aria-hidden />
                <span className="sr-only">{t('search.placeholder')}</span>
                <input
                  ref={inputRef}
                  type="search"
                  name="q"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onListKeyDown}
                  placeholder={t('search.placeholder')}
                  className={cn(
                    'text-heading-3 w-full min-w-0 bg-transparent py-2',
                    'text-content-on-cinema outline-none',
                    'placeholder:text-content-on-cinema-muted',
                  )}
                />
              </label>
            </form>

            {/* Разделы: переключатели области поиска — см. шапку файла. */}
            <div
              role="group"
              aria-label={t('a11y.searchScope')}
              className="mt-8 flex w-full max-w-(--layout-content-max-width) flex-wrap justify-center gap-2"
            >
              {enabledSearchScopes().map((candidate) => {
                const active = candidate === scope;

                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setScope(candidate)}
                    className={cn(
                      'text-caption rounded-full border px-4 py-2',
                      'transition-colors duration-normal ease-brand',
                      active
                        ? 'border-accent-on-cinema bg-content-on-cinema/10 text-content-on-cinema'
                        : 'border-border-on-cinema text-content-on-cinema-muted hover:border-accent-on-cinema hover:text-content-on-cinema',
                    )}
                  >
                    {t(searchScopeLabelKey(candidate))}
                  </button>
                );
              })}
            </div>

            <div className="mt-10 w-full max-w-(--layout-content-max-width)">
              {/*
                Строка состояния: одна и та же позиция на экране отвечает на
                «что здесь происходит» во всех состояниях — популярное, слишком
                короткий запрос, загрузка, ничего не найдено, сбой. Разные
                сообщения в разных местах читаются как разные экраны.
              */}
              <p className="text-eyebrow text-content-on-cinema-muted">{statusText}</p>

              {/*
                Число найденного объявляется отдельно и вежливо: для человека со
                скринридером выдача меняется без всякого сигнала, потому что
                фокус остаётся в поле ввода.
              */}
              <p className="sr-only" aria-live="polite">
                {loading
                  ? t('a11y.loading')
                  : longEnough
                    ? t('common.counts.results', { count: hits.length + styleMatches.length })
                    : ''}
              </p>

              {failed && (
                <div className="mt-4 px-4">
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className={cn(
                      'text-caption rounded-full border border-border-on-cinema px-4 py-2',
                      'text-content-on-cinema transition-colors duration-normal ease-brand',
                      'hover:border-accent-on-cinema',
                    )}
                  >
                    {t('common.actions.retry')}
                  </button>
                </div>
              )}

              {loading && (
                <ul className="mt-4 flex flex-col gap-1" aria-hidden>
                  {Array.from({ length: limits.search.popularCount }).map((_, index) => (
                    <li key={index} className="px-4 py-3">
                      <Skeleton
                        className={cn(
                          'h-4 bg-content-on-cinema/10',
                          index % 2 === 0 ? 'w-full' : 'w-4/5',
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {!loading && !failed && (
                <div ref={listRef} onKeyDown={onListKeyDown}>
                  <ul className="mt-4 flex flex-col">
                    {/*
                      Направления идут первыми при введённом запросе: подборка
                      «вся сальса» отвечает на запрос «сальса» полнее, чем одно
                      занятие из неё.
                    */}
                    {styleMatches.map((option) => (
                      <li key={option.style}>
                        <SearchRow
                          href={routes.discover({ style: danceStyleSlug(option.style) })}
                          title={option.label}
                          term={longEnough ? term : ''}
                          badge={t('common.labels.style')}
                          onNavigate={close}
                        />
                      </li>
                    ))}

                    {hits.map((hit) => (
                      <li key={hit.id}>
                        <SearchRow
                          href={hit.href}
                          title={hit.title}
                          subtitle={hit.subtitle}
                          term={term}
                          badge={t(searchScopeLabelKey(hit.scope))}
                          onNavigate={close}
                        />
                      </li>
                    ))}
                  </ul>

                  {longEnough && hits.length + styleMatches.length > 0 && (
                    <div className="mt-6 px-4">
                      {/*
                        Ссылка на полную выдачу: оверлей показывает первые строки,
                        а страница результатов — всё, с разбивкой по разделам, и её
                        можно переслать и проиндексировать.
                      */}
                      <Link
                        href={resultsHref}
                        onClick={close}
                        className={cn(
                          'text-caption inline-flex items-center gap-2 border-b border-accent-on-cinema pb-1',
                          'text-content-on-cinema transition-opacity duration-normal ease-brand hover:opacity-80',
                        )}
                      >
                        {t('search.viewAll')}
                      </Link>
                    </div>
                  )}

                  {longEnough && hits.length + styleMatches.length === 0 && (
                    <p className="text-body-sm mt-4 px-4 text-content-on-cinema-muted">
                      {t('search.noResultsHint')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Строка выдачи ───────────────────────────── */

interface SearchRowProps {
  href: string;
  title: string;
  subtitle?: string;
  /** Запрос для подсветки. Пустая строка — подсвечивать нечего. */
  term: string;
  badge: string;
  onNavigate(): void;
}

/**
 * Одна строка результата.
 *
 * Разметка одна на все разделы: смешанный список из строк разной формы читается
 * как сбой вёрстки, а не как разнообразие. Раздел различает подпись справа.
 */
function SearchRow({ href, title, subtitle, term, badge, onNavigate }: SearchRowProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center justify-between gap-4 rounded-md px-4 py-3',
        'transition-colors duration-normal ease-brand hover:bg-content-on-cinema/10',
        'focus-visible:bg-content-on-cinema/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
      )}
    >
      <span className="min-w-0">
        <span className="text-body block truncate">
          <Highlighted text={title} term={term} />
        </span>
        {subtitle !== undefined && subtitle.length > 0 && (
          <span className="text-caption block truncate text-content-on-cinema-muted">
            {subtitle}
          </span>
        )}
      </span>
      <span className="text-caption shrink-0 text-content-on-cinema-muted">{badge}</span>
    </Link>
  );
}

/**
 * Найденная часть названия — ярче и жирнее остального.
 *
 * Подсветка сделана весом и яркостью, а не цветом: акцент бренда на тёмном фоне
 * не проходит контраст как текст (`docs/00-decision-record.md` §7), а жёлтая
 * заливка `<mark>` по умолчанию на кинематографичном фоне выглядит как ошибка
 * стилей. Тег `<mark>` при этом остаётся: это его семантика, и часть
 * скринридеров её объявляет.
 */
function Highlighted({ text, term }: { text: string; term: string }) {
  if (term.length === 0) return <>{text}</>;

  const chunks = highlightMatches(text, term);
  /* Совпадений нет (нашлось по опечатке или по другому полю) — не выделяем ничего. */
  if (!chunks.some((chunk) => chunk.match)) return <>{text}</>;

  return (
    <>
      {chunks.map((chunk, index) =>
        chunk.match ? (
          <mark
            key={index}
            className="bg-transparent font-semibold text-content-on-cinema"
          >
            {chunk.text}
          </mark>
        ) : (
          <span key={index} className="text-content-on-cinema-muted">
            {chunk.text}
          </span>
        ),
      )}
    </>
  );
}
