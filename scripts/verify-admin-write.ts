/**
 * Проверка пути записи админки на живой базе.
 *
 * В `npm run verify` не входит и входить не может: нужна поднятая база. Смысл
 * отдельной команды тот же, что у `verify:auth` — проверить то, что не проверяет
 * ни компилятор, ни модульный тест: приведения делегатов Prisma в `registry.ts`,
 * запись переводов и совпадение имён полей формы с колонками.
 *
 * Так нашлись две ошибки: `null` в NOT NULL колонку с default (промокод не
 * создавался вовсе) и пустая строка в колонку `String[]` (занятие не сохранялось
 * при незаполненном списке на одном из языков).
 *
 * Запуск: npm run verify:admin
 *
 * Свои записи проверка создаёт и удаляет; чужих не касается.
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

function ok(label: string, condition: boolean, detail?: unknown): void {
  console.log(`${condition ? 'OK ' : '!! '}${label}${detail === undefined ? '' : ` — ${String(detail)}`}`);
  if (!condition) process.exitCode = 1;
}

async function main(): Promise<void> {
  const { adminResourceSpecs } = await import('../src/config/admin.ts');
  const { emptyValues, translationFieldName } = await import('../src/domain/admin/schema.ts');
  const registry = await import('../src/server/admin/registry.ts');
  const trash = await import('../src/server/admin/trash.ts');
  const { purgeCutoff } = await import('../src/domain/trash.ts');
  const { db } = await import('../src/lib/db.ts');

  /* Хвосты предыдущего прогона: проверка должна начинаться с чистого места. */
  await db.promoCode.deleteMany({ where: { code: { in: ['SMOKE-TEST-WRITE', 'SMOKE-TEST-STALE'] } } });
  await db.danceClass.deleteMany({ where: { slug: 'smoke-test-write-class' } });

  /* ─── 1. Ресурс без переводов: promo-codes ─── */

  const promoValues = {
    ...emptyValues(adminResourceSpecs['promo-codes']),
    code: 'SMOKE-TEST-WRITE',
    type: 'PERCENT',
    value: 15,
    usageLimit: 10,
    isActive: true,
  };

  const promoId = await registry.createResource('promo-codes', promoValues);
  ok('promo-codes: create', typeof promoId === 'string' && promoId.length > 0, promoId);

  const promoRead = await registry.getResourceValues('promo-codes', promoId);
  ok('promo-codes: read', promoRead?.code === 'SMOKE-TEST-WRITE', promoRead?.code);
  ok('promo-codes: число сохранено числом', promoRead?.value === 15, promoRead?.value);

  const promoList = await registry.listResource('promo-codes', { q: 'SMOKE-TEST', page: 1 });
  ok('promo-codes: list + поиск', promoList.rows.some((row) => row.id === promoId), promoList.total);

  await registry.updateResource('promo-codes', promoId, { ...promoValues, value: 20, isActive: false });
  const promoAfter = await registry.getResourceValues('promo-codes', promoId);
  ok('promo-codes: update', promoAfter?.value === 20 && promoAfter?.isActive === false, promoAfter?.value);

  const snapshot = await registry.resourceSnapshot('promo-codes', promoId);
  ok('promo-codes: снимок для аудита', snapshot !== null && 'code' in snapshot);

  await registry.deleteResource('promo-codes', promoId);
  ok('promo-codes: delete', (await registry.getResourceValues('promo-codes', promoId)) === null);
  /* Проверка не оставляет за собой мусора даже в корзине. */
  await trash.purgeFromTrash('promo-codes', promoId);

  /* ─── 2. Ресурс с переводами и связью: classes ─── */

  const instructor = await db.instructorProfile.findFirst({ select: { id: true } });
  if (!instructor) throw new Error('в базе нет инструкторов — сначала npm run db:seed');

  const options = await registry.relationOptions('instructors');
  ok('relationOptions: инструкторы', options.some((option) => option.value === instructor.id), options.length);

  const classValues = {
    ...emptyValues(adminResourceSpecs.classes),
    slug: 'smoke-test-write-class',
    title: 'Փորձնական դաս',
    description: 'Ստուգում է գրելու ուղին։',
    learningPoints: ['քայլ մեկ', 'քայլ երկու'],
    instructorId: instructor.id,
    style: 'SALSA',
    level: 'BEGINNER',
    durationMinutes: 60,
    price: 6000,
    capacity: 12,
    isActive: true,
    [translationFieldName('title', 'ru')]: 'Тестовое занятие',
    [translationFieldName('description', 'ru')]: 'Проверяет путь записи.',
    [translationFieldName('learningPoints', 'ru')]: ['шаг один', 'шаг два'],
    [translationFieldName('title', 'en')]: 'Smoke test class',
    [translationFieldName('description', 'en')]: 'Exercises the write path.',
  };

  const classId = await registry.createResource('classes', classValues);
  ok('classes: create', typeof classId === 'string' && classId.length > 0, classId);

  const translations = await db.danceClassTranslation.findMany({
    where: { classId },
    select: { locale: true, title: true, learningPoints: true },
    orderBy: { locale: 'asc' },
  });
  ok('classes: переводы записаны', translations.length === 2, translations.map((t) => t.locale).join(','));
  ok(
    'classes: русский заголовок',
    translations.find((t) => t.locale === 'ru')?.title === 'Тестовое занятие',
    translations.find((t) => t.locale === 'ru')?.title,
  );
  ok(
    'classes: список строк в переводе',
    translations.find((t) => t.locale === 'ru')?.learningPoints.length === 2,
  );

  const classRead = await registry.getResourceValues('classes', classId);
  ok('classes: чтение переводов в форму', classRead?.[translationFieldName('title', 'en')] === 'Smoke test class');
  ok('classes: деньги целым числом', classRead?.price === 6000, classRead?.price);

  const classList = await registry.listResource('classes', { q: 'smoke', page: 1 });
  const listedRow = classList.rows.find((row) => row.id === classId);
  ok('classes: list со связью', listedRow !== undefined && listedRow.instructorName !== null);

  /* Пустой перевод должен удалить строку, а не записать пустую. */
  await registry.updateResource('classes', classId, {
    ...classValues,
    [translationFieldName('title', 'en')]: '',
    [translationFieldName('description', 'en')]: '',
  });
  const afterBlank = await db.danceClassTranslation.findMany({ where: { classId }, select: { locale: true } });
  ok('classes: пустой перевод удалён', afterBlank.length === 1, afterBlank.map((t) => t.locale).join(','));

  /*
   * Удаление занятия — теперь перенос в корзину: запись исчезает из чтений, но
   * остаётся восстановимой. Переводы каскадом НЕ уходят: каскад срабатывает при
   * настоящем удалении, а его выполняет окончательное удаление из корзины.
   */
  await registry.deleteResource('classes', classId);
  ok('classes: удаление уводит в корзину', (await registry.getResourceValues('classes', classId)) === null);
  ok('classes: запись видна в корзине', (await trash.trashedSnapshot('classes', classId)) !== null);

  await trash.restoreFromTrash('classes', classId);
  ok('classes: восстановление возвращает', (await registry.getResourceValues('classes', classId)) !== null);

  await registry.deleteResource('classes', classId);
  await trash.purgeFromTrash('classes', classId);
  ok(
    'classes: окончательное удаление уносит переводы каскадом',
    (await db.danceClassTranslation.count({ where: { classId } })) === 0,
  );

  /* ─── 3. Корзина: срок хранения и счётчики ─── */

  const staleId = await registry.createResource('promo-codes', {
    ...promoValues,
    code: 'SMOKE-TEST-STALE',
  });

  await registry.deleteResource('promo-codes', staleId);

  const counts = await trash.trashCounts();
  ok('корзина: счётчик раздела', (counts['promo-codes'] ?? 0) >= 1, JSON.stringify(counts));

  const trashPage = await trash.listTrash('promo-codes', 1);
  ok(
    'корзина: запись в списке с названием',
    trashPage.entries.some((entry) => entry.id === staleId && entry.label === 'SMOKE-TEST-STALE'),
    trashPage.total,
  );

  /* Сдвигаем дату удаления за срок хранения и проверяем чистку. */
  await db.promoCode.update({
    where: { id: staleId },
    data: { deletedAt: purgeCutoff(new Date()) },
  });

  const report = await trash.purgeExpiredTrash(new Date());
  ok('корзина: просроченное стёрто', (report.purged['promo-codes'] ?? 0) >= 1, JSON.stringify(report.purged));
  ok(
    'корзина: запись действительно исчезла',
    (await db.promoCode.count({ where: { code: 'SMOKE-TEST-STALE' } })) === 0,
  );

  await db.$disconnect();
  console.log(process.exitCode ? 'ЕСТЬ ОШИБКИ' : 'путь записи админки работает');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
