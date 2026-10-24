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
