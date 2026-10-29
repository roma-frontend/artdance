import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mediaPaths } from '@/config/media';
import { domainErrors } from '@/domain/errors';

import { POST } from './route';

const FILE_ID = '00000000-0000-4000-8000-000000000001';

const CALLER = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Админ',
  role: 'admin',
  locale: 'ru',
};

/** Модели владельцев. У каждой `findUnique` подтверждает, что владелец существует. */
const OWNER_MODELS = [
  'instructorProfile',
  'venue',
  'room',
  'danceClass',
  'event',
  'product',
  'banner',
  'blogPost',
  'course',
  'user',
] as const;

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  checkRateLimit: vi.fn(),
  clientIdentifier: vi.fn(),
  processImage: vi.fn(),
  putMediaObject: vi.fn(),
  recordAudit: vi.fn(),
  db: {
    instructorProfile: { findUnique: vi.fn() },
    venue: { findUnique: vi.fn() },
    room: { findUnique: vi.fn() },
    danceClass: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    banner: { findUnique: vi.fn(), update: vi.fn() },
    blogPost: { findUnique: vi.fn(), update: vi.fn() },
    course: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    mediaAsset: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/guards', () => ({ requireCapability: mocks.requireCapability }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: mocks.clientIdentifier,
}));
vi.mock('@/lib/media/ingest', () => ({ processImage: mocks.processImage }));
vi.mock('@/lib/media/storage', () => ({ putMediaObject: mocks.putMediaObject }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));

const instructorFields = { kind: 'instructorPhoto', altText: 'Портрет Ани', instructorId: 'ins-1' };

function imageFile(name = 'anna.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function upload(fields: Record<string, string>, file: File | null = imageFile()): Request {
  const form = new FormData();
  if (file) form.set('file', file);
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return new Request('http://localhost/api/media/upload', { method: 'POST', body: form });
}

/** Успешный результат `processImage`: мастер AVIF и два производных при ширине 400. */
function processed() {
  return {
    ok: true,
    image: {
      width: 800,
      height: 1000,
      sourceFormat: 'jpeg',
      master: { width: 800, height: 1000, format: 'avif', bytes: 1234, data: Buffer.from('master') },
      variants: [
        { width: 400, height: 500, format: 'avif', bytes: 300, data: Buffer.from('v400-avif') },
        { width: 400, height: 500, format: 'webp', bytes: 320, data: Buffer.from('v400-webp') },
      ],
      blurDataUrl: 'data:image/webp;base64,AAAA',
      totalBytes: 1854,
      sourceBytes: 3,
    },
  };
}

