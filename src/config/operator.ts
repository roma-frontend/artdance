import type { MessageKey } from '@/i18n/types';

export const operatorTools = ['tickets', 'translations', 'database', 'sessions', 'operations', 'access', 'terminal'] as const;
export type OperatorTool = (typeof operatorTools)[number];
export const operatorToolLabels: Record<OperatorTool, MessageKey> = {
  tickets: 'admin.support.queueTitle', translations: 'admin.support.toolsTitle',
  database: 'admin.nav.users', sessions: 'admin.nav.users',
  operations: 'admin.nav.integrations', access: 'admin.nav.settings', terminal: 'admin.nav.auditLog',
};
export const operatorJobs = ['booking', 'holds', 'trash', 'digest'] as const;
export type OperatorJob = (typeof operatorJobs)[number];

/** Supplemental records without existing workflow-specific admin forms. */
export const operatorEditableModels = [
  'ContentBlock', 'AvailabilityRule', 'AvailabilityException', 'InstructorExperience',
  'PriceOption', 'InstructorTariff', 'ShortLink', 'AdSlot', 'CorporateAccount',
] as const;

export const operatorPageSize = 25;
export const operatorExportLimit = 20_000;
