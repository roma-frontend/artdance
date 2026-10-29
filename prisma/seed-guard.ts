// Демо-аккаунты с общим паролем из репозитория: писать только в локальную базу.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PRODUCTION_MARKERS = ['NODE_ENV', 'NEXT_PUBLIC_APP_ENV', 'VERCEL_ENV'] as const;

/** Имя цели без пароля; чужая база пускается только с SEED_ALLOW_REMOTE_DB, равным ему. */
export function assertSeedTarget(
  connectionString: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  const marker = PRODUCTION_MARKERS.find((name) => env[name] === 'production');
  if (marker) {
    throw new Error(
      `seed — ${marker}=production: демо-сид не запускается в продакшен-окружении.`,
    );
  }

  const url = toUrl(connectionString);
  const target = targetName(url);
  const queryHosts = url.searchParams.getAll('host');
  if (isLoopback(url.hostname) && queryHosts.every(isLoopback)) return target;
  if (env.SEED_ALLOW_REMOTE_DB?.trim() === target && queryHosts.length === 0) return target;

  throw new Error(
    `seed — цель ${target} не локальная: демо-аккаунты с общим паролем не пишутся в чужую базу. ` +
      `Если это тестовая база, задайте SEED_ALLOW_REMOTE_DB=${target}`,
  );
}

function toUrl(connectionString: string): URL {
  try {
    return new URL(connectionString);
  } catch {
    throw new Error('seed — строка подключения не разбирается, цель записи не проверена.');
  }
}

function targetName(url: URL): string {
  const port = url.port ? `:${url.port}` : '';
  return `${url.username}@${url.hostname.toLowerCase()}${port}${url.pathname}`;
}

function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}
