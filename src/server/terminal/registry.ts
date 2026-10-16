/**
 * TERMINAL REGISTRY — единственный источник команд оператора.
 *
 * Фронт читает его для подсказок/автокомплита, бэк — для исполнения.
 * Добавить команду = добавить объект сюда.
 */

export interface TerminalCommandSpec {
  name: string;
  usage: string;
  description: string;
  examples?: readonly string[];
  dangerous?: boolean;
}

export const terminalCommands: readonly TerminalCommandSpec[] = [
  {
    name: 'help',
    usage: 'help',
    description: 'Показать список команд',
    examples: ['help'],
  },
  {
    name: 'health',
    usage: 'health',
    description: 'Сводка: сессии, тикеты, сбои платежей/писем/webhook, сервисы',
  },
  {
    name: 'counts',
    usage: 'counts',
    description: 'Активные сессии, заблокированные ключи входа, открытые тикеты',
  },
  {
    name: 'jobs',
    usage: 'jobs [n]',
    description: 'Последние JobRun (по умолчанию 10)',
    examples: ['jobs', 'jobs 5'],
  },
  {
    name: 'db',
    usage: 'db <sub>',
    description: 'Работа с данными. Подкоманды: models | counts [Model] | count <Model> [--where JSON] | find <Model> [--where JSON] [--take N] [--q text]',
    examples: ['db models', 'db counts', 'db counts User', 'db count Cart --where {"anonymousId":{"not":null}}', 'db find Cart --take 3'],
  },
  {
    name: 'carts',
    usage: 'carts <sub>',
    description: 'Корзины магазина. Подкоманды: stats | purge [--empty] [--anon] [--older-than 7d] [--dry-run] [--force]',
    examples: ['carts stats', 'carts purge --empty --dry-run', 'carts purge --empty --force', 'carts purge --empty --anon --older-than 7d --force'],
  },
  {
    name: 'classes',
    usage: 'classes [query] [--take N]',
    description: 'Найти занятия DanceClass по salsa/названию/слагу и показать картинки',
    examples: ['classes salsa', 'classes --take 5', 'classes bachata --take 3'],
  },
  {
    name: 'instructors',
    usage: 'instructors [query] [--take N]',
    description: 'Найти инструкторов и показать аватарки',
    examples: ['instructors --take 3', 'instructors salsa'],
  },
  {
    name: 'products',
    usage: 'products [query] [--take N]',
    description: 'Найти товары и показать картинки',
    examples: ['products --take 3', 'products salsa'],
  },
  {
    name: 'media',
    usage: 'media <Model> <id|slug>',
    description: 'Показать медиа-активы сущности (картинки + URL)',
    examples: ['media DanceClass <id>', 'media DanceClass salsa-bachata', 'media Product <id>'],
  },
  {
    name: 'revalidate',
    usage: 'revalidate [path]',
    description: 'Инвалидировать кэш Next.js (по умолчанию /)',
    examples: ['revalidate /', 'revalidate /en/admin/support/terminal'],
  },
  {
    name: 'open',
    usage: 'open <path|slug>',
    description: 'Подсказать ссылку для открытия в новой вкладке (копируй URL)',
    examples: ['open /en/classes/salsa', 'open salsa'],
  },
  {
    name: 'clear',
    usage: 'clear',
    description: 'Очистить вывод терминала (только фронт)',
  },
] as const;

export const terminalCommandNames = terminalCommands.map((c) => c.name);

export function findCommand(name: string): TerminalCommandSpec | undefined {
  return terminalCommands.find((c) => c.name === name.toLowerCase());
}
