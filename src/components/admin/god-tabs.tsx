'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Blocks,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Languages,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Terminal,
  Trash2,
  Users,
  Wallet,
  Zap,
  Crown,
  CalendarDays,
} from 'lucide-react';

import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { routes } from '@/config/routes';

export type GodTabId = 'overview' | 'queue' | 'operations' | 'terminal' | 'access' | 'tools';

export interface GodTabMeta {
  id: GodTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  hint: string;
}

function useMeta(): Record<GodTabId, GodTabMeta> {
  const tg = useTranslations('admin.support.god');
  return {
    overview: { id: 'overview', label: tg('overviewTitle'), icon: Sparkles, hint: tg('overviewHint') },
    queue: { id: 'queue', label: useTranslations('admin.support')('queueTitle'), icon: MessageSquare, hint: tg('queueHint') },
    operations: { id: 'operations', label: tg('operationsTitleShort'), icon: Zap, hint: tg('operationsHint') },
    terminal: { id: 'terminal', label: tg('terminalTitleShort'), icon: Terminal, hint: tg('terminalHintTab') },
    access: { id: 'access', label: tg('accessTitleShort'), icon: ShieldCheck, hint: tg('accessHintTab') },
    tools: { id: 'tools', label: tg('toolsTitleShort'), icon: LayoutGrid, hint: tg('toolsHintTab') },
  };
}

const STATIC_META: Record<GodTabId, GodTabMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: Sparkles, hint: 'Pulse, health, omnibox' },
  queue: { id: 'queue', label: 'Support Queue', icon: MessageSquare, hint: 'Tickets · SLA · assignment' },
  operations: { id: 'operations', label: 'Operations', icon: Zap, hint: 'Jobs · audit' },
  terminal: { id: 'terminal', label: 'Terminal', icon: Terminal, hint: 'Whitelisted · audited · Tab complete' },
  access: { id: 'access', label: 'Access', icon: ShieldCheck, hint: 'Impersonation · approvals · audit' },
  tools: { id: 'tools', label: 'Tools', icon: LayoutGrid, hint: 'All resources · one click' },
};
export function godTabMeta(id: GodTabId): GodTabMeta { return STATIC_META[id]; }

interface Props {
  active: GodTabId;
  onChange: (id: GodTabId) => void;
  counts?: { openTickets?: number; pendingTickets?: number; failedPayments?: number; pendingApprovals?: number };
  children: React.ReactNode;
}

