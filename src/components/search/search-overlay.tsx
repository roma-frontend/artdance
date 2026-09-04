/**
 * SEARCH OVERLAY — полноэкранный поиск.
 *
 * В прототипе это блок с инлайновыми стилями и без всякой логики: поле,
 * крестик, шесть чипов. Ни обработчика ввода, ни результатов, ни Esc, ни ловушки
 * фокуса. Здесь достроено то, без чего оверлей не работает, и не достроено то,
 * чего пока нет в системе.
 *
 * **Что уже работает по-настоящему.** Открытие иконкой и по Cmd/Ctrl+K. Ловушка
 * фокуса, Esc, блокировка прокрутки и возврат фокуса на триггер — от Radix
 * Dialog, а не своим `visibility` как в макете. Запрос уходит в
 * `routes.discover({ q })`, то есть ссылка на результаты остаётся пересылаемой и
 * индексируемой. Подсказки по направлениям фильтруются на месте: «сал» →
 * «Salsa» → подборка направления. Данные для этого уже есть в
 * `domain/enums.ts`, запрос к серверу не нужен.
 *
 * **Чего здесь осознанно НЕТ.** Поиска по занятиям, инструкторам и товарам:
 * `/api/search` — задача 2.8, и пока его нет, оверлей честно отправляет запрос в
 * каталог, а не изображает выдачу. По той же причине чипы областей — это ссылки
 * на разделы, а не переключатели фильтра: в прототипе у них нет активного
 * состояния, потому что фильтровать ещё нечего. Когда область станет параметром
 * запроса, они станут переключателями — компонент к этому готов, менять придётся
 * только источник списка результатов.
 *
 * **Задержка ввода настоящая, хотя фильтрация локальная.** Пауза берётся из
 * `limits.search.debounceMs` и стоит там, где потом окажется запрос к API:
 * иначе при подключении `/api/search` её пришлось бы вставлять заново и
 * выяснять на демо, что поиск шлёт запрос на каждый символ.
 *
 * **Транслитерации пока нет.** Посетитель с армянской раскладки не найдёт
 * «Salsa», набрав «Սալսա». Это известная дыра, и закрывает её
 * `lib/search/normalize.ts` из задачи 2.8 — заглушку в виде своего словаря
 * писать не стоит: он разойдётся с настоящим индексом.
 */

'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { isEnabled, limits, routes } from '@/config';
import { danceStyleLabelKey, danceStyleSlug, danceStyles, type DanceStyle } from '@/domain/enums';
import { Link, useRouter } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
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

  /*
   * Cmd/Ctrl+K — ожидаемое сочетание для поиска в продуктах последних лет.
   * `preventDefault` обязателен: в Firefox Ctrl+K фокусирует адресную строку.
   * Слушатель один на приложение и не зависит от того, открыт ли оверлей.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setOpen((previous) => !previous);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const api = useMemo<SearchOverlayApi>(
    () => ({
      open,
      openSearch: () => setOpen(true),
      closeSearch: () => setOpen(false),
    }),
    [open],
  );

  return (
    <SearchOverlayContext.Provider value={api}>
      {children}
      <SearchOverlay open={open} onOpenChange={setOpen} />
    </SearchOverlayContext.Provider>
  );
}

/* ───────────────────────── Области поиска ───────────────────────── */

interface SearchScope {
  id: string;
  labelKey: MessageKey;
  href: string;
  /** Раздел выключенного модуля не показывается — как в шапке и подвале. */
  enabled: boolean;
}

/**
 * Разделы под полем ввода. Порядок и подписи — из макета (`search.scope*`),
 * адреса — из `routes`, доступность — из флагов поставки.
 */
const searchScopes: readonly SearchScope[] = [
  { id: 'all', labelKey: 'search.scopeAll', href: routes.discover(), enabled: true },
  { id: 'classes', labelKey: 'search.scopeClasses', href: routes.classes(), enabled: true },
  {
    id: 'instructors',
    labelKey: 'search.scopeInstructors',
    href: routes.instructors(),
    enabled: true,
  },
  { id: 'studios', labelKey: 'search.scopeStudios', href: routes.studios(), enabled: true },
  { id: 'products', labelKey: 'search.scopeProducts', href: routes.shop(), enabled: isEnabled('shop') },
  { id: 'events', labelKey: 'search.scopeEvents', href: routes.events(), enabled: isEnabled('events') },
];

/* ───────────────────────────── Оверлей ───────────────────────────── */

