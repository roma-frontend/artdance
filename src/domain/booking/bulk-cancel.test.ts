import { describe, expect, it } from 'vitest';

import { parseBulkCancelPayload } from './bulk-cancel';

const valid = { bookingIds: ['b1', 'b2'], reason: 'Зал закрыт на ремонт', byProvider: true };

describe('parseBulkCancelPayload', () => {
  it('принимает корректную заявку', () => {
    expect(parseBulkCancelPayload(valid, 100)).toEqual(valid);
  });

  it('убирает повторы идентификаторов и сохраняет порядок', () => {
    const parsed = parseBulkCancelPayload({ ...valid, bookingIds: ['b2', 'b1', 'b2'] }, 100);

    expect(parsed?.bookingIds).toEqual(['b2', 'b1']);
  });

  it('отклоняет заявку без броней и с пустым идентификатором', () => {
    expect(parseBulkCancelPayload({ ...valid, bookingIds: [] }, 100)).toBeNull();
    expect(parseBulkCancelPayload({ ...valid, bookingIds: ['b1', ''] }, 100)).toBeNull();
    expect(parseBulkCancelPayload({ ...valid, bookingIds: ['b1', 7] }, 100)).toBeNull();
  });

  it('отклоняет заявку, которая больше предела за одно действие', () => {
    expect(parseBulkCancelPayload(valid, 1)).toBeNull();
  });

  it('отклоняет причину короче трёх символов и заявку без причины', () => {
    expect(parseBulkCancelPayload({ ...valid, reason: 'ok' }, 100)).toBeNull();
    expect(parseBulkCancelPayload({ ...valid, reason: undefined }, 100)).toBeNull();
  });

  it('отклоняет флаг отмены не булевого типа и отсутствующий payload', () => {
    expect(parseBulkCancelPayload({ ...valid, byProvider: 'yes' }, 100)).toBeNull();
    expect(parseBulkCancelPayload(null, 100)).toBeNull();
    expect(parseBulkCancelPayload('bookingIds', 100)).toBeNull();
  });
});
