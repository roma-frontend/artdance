import { describe, expect, it } from 'vitest';

import { uploadPolicies } from '@/config/security';

import { exceedsDeclaredSize, safeObjectName, validateUpload } from './uploads';

const valid = {
  fileName: 'anna-portrait.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 400_000,
  kind: 'instructorPhoto' as const,
};

describe('validateUpload', () => {
  it('пропускает корректный файл', () => {
    expect(validateUpload(valid)).toEqual({ ok: true });
  });

  it('отклоняет превышение размера политики', () => {
    const result = validateUpload({ ...valid, sizeBytes: uploadPolicies.instructorPhoto.maxBytes + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('FILE_TOO_LARGE');
  });

  it('отклоняет неразрешённый MIME', () => {
    const result = validateUpload({ ...valid, mimeType: 'application/x-msdownload' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('UNSUPPORTED_TYPE');
  });

  it('игнорирует параметры после точки с запятой в MIME', () => {
    expect(validateUpload({ ...valid, mimeType: 'image/jpeg; charset=binary' })).toEqual({ ok: true });
  });

  it('отклоняет подделку расширения при валидном MIME', () => {
    /** Классическая атака: MIME честный, имя — исполняемое. */
    const result = validateUpload({ ...valid, fileName: 'payload.php' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('UNSUPPORTED_EXTENSION');
  });

  it('отклоняет path traversal в имени файла', () => {
    for (const fileName of ['../../etc/passwd.jpg', 'a/b.jpg', 'a\\b.jpg', '.hidden.jpg']) {
      const result = validateUpload({ ...valid, fileName });
      expect(result.ok, fileName).toBe(false);
      if (!result.ok) expect(result.rejection.code).toBe('INVALID_FILE_NAME');
    }
  });

  it('отклоняет имя без расширения', () => {
    const result = validateUpload({ ...valid, fileName: 'portrait' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('UNSUPPORTED_EXTENSION');
  });

  it('соблюдает лимит числа файлов на сущность', () => {
    const result = validateUpload({
      ...valid,
      existingCount: uploadPolicies.instructorPhoto.maxPerEntity,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.code).toBe('TOO_MANY_FILES');
  });

  it('видео допускается только там, где политика это разрешает', () => {
    const asVideo = { fileName: 'lesson.mp4', mimeType: 'video/mp4', sizeBytes: 1_000_000 };
    expect(validateUpload({ ...asVideo, kind: 'courseVideo' })).toEqual({ ok: true });
    expect(validateUpload({ ...asVideo, kind: 'productImage' }).ok).toBe(false);
  });
});

describe('exceedsDeclaredSize', () => {
  it('отсекает по Content-Length до чтения тела', () => {
    const max = uploadPolicies.courseVideo.maxBytes;
    expect(exceedsDeclaredSize(String(max + 5 * 1024 * 1024), 'courseVideo')).toBe(true);
    expect(exceedsDeclaredSize(String(max - 1), 'courseVideo')).toBe(false);
  });

  it('не блокирует запрос без заголовка', () => {
    expect(exceedsDeclaredSize(null, 'avatar')).toBe(false);
  });
});

describe('safeObjectName', () => {
  it('сохраняет только расширение — имя пользователя не становится ключом', () => {
    expect(safeObjectName('../../evil.JPG', 'abc123')).toBe('abc123.jpg');
  });

  it('без расширения даёт нейтральное .bin', () => {
    expect(safeObjectName('no-extension', 'abc123')).toBe('abc123.bin');
  });

  it('вычищает небезопасные символы из расширения', () => {
    expect(safeObjectName('file.jp g;', 'id1')).toBe('id1.jpg');
  });
});
