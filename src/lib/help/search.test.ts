import { describe, expect, it } from 'vitest';

import { MIN_HELP_QUERY_LENGTH, normalizeHelpQuery, searchHelp } from './search';

const topics = [
  { id: 'booking', title: 'Брони и занятия', body: 'Лист ожидания и перенос занятия.' },
  { id: 'payments', title: 'Оплата и возвраты', body: 'Способы оплаты и сроки возврата.' },
  { id: 'rules', title: 'Правила', body: 'Всё о правилах зала.' },
];

const faq = [
  {
    groupId: 'cancellation',
    question: 'Можно отменить бронь?',
    answer: 'Отмена за 24 часа — возврат полный.',
  },
  {
    groupId: 'booking',
    question: 'Мест нет. Что делать?',
    answer: 'Встаньте в лист ожидания.',
  },
];

describe('normalizeHelpQuery', () => {
  it('приводит регистр, ё и пробелы к одному виду', () => {
    expect(normalizeHelpQuery('  ЁЛКА   Перенос ')).toBe('елка перенос');
  });

  it('сводит полноширинные латинские буквы к обычным', () => {
    expect(normalizeHelpQuery('ＦＡＱ')).toBe('faq');
  });
});

describe('searchHelp', () => {
  it('короче порога ничего не ищет', () => {
    expect(MIN_HELP_QUERY_LENGTH).toBe(2);
    expect(searchHelp('а', topics, faq)).toEqual({ topics: [], faq: [] });
    expect(searchHelp('   ', topics, faq)).toEqual({ topics: [], faq: [] });
  });

  it('находит тему по заголовку без учёта регистра', () => {
    expect(searchHelp('ОПЛАТА', topics, faq).topics.map((topic) => topic.id)).toEqual(['payments']);
  });

  it('ищет и по тексту темы, не только по заголовку', () => {
    expect(searchHelp('ожидания', topics, faq).topics.map((topic) => topic.id)).toEqual(['booking']);
  });

  it('требует совпадения всех слов', () => {
    expect(searchHelp('отмена перенос', topics, faq)).toEqual({ topics: [], faq: [] });
  });

  it('слова могут стоять в вопросе и в ответе одной записи', () => {
    const result = searchHelp('отменить возврат', topics, faq);
    expect(result.faq.map((entry) => entry.groupId)).toEqual(['cancellation']);
    expect(result.topics).toEqual([]);
  });

  it('ё и е не различаются', () => {
    expect(searchHelp('ВСЁ', topics, faq).topics.map((topic) => topic.id)).toEqual(['rules']);
  });

  it('ищет по армянскому тексту без учёта регистра', () => {
    const armenian = [{ id: 'hy', title: 'Չեղարկում', body: '' }];
    expect(searchHelp('չեղարկում', armenian, []).topics.map((topic) => topic.id)).toEqual(['hy']);
  });

  it('без совпадений отдаёт пустые списки', () => {
    expect(searchHelp('несуществующее', topics, faq)).toEqual({ topics: [], faq: [] });
  });

  it('отдаёт исходные объекты, а не копии', () => {
    const result = searchHelp('лист ожидания', topics, faq);
    expect(result.topics[0]).toBe(topics[0]);
    expect(result.faq[0]).toBe(faq[1]);
  });
});
