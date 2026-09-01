/**
 * Реестр каталогов. Динамический `import()` по локали, чтобы в бандл
 * не попадали все три языка сразу.
 */

import type { Locale } from '../config';
import type { Messages } from '../types';

export const messageLoaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  hy: () => import('./hy') as Promise<{ default: Messages }>,
  ru: () => import('./ru') as Promise<{ default: Messages }>,
  en: () => import('./en') as unknown as Promise<{ default: Messages }>,
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = await messageLoaders[locale]();
  return mod.default;
}
