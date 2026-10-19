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

/**
 * Descriptions are i18n keys: `admin.support.terminalCmd<Name>` (e.g. terminalCmdHelp).
 * Registry keeps `description` as EN fallback; UI resolves via next-intl so EN stays EN.
 */
export const terminalCommands: readonly TerminalCommandSpec[] = [
  { name: 'help', usage: 'help', description: 'Show all commands', examples: ['help'] },
  { name: 'health', usage: 'health', description: 'Summary: sessions, tickets, failed payments/emails/webhooks, services' },
  { name: 'counts', usage: 'counts', description: 'Active sessions, locked login keys, open tickets' },
  { name: 'jobs', usage: 'jobs [n]', description: 'Recent JobRun entries (default 10)', examples: ['jobs', 'jobs 5'] },
  {
    name: 'inspect',
    usage: 'inspect <User|Order|Booking|SupportTicket> <id|key>',
    description: 'Support snapshot with safe relations and recent activity',
    examples: ['inspect User <id>', 'inspect Order AD-2026-00042', 'inspect SupportTicket <id>'],
  },
  {
    name: 'search',
    usage: 'search <email|id|name|reference|text>',
    description: 'Search users, orders, bookings, classes, venues and support tickets',
    examples: ['search anna@example.com', 'search AD-2026-00042', 'search payment'],
  },
  {
    name: 'db',
    usage: 'db <sub>',
    description:
      'Data access (all models). Subcommands: models | counts [Model] | count <Model> [--where JSON] | find <Model> [--where JSON] [--take N] [--q text] | get <Model> <id> | fields <Model> | create <Model> --data JSON | update <Model> <id> --set JSON | delete <Model> <id> [--force] [--hard] | restore <Model> <id>',
    examples: [
      'db models',
      'db counts',
      'db counts User',
      'db count Cart --where {"anonymousId":{"not":null}}',
      'db find Cart --take 3',
      'db get User <id>',
      'db fields DanceClass',
      'db create PromoCode --data {"code":"TEST","type":"FIXED","value":1000}',
      'db update User <id> --set {"name":"New Name"}',
      'db delete DanceClass <id> --force',
      'db restore DanceClass <id>',
    ],
  },
  {
    name: 'carts',
    usage: 'carts <sub>',
    description: 'Shop carts. Subcommands: stats | purge [--empty] [--anon] [--older-than 7d] [--dry-run] [--force]',
    examples: ['carts stats', 'carts purge --empty --dry-run', 'carts purge --empty --force', 'carts purge --empty --anon --older-than 7d --force'],
  },
  {
    name: 'classes',
    usage: 'classes [query] [--take N]',
    description: 'Find DanceClass by salsa/title/slug and show images',
    examples: ['classes salsa', 'classes --take 5', 'classes bachata --take 3'],
  },
  {
    name: 'instructors',
    usage: 'instructors [query] [--take N]',
    description: 'Find instructors and show avatars',
    examples: ['instructors --take 3', 'instructors salsa'],
  },
  {
    name: 'products',
    usage: 'products [query] [--take N]',
    description: 'Find products and show images',
    examples: ['products --take 3', 'products salsa'],
  },
  {
    name: 'media',
    usage: 'media <Model> <id|slug>',
    description: 'Show media assets of an entity (images + URLs)',
    examples: ['media DanceClass <id>', 'media DanceClass salsa-bachata', 'media Product <id>'],
  },
  { name: 'revalidate', usage: 'revalidate [path]', description: 'Invalidate Next.js cache (default /)', examples: ['revalidate /', 'revalidate /en/admin/support/terminal'] },
  { name: 'open', usage: 'open <path|slug>', description: 'Suggest a link to open in a new tab (copy URL)', examples: ['open /en/classes/salsa', 'open salsa'] },
  { name: 'clear', usage: 'clear', description: 'Clear terminal output (client only)' },
] as const;

export const terminalCommandNames = terminalCommands.map((c) => c.name);

export function findCommand(name: string): TerminalCommandSpec | undefined {
  return terminalCommands.find((c) => c.name === name.toLowerCase());
}
