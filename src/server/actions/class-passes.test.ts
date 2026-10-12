import { expect, it, vi } from 'vitest';
const purchase = vi.hoisted(() => vi.fn());
vi.mock('@/server/class-pass/service', () => ({ purchaseClassPass: purchase }));
import { buyClassPass, purchaseClassPassAction } from './class-passes';

it('blocks direct public actions until verified payments are available', async () => {
  const form = new FormData();
  form.set('passId', 'cp-10');
  await expect(purchaseClassPassAction(form)).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
  expect(await buyClassPass('cp-10')).toEqual({ ok: false, error: 'FEATURE_DISABLED' });
  expect(purchase).not.toHaveBeenCalled();
});
