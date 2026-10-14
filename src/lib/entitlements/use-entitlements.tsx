'use client';

import { useEffect, useState } from 'react';

import { features, type FeatureKey } from '@/config/features';
import {
  headerIconItems as staticHeaderIcons,
  headerMegaGroups as staticMegaGroups,
  footerNavGroups as staticFooterGroups,
  primaryNavItems as staticPrimary,
  allMegaChildren as staticMegaChildren,
} from '@/config/navigation';

type Snapshot = Record<FeatureKey, boolean>;

function applySnapshot(snapshot: Snapshot) {
  const enabled = (feature?: FeatureKey) => !feature || !!snapshot[feature];
  return {
    primary: staticPrimary.filter((i) => enabled(i.feature)),
    headerIcons: staticHeaderIcons.filter((i) => enabled((i as unknown as { feature?: FeatureKey }).feature)),
    megaGroups: staticMegaGroups
      .map((g) => ({ ...g, children: g.children.filter((c) => enabled(c.feature)) }))
      .filter((g) => g.children.length > 0 || !g.children.length),
    megaChildren: staticMegaChildren.filter((c) => enabled(c.feature)),
    footerGroups: staticFooterGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => enabled(it.feature)) }))
      .filter((g) => g.items.length > 0),
  };
}

export function useEntitlementFilters() {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ ...features }) as Snapshot);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/entitlements', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        const next: Snapshot = { ...features } as Snapshot;
        for (const k of Object.keys(next) as FeatureKey[]) {
          if (typeof data[k] === 'boolean') next[k] = data[k];
        }
        setSnapshot(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = applySnapshot(snapshot);
  return {
    headerIconItems: derived.headerIcons,
    headerMegaGroupsClient: derived.megaGroups,
    allMegaChildrenClient: derived.megaChildren,
    footerGroupsClient: derived.footerGroups,
    snapshot,
  };
}
