import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  db: {
    user: { findUnique: vi.fn() },
    accessControl: { findMany: vi.fn() },
    accessGrant: { findMany: vi.fn() },
    operatorSetting: { findUnique: vi.fn(), findMany: vi.fn() },
    supportTicket: { count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
  recordAudit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  clientIdentifier: () => 'test',
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn() }));
vi.mock('@/server/admin/trash', () => ({ purgeExpiredTrash: vi.fn() }));
vi.mock('@/server/hold/service', () => ({ purgeExpiredHolds: vi.fn() }));
vi.mock('@/server/cron/tasks', () => ({ runBookingCron: vi.fn(), runDailyDigest: vi.fn() }));

import { isSupportOperator, support } from '@/config/security';
import { userRoles } from '@/domain/enums';
import { getCaller, requireCapability, requireOperator } from '@/lib/auth/guards';
import { hasCapability, resolveCapabilities } from '@/lib/auth/capabilities';
import * as actions from '@/server/actions/admin/operator';
import { setSupportTicketStatus } from '@/server/actions/admin/support';
import { adminAccess } from './access';
import { browseModel, exportModel, globalOperatorSearch, operatorPulse, translationCatalog } from './operator';
import { getSupportSummary } from './support';

const user = { id: 'actor', email: 'other@example.com', name: 'Actor', role: 'SUPPORT', locale: 'en', isActive: true };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: user.id }, session: { id: 'session' } });
  mocks.db.user.findUnique.mockResolvedValue(user);
  mocks.db.accessControl.findMany.mockResolvedValue([]);
  // Even an active grant must not bypass the allowlist.
  mocks.db.accessGrant.findMany.mockResolvedValue([{ capability: 'support.manage' }, { capability: 'users.impersonate' }]);
  mocks.db.operatorSetting.findUnique.mockResolvedValue(null);
});

describe('support operator allowlist', () => {
  it.each(support.operatorEmails)('allows %s with every stored role', async (email) => {
    for (const role of userRoles) {
      mocks.db.user.findUnique.mockResolvedValue({ ...user, email: ` ${email.toUpperCase()} `, role });
      expect(isSupportOperator({ email: ` ${email.toUpperCase()} ` })).toBe(true);
      await expect(requireOperator()).resolves.toMatchObject({ id: user.id, role: 'SUPPORT' });
      await expect(requireCapability('support.manage')).resolves.toMatchObject({ id: user.id });
      expect((await adminAccess()).can('support.manage')).toBe(true);
    }
  });

  it.each(userRoles)('denies an unlisted %s, regardless of grants', async (role) => {
    mocks.db.user.findUnique.mockResolvedValue({ ...user, role });
    await expect(requireOperator()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requireCapability('support.manage')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requireCapability('users.impersonate')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await hasCapability(role, 'support.manage', user.email)).toBe(false);
    const resolved = await resolveCapabilities(role, user.email);
    expect(resolved.has('support.manage')).toBe(false);
    expect(resolved.has('users.impersonate')).toBe(false);
  });

  it.each([null, undefined, '', 'romangulanyan@gmail.com.evil', 'support@demo.artdance.am.evil', 'support@artdance.am'])('denies missing or lookalike email %s', (email) => {
    expect(isSupportOperator({ email })).toBe(false);
  });

  it('fails closed when resolving operator capabilities without identity', async () => {
    expect(await hasCapability('ADMIN', 'support.manage')).toBe(false);
    expect((await resolveCapabilities('ADMIN')).has('support.manage')).toBe(false);
    expect(await resolveCapabilities('SUPPORT')).toEqual(new Set());
  });

  it('preserves ordinary administrator access while hiding operator tools', async () => {
    mocks.db.user.findUnique.mockResolvedValue({ ...user, role: 'ADMIN' });
    const access = await adminAccess();
    expect(access.can('catalog.edit')).toBe(true);
    expect(access.can('settings.edit')).toBe(true);
    expect(access.can('support.manage')).toBe(false);
    expect(access.can('users.impersonate')).toBe(false);
  });

  it('trusts current database identity, not stale session email or role', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: user.id, email: support.ownerEmail, role: 'SUPPORT' }, session: { id: 'session' } });
    await expect(requireOperator()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await getCaller())?.email).toBe(user.email);
  });

  it('rejects anonymous and inactive operators', async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireOperator()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    mocks.getSession.mockResolvedValue({ user: { id: user.id }, session: { id: 'session' } });
    mocks.db.user.findUnique.mockResolvedValue({ ...user, email: support.ownerEmail, isActive: false });
    await expect(requireOperator()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('uses the real allowlisted actor for stopping impersonation', async () => {
    mocks.db.user.findUnique.mockResolvedValue({ ...user, email: support.ownerEmail });
    mocks.db.operatorSetting.findUnique.mockResolvedValueOnce({ value: { userId: 'customer', expiresAt: Date.now() + 60_000 } });
    mocks.db.user.findUnique.mockResolvedValueOnce({ ...user, email: support.ownerEmail })
      .mockResolvedValueOnce({ ...user, id: 'customer', role: 'CUSTOMER' });
    expect((await getCaller())?.impersonator?.email).toBe(support.ownerEmail);
    await expect(requireOperator()).resolves.toMatchObject({ id: user.id, email: support.ownerEmail });
  });

  it('does not honor stored impersonation for an unlisted administrator', async () => {
    mocks.db.user.findUnique.mockResolvedValue({ ...user, role: 'ADMIN' });
    mocks.db.operatorSetting.findUnique.mockResolvedValue({ value: { userId: 'customer', expiresAt: Date.now() + 60_000 } });
    expect((await getCaller())?.id).toBe(user.id);
    expect(mocks.db.operatorSetting.findUnique).not.toHaveBeenCalled();
  });
});

describe.each(['ADMIN', 'SUPPORT'])('direct operator requests from unlisted %s', (role) => {
  beforeEach(() => mocks.db.user.findUnique.mockResolvedValue({ ...user, role }));

  it('blocks every mutation before accessing data or recording an audit', async () => {
    const requests = [
      actions.saveTranslationOverride({ key: 'admin.title', locale: 'en', value: 'New' }),
      actions.resetTranslationOverride({ key: 'admin.title', locale: 'en' }),
      actions.revokeSession({ sessionId: 'session' }),
      actions.runOperatorJob({ job: 'booking' }),
      actions.startImpersonation({ userId: 'customer' }),
      actions.stopImpersonation({}),
      actions.exportOperatorModel({ model: 'User' }),
      actions.runOperatorCommand({ command: 'health' }),
      actions.replyToSupportTicket({ ticketId: 'ticket', body: 'Reply', internal: true }),
      actions.setFeatureFlag({ key: 'shop', enabled: false }),
      setSupportTicketStatus({ id: 'ticket', status: 'RESOLVED' }),
    ];
    for (const request of requests) {
      expect((await request)?.serverError?.code).toBe('FORBIDDEN');
    }
    expect(mocks.db.supportTicket.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.supportTicket.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('blocks data services before querying operator data', async () => {
    const requests = [getSupportSummary(), browseModel('User', '', 1), exportModel('User'), translationCatalog('', 1), operatorPulse(), globalOperatorSearch('actor')];
    await Promise.all(requests.map((request) => expect(request).rejects.toMatchObject({ code: 'FORBIDDEN' })));
    expect(mocks.db.supportTicket.count).not.toHaveBeenCalled();
    expect(mocks.db.operatorSetting.findMany).not.toHaveBeenCalled();
  });
});
