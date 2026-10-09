import { describe, expect, it } from 'vitest';

import { flattenMessages, messageParameters, messageTags, redactRecord, setMessage } from './operator';

describe('operator data boundaries', () => {
  it('flattens message trees and preserves ICU metadata', () => {
    expect(flattenMessages({ admin: { title: 'Title' } })).toEqual({ 'admin.title': 'Title' });
    expect(messageParameters('{count, plural, one {# item} other {# items}} on <link>now</link>')).toEqual(['count']);
    expect(messageTags('Open <link>the record</link>')).toEqual(['link']);
  });

  it('only edits an existing string key and blocks prototype paths', () => {
    const tree: Record<string, unknown> = { admin: { title: 'Old' } };
    expect(setMessage(tree, 'admin.title', 'New')).toBe(true);
    expect(tree).toEqual({ admin: { title: 'New' } });
    expect(setMessage(tree, 'admin.missing', 'Nope')).toBe(false);
    expect(setMessage(tree, '__proto__.polluted', 'Nope')).toBe(false);
  });

  it('redacts credential and provider payload fields from the data browser', () => {
    expect(redactRecord({ id: '1', email: 'a@example.com', token: 'secret', providerPayload: { card: 'x' } }, 'User')).toEqual({ id: '1', email: 'a@example.com' });
  });
});
