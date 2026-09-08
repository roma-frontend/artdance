-- Ресурс расписания — ровно один: либо инструктор, либо зал.
--
-- Prisma не умеет выражать это в схеме, поэтому ограничение объявляется здесь.
-- Комментарий в `schema.prisma` обещает CHECK-констрейнт — вот он. Без него в
-- таблицу попадает строка, у которой не заполнен ни один ресурс (правило,
-- которое ни к кому не относится, — невидимая дыра в расписании) или заполнены
-- оба сразу (правило, которое принадлежит и инструктору, и залу, и потому
-- считается дважды при вычислении свободных слотов).
--
-- Приложение проверяет то же самое раньше и с понятной ошибкой; база — последняя
-- линия защиты, которая действует и для ручного SQL, и для миграции данных.

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_resource_check"
  CHECK (("instructorId" IS NULL) <> ("roomId" IS NULL));

ALTER TABLE "AvailabilityException"
  ADD CONSTRAINT "AvailabilityException_resource_check"
  CHECK (("instructorId" IS NULL) <> ("roomId" IS NULL));

ALTER TABLE "PriceOption"
  ADD CONSTRAINT "PriceOption_resource_check"
  CHECK (("instructorId" IS NULL) <> ("roomId" IS NULL));

-- Удержание слота держит ровно один ресурс. `sessionId` в проверку не входит:
-- он уточняет, ЧТО бронируется в этом слоте (конкретное проведение занятия), а
-- ресурс — ЧЕЙ это слот. Уникальные индексы `(instructorId, startsAt)` и
-- `(roomId, startsAt)` работают только при одном заполненном ресурсе: с двумя
-- одна и та же попытка занимала бы два слота и снимала бы защиту от гонки.
ALTER TABLE "SlotHold"
  ADD CONSTRAINT "SlotHold_resource_check"
  CHECK (("instructorId" IS NULL) <> ("roomId" IS NULL));

-- Удержание принадлежит либо пользователю, либо анонимной сессии корзины, но не
-- обоим и не никому: удержание без владельца невозможно освободить адресно, а с
-- двумя владельцами непонятно, кому принадлежит слот при слиянии корзин.
ALTER TABLE "SlotHold"
  ADD CONSTRAINT "SlotHold_owner_check"
  CHECK (("userId" IS NULL) <> ("anonymousId" IS NULL));

-- Отзыв относится ровно к одной сущности. Без этого один отзыв показывается и у
-- инструктора, и у товара, и средние оценки начинают считаться по чужим отзывам.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_target_check"
  CHECK (
    (CASE WHEN "instructorId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "classId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "courseId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "productId" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "venueId" IS NULL THEN 0 ELSE 1 END)
    = 1
  );

-- Оценка в границах шкалы. Шкала — коммерческое решение (`reviews.minRating` /
-- `maxRating`), но диапазон 1..5 зафиксирован в схеме как тип данных: изменение
-- шкалы потребует миграции, и это правильно — старые отзывы придётся пересчитать.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range_check"
  CHECK ("rating" BETWEEN 1 AND 5);
