import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { STRIPE_PUBLISHABLE_KEY: undefined as string | undefined },
}));

vi.mock('@/config/env', () => ({ getServerEnv: () => mocks.env }));

import { publishableKeyFor } from './publishable-key';

beforeEach(() => {
  mocks.env.STRIPE_PUBLISHABLE_KEY = undefined;
});

describe('publishableKeyFor', () => {
  it('отдаёт публикуемый ключ pk_ для Stripe', () => {
    mocks.env.STRIPE_PUBLISHABLE_KEY = ['pk', 'test', 'unit'].join('_');

    expect(publishableKeyFor('stripe')).toBe(['pk', 'test', 'unit'].join('_'));
  });

  it('не отдаёт секретный ключ, даже если его записали в публикуемую переменную', () => {
    mocks.env.STRIPE_PUBLISHABLE_KEY = ['sk', 'test', 'unit'].join('_');

    expect(publishableKeyFor('stripe')).toBeNull();
  });

  it('для mock, не-Stripe провайдеров и отсутствующего провайдера ключа нет', () => {
    mocks.env.STRIPE_PUBLISHABLE_KEY = ['pk', 'test', 'unit'].join('_');

    expect(publishableKeyFor('mock')).toBeNull();
    expect(publishableKeyFor('idram')).toBeNull();
    expect(publishableKeyFor(undefined)).toBeNull();
  });

  it('без переменной возвращает null', () => {
    expect(publishableKeyFor('stripe')).toBeNull();
  });
});
