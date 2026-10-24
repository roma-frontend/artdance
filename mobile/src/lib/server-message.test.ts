import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readServerMessage, resolveServerMessage, serverMessageOf } from './server-message.ts';

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

test('readServerMessage translates messageKey from an error body', async () => {
  const response = new Response(JSON.stringify({ messageKey: 'errors.rateLimited.description', params: { seconds: 30 } }), {
    status: 429,
  });
  assert.equal(await readServerMessage(response, catalog), 'Подождите 30');
});

test('readServerMessage returns null without a usable messageKey', async () => {
  assert.equal(await readServerMessage(new Response('oops', { status: 500 }), catalog), null);
  assert.equal(await readServerMessage(new Response('{"error":"X"}', { status: 400 }), catalog), null);
});

test('serverMessageOf reads only a translated message from module errors', () => {
  assert.equal(serverMessageOf(Object.assign(new Error('HTTP 429'), { serverMessage: 'Подождите 30' })), 'Подождите 30');
  assert.equal(serverMessageOf(new Error('HTTP 500')), null);
  assert.equal(serverMessageOf('plain'), null);
});
