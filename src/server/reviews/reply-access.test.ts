import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteReply, replyToReview, type ReplyActor } from '@/server/reviews/reply';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    review: { findUnique: vi.fn() },
    venueMember: { findUnique: vi.fn() },
    reviewResponse: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

const REPLY_BODY = 'Спасибо за отзыв, учтём на следующих занятиях.';

const APPROVED_REVIEW = {
  id: 'r-1',
  moderation: 'APPROVED',
  venueId: null,
  instructor: { userId: 'instructor-1' },
};

const OWNER: ReplyActor = { id: 'instructor-1', role: 'INSTRUCTOR' };
const STRANGER: ReplyActor = { id: 'stranger-1', role: 'CUSTOMER' };
const ADMIN: ReplyActor = { id: 'admin-1', role: 'ADMIN' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('replyToReview', () => {
  it('rejects a user who neither owns the review nor manages the venue', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);

    await expect(
      replyToReview({ reviewId: 'r-1', actor: STRANGER, body: REPLY_BODY }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbMock.reviewResponse.create).not.toHaveBeenCalled();
  });

  it('lets the instructor who owns the review reply, with the author taken from the actor', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);
    dbMock.reviewResponse.create.mockResolvedValueOnce({ id: 'rr-1', body: REPLY_BODY, createdAt: new Date() });

    await replyToReview({ reviewId: 'r-1', actor: OWNER, body: `  ${REPLY_BODY}  ` });

    expect(dbMock.reviewResponse.create).toHaveBeenCalledWith({
      data: { reviewId: 'r-1', authorId: 'instructor-1', body: REPLY_BODY },
      select: { id: true, body: true, createdAt: true },
    });
  });

  it('lets an admin reply to a review of another instructor', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);
    dbMock.reviewResponse.create.mockResolvedValueOnce({ id: 'rr-2', body: REPLY_BODY, createdAt: new Date() });

    await replyToReview({ reviewId: 'r-1', actor: ADMIN, body: REPLY_BODY });

    expect(dbMock.reviewResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: 'admin-1' }) }),
    );
  });

  it('lets a member of the venue reply to a venue review', async () => {
    const venueReview = { ...APPROVED_REVIEW, venueId: 'venue-1', instructor: null };
    dbMock.review.findUnique.mockResolvedValueOnce(venueReview);
    dbMock.venueMember.findUnique.mockResolvedValueOnce({ id: 'vm-1' });
    dbMock.reviewResponse.create.mockResolvedValueOnce({ id: 'rr-3', body: REPLY_BODY, createdAt: new Date() });

    await replyToReview({ reviewId: 'r-1', actor: { id: 'member-1', role: 'VENUE_OWNER' }, body: REPLY_BODY });

    expect(dbMock.reviewResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: 'member-1' }) }),
    );
  });

  it('rejects a reply under a review that is not approved', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce({ ...APPROVED_REVIEW, moderation: 'PENDING' });

    await expect(
      replyToReview({ reviewId: 'r-1', actor: OWNER, body: REPLY_BODY }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(dbMock.reviewResponse.create).not.toHaveBeenCalled();
  });

  it('maps a second reply on the same review to a validation error', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);
    dbMock.reviewResponse.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    await expect(
      replyToReview({ reviewId: 'r-1', actor: OWNER, body: REPLY_BODY }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'reviewId' });
  });
});

describe('deleteReply', () => {
  it('rejects a user who neither owns the review nor manages the venue', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);

    await expect(deleteReply({ reviewId: 'r-1', actor: STRANGER })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbMock.reviewResponse.deleteMany).not.toHaveBeenCalled();
  });

  it('lets the owner delete the reply under a review that is no longer approved', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce({ ...APPROVED_REVIEW, moderation: 'REJECTED' });
    dbMock.reviewResponse.deleteMany.mockResolvedValueOnce({ count: 1 });

    await deleteReply({ reviewId: 'r-1', actor: OWNER });

    expect(dbMock.reviewResponse.deleteMany).toHaveBeenCalledWith({ where: { reviewId: 'r-1' } });
  });

  it('returns NOT_FOUND when there is no reply to delete', async () => {
    dbMock.review.findUnique.mockResolvedValueOnce(APPROVED_REVIEW);
    dbMock.reviewResponse.deleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(deleteReply({ reviewId: 'r-1', actor: OWNER })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
