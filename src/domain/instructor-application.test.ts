import { describe, expect, it } from 'vitest';

import {
  instructorApplicationSchema,
  isApplicationDocumentKind,
  sniffDocumentMime,
} from '@/domain/instructor-application';

const validFields = {
  name: 'Анна Петрова',
  email: 'Anna@Example.com ',
  phone: '+37499000000',
  bio: 'Преподаю бачату и сальсу более пяти лет.',
  styles: ['BACHATA', 'SALSA'],
};

describe('instructorApplicationSchema', () => {
  it('принимает корректную заявку и нормализует email', () => {
    const parsed = instructorApplicationSchema.parse(validFields);
    expect(parsed.email).toBe('anna@example.com');
  });

  it('требует хотя бы один стиль', () => {
    expect(instructorApplicationSchema.safeParse({ ...validFields, styles: [] }).success).toBe(false);
  });

  it('отклоняет неизвестный стиль', () => {
    expect(instructorApplicationSchema.safeParse({ ...validFields, styles: ['MOONWALK'] }).success).toBe(false);
  });

  it('требует биографию от 10 символов', () => {
    expect(instructorApplicationSchema.safeParse({ ...validFields, bio: 'коротко' }).success).toBe(false);
  });

  it('допускает пустой телефон, если поле не передано', () => {
    const { phone: _phone, ...withoutPhone } = validFields;
    expect(instructorApplicationSchema.safeParse(withoutPhone).success).toBe(true);
  });
});

describe('sniffDocumentMime', () => {
  it('распознаёт PDF по сигнатуре %PDF-', () => {
    expect(sniffDocumentMime(Buffer.from('%PDF-1.7 rest'))).toBe('application/pdf');
  });

  it('распознаёт JPEG, PNG и WEBP', () => {
    expect(sniffDocumentMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffDocumentMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
    expect(sniffDocumentMime(webp)).toBe('image/webp');
  });

  it('отклоняет файл с подменённым расширением или заголовком', () => {
    expect(sniffDocumentMime(Buffer.from('MZ\x90\x00 exe header'))).toBeNull();
    expect(sniffDocumentMime(Buffer.from('<html>'))).toBeNull();
  });

  it('не падает на коротком буфере', () => {
    expect(sniffDocumentMime(new Uint8Array([0xff]))).toBeNull();
    expect(sniffDocumentMime(new Uint8Array([]))).toBeNull();
  });
});

describe('isApplicationDocumentKind', () => {
  it('пропускает только известные виды документов', () => {
    expect(isApplicationDocumentKind('identity')).toBe(true);
    expect(isApplicationDocumentKind('diploma')).toBe(true);
    expect(isApplicationDocumentKind('certificate')).toBe(true);
    expect(isApplicationDocumentKind('selfie')).toBe(false);
  });
});
