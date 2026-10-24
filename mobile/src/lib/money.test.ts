import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyRate, breakdownVat, distributeProportionally, MoneyError, roundToPriceStep } from './money.ts';

test('rejects non-integer and non-finite amounts', () => {
  assert.throws(() => roundToPriceStep(12_000.5), MoneyError);
  assert.throws(() => breakdownVat(Number.NaN, 0.2, true), MoneyError);
});

test('applyRate rounds half up and rejects negative rates', () => {
  assert.equal(applyRate(10_000, 0.15), 1_500);
  assert.equal(applyRate(5, 0.5), 3);
  assert.throws(() => applyRate(1_000, -0.1), MoneyError);
});

test('roundToPriceStep rounds to the nearest 100 AMD by default', () => {
  assert.equal(roundToPriceStep(12_049), 12_000);
  assert.equal(roundToPriceStep(12_050), 12_100);
  assert.equal(roundToPriceStep(12_049, 1), 12_049);
});

test('VAT is extracted from a VAT-inclusive price', () => {
  const result = breakdownVat(12_000, 0.2, true);
  assert.deepEqual(result, { gross: 12_000, net: 10_000, vat: 2_000 });
  assert.equal(result.net + result.vat, result.gross);
});

test('VAT is added on top of a VAT-exclusive price', () => {
  assert.deepEqual(breakdownVat(10_000, 0.2, false), { gross: 12_000, net: 10_000, vat: 2_000 });
});

test('zero VAT rate changes nothing', () => {
  assert.deepEqual(breakdownVat(10_000, 0, true), { gross: 10_000, net: 10_000, vat: 0 });
});

test('distributed discount parts always sum to the total', () => {
  const parts = distributeProportionally(6_050, [12_000, 15_000, 18_000]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 6_050);
});

test('distribution with zero weights returns zeros', () => {
  assert.deepEqual(distributeProportionally(1_000, [0, 0]), [0, 0]);
});

test('order discount distributed over lines matches the discount exactly', () => {
  const lines = [18_000, 30_000, 12_500];
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const discount = applyRate(subtotal, 0.1);
  const parts = distributeProportionally(discount, lines);
  assert.equal(parts.reduce((a, b) => a + b, 0), discount);
});