const ASSET = { id: 'asset-1', storageKey: 'stored-key', width: 800, height: 1000, bytes: 1234 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(FILE_ID);

  mocks.requireCapability.mockResolvedValue(CALLER);
  mocks.clientIdentifier.mockReturnValue('client-1');
  mocks.checkRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: new Date(0),
    retryAfterSeconds: 0,
    backend: 'memory',
  });
  mocks.processImage.mockResolvedValue(processed());
  mocks.putMediaObject.mockImplementation(async (key: string) => ({
    key,
    url: `/media-proxy/${key}`,
    bytes: 1,
  }));
  mocks.recordAudit.mockResolvedValue(undefined);

  for (const model of OWNER_MODELS) {
    mocks.db[model].findUnique.mockResolvedValue({ id: 'owner' });
  }
  for (const model of ['banner', 'blogPost', 'course', 'user'] as const) {
    mocks.db[model].update.mockResolvedValue({ id: 'owner' });
  }
  mocks.db.mediaAsset.count.mockResolvedValue(0);
  mocks.db.mediaAsset.findFirst.mockResolvedValue(null);
  mocks.db.mediaAsset.create.mockResolvedValue(ASSET);
  mocks.db.mediaAsset.update.mockResolvedValue(ASSET);
  mocks.db.mediaAsset.upsert.mockResolvedValue(ASSET);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/media/upload', () => {
  describe('доступ и лимиты', () => {
    it('отклоняет запрос без права media.upload до любой работы с файлом', async () => {
      mocks.requireCapability.mockRejectedValue(domainErrors.unauthorized());

      const response = await POST(upload(instructorFields));

      expect(response.status).toBe(401);
      expect(mocks.requireCapability).toHaveBeenCalledWith('media.upload');
      expect(mocks.checkRateLimit).not.toHaveBeenCalled();
      expect(mocks.processImage).not.toHaveBeenCalled();
      expect(mocks.putMediaObject).not.toHaveBeenCalled();
    });

    it('возвращает 429 при исчерпанном лимите и не разбирает изображение', async () => {
      mocks.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(0),
        retryAfterSeconds: 30,
        backend: 'memory',
      });

      const response = await POST(upload(instructorFields));

      expect(response.status).toBe(429);
      expect(mocks.checkRateLimit).toHaveBeenCalledWith('mediaUpload', 'client-1');
      expect(mocks.processImage).not.toHaveBeenCalled();
    });
  });

  describe('проверка полей формы', () => {
    it('отвечает 422 без файла', async () => {
      const response = await POST(upload(instructorFields, null));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: 'VALIDATION_FAILED', field: 'file' });
    });

    it('отклоняет видео как роль изображения: sharp видео не читает', async () => {
      const response = await POST(upload({ ...instructorFields, kind: 'courseVideo' }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ field: 'kind' });
      expect(mocks.processImage).not.toHaveBeenCalled();
    });

    it('отклоняет неизвестную роль загрузки', async () => {
      const response = await POST(upload({ ...instructorFields, kind: 'logo' }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ field: 'kind' });
    });

    it('требует текст альтернативы, пробелы не считаются текстом', async () => {
      const response = await POST(upload({ kind: 'instructorPhoto', instructorId: 'ins-1', altText: '   ' }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ field: 'altText' });
    });

    it('требует ровно одного владельца: ни одного', async () => {
      const response = await POST(upload({ kind: 'instructorPhoto', altText: 'Портрет' }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ field: 'owner' });
    });

    it('требует ровно одного владельца: два сразу', async () => {
      const response = await POST(upload({ ...instructorFields, venueId: 'venue-1' }));

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ field: 'owner' });
    });

    it('отвечает 404 для несуществующего владельца и ничего не пишет', async () => {
      mocks.db.course.findUnique.mockResolvedValue(null);

      const response = await POST(upload({ kind: 'courseCover', altText: 'Обложка', courseId: 'missing' }));

      expect(response.status).toBe(404);
      expect(mocks.putMediaObject).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.create).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.upsert).not.toHaveBeenCalled();
    });

    it('отклоняет исполняемое расширение до разбора содержимого', async () => {
      const response = await POST(upload(instructorFields, imageFile('shell.php', 'image/jpeg')));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: 'UNSUPPORTED_EXTENSION',
        params: { extension: 'php' },
      });
      expect(mocks.processImage).not.toHaveBeenCalled();
    });
  });

  describe('разбор содержимого и лимит кадров', () => {
    it('возвращает 422 и ничего не пишет, если sharp отклонил содержимое', async () => {
      mocks.processImage.mockResolvedValue({
        ok: false,
        rejection: { code: 'MEDIA_TOO_SMALL', params: { min: 600 } },
      });

      const response = await POST(upload(instructorFields));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: 'MEDIA_TOO_SMALL', params: { min: 600 } });
      expect(mocks.putMediaObject).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.create).not.toHaveBeenCalled();
    });

    it('отклоняет кадр сверх предела владельца', async () => {
      mocks.db.mediaAsset.count.mockResolvedValue(12);

      const response = await POST(upload(instructorFields));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: 'TOO_MANY_FILES', params: { max: 12 } });
      expect(mocks.processImage).not.toHaveBeenCalled();
    });

    it('передаёт пресет роли в processImage без ручного списка форматов', async () => {
      await POST(upload(instructorFields));

      expect(mocks.processImage).toHaveBeenCalledWith(expect.any(Buffer), { preset: 'instructorCard' });
      expect(mocks.processImage.mock.calls[0]?.[1]).not.toHaveProperty('formats');
    });

    it('аватар кодируется в JPEG и получает пресет avatar', async () => {
      await POST(upload({ kind: 'avatar', altText: 'Аватар', avatarOwnerId: 'user-1' }));

      expect(mocks.processImage).toHaveBeenCalledWith(expect.any(Buffer), {
        preset: 'avatar',
        formats: ['jpeg'],
      });
    });
  });

  describe('запись в хранилище и базу', () => {
    it('пишет мастер и производные под ключами общего соглашения и создаёт строку', async () => {
      mocks.db.mediaAsset.count.mockResolvedValue(3);

      const response = await POST(upload(instructorFields));

      const baseKey = mediaPaths.instructorPhoto('ins-1', FILE_ID);
      expect(response.status).toBe(200);
      expect(mocks.putMediaObject).toHaveBeenCalledTimes(3);
      expect(mocks.putMediaObject).toHaveBeenNthCalledWith(1, `${baseKey}.avif`, expect.any(Buffer), 'image/avif');
      expect(mocks.putMediaObject).toHaveBeenNthCalledWith(2, `${baseKey}-400.avif`, expect.any(Buffer), 'image/avif');
      expect(mocks.putMediaObject).toHaveBeenNthCalledWith(3, `${baseKey}-400.webp`, expect.any(Buffer), 'image/webp');
      expect(mocks.db.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storageKey: `${baseKey}.avif`,
            mimeType: 'image/avif',
            altText: 'Портрет Ани',
            instructorId: 'ins-1',
            sortOrder: 3,
            uploadedById: 'admin-1',
          }),
        }),
      );
    });

    it('отвечает ссылкой на мастер, размерами и пресетом', async () => {
      const response = await POST(upload(instructorFields));

      const baseKey = mediaPaths.instructorPhoto('ins-1', FILE_ID);
      expect(await response.json()).toEqual({
        id: 'asset-1',
        url: `/media-proxy/${baseKey}.avif`,
        width: 800,
        height: 1000,
        bytes: 1234,
        preset: 'instructorCard',
      });
    });

    it('записывает аудит с автором, владельцем и адресом клиента', async () => {
      await POST(upload(instructorFields));

      expect(mocks.recordAudit).toHaveBeenCalledWith({
        actor: CALLER,
        action: 'admin.media.upload',
        entityType: 'MediaAsset',
        entityId: 'asset-1',
        after: { storageKey: ASSET.storageKey, owner: 'instructorId', ownerId: 'ins-1' },
        ipAddress: 'client-1',
      });
    });

    it('сохраняет фокус в формате «N% N%»', async () => {
      await POST(upload({ ...instructorFields, focalPoint: '50% 30%' }));

      expect(mocks.db.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ focalPoint: '50% 30%' }) }),
      );
    });

    it('отбрасывает фокус в любом другом формате', async () => {
      await POST(upload({ ...instructorFields, focalPoint: 'left top' }));

      const [args] = mocks.db.mediaAsset.create.mock.calls[0] ?? [];
      expect(args.data).not.toHaveProperty('focalPoint');
    });

    it('для роли с одним кадром использует upsert, а не create', async () => {
      const response = await POST(upload({ kind: 'courseCover', altText: 'Обложка курса', courseId: 'course-1' }));

      expect(response.status).toBe(200);
      expect(mocks.db.mediaAsset.create).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { courseId: 'course-1' },
          update: expect.objectContaining({ deletedAt: null }),
          create: expect.objectContaining({ courseId: 'course-1', sortOrder: 0, uploadedById: 'admin-1' }),
        }),
      );
    });

    it.each([
      { kind: 'courseCover', owner: 'courseId', model: 'course', data: { coverKey: null } },
      { kind: 'blogCover', owner: 'blogPostId', model: 'blogPost', data: { coverKey: null, coverAlt: null } },
      { kind: 'bannerImage', owner: 'bannerId', model: 'banner', data: { imageKey: null } },
      { kind: 'avatar', owner: 'avatarOwnerId', model: 'user', data: { avatarKey: null } },
    ] as const)('после записи сбрасывает строковый ключ модели $model', async ({ kind, owner, model, data }) => {
      const response = await POST(upload({ kind, altText: 'Текст', [owner]: 'owner-1' }));

      expect(response.status).toBe(200);
      expect(mocks.db[model].update).toHaveBeenCalledWith({ where: { id: 'owner-1' }, data });
    });

    it('при замене обновляет существующую строку и не создаёт новую', async () => {
      mocks.db.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-old',
        sortOrder: 0,
        purpose: null,
        focalPoint: null,
      });

      const response = await POST(
        upload({ kind: 'venuePhoto', altText: 'Зал', roomId: 'room-1', replaceAssetId: 'asset-old' }),
      );

      expect(response.status).toBe(200);
      expect(mocks.db.mediaAsset.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'asset-old', roomId: 'room-1' } }),
      );
      expect(mocks.db.mediaAsset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asset-old' },
          data: expect.objectContaining({ storageKey: `${mediaPaths.studioPhoto('room-1', FILE_ID)}.avif` }),
        }),
      );
      expect(mocks.db.mediaAsset.create).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.upsert).not.toHaveBeenCalled();
    });

    it('чужой кадр нельзя заменить: поиск по владельцу его не находит, загрузка идёт как новая', async () => {
      mocks.db.mediaAsset.findFirst.mockResolvedValue(null);

      const response = await POST(
        upload({ kind: 'venuePhoto', altText: 'Зал', roomId: 'room-1', replaceAssetId: 'asset-of-other-room' }),
      );

      expect(response.status).toBe(200);
      expect(mocks.db.mediaAsset.update).not.toHaveBeenCalled();
      expect(mocks.db.mediaAsset.create).toHaveBeenCalledTimes(1);
    });

    it('при сбое хранилища отвечает 500 без деталей и не пишет строку', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.putMediaObject.mockRejectedValue(new Error('R2 unavailable'));

      const response = await POST(upload(instructorFields));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'INTERNAL' });
      expect(mocks.db.mediaAsset.create).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('[api/media/upload]', expect.any(Error));
    });
  });
});
