/** Pure validation and serialization shared by the operator tools. */
export function flattenMessages(tree: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[path] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(result, flattenMessages(value as Record<string, unknown>, path));
  }
  return result;
}

export function messageParameters(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\s*([A-Za-z_]\w*)\s*(?=[,}])/g)].map((m) => m[1]).filter((v): v is string => Boolean(v)))].sort();
}

export function messageTags(text: string): string[] {
  return [...new Set([...text.matchAll(/<([A-Za-z][\w-]*)>/g)].map((m) => m[1]).filter((v): v is string => Boolean(v)))].sort();
}

export function setMessage(tree: Record<string, unknown>, key: string, value: string): boolean {
  const parts = key.split('.');
  if (parts.some((part) => ['__proto__', 'constructor', 'prototype'].includes(part))) return false;
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    const child = Object.hasOwn(node, part) ? node[part] : undefined;
    if (!child || typeof child !== 'object' || Array.isArray(child)) return false;
    node = child as Record<string, unknown>;
  }
  const last = parts.at(-1)!;
  if (!Object.hasOwn(node, last) || typeof node[last] !== 'string') return false;
  node[last] = value;
  return true;
}

/** No auth credentials, provider payloads or push secrets in the data browser. */
export const secretFields = new Set([
  'password', 'passwordHash', 'token', 'tokenHash', 'accessToken', 'refreshToken',
  'idToken', 'secret', 'value', 'p256dh', 'auth', 'endpoint', 'providerPayload',
  'rawPayload', 'payload', 'bankAccountIban', 'bankAccountNumber', 'accountNumber',
]);

export function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
}

export function redactRecord(row: Record<string, unknown>, model: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !secretFields.has(key) || (key === 'value' && !['VerificationToken', 'OperatorSetting'].includes(model))));
}