export function GodTabs({ active, onChange, counts, children }: Props) {
  const META = useMeta();
  const tg = useTranslations('admin.support.god');
  const tabs: GodTabMeta[] = [
    { ...META.overview },
    { ...META.queue, badge: counts?.openTickets ? `${counts.openTickets}` : undefined },
    { ...META.operations },
    { ...META.terminal },
    { ...META.access, badge: counts?.pendingApprovals ? `${counts.pendingApprovals}` : undefined },
    { ...META.tools },
  ];

  return (
    <Tabs value={active} onValueChange={(v) => onChange(v as GodTabId)} className="w-full">
      {/* Sticky, scrollable tab bar — beautiful on mobile */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-900/70 sm:mx-0 sm:rounded-2xl sm:border sm:px-2 sm:py-2">
        <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto bg-transparent p-1 scrollbar-none dark:bg-transparent">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold leading-none transition',
                  'data-[state=active]:shadow-sm',
                  isActive
                    ? 'border-amber-200 bg-amber-50 text-amber-900 data-[state=active]:bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200 dark:data-[state=active]:bg-amber-950/30'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200'
                )}
              >
                <tab.icon className={cn('h-4 w-4', isActive ? 'text-amber-600 dark:text-amber-300' : 'text-zinc-500 dark:text-zinc-400')} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.badge ? (
                  <span className={cn('ml-1 rounded-full px-1.5 py-0.5 text-xs font-black leading-none', isActive ? 'bg-white text-amber-700 dark:bg-white dark:text-amber-900' : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900')}>
                    {tab.badge}
                  </span>
                ) : null}
                {isActive ? (
                  <motion.span layoutId="god-tab-indicator" className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-amber-100/50 dark:bg-amber-900/20" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <p className="hidden px-2 pb-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400 sm:block">
          {META[active].hint} {tg('tabHintSuffix')}
        </p>
      </div>

      <div className="mt-4 space-y-6">
        {children}
      </div>
    </Tabs>
  );
}

export function GodTabPanel({ value, children, className }: { value: GodTabId; children: React.ReactNode; className?: string }) {
  return (
    <TabsContent value={value} className={cn('mt-0 space-y-6 outline-none', className)}>
      {children}
    </TabsContent>
  );
}

// Helper: quick grid for Tools tab — labels/descriptions come from i18n where possible,
// but kept as static for now to avoid hook-in-module. GodCommandCenter resolves via t() when rendering.
export const QUICK_TOOLS: Array<{ label: string; href: string; icon: React.ComponentType<{ className?: string }>; desc: string; accent?: boolean }> = [
  { label: 'Data Browser — GOD DB', href: routes.adminOperatorTool('database'), icon: Database, desc: '70+ tables · edit any row', accent: true },
  { label: 'Live translations', href: routes.adminOperatorTool('translations'), icon: Languages, desc: 'Override without deploy' },
  { label: 'Active sessions', href: routes.adminOperatorTool('sessions'), icon: Users, desc: 'Revoke immediately' },
  { label: 'Scheduled jobs', href: routes.adminOperatorTool('operations'), icon: Zap, desc: 'booking · holds · trash · SLA' },
  { label: 'Access & impersonation', href: routes.adminOperatorTool('access'), icon: ShieldCheck, desc: 'Matrix + grants' },
  { label: 'Safe terminal', href: routes.adminOperatorTool('terminal'), icon: Terminal, desc: 'Whitelisted commands' },
  { label: 'Feature flags', href: routes.adminOperatorTool('features'), icon: Blocks, desc: 'Enable/disable modules' },
  { label: 'Entitlements', href: routes.adminOperatorTool('entitlements'), icon: Crown, desc: 'MVP / FULL / PREMIUM' },
  { label: 'Users', href: routes.adminUsers(), icon: Users, desc: 'Roles · suspend · preview' },
  { label: 'Bookings', href: routes.adminBookings(), icon: CalendarDays, desc: 'Confirm · cancel · reschedule' },
  { label: 'Orders', href: routes.adminOrders(), icon: Package, desc: 'Payments · refunds' },
  { label: 'Payouts', href: routes.adminPayouts(), icon: Wallet, desc: 'Release · hold' },
  { label: 'Shop — products', href: routes.adminResource('products'), icon: Store, desc: 'Products & variants' },
  { label: 'Classes & sessions', href: routes.adminResource('classes'), icon: GraduationCap, desc: 'Catalog heart' },
  { label: 'Instructors', href: routes.adminResource('instructors'), icon: GraduationCap, desc: 'Verify · publish' },
  { label: 'Venues & rooms', href: routes.adminResource('venues'), icon: MapPin, desc: 'Studios & halls' },
  { label: 'Moderation queue', href: routes.adminModeration(), icon: ShieldCheck, desc: 'Reviews · profiles' },
  { label: 'Reports & revenue', href: routes.adminReports(), icon: Activity, desc: 'GMV · take rate' },
  { label: 'Trash', href: routes.adminTrash(), icon: Trash2, desc: 'Restore or purge' },
  { label: 'Audit log', href: routes.adminAuditLog(), icon: FileText, desc: 'Every change' },
  { label: 'Integrations', href: routes.adminIntegrations(), icon: Globe, desc: 'R2 · email · payments' },
  { label: 'Approvals', href: routes.adminApprovals(), icon: ShieldCheck, desc: 'Maker-checker' },
];
