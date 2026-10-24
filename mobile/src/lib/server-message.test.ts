import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveServerMessage } from './server-message.ts';

const catalog = {
  errors: {
    unauthorized: { description: 'Нужно войти' },
    rateLimited: { description: 'Подождите {seconds}' },
  },
  validation: { required: 'Обязательное поле' },
};

test('resolves a dotted server key from the catalog', () => {
  assert.equal(resolveServerMessage('validation.required', {}, catalog), 'Обязательное поле');
});

test('interpolates known params and keeps unknown placeholders', () => {
  assert.equal(resolveServerMessage('errors.rateLimited.description', { seconds: 30 }, catalog), 'Подождите 30');
  assert.equal(resolveServerMessage('errors.rateLimited.description', {}, catalog), 'Подождите {seconds}');
});

test('returns null for unknown keys and non-string nodes', () => {
  assert.equal(resolveServerMessage('errors.missing.description', {}, catalog), null);
  assert.equal(resolveServerMessage('errors', {}, catalog), null);
});
