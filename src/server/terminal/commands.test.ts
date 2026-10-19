import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  recordAudit: vi.fn(),
  globalOperatorSearch: vi.fn(),
  delegate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/config/media', () => ({ mediaUrl: (key: string) => `https://media.test/${key}` }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/auth/guards', () => ({ requireOperator: mocks.requireOperator }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/config/trash', () => ({ isTrashedModel: () => false }));
vi.mock('@/domain/trash', () => ({ onlyTrashed: {} }));
vi.mock('@/server/cart/service', () => ({ cartStats: vi.fn(), purgeEmptyCarts: vi.fn() }));
vi.mock('@/server/admin/inspect', () => ({ formatInspect: vi.fn(), inspectOperatorRecord: vi.fn() }));
vi.mock('@/server/admin/operator', () => ({
  browseModel: vi.fn(),
  getOperatorCounts: vi.fn(),
  modelFields: vi.fn(() => [{ name: 'id', type: 'String', isRequired: true, isList: false }]),
  operatorDelegate: vi.fn(() => mocks.delegate),
  operatorModelName: vi.fn((name: string) => name === 'Users' ? 'User' : name),
  operatorModels: vi.fn(() => [{ name: 'User' }]),
  globalOperatorSearch: mocks.globalOperatorSearch,
  operatorPulse: vi.fn(),
}));

import { runTerminalCommand, tokenizeTerminalCommand } from './commands';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOperator.mockResolvedValue({ id: 'operator', role: 'SUPPORT' });
  mocks.delegate.findUnique.mockResolvedValue({ id: 'user-1', name: 'Old' });
});

describe('terminal command safety', () => {
  it('keeps JSON with spaces as one argument', () => {
    expect(tokenizeTerminalCommand('db update User user-1 --set {"name": "New Name"}')).toEqual([
      'db', 'update', 'User', 'user-1', '--set', '{"name": "New Name"}',
    ]);
  });

  it('previews an update without writing or auditing', async () => {
    const result = await runTerminalCommand('db update User user-1 --set {"name": "New Name"} --dry-run');

    expect(result.ok).toBe(true);
    expect(result.lines.join('\n')).toContain('dry-run: update User user-1');
    expect(result.lines.join('\n')).toContain('New Name');
    expect(mocks.delegate.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('blocks financial mutations through generic db writes', async () => {
    const result = await runTerminalCommand('db update Payment payment-1 --set {"status":"PAID"}');
    expect(result.lines.join('\n')).toContain('Payment is protected');
    expect(mocks.delegate.update).not.toHaveBeenCalled();
  });

  it('searches support entities through the operator index', async () => {
    mocks.globalOperatorSearch.mockResolvedValue([{ kind: 'users', label: 'Anna · anna@example.com', href: '/admin/users/user-1' }]);
    const result = await runTerminalCommand('search anna@example.com');
    expect(result.lines.join('\n')).toContain('users      Anna · anna@example.com');
    expect(mocks.globalOperatorSearch).toHaveBeenCalledWith('anna@example.com');
  });
});
