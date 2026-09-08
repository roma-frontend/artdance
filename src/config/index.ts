/**
 * Барьер конфигурации. Приложение импортирует настройки только отсюда:
 *
 *   import { businessRules, routes, site } from '@/config';
 *
 * `getServerEnv` умышленно НЕ реэкспортируется: серверные секреты должны
 * импортироваться явно из `@/config/env` в server-only модулях, чтобы случайный
 * импорт из клиентского компонента был заметен на code review.
 */

export { clientEnv, isLocal, isPreview, isProduction, type ClientEnv } from './env';
export { site, absoluteUrl, directionsUrl, type Site } from './site';
export {
  routes,
  apiRoutes,
  checkoutSteps,
  protectedPathPrefixes,
  noIndexPathPrefixes,
  type CheckoutStep,
  type ListingParams,
  type ShopParams,
} from './routes';
export {
  businessRules,
  booking,
  bookingLocationOptions,
  commerce,
  commission,
  currency,
  dataRetention,
  limits,
  payout,
  promotions,
  rateLimits,
  reviews,
  security,
  tax,
  venue,
  type BookingLocationOption,
  type BusinessRules,
  type RateLimitKey,
} from './business';
export {
  subscriptionPlans,
  subscriptionPlanIds,
  subscriptionPlanNameKey,
  subscriptionPlanDescriptionKey,
  orderedSubscriptionPlans,
  billingIntervals,
  planFeatureIds,
  planFeatureLabelKey,
  priceGuidance,
  lineItemTypes,
  commissionableLineItems,
  nonRefundableLineItems,
  type BillingInterval,
  type LineItemType,
  type PlanFeatureId,
  type PlanQuota,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from './pricing';
export {
  legalDocuments,
  legalDocumentBySlug,
  legalDocumentIds,
  legalDocumentIntroKey,
  legalDocumentSlugs,
  legalDocumentTitleKey,
  legalSectionBodyKey,
  legalSectionTitleKey,
  type LegalDocumentId,
  type LegalDocumentSpec,
  type LegalDocumentStatus,
} from './legal';
export { features, isEnabled, deliveryPhases, type DeliveryPhaseId, type FeatureKey } from './features';
export {
  headerCta,
  headerIconItems,
  footerNavGroups,
  hasCinemaHero,
  isActiveNavPath,
  mobileDockItems,
  mobileDockSlots,
  mobileMenuItems,
  navIconNames,
  primaryNavItems,
  type MobileDockItem,
  type MobileDockSlot,
  type NavGroup,
  type NavIconItem,
  type NavIconName,
  type NavItem,
} from './navigation';
export {
  capabilities,
  defaultRoleCapabilities,
  grantLimits,
  isCapability,
  nonGrantableCapabilities,
  type Capability,
} from './capabilities';
export {
  baseSecurityHeaders,
  contentSecurityPolicy,
  criticalAuditActions,
  mutatingMethods,
  uploadKinds,
  uploadPolicies,
  webhookSecurity,
  type CriticalAuditAction,
  type UploadKind,
  type UploadPolicy,
} from './security';
export {
  cacheControl,
  cacheTags,
  dataRevalidate,
  buildCacheHeaderRules,
} from './cache';
export { checkEnvironment, reportEnvironmentIssues, type EnvIssue } from './env-report';
export {
  imagePresets,
  imageQuality,
  imageWidths,
  mediaFallbacks,
  mediaPaths,
  mediaUrl,
  mediaBaseUrl,
  blurDataUrl,
  videoConfig,
  type ImagePresetKey,
} from './media';
export { seo, type SeoConfig } from './seo';
