/**
 * Согласия при брони (D-03) для мобильного приложения. Модуль без React Native и Expo, поэтому
 * тесты идут в Node. Зеркалит `src/domain/booking/consent-form.ts` и `src/config/consents.ts` веба.
 * Сервер проверяет всё заново и остаётся источником истины: здесь только то, что нужно экрану брони.
 */

/** Согласия из `src/config/consents.ts` (`bookingConsentIds`). */
export type BookingConsentId = 'healthWaiver' | 'shootingConsent' | 'minorParentalConsent';

/** Предметы брони, как `BookingSubject` в Prisma. */
export type BookingSubject = 'CLASS_SESSION' | 'PRIVATE_SESSION' | 'STUDIO_RENTAL' | 'EVENT_TICKET';

/** Тип занятия класса из `GET /api/booking/sessions`. */
export type LessonType = 'GROUP' | 'PRIVATE' | 'PAIR';

/** Поля, которые сервер может отвергнуть из-за согласий. */
export type ConsentField = 'consents' | 'participantBirthDate';

/** Ответ `GET /api/booking/consents`: снимок правил из `bookingConsentsSnapshot`. */
export type BookingConsentRules = {
  /** С этого возраста участник считается взрослым. */
  adultAgeYears: number;
  /** Согласия, которые добавляются для участника младше `adultAgeYears`. */
  minorConsents: BookingConsentId[];
  /** Согласия, которые требует бронь предмета. Нет ключа или пустой список — правила нет. */
  subjects: Partial<Record<BookingSubject, BookingConsentId[]>>;
  /** Согласия, тексты которых пока черновик. */
  draft: BookingConsentId[];
};

/** Состояние формы согласий на экране брони. */
export type BookingConsentForm = {
  /** У предмета есть правило: нужны дата рождения и согласия. */
  active: boolean;
  /** Полных лет участнику; null, если дата пуста или некорректна. */
  age: number | null;
  /** Введена полная дата (10 символов), но она не проходит проверку. */
  birthDateInvalid: boolean;
  /** Согласия, которые спрашиваются у этого участника. */
  ids: BookingConsentId[];
  /** Отмеченные согласия из `ids`, в порядке `ids`. */
  acceptedIds: BookingConsentId[];
  /** Хотя бы один текст из `ids` ещё черновик. */
  draft: boolean;
  /** Бронь можно отправить: правила нет или возраст известен и отмечено всё нужное. */
  ready: boolean;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Старше этого возраста дата считается ошибкой ввода; совпадает с проверкой на сервере. */
const MAX_AGE_YEARS = 120;

/**
 * Полные годы участника на дату `today` (`YYYY-MM-DD`). Сравнение идёт по календарным датам без
 * времени и часовых поясов. Экран передаёт сегодняшнюю дату площадки (Ереван), как сервер.
 * Возвращает null, если формат не `YYYY-MM-DD`, такой даты нет (например, 30 февраля), дата в будущем
 * или возраст больше 120 лет.
 */
export function birthDateToAge(birthDate: string, today: string): number | null {
  const match = ISO_DATE.exec(birthDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  if (birthDate > today) return null;
  let age = Number(today.slice(0, 4)) - year;
  // В одном формате `YYYY-MM-DD` строковое сравнение совпадает с порядком дат.
  if (today.slice(5) < birthDate.slice(5)) age -= 1;
  return age > MAX_AGE_YEARS ? null : age;
}

/** Есть ли у предмета правило согласий. Без правила поля не показываются, тело брони не меняется. */
export function isConsentActive(rules: BookingConsentRules | null, subject: BookingSubject): boolean {
  return (rules?.subjects[subject]?.length ?? 0) > 0;
}

/** Согласия, которые требует бронь предмета: взрослому — базовые, младшему — ещё родительское. */
export function consentsForSubject(rules: BookingConsentRules, subject: BookingSubject, isMinor: boolean): BookingConsentId[] {
  const base = rules.subjects[subject] ?? [];
  if (base.length === 0) return [];
  return isMinor ? base.concat(rules.minorConsents.filter((id) => !base.includes(id))) : [...base];
}

/**
 * Состояние формы согласий. `rules` = null (ещё не загружены): правила нет, сервер проверит бронь сам.
 * Ошибку даты показываем только для полной строки (10 символов), чтобы она не мигала во время ввода.
 */
export function bookingConsentForm(input: {
  rules: BookingConsentRules | null;
  subject: BookingSubject;
  birthDate: string;
  checked: readonly BookingConsentId[];
  today: string;
}): BookingConsentForm {
  const { rules, subject, birthDate, checked, today } = input;
  if (rules === null || !isConsentActive(rules, subject)) {
    return { active: false, age: null, birthDateInvalid: false, ids: [], acceptedIds: [], draft: false, ready: true };
  }
  const age = birthDateToAge(birthDate, today);
  const ids = age === null ? [] : consentsForSubject(rules, subject, age < rules.adultAgeYears);
  const acceptedIds = ids.filter((id) => checked.includes(id));
  return {
    active: true,
    age,
    birthDateInvalid: birthDate.length === 10 && age === null,
    ids,
    acceptedIds,
    draft: ids.some((id) => rules.draft.includes(id)),
    ready: age !== null && ids.length > 0 && acceptedIds.length === ids.length,
  };
}

/** Поля тела брони (`/api/booking`, `/api/booking/recurring`). Пусто, пока правила нет: тело остаётся прежним. */
export function buildConsentBody(
  form: BookingConsentForm,
  birthDate: string,
): { consents?: BookingConsentId[]; participantBirthDate?: string } {
  return form.active ? { consents: [...form.acceptedIds], participantBirthDate: birthDate } : {};
}

/** Поле, которое сервер отверг из-за согласий; null, если ошибка не о согласиях. */
export function consentErrorField(field: string | null | undefined): ConsentField | null {
  return field === 'consents' || field === 'participantBirthDate' ? field : null;
}

/**
 * Предмет брони, как на сервере: слот без `sessionId` — частное занятие; слот класса — занятие,
 * кроме класса типа PRIVATE.
 */
export function bookingSubjectFor(slot: { sessionId?: string }, lessonType: LessonType | null): BookingSubject {
  if (slot.sessionId === undefined) return 'PRIVATE_SESSION';
  return lessonType === 'PRIVATE' ? 'PRIVATE_SESSION' : 'CLASS_SESSION';
}
