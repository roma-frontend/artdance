import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clients = vi.hoisted(() => ({
  node: vi.fn(),
  worker: vi.fn(),
  adapter: vi.fn(),
  context: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: clients.context }));
vi.mock('@prisma/client', () => ({ PrismaClient: clients.node }));
vi.mock('@prisma/client/edge', () => ({ PrismaClient: clients.worker }));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: clients.adapter }));
vi.mock('@/config/env', () => ({
  isProduction: true,
  getServerEnv: () => ({ DATABASE_URL: 'postgresql://localhost/artdance' }),
}));

describe('Prisma runtime selection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clients.context.mockReturnValue({
      env: { HYPERDRIVE: { connectionString: 'postgresql://hyperdrive/artdance' } },
    });
    clients.node.mockImplementation(function () {
      return { $extends: vi.fn().mockReturnValue({ runtime: 'node' }) };
    });
    clients.worker.mockImplementation(function () {
      return { $extends: vi.fn().mockReturnValue({ runtime: 'worker' }) };
    });
    clients.adapter.mockImplementation(function () {
      return {};
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Node client outside Workers', async () => {
    vi.stubGlobal('navigator', undefined);
    await import('./db');

    expect(clients.node).toHaveBeenCalledOnce();
    expect(clients.worker).not.toHaveBeenCalled();
    expect(clients.adapter).toHaveBeenCalledWith({ connectionString: 'postgresql://localhost/artdance' });
    expect(clients.context).not.toHaveBeenCalled();
  });

  it('uses the static WASM client in Workers', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
    await import('./db');

    expect(clients.worker).toHaveBeenCalledOnce();
    expect(clients.node).not.toHaveBeenCalled();
    expect(clients.adapter).toHaveBeenCalledWith({
      connectionString: 'postgresql://hyperdrive/artdance',
      maxUses: 1,
    });
  });
});