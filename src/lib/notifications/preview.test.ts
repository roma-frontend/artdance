import { describe, expect, it } from 'vitest';

import { notificationTypes } from '@/config/notifications';
import { locales } from '@/i18n/config';
import { buildPreview } from '@/lib/notifications/preview';

/** Неподставленный плейсхолдер `{key}`: значит, в превью нет данных для шаблона. */
const LEFTOVER = /\{\w+\}/;

describe('buildPreview: каждый шаблон уведомления на каждом языке', () => {
  for (const type of notificationTypes) {
    for (const locale of locales) {
      it(`${type} (${locale}) заполнен и без плейсхолдеров`, async () => {
        const content = await buildPreview(type, locale);
        const texts = [content.subject, content.heading, ...content.paragraphs, content.action?.label, content.footnote].filter(
          (text): text is string => typeof text === 'string',
        );

        expect(content.subject.trim()).not.toBe('');
        expect(content.heading.trim()).not.toBe('');
        expect(content.paragraphs.length).toBeGreaterThan(0);
        for (const text of texts) {
          expect(text).not.toMatch(LEFTOVER);
        }
      });
    }
  }
});
