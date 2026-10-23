'use client';

import { useEffect, useState } from 'react';

import { features, type FeatureKey } from '@/config/features';
import {
  footerGroupsUngated as staticFooterGroups,
  headerIconItemsUngated as staticHeaderIcons,
  headerMegaGroups as staticMegaGroups,
  megaChildrenUngated as staticMegaChildren,
  primaryNavUngated as staticPrimary,
} from '@/config/navigation';

type Snapshot = Record<FeatureKey, boolean>;

function applySnapshot(snapshot: Snapshot | null) {
  /* До загрузки снимка все модульные разделы скрыты: билд-флаги не решают за рантайм. */
  const enabled = (feature?: FeatureKey) => !feature || snapshot?.[feature] === true;
  return {
    primary: staticPrimary.filter((i) => enabled(i.feature)),
    headerIcons: staticHeaderIcons.filter((i) => enabled((i as unknown as { feature?: FeatureKey }).feature)),
    megaGroups: staticMegaGroups
      .map((g) => {
        const children = g.children.filter((c) => enabled(c.feature));
        const fallback = children.find((child) => child.href === g.href)?.href ?? children[0]?.href ?? g.href;
        return { ...g, href: fallback, children };
      })
      .filter((g) => g.children.length > 0),
    megaChildren: staticMegaChildren.filter((c) => enabled(c.feature)),
    footerGroups: staticFooterGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => enabled(it.feature)) }))
      .filter((g) => g.items.length > 0),
  };
}

export function useEntitlementsSnapshot(): Snapshot | null {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/entitlements', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        /* Только явно включённый модуль открывается; всё прочее — закрыто. */
        const next = {} as Snapshot;
        for (const k of Object.keys(features) as FeatureKey[]) {
          next[k] = data[k] === true;
        }
        setSnapshot(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return snapshot;
}

export function useEntitlementFilters() {
  const snapshot = useEntitlementsSnapshot();
  const derived = applySnapshot(snapshot);
  return {
    headerIconItems: derived.headerIcons,
    headerMegaGroupsClient: derived.megaGroups,
    allMegaChildrenClient: derived.megaChildren,
    footerGroupsClient: derived.footerGroups,
    snapshot,
  };
}