interface SearchOverlayProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function SearchOverlay({ open, onOpenChange }: SearchOverlayProps) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const debouncedQuery = useDebouncedValue(query, limits.search.debounceMs);
  const trimmed = debouncedQuery.trim();
  const longEnough = trimmed.length >= limits.search.minQueryLength;

  /** Подписи направлений на языке страницы: по ним и идёт сопоставление. */
  const styleOptions = useMemo(
    () =>
      danceStyles.map((style: DanceStyle) => ({
        style,
        label: t(danceStyleLabelKey(style) as 'danceStyles.hipHop'),
      })),
    [t],
  );

  const matches = useMemo(() => {
    const needle = trimmed.toLocaleLowerCase();
    if (!longEnough) {
      /* Пустой экран: короткий список «популярное», умещающийся без прокрутки. */
      return styleOptions.slice(0, limits.search.popularCount);
    }
    return styleOptions
      .filter((option) => option.label.toLocaleLowerCase().includes(needle))
      .slice(0, limits.search.maxSuggestions);
  }, [longEnough, styleOptions, trimmed]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /*
   * Оверлей закрывается по переходу, а не сам собой: разметка страницы под ним
   * остаётся смонтированной, и без явного закрытия человек попадает на новую
   * страницу, продолжая смотреть в затемнённое поле поиска.
   */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value.length > 0 ? routes.discover({ q: value }) : routes.discover());
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        /* Закрытый поиск не помнит прошлый запрос: следующее открытие — новый. */
        if (!next) setQuery('');
      }}
    >
      <DialogContent
        showCloseButton={false}
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
          тёмном фоне она читается как светлый шов. Список при этом рассчитан
          умещаться целиком (`limits.search.popularCount`), поэтому прокрутка
          нужна только на низких окнах.

          Отступ сверху — токен `layout.overlayTopOffset`, как в макете: поле
          ввода попадает в естественную зону взгляда, а не в центр экрана.
        */}
        <div className="scrollbar-none w-full flex-1 overflow-y-auto">
          <div className="page-container flex flex-col items-center pt-(--layout-overlay-top-offset) pb-10">
            <form onSubmit={submit} className="w-full max-w-(--layout-content-max-width)">
              <label className="flex items-center gap-3 border-b-2 border-border-on-cinema pb-4">
                <SearchIcon className="size-6 shrink-0 text-content-on-cinema-muted" aria-hidden />
                <span className="sr-only">{t('search.placeholder')}</span>
                <input
                  type="search"
                  name="q"
                  autoFocus
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('search.placeholder')}
                  className={cn(
                    'text-heading-3 w-full min-w-0 bg-transparent py-2',
                    'text-content-on-cinema outline-none',
                    'placeholder:text-content-on-cinema-muted',
                  )}
                />
              </label>
            </form>

            {/* Разделы: ссылки, а не переключатели фильтра — см. шапку файла. */}
            <nav
              aria-label={t('common.actions.search')}
              className="mt-8 flex w-full max-w-(--layout-content-max-width) flex-wrap justify-center gap-2"
            >
              {searchScopes
                .filter((scope) => scope.enabled)
                .map((scope) => (
                  <Link
                    key={scope.id}
                    href={scope.href}
                    onClick={close}
                    className={cn(
                      'text-caption rounded-full border border-border-on-cinema px-4 py-2',
                      'text-content-on-cinema-muted transition-colors duration-normal ease-brand',
                      'hover:border-accent-on-cinema hover:text-content-on-cinema',
                    )}
                  >
                    {t(scope.labelKey)}
                  </Link>
                ))}
            </nav>

            <div className="mt-10 w-full max-w-(--layout-content-max-width)">
              {/*
                Пока запрос короче минимума, вместо пустоты показываются
                направления: это и подсказка о том, что здесь искать, и рабочий
                список — в макете на этом месте нет ничего.
              */}
              <p className="text-eyebrow text-content-on-cinema-muted">
                {longEnough
                  ? t('common.states.noResults')
                  : query.trim().length > 0
                    ? t('search.minLength', { min: limits.search.minQueryLength })
                    : t('search.popular')}
              </p>

              {longEnough && matches.length > 0 && (
                <p className="sr-only">{t('common.counts.results', { count: matches.length })}</p>
              )}

              <ul className="mt-4 flex flex-col">
                {longEnough && (
                  <li>
                    {/* Свободный запрос всегда доступен: он и есть настоящий поиск. */}
                    <Link
                      href={routes.discover({ q: trimmed })}
                      onClick={close}
                      className={cn(
                        'flex items-center justify-between gap-4 rounded-md px-4 py-3',
                        'transition-colors duration-normal ease-brand hover:bg-content-on-cinema/10',
                      )}
                    >
                      <span className="text-body flex min-w-0 items-center gap-3">
                        <SearchIcon
                          className="size-4 shrink-0 text-content-on-cinema-muted"
                          aria-hidden
                        />
                        <span className="truncate">{trimmed}</span>
                      </span>
                      <span className="text-caption shrink-0 text-content-on-cinema-muted">
                        {t('search.scopeAll')}
                      </span>
                    </Link>
                  </li>
                )}

                {matches.map((option) => (
                  <li key={option.style}>
                    <Link
                      href={routes.discover({ style: danceStyleSlug(option.style) })}
                      onClick={close}
                      className={cn(
                        'flex items-center justify-between gap-4 rounded-md px-4 py-3',
                        'transition-colors duration-normal ease-brand hover:bg-content-on-cinema/10',
                      )}
                    >
                      <span className="text-body truncate">{option.label}</span>
                      <span className="text-caption shrink-0 text-content-on-cinema-muted">
                        {t('common.labels.style')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {longEnough && matches.length === 0 && (
                <p className="text-body-sm mt-4 px-4 text-content-on-cinema-muted">
                  {t('common.states.noResultsHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
