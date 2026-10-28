/**
 * Тестовые карты заглушки оплаты (mock). Номера публичные, как в документации Stripe:
 * они ничего не списывают и не имеют смысла вне тестового контура.
 *
 * Исход выбирает клиент и отправляет на сервер как `scenario`. Номер карты на сервер не уходит.
 */

export type TestCardScenario = 'success' | 'declined';

const SCENARIOS = new Map<string, TestCardScenario>([
  ['4242424242424242', 'success'],
  ['4000000000000002', 'declined'],
]);

/** Исход для номера тестовой карты или `null`, если номер не из списка. Пробелы и дефисы игнорируются. */
export function testCardScenario(cardNumber: string): TestCardScenario | null {
  return SCENARIOS.get(cardNumber.replace(/\D/g, '')) ?? null;
}
