/** Переводит messageKey сервера по словарю приложения; null, если ключа нет или он не строка. */
export function resolveServerMessage(
  messageKey: string,
  params: Readonly<Record<string, string | number>>,
  catalog: unknown,
): string | null {
  let node: unknown = catalog;
  for (const part of messageKey.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return null;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'string') return null;
  return node.replace(/\{(\w+)\}/g, (placeholder, name: string) => (name in params ? String(params[name]) : placeholder));
}

/** Читает messageKey из тела неуспешного ответа и переводит его по словарю. */
export async function readServerMessage(response: Response, catalog: unknown): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as {
    messageKey?: string;
    params?: Record<string, string | number>;
  } | null;
  if (!body?.messageKey) return null;
  return resolveServerMessage(body.messageKey, body.params ?? {}, catalog);
}

/** Переведённый текст сервера из ошибки модуля; null, если его нет. */
export function serverMessageOf(error: unknown): string | null {
  return error instanceof Error && 'serverMessage' in error && typeof error.serverMessage === 'string'
    ? error.serverMessage
    : null;
}
