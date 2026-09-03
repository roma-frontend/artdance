/**
 * MOBILE DOCK — нижняя панель навигации для узких экранов.
 *
 * Четыре постоянных назначения и центральная кнопка, открывающая сетку
 * остальных разделов. Это замена бургеру с выезжающим списком, и замена по
 * существу, а не по виду: список начинался у верхнего края экрана, куда на
 * телефоне в 6,7 дюйма одной рукой не дотянуться, а док стоит там, где палец
 * уже есть.
 *
 * Геометрия — тот самый пункт, который ломается первым, поэтому она задана
 * жёстко: каждая вкладка это блок иконки фиксированной высоты плюс блок
 * подписи фиксированной высоты. Длинная подпись обрезается внутри своего блока
 * и не может сдвинуть иконку, а активная вкладка не может встать на пиксель
 * выше соседней. Активную выделяем цветом и толщиной штриха, а не масштабом:
 * увеличенная иконка поднимает свою верхнюю кромку и получается «почти
 * выровнено», что как раз и заметно.
 *
 * Подчёркивание активной вкладки — единственный элемент, который двигается.
 * Оно едет по колонке из пяти, поэтому его положение это одно умножение, а не
 * измерение четырёх ячеек.
 *
 * Док не рендерится от `lg` и выше: там работает горизонтальная навигация в
 * шапке. Порог тот же, на котором в шапке скрываются ссылки.
 */

'use client';

import { LayoutGridIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MobileMenuSheetContent } from '@/components/layout/mobile-menu-sheet';
import { navIcons } from '@/components/layout/nav-icons';
import { Drawer, DrawerTrigger } from '@/components/ui/drawer';
import { isActiveNavPath, mobileDockItems, mobileDockSlots, type MobileDockItem } from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Всего колонок в доке: четыре вкладки и центральная кнопка. */
const COLUMNS = mobileDockSlots.length + 1;

export function MobileDock() {
  const t = useTranslations();
  const pathname = usePathname();

  const active = mobileDockItems.find((item) => isActiveNavPath(pathname, item.href));

  return (
    /*
     * `Drawer` охватывает и док, и шторку, и своей разметки не создаёт. Так
     * кнопка становится настоящим `DrawerTrigger`: состояние держит библиотека,
     * `aria-expanded` она ставит сама, а фокус после закрытия возвращается на
     * кнопку. Со своим `useState` последнего не происходило — на телефоне
     * касание кнопку не фокусирует, и фокус возвращался на `body`.
     */
    <Drawer
      /*
       * Фокус переносится внутрь шторки при открытии.
       *
       * У vaul это выключено по умолчанию — на телефоне автофокус в поле ввода
       * поднимает клавиатуру поверх панели. Но у нашей шторки полей нет, а
       * модальный диалог обязан забирать фокус: без этого ловушка фокуса держать
       * нечего, `Tab` уводит на страницу под затемнением, и клавиатурой шторка
       * становится непроходимой. Проверяется `e2e/site-header.spec.ts`.
       */
      autoFocus
    >
      {/*
        Внешняя обёртка не перехватывает нажатия (`pointer-events-none` в
        `globals.css`): она занимает всю ширину, и без этого её прозрачные поля
        по бокам съедали бы клики по содержимому страницы под ними.
      */}
      <div className="mobile-dock-shell lg:hidden">
        <nav
          aria-label={t('a11y.mainNav')}
          className={cn(
            'mobile-dock pointer-events-auto relative mx-auto grid items-stretch',
            'h-(--layout-bottom-nav-height) w-full max-w-md rounded-xl',
            'border border-border-default bg-surface-card/95 shadow-lg backdrop-blur-xl',
          )}
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {/*
            Индикатор активной вкладки. Ширина ровно в одну колонку, сдвиг —
            номер слота, умноженный на 100%. При отсутствии активного раздела
            (например, на странице занятия) индикатор гаснет, а не уезжает в ноль.
          */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 transition-[translate,opacity]',
              'duration-slow ease-brand motion-reduce:transition-none',
              active ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              width: `${100 / COLUMNS}%`,
              translate: `${(active?.slot ?? 0) * 100}% 0`,
            }}
          >
            <span className="mobile-dock-indicator" />
          </span>

          <DockTab item={dockItem(0)} activeSlot={active?.slot} />
          <DockTab item={dockItem(1)} activeSlot={active?.slot} />

          {/* Центральное действие: открывает всё, что не поместилось в док. */}
          <div className="relative z-raised flex items-start justify-center">
            <DrawerTrigger
              aria-label={t('nav.openMenu')}
              className={cn(
                'grid size-14 -translate-y-5 place-items-center rounded-full',
                'bg-accent text-content-on-accent shadow-lg',
                'ring-4 ring-surface-canvas',
                'transition-[scale,background-color] duration-normal ease-brand active:scale-95',
                'hover:bg-accent-hover',
              )}
            >
              <LayoutGridIcon className="size-6" aria-hidden />
            </DrawerTrigger>
          </div>

          <DockTab item={dockItem(3)} activeSlot={active?.slot} />
          <DockTab item={dockItem(4)} activeSlot={active?.slot} />
        </nav>
      </div>

      <MobileMenuSheetContent />
    </Drawer>
  );
}

/** Вкладка по номеру слота. Порядок в разметке — визуальный, без `grid-column`. */
function dockItem(slot: number): MobileDockItem | undefined {
  return mobileDockItems.find((item) => item.slot === slot);
}

function DockTab({ item, activeSlot }: { item?: MobileDockItem; activeSlot?: number }) {
  const t = useTranslations();

  /* Пустая колонка сохраняет сетку: центральная кнопка обязана остаться в центре. */
  if (!item) return <span aria-hidden />;

  const active = item.slot === activeSlot;
  const Icon = navIcons[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative z-raised flex h-full min-w-0 flex-col items-center justify-center gap-1',
        'text-2xs transition-colors duration-normal ease-brand',
        active ? 'font-bold text-content-accent' : 'font-semibold text-content-tertiary',
      )}
    >
      <span className="grid h-8 w-12 place-items-center">
        <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
      </span>
      {/*
        Подпись в блоке фиксированной высоты: армянские названия разделов
        длиннее английских, и без обрезки внутри своего блока они переносились
        на вторую строку, поднимая иконку соседней вкладки.
      */}
      <span className="block h-4 w-full truncate px-0.5 text-center leading-4">
        {t(item.labelKey)}
      </span>
    </Link>
  );
}
