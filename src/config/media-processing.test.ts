import { describe, expect, it } from 'vitest';

import { variantKey } from './media-processing';

describe('variantKey', () => {
  it('ставит дефис между базовым ключом и шириной, точку — перед форматом', () => {
    expect(variantKey('instructors/ins-1/abc', 420, 'avif')).toBe('instructors/ins-1/abc-420.avif');
  });

  it('WebP получает имя по той же схеме', () => {
    expect(variantKey('instructors/ins-1/abc', 420, 'webp')).toBe('instructors/ins-1/abc-420.webp');
  });

  it('JPEG аватара — тот же шаблон с расширением .jpeg', () => {
    expect(variantKey('avatars/user-1/abc', 512, 'jpeg')).toBe('avatars/user-1/abc-512.jpeg');
  });

  it('не использует слэш перед шириной: такой ключ не совпал бы с уже записанными объектами', () => {
    expect(variantKey('instructors/ins-1/abc', 420, 'avif')).not.toContain('/420');
  });
});
