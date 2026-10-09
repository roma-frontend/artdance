import type { AccountView } from '@/components/account/view-toggle';

export function resolveAccountView(searchParams?: Record<string, string | string[] | undefined>): AccountView {
  const v = searchParams?.view;
  const raw = Array.isArray(v) ? v[0] : v;
  return raw === 'grid' ? 'grid' : 'list';
}
