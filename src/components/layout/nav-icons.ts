/**
 * Реестр иконок навигации: имя из конфигурации → компонент lucide.
 *
 * Живёт в UI-слое, потому что `src/config` не имеет права импортировать React —
 * иначе конфигурация перестаёт быть данными и её нельзя прочитать из скрипта.
 * Тип `Record<NavIconName, LucideIcon>` делает пропуск иконки ошибкой сборки:
 * добавить раздел с новым именем иконки и забыть про сам значок невозможно.
 *
 * Иконки одного семейства и одинаковой толщины. Эмодзи из прототипа (📍, ⭐)
 * не переносятся: они рисуются по-разному в разных системах, а скринридер
 * читает их как «булавка» и «звезда».
 */

import {
  CalendarDaysIcon,
  CompassIcon,
  HeartIcon,
  HomeIcon,
  MapPinIcon,
  MusicIcon,
  SearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TicketIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

import type { NavIconName } from '@/config';

export const navIcons: Record<NavIconName, LucideIcon> = {
  home: HomeIcon,
  discover: CompassIcon,
  classes: MusicIcon,
  instructors: UsersIcon,
  studios: MapPinIcon,
  calendar: CalendarDaysIcon,
  events: TicketIcon,
  pricing: SparklesIcon,
  search: SearchIcon,
  cart: ShoppingBagIcon,
  favorites: HeartIcon,
  account: UserIcon,
  shop: ShoppingBagIcon,
};
