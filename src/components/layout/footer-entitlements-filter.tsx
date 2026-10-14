'use client';

import type { ReactNode } from 'react';

import type { NavGroup } from '@/config/navigation';

export function FooterEntitlementsFilter({ children }: { groups: readonly NavGroup[]; children: ReactNode }) {
  return <>{children}</>;
}
