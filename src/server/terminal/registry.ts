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
    name: 'revalidate',
    usage: 'revalidate [path]',
    description: 'Инвалидировать кэш Next.js (по умолчанию /)',
    examples: ['revalidate /', 'revalidate /en/admin/support/terminal'],
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
