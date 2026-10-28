/** Тестовые карты заглушки (Expo Go и mock). Номер карты на сервер не уходит: только сценарий. */
export type TestScenario = 'success' | 'declined';

/** Значения полей тестовой карты в том виде, в каком их видит пользователь. */
export type TestCardValues = { number: string; expiry: string; cvc: string };

const SUCCESS_CARD = '4242424242424242';
const DECLINED_CARD = '4000000000000002';

/** Сценарий по номеру тестовой карты или null, если карта не тестовая. Пробелы в номере допустимы. */
export function testCardScenario(number: string): TestScenario | null {
  const digits = number.replace(/\D/g, '');
  if (digits === SUCCESS_CARD) return 'success';
  if (digits === DECLINED_CARD) return 'declined';
  return null;
}

/** Номер группами по четыре цифры, не длиннее шестнадцати цифр. */
export function formatCardNumber(input: string): string {
  return input
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** Срок в формате ММ/ГГ: не больше четырёх цифр, косая черта ставится сама. */
export function formatExpiry(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Срок заполнен полностью (месяц от 01 до 12), CVC содержит три или четыре цифры. */
export function isCardDetailsComplete(values: TestCardValues): boolean {
  const expiry = values.expiry.replace(/\D/g, '');
  const month = Number(expiry.slice(0, 2));
  const cvc = values.cvc.replace(/\D/g, '');
  return expiry.length === 4 && month >= 1 && month <= 12 && (cvc.length === 3 || cvc.length === 4);
}
