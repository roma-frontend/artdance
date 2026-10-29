import { describe, expect, it } from 'vitest';

import type { NotificationType } from '@/config/notifications';
import { renderEmail } from '@/lib/notifications/render';

const HREF = 'https://example.test/en/cart';

const cases: Array<[NotificationType, string]> = [
  ['cart.abandoned', 'Your cart is waiting'],
  ['onboarding.welcome', 'Welcome to ArtDance'],
  ['onboarding.howToBook', 'How to book your first class'],
  ['onboarding.bonus', 'A bonus for inviting friends'],
];

describe('renderEmail: корзина и онбординг', () => {
  it.each(cases)('%s рисуется своими ключами и ведёт на переданную ссылку', async (type, subject) => {
    const rendered = await renderEmail({ type, locale: 'en', data: { href: HREF } });

    expect(rendered.subject).toBe(subject);
    expect(rendered.paragraphs).toHaveLength(1);
    expect(rendered.ctaLabel).toBeTruthy();
    expect(rendered.ctaHref).toBe(HREF);
  });
});

describe('renderEmail: сохранённый поиск', () => {
  it('тема называет запрос, тело — число и пример, кнопка ведёт на поиск', async () => {
    const rendered = await renderEmail({
      type: 'savedSearch.match',
      locale: 'en',
      data: { query: 'salsa', count: 3, title: 'Salsa Basics', href: HREF },
    });

    expect(rendered.subject).toBe('New matches for "salsa"');
    expect(rendered.heading).toBe('You have new matches');
    expect(rendered.paragraphs).toEqual([
      'New matches: 3. For example: Salsa Basics. Open the search to see all of them.',
    ]);
    expect(rendered.ctaLabel).toBe('Open search');
    expect(rendered.ctaHref).toBe(HREF);
  });
});

describe('renderEmail: лист ожидания', () => {
  it('en: тема, заголовок и кнопка из каталога, срок подставлен', async () => {
    const rendered = await renderEmail({
      type: 'waitlist.ready',
      locale: 'en',
      data: { when: '15 Jun 2030, 18:00', href: HREF },
    });

    expect(rendered.subject).toBe('Your waitlist spot is ready');
    expect(rendered.heading).toBe('A spot is free for you');
    expect(rendered.paragraphs).toEqual(['A spot opened up. Claim it before 15 Jun 2030, 18:00.']);
    expect(rendered.ctaLabel).toBe('Claim spot');
    expect(rendered.ctaHref).toBe(HREF);
  });

  it('ru: тема на русском, без латиницы и без незаполненных плейсхолдеров', async () => {
    const rendered = await renderEmail({
      type: 'waitlist.ready',
      locale: 'ru',
      data: { when: '15 июн. 2030 г., 18:00', href: HREF },
    });

    expect(rendered.subject).not.toMatch(/[A-Za-z]/);
    expect(rendered.paragraphs.join(' ')).not.toContain('{');
  });
});
