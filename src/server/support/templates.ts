import 'server-only';

import { z } from 'zod';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { locales, type Locale } from '@/i18n/config';

const id = z.string().trim().min(1).max(128);

export async function listTemplates(locale?: Locale) {
  await requireOperator();
  return db.supportTemplate.findMany({
    where: locale ? { locale } : {},
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, title: true, body: true, locale: true, createdAt: true, createdById: true },
  });
}

export async function createTemplate(input: { title: string; body: string; locale: Locale }) {
  const caller = await requireOperator();
  const title = z.string().trim().min(2).max(120).parse(input.title);
  const body = z.string().trim().min(5).max(8000).parse(input.body);
  const locale = z.enum(locales as unknown as [string, ...string[]]).parse(input.locale) as Locale;
  return db.supportTemplate.create({
    data: { title, body, locale, createdById: caller.id },
    select: { id: true, title: true, body: true, locale: true },
  });
}

export async function updateTemplate(input: { id: string; title: string; body: string; locale: Locale }) {
  await requireOperator();
  const tid = id.parse(input.id);
  const title = z.string().trim().min(2).max(120).parse(input.title);
  const body = z.string().trim().min(5).max(8000).parse(input.body);
  const locale = z.enum(locales as unknown as [string, ...string[]]).parse(input.locale) as Locale;
  return db.supportTemplate.update({ where: { id: tid }, data: { title, body, locale } });
}

export async function deleteTemplate(input: { id: string }) {
  await requireOperator();
  const tid = id.parse(input.id);
  await db.supportTemplate.delete({ where: { id: tid } });
  return { deleted: true };
}
